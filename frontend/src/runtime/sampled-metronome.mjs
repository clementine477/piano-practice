/** Recorded woodblock clicks, on the same audio clock as the piano. */
export function beatEvents(measures, duration=Infinity) {
  const events=[];
  for(const measure of measures||[])for(const time of measure.beatSeconds||[]) {
    if(!Number.isFinite(time)||time<0||time>=duration-1e-7)continue;
    events.push({time,accent:Math.abs(time-measure.startSeconds)<1e-6});
  }
  events.sort((a,b)=>a.time-b.time);
  return events.filter((event,index)=>!index||Math.abs(event.time-events[index-1].time)>1e-6);
}

export function createSampledMetronome({engine,transport,measures,bus,fetcher=fetch}) {
  let output=null,context=null,buffers=null,loading=null,db=engine.metronomeVolumeDb();
  let document=null,events=[],cursor=null,lastSeconds=-Infinity;
  const voices=new Set();
  const urls=['/samples/metronome/wood-accent.wav','/samples/metronome/wood-beat.wav'];
  function setVolume(value){
    db=value;
    if(output)output.gain.setTargetAtTime(db<=-79?0:10**(db/20),context.currentTime,.005);
  }
  async function load(){
    if(buffers)return;
    if(loading)return loading;
    context=transport().context.rawContext;
    if(!output){output=context.createGain();output.gain.value=db<=-79?0:10**(db/20);output.connect(context.destination);}
    loading=Promise.all(urls.map(async url=>{
      const response=await fetcher(url);if(!response.ok)throw Error('Could not load metronome recording');
      return context.decodeAudioData(await response.arrayBuffer());
    })).then(result=>{buffers=result;}).finally(()=>{loading=null;});
    return loading;
  }
  function hit(accent,when=context?.currentTime){
    if(!buffers||!Number.isFinite(when))return;
    const source=context.createBufferSource(),gain=context.createGain();
    source.buffer=buffers[accent?0:1];source.connect(gain);gain.connect(output);
    const voice={source,gain,when:Math.max(context.currentTime,when)};voices.add(voice);
    source.onended=()=>{voices.delete(voice);source.disconnect();gain.disconnect();};
    source.start(voice.when);
  }
  function reset(){
    cursor=null;lastSeconds=-Infinity;
    for(const voice of voices){
      // Cancel future attacks outright; fade an already sounding click quickly.
      const now=context.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.when>now?0:voice.gain.gain.value,now);
      voice.gain.gain.linearRampToValueAtTime(0,now+.004);
      voice.source.stop(voice.when>now?now:now+.005);
    }
    voices.clear();
  }
  function schedule(seconds,when){
    if(!buffers||!engine.doc||!engine._state.metronomeEnabled||engine.countingIn)return;
    const clock=transport(),rate=Math.max(.01,engine._state.tempoMultiplier||1);
    when=Number.isFinite(when)?when:clock.context.now();
    // The tick callback's precise timestamp avoids a second lookahead or a
    // rounded BPM. Measure beat times already include the full tempo map.
    if(Number.isFinite(engine.clock?._startOffset)&&clock.getSecondsAtTime)
      seconds=engine.clock._startOffset+clock.getSecondsAtTime(when)*rate;
    if(document!==engine.doc){reset();document=engine.doc;events=beatEvents(measures(document),document.totalDuration);}
    if(seconds<lastSeconds-1e-5)reset();
    if(cursor===null){
      cursor=0;while(cursor<events.length&&events[cursor].time<seconds-1e-5)cursor++;
    }
    lastSeconds=seconds;
    const offset=(engine.renderOffsetMs||0)/1000;
    const end=Math.min(engine.doc.totalDuration,
      engine.learningRange?.end??Infinity,engine._state.loopEnd??Infinity);
    while(cursor<events.length&&events[cursor].time<=seconds+.3*rate){
      const event=events[cursor++];
      if(event.time>=end-1e-7)break;
      hit(event.accent,when+(event.time-seconds)/rate-offset);
    }
  }
  function countIn(beats,secondsPerBeat,beatsPerBar){
    reset();const start=transport().context.now();
    for(let index=0;index<beats;index++)hit(index%beatsPerBar===0,start+index*secondsPerBeat);
  }
  function stateChanged({status}){if(status!=='playing')reset();}
  // Prime the first beat from the transport start event. Under renderer load
  // its first repeating tick may arrive after beat zero and otherwise skip it.
  const clock=transport();
  function started(when){schedule(engine.clock?.currentSeconds??engine._state.currentSeconds??0,when);}
  clock.on?.('start',started);
  bus?.on('transport:stateChange',stateChanged);
  const volume={get value(){return db;},set value(value){setVolume(value);}};
  return {load,schedule,countIn,reset,volume,triggerRelease:reset,
    get output(){return output;},get state(){return {loaded:!!buffers,voices:voices.size,beats:events.length,recorded:true};},
    dispose(){reset();clock.off?.('start',started);bus?.off('transport:stateChange',stateChanged);output?.disconnect();}
  };
}
