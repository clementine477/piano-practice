/** Local recorded piano. Every attack owns a cancellable Web Audio source. */
export class SampledPiano {
  constructor(context, {baseURL=new URL('/soundfont/upright-kw/',globalThis.location.href), reverb=.12, onProgress}={}) {
    this.context=context;this.baseURL=baseURL;this.reverb=reverb;
    this.buffers=new Map();this.voices=new Set();this.ready=false;
    this.requests=new Map();this.pinned=new Set();this.resident=new Set();this.onProgress=onProgress;
    this.settings={brightness:0,room:reverb*100,tuning:440};
    this.stats={attacks:0,releases:0,peakVoices:0,missingSamples:0,fallbackSamples:0};
    this.makeBus();
  }
  configure({brightness=this.settings.brightness,room=this.settings.room,tuning=this.settings.tuning}={}) {
    const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
    this.settings={brightness:Math.max(-6,Math.min(6,finite(brightness,0))),room:Math.max(0,Math.min(30,finite(room,12))),tuning:Math.max(432,Math.min(446,finite(tuning,440)))};
    this.reverb=this.settings.room/100;
    const t=this.context.currentTime;
    this.tone.gain.setTargetAtTime(this.settings.brightness,t,.025);
    this.wet.gain.setTargetAtTime(this.reverb,t,.025);
    for(const voice of this.voices)for(const source of voice.nodes)source.playbackRate.setTargetAtTime(voice.baseRate*2**((voice.tune??0)/1200)*this.settings.tuning/440,t,.025);
  }
  makeBus() {
    const c=this.context;
    this.output=c.createGain();this.output.gain.value=1.3;
    this.input=c.createGain();this.tone=c.createBiquadFilter();this.tone.type='highshelf';this.tone.frequency.value=2200;this.tone.gain.value=this.settings.brightness;
    this.input.connect(this.tone);this.tone.connect(this.output);
    this.convolver=c.createConvolver();
    const impulse=c.createBuffer(2,Math.round(c.sampleRate*1.35),c.sampleRate);
    let seed=95;
    for(let ch=0;ch<2;ch++) {
      const d=impulse.getChannelData(ch);let smooth=0;
      for(let i=0;i<d.length;i++) {
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        smooth=.42*smooth+.58*(seed/2147483648-1);
        d[i]=i<c.sampleRate*.018?0:smooth*Math.exp(-i/(c.sampleRate*.27));
      }
    }
    this.convolver.buffer=impulse;
    this.wet=c.createGain();this.wet.gain.value=this.reverb;
    this.tone.connect(this.convolver);this.convolver.connect(this.wet);this.wet.connect(this.output);
    this.output.connect(c.destination);
  }
  sampleId(sample){return sample.id??`${sample.midi}:${sample.velocity}`;}
  async fetchSample(id) {
    if(this.disposed)throw new DOMException('Piano load cancelled','AbortError');
    if(this.buffers.has(id))return this.buffers.get(id);
    if(this.requests.has(id))return this.requests.get(id);
    const sample=this.entries.get(id);
    if(!sample)throw Error('Missing piano sample mapping: '+id);
    const request=(async()=>{
      const response=await fetch(new URL(sample.file.split('/').map(encodeURIComponent).join('/'),this.baseURL),{signal:this.loadController.signal});
      if(!response.ok)throw Error('Missing local piano sample: '+sample.file);
      const buffer=await this.context.decodeAudioData(await response.arrayBuffer());
      if(this.disposed)throw new DOMException('Piano load cancelled','AbortError');
      this.buffers.set(id,buffer);return buffer;
    })().finally(()=>this.requests.delete(id));
    this.requests.set(id,request);return request;
  }
  async ensureSamples(ids) {
    const pending=[...new Set(ids)].filter(id=>!this.buffers.has(id));
    const total=pending.length;let done=0;
    if(total)this.onProgress?.({loading:true,done,total});
    try{
      await Promise.all(Array.from({length:4},async()=>{
        while(pending.length){await this.fetchSample(pending.shift());this.onProgress?.({loading:true,done:++done,total});}
      }));
      this.onProgress?.({loading:false,done:total,total});
    }catch(error){if(error.name!=='AbortError')this.onProgress?.({loading:false,error:true});throw error;}
  }
  async load() {
    if(this.disposed)throw new DOMException('Piano load cancelled','AbortError');
    if(this.ready)return;
    if(this.loading)return this.loading;
    this.loading=(async()=>{
      this.loadController=new AbortController();
      const response=await fetch(new URL('manifest.json',this.baseURL),{signal:this.loadController.signal});
      if(!response.ok)throw Error('Local piano sample manifest is unavailable');
      const manifest=await response.json();
      // The original three banks eagerly decoded every velocity layer (~1 GB
      // for the default grand). One layer keeps all live keys immediately
      // playable; the exact layers of the current performance are prepared.
      if(!manifest.lazy){manifest.lazy=true;manifest.preloadLayers=[manifest.layers[Math.floor(manifest.layers.length/2)]];}
      this.manifest=manifest;this.layers=manifest.layers;
      this.entries=new Map(manifest.samples.map(s=>[this.sampleId(s),s]));
      this.resident=new Set(manifest.samples.filter(s=>!manifest.lazy||s.kind==='release'||manifest.preloadLayers.includes(s.velocity)).map(s=>this.sampleId(s)));
      this.pinned=new Set(this.resident);
      this.outputTrim=manifest.outputTrim??1;
      this.output.gain.value=1.3*this.outputTrim;
      await this.ensureSamples(this.resident);
      this.ready=true;
    })().catch(e=>{this.loading=null;throw e;});
    return this.loading;
  }
  region(midi) {
    const key=Math.max(21,Math.min(108,Math.round(midi)));
    return this.manifest.keyRegions?.find(r=>r.low<=key&&r.high>=key)??{midi:key,tune:0};
  }
  layerAt(velocity){return this.manifest.velocityRanges?.find(r=>r.low<=velocity&&r.high>=velocity)?.layer;}
  sampleLayers(velocity){
    const v=Math.max(1,Math.min(127,velocity)),mapped=this.layerAt(Math.round(v));
    if(mapped!==undefined)return [mapped];
    const lower=[...this.layers].reverse().find(l=>l<=v)??this.layers[0];
    const upper=this.layers.find(l=>l>=v)??this.layers.at(-1);
    return lower===upper?[lower]:[lower,upper];
  }
  async prepareNotes(notes) {
    await this.load();if(!this.manifest.lazy)return;
    const needed=new Set(this.resident);
    for(const note of notes){
      if(note.velocity<=0)continue;
      const velocity=Math.max(1,Math.min(127,Math.round(note.velocity??90)));
      for(const layer of this.sampleLayers(velocity))needed.add(`${this.region(note.midi).midi}:${layer}`);
    }
    this.pinned=needed;
    // Only the current piece and the small live-key fallback stay decoded.
    for(const id of this.buffers.keys())if(!needed.has(id))this.buffers.delete(id);
    await this.ensureSamples(needed);
    // A slower previous preparation may finish after a song change. Retain
    // only the latest selection, not samples that its old requests added late.
    for(const id of this.buffers.keys())if(!this.pinned.has(id))this.buffers.delete(id);
  }
  trimCache() {
    let bytes=this.decodedBytes;
    for(const [id,buffer] of this.buffers){
      if(bytes<=512*1024*1024)break;
      if(!this.pinned.has(id)){bytes-=buffer.length*buffer.numberOfChannels*4;this.buffers.delete(id);}
    }
  }
  attack(midi,velocity=90,when=this.context.currentTime) {
    if(this.disposed||!this.ready||velocity<=0)return;
    const region=this.region(midi),key=region.midi;
    const v=Math.max(1,Math.min(127,velocity));
    const mapped=this.layerAt(Math.round(v));
    const [lower,upper=lower]=this.sampleLayers(v);
    const mix=upper===lower?0:(v-lower)/(upper-lower);
    const gainScale=mapped?(v/127)**this.manifest.velocityExponent:v<this.layers[0]?(v/this.layers[0])**1.35:v>this.layers.at(-1)?(v/this.layers.at(-1))**1.1:1;
    const t=Math.max(this.context.currentTime,when??0);
    const voice={midi,key,velocity:v,baseRate:2**((midi-key)/12),tune:region.tune??0,released:false,start:t,nodes:[],gain:this.context.createGain(),finished:0};
    voice.gain.gain.setValueAtTime(gainScale,t);voice.gain.connect(this.input);
    for(const [layer,amount] of lower===upper?[[lower,1]]:[[lower,1-mix],[upper,mix]]) {
      if(amount<=0)continue;
      let buffer=this.buffers.get(`${key}:${layer}`),fallbackScale=1;
      if(!buffer&&this.manifest.lazy){
        // Live MIDI input remains immediate; demonstration playback is prepared in advance.
        const available=this.layers.filter(l=>this.buffers.has(`${key}:${l}`)).sort((a,b)=>Math.abs(a-layer)-Math.abs(b-layer));
        if(available.length){buffer=this.buffers.get(`${key}:${available[0]}`);fallbackScale=Math.max(.25,Math.min(2,(layer/available[0])**.65));this.stats.fallbackSamples++;}
        void this.fetchSample(`${key}:${layer}`).then(()=>this.trimCache()).catch(e=>{if(e.name!=='AbortError')this.onProgress?.({loading:false,error:true});});
      }
      if(!buffer){this.stats.missingSamples++;continue;}
      const source=this.context.createBufferSource(),level=this.context.createGain();
      source.buffer=buffer;source.playbackRate.value=voice.baseRate*2**(voice.tune/1200)*this.settings.tuning/440;level.gain.value=amount*fallbackScale;
      source.connect(level);level.connect(voice.gain);
      voice.nodes.push(source);
      source.onended=()=>{
        source.disconnect();level.disconnect();
        if(++voice.finished===voice.nodes.length){voice.gain.disconnect();this.voices.delete(voice);}
      };
      source.start(t);
    }
    if(voice.nodes.length){this.voices.add(voice);this.stats.attacks++;this.stats.peakVoices=Math.max(this.stats.peakVoices,this.voices.size);}
    else voice.gain.disconnect();
  }
  release(midi,when=this.context.currentTime) {
    const voice=[...this.voices].find(v=>v.midi===midi&&!v.released);
    if(!voice)return;
    voice.released=true;this.stats.releases++;
    const t=Math.max(this.context.currentTime,voice.start,when??0);
    // A damped piano still has a short resonant tail after the key/pedal lifts.
    const duration=this.manifest.undampedHighNotes&&midi>=89?2:midi<49?.58:midi<73?.44:.32;
    voice.gain.gain.cancelAndHoldAtTime(t);
    voice.gain.gain.setTargetAtTime(0,t,duration/6);
    for(const node of voice.nodes)node.stop(t+duration);
    if(this.manifest.releaseGain)this.releaseResonance(voice,t);
  }
  releaseResonance(voice,when) {
    const buffer=this.buffers.get(`release:${voice.key}:${voice.velocity<=44?'S':'L'}`);
    if(!buffer)return;
    const source=this.context.createBufferSource(),gain=this.context.createGain();
    source.buffer=buffer;source.playbackRate.value=voice.baseRate*2**(voice.tune/1200)*this.settings.tuning/440;
    const level=this.manifest.releaseGain*(voice.velocity/127)**1.8*Math.exp(-Math.max(0,when-voice.start)*.8);
    gain.gain.setValueAtTime(level,when);gain.gain.setTargetAtTime(0,when+.05,.23);
    source.connect(gain);gain.connect(this.input);
    const tail={midi:voice.midi,tune:voice.tune,baseRate:voice.baseRate,released:true,start:when,nodes:[source],gain};
    this.voices.add(tail);
    source.onended=()=>{source.disconnect();gain.disconnect();this.voices.delete(tail);};
    source.start(when);source.stop(when+1.4);
  }
  stop() {
    const t=this.context.currentTime;
    for(const voice of this.voices){
      voice.released=true;
      // stop() cancels future start() calls too, not just currently audible notes.
      for(const node of voice.nodes){try{node.stop(t+.008);}catch{}}
    }
    this.voices.clear();
    // Cut the old reverb bus as well. A new bus lets immediate resume work.
    const old={output:this.output,input:this.input,tone:this.tone,wet:this.wet,convolver:this.convolver};
    old.output.gain.cancelAndHoldAtTime(t);old.output.gain.linearRampToValueAtTime(0,t+.008);
    this.makeBus();
    this.output.gain.value=1.3*(this.outputTrim??1);
    setTimeout(()=>Object.values(old).forEach(n=>n.disconnect()),30);
  }
  dispose() {
    this.disposed=true;this.loadController?.abort();
    for(const voice of this.voices)for(const source of voice.nodes){try{source.stop();}catch{}source.disconnect();}
    this.voices.clear();this.buffers.clear();this.ready=false;
    for(const node of [this.input,this.tone,this.output,this.wet,this.convolver])node.disconnect();
  }
  get decodedBytes(){let n=0;for(const b of this.buffers.values())n+=b.length*b.numberOfChannels*4;return n;}
  get state(){return {ready:this.ready,samples:this.buffers.size,availableSamples:this.entries?.size??0,decodedBytes:this.decodedBytes,voices:this.voices.size,unreleased:[...this.voices].filter(v=>!v.released).length,settings:{...this.settings},...this.stats};}
}

