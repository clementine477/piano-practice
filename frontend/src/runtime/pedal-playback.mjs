/** Single-piano sustain. Score automation is confined to demonstration mode;
 * physical pedal input and the practice judge remain independent. */
export function normalizeSustainRanges(ranges = []) {
  const valid = ranges.filter(r => Number.isFinite(r.startSeconds) &&
    Number.isFinite(r.endSeconds) && r.endSeconds > r.startSeconds)
    .map(r => ({startSeconds: Math.max(0,r.startSeconds), endSeconds:r.endSeconds}))
    .sort((a,b) => a.startSeconds-b.startSeconds || a.endSeconds-b.endSeconds);
  const merged=[];
  for(const r of valid) {
    const last=merged.at(-1);
    if(last && r.startSeconds < last.endSeconds-1e-7) last.endSeconds=Math.max(last.endSeconds,r.endSeconds);
    else merged.push({...r});
  }
  return merged;
}

/** Keep each MIDI channel's gate independent before combining the piano ranges. */
export function sustainRangesFromMidi(tracks, endSeconds) {
  const events=[];
  for(const track of tracks) for(const cc of track.controlChanges?.[64] || [])
    if(Number.isFinite(cc.time) && Number.isFinite(cc.value))
      events.push({time:cc.time,value:cc.value,channel:track.channel ?? 0});
  events.sort((a,b)=>a.time-b.time);
  const starts=new Map(), ranges=[];
  for(const e of events) {
    if(e.value >= 0.5) { if(!starts.has(e.channel))starts.set(e.channel,e.time); }
    else if(starts.has(e.channel)) {
      ranges.push({startSeconds:starts.get(e.channel),endSeconds:e.time});starts.delete(e.channel);
    }
  }
  for(const start of starts.values())ranges.push({startSeconds:start,endSeconds});
  return normalizeSustainRanges(ranges);
}

/** Read pedal directions before alphaTab's MIDI generation. Some valid
 * directions before a measure's first note are omitted by that importer. */
export function sustainRangesFromMusicXml(xml, masterBars, ppq, toSeconds, endSeconds) {
  const dom=new DOMParser().parseFromString(xml,'application/xml');
  if(dom.querySelector('parsererror'))return [];
  const events=[];
  const child=(el,name)=>[...el.children].find(c=>c.localName===name);
  const num=(el,name,fallback=0)=>Number(child(el,name)?.textContent ?? fallback);
  const parts=[...dom.documentElement.children].filter(c=>c.localName==='part');
  for(let partIndex=0;partIndex<parts.length;partIndex++) {
    let divisions=1;
    const measures=[...parts[partIndex].children].filter(c=>c.localName==='measure');
    for(let index=0;index<measures.length;index++) {
      let position=0;
      const starts=masterBars.filter(b=>b.masterBar.index===index).map(b=>b.start);
      for(const el of measures[index].children) {
        if(el.localName==='attributes')divisions=num(el,'divisions',divisions);
        else if(el.localName==='backup')position-=num(el,'duration')/divisions;
        else if(el.localName==='forward')position+=num(el,'duration')/divisions;
        else if(el.localName==='note'&&!child(el,'chord')&&!child(el,'grace'))position+=num(el,'duration')/divisions;
        else if(el.localName==='direction') {
          const beat=position+num(el,'offset')/divisions;
          for(const pedal of el.querySelectorAll('direction-type > pedal')) {
            const kind=pedal.getAttribute('type');
            if(!['start','stop','change'].includes(kind))continue;
            const key=`${partIndex}:${pedal.getAttribute('number')||1}`;
            for(const start of starts) {
              const time=toSeconds(Math.max(start,start+beat*ppq));
              if(kind==='stop'||kind==='change')events.push({time,key,down:false});
              if(kind==='start'||kind==='change')events.push({time,key,down:true});
            }
          }
        }
      }
    }
  }
  events.sort((a,b)=>a.time-b.time||Number(a.down)-Number(b.down));
  const active=new Map(),ranges=[];
  for(const e of events) {
    if(e.down){if(!active.has(e.key))active.set(e.key,e.time);}
    else if(active.has(e.key)){ranges.push({startSeconds:active.get(e.key),endSeconds:e.time});active.delete(e.key);}
  }
  for(const start of active.values())ranges.push({startSeconds:start,endSeconds});
  return normalizeSustainRanges(ranges);
}