export function installSampledPiano({audio,context,wake,onStatus}) {
  const legacy={load:audio.load.bind(audio),playMidi:audio.playMidi.bind(audio),stopNote:audio.stopNote.bind(audio),stopAll:audio.stopAll.bind(audio)};
  let piano=null,bank=null,settings={};
  const banks={grand:'upright-kw',bright:'upright-kw','upright-kw':'upright-kw','ydp-grand':'ydp-grand','salamander-grand':'salamander-grand','steinway-b':'steinway-b'};
  audio.setPianoSettings=function(s){settings={brightness:s.pianoBrightness??0,room:s.pianoRoom??12,tuning:s.pianoTuning??440};piano?.configure(settings);};
  const usePiano=()=>!!banks[audio._currentId];
  audio.load=async function(){
    if(!usePiano()){piano?.dispose();piano=null;bank=null;return legacy.load();}
    this.ctx=context();const requested=banks[this._currentId];
    if(!piano||bank!==requested){piano?.dispose();bank=requested;const next=new SampledPiano(this.ctx,{baseURL:new URL(`/soundfont/${bank}/`,globalThis.location.href),onProgress:s=>{if(piano===next)onStatus?.(s);}});piano=next;piano.configure(settings);}
    this.sampledPiano=piano;const target=piano;
    try{await target.load();if(target===piano)this._loaded=true;}catch(error){if(error.name!=='AbortError')throw error;}
  };
  audio.prepareNotes=async function(notes){const target=piano;if(!target)return;try{await target.prepareNotes(notes);}catch(e){if(e.name!=='AbortError')throw e;}};
  audio.wake=async function(){await wake();this.ctx=context();if(this.ctx.state==='suspended')await this.ctx.resume();};
  audio.playMidi=function(midi,velocity=90,when){
    if(!usePiano())return legacy.playMidi(midi,velocity);
    if(velocity<=0)return;
    try{if(this.midiOutput){this.midiOutput.sendNoteOn(midi,{channels:1,rawAttack:velocity});return;}}catch{}
    if(this.ctx?.state==='suspended')void this.ctx.resume();
    piano?.attack(midi,velocity,when);
  };
  audio.stopNote=function(midi,when){
    if(!usePiano())return legacy.stopNote(midi);
    try{this.midiOutput?.sendNoteOff(midi,{channels:1});}catch{}
    piano?.release(midi,when);
  };
  audio.stopAll=function(){piano?.stop();legacy.stopAll();};
  return {get piano(){return piano;}};
}