export function installPedalPlayback({engine, transport}) {
  if(engine.pedalPlayback) return engine.pedalPlayback;
  const audio=engine.audio;
  const original={playMidi:audio.playMidi.bind(audio),stopNote:audio.stopNote.bind(audio),stopAll:audio.stopAll.bind(audio)};
  // PolySynth allocates one voice per attack, including repeated pitches.
  // Keep a release count: a Set of pitches leaves earlier voices sounding.
  const held=new Map(), deferred=new Map(), jobs=new Set();
  let down=false, output=null, epoch=0, cursor=0, events=[], document=null, lastSeconds=-Infinity;
  let anonymous=0;

  function send(output,value) { try{output?.sendControlChange(64,value,{channels:1});}catch{} }
  function syncOutput() {
    const next=audio.midiOutput || null;
    if(next!==output) { send(output,0);output=next;send(output,down?127:0); }
  }
  function hasHeld(midi) { return [...held.values()].some(v=>v===midi); }
  function releasePending(midi,when) {
    if(hasHeld(midi))return;
    const count=deferred.get(midi)||0;
    for(let i=0;i<count;i++)original.stopNote(midi,when);
    deferred.delete(midi);
  }
  function apply(value,when) {
    syncOutput();
    if(down===value)return;
    down=value;send(output,down?127:0);
    if(!down) {
      for(const midi of deferred.keys())releasePending(midi,when);
    }
  }
  function reset() {
    epoch++;
    for(const id of jobs) transport().clear(id);
    jobs.clear();cursor=0;events=[];document=null;lastSeconds=-Infinity;
    held.clear();deferred.clear();down=false;
    send(output,0);
    const current=audio.midiOutput || null;
    if(current!==output)send(current,0);
    output=current;
  }
  audio.playNote=function(note,when){this.playMidi(note.midi,note.velocity,note.id,when);};
  audio.playMidi=function(midi,velocity=90,noteId,when) {
    if(velocity<=0)return;
    syncOutput();
    held.set(noteId ?? `virtual:${anonymous++}`,midi);
    original.playMidi(midi,velocity,when);
  };
  audio.stopNote=function(midi,noteId,when) {
    const id=noteId ?? [...held].find(([key,value])=>value===midi && key.startsWith('virtual:'))?.[0];
    if(id===undefined || !held.has(id))return;
    held.delete(id);
    deferred.set(midi,(deferred.get(midi)||0)+1);
    if(down) {
      // Hardware receives the real key release and sustains through CC64.
      // The local synthesizer waits to release its envelope until pedal-up.
      try{audio.midiOutput?.sendNoteOff(midi,{channels:1});}catch{}
    } else releasePending(midi,when);
  };
  audio.stopAll=function(){reset();original.stopAll();};

  function schedule(seconds) {
    const state=engine._state;
    if(!engine.doc || !state.demo || engine.countingIn) {
      if(document || down) { reset();original.stopAll(); }
      return;
    }
    syncOutput();
    if(document!==engine.doc || seconds < lastSeconds-1e-4) {
      reset();document=engine.doc;
      const ranges=normalizeSustainRanges(document.sustainRanges);
      events=ranges.flatMap(r=>[{time:r.startSeconds,down:true},{time:r.endSeconds,down:false}]);
      events.sort((a,b)=>a.time-b.time || Number(a.down)-Number(b.down));
      apply(ranges.some(r=>r.startSeconds<=seconds && seconds<r.endSeconds));
      while(cursor<events.length && events[cursor].time<=seconds+1e-7)cursor++;
    }
    lastSeconds=seconds;
    const multiplier=Math.max(0.01,state.tempoMultiplier || 1);
    const offset=(engine.renderOffsetMs || 0)/1000;
    const generation=epoch;
    while(cursor<events.length && events[cursor].time<=seconds+5) {
      const event=events[cursor++];
      const delay=Math.max(0,(event.time-seconds)/multiplier-offset);
      let id=transport().scheduleOnce(when=>{
        jobs.delete(id);
        if(generation===epoch && engine._state.demo)apply(event.down,when);
      },`+${delay}`);
      jobs.add(id);
    }
  }
  const api={schedule,reset,get generation(){return epoch;},get state(){return {down,pending:jobs.size,held:held.size,deferred:deferred.size};}};
  engine.pedalPlayback=api;
  return api;
}
