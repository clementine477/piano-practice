/** Preserve explicit MusicXML note dynamics lost by the donor MIDI importer. */
export function applyMusicXmlVelocities(xml,notes,masterBars,ppq,ticksToSeconds) {
  const dom=new DOMParser().parseFromString(xml,'application/xml');
  if(dom.querySelector('parsererror'))return;
  const child=(el,name)=>[...el.children].find(c=>c.localName===name);
  const num=(el,name,fallback=0)=>Number(child(el,name)?.textContent??fallback);
  const parts=[...dom.documentElement.children].filter(c=>c.localName==='part');
  // Matching by pitch, tick and staff is unambiguous for a single piano part.
  if(parts.length!==1)return;
  let divisions=1;
  const values=new Map();
  const measures=[...parts[0].children].filter(c=>c.localName==='measure');
  for(let index=0;index<measures.length;index++) {
    let position=0,chordStart=0;
    const starts=masterBars.filter(b=>b.masterBar.index===index).map(b=>b.start);
    for(const el of measures[index].children) {
      if(el.localName==='attributes')divisions=num(el,'divisions',divisions);
      else if(el.localName==='backup')position-=num(el,'duration')/divisions;
      else if(el.localName==='forward')position+=num(el,'duration')/divisions;
      else if(el.localName==='note') {
        const isChord=!!child(el,'chord'),pitch=child(el,'pitch');
        if(!isChord)chordStart=position;
        const dynamics=el.getAttribute('dynamics');
        const tiedFromPrevious=[...el.children].some(c=>c.localName==='tie'&&c.getAttribute('type')==='stop');
        if(pitch&&!tiedFromPrevious) {
          const midi=(num(pitch,'octave')+1)*12+{C:0,D:2,E:4,F:5,G:7,A:9,B:11}[child(pitch,'step')?.textContent]+num(pitch,'alter');
          const hand=num(el,'staff',1)===1?'right':'left';
          const velocity=dynamics!==null&&Number.isFinite(Number(dynamics))?Math.max(0,Math.min(127,Math.round(Number(dynamics)*.9))):undefined;
          const attack=Number(el.getAttribute('attack')??0)*ppq/divisions;
          const release=Number(el.getAttribute('release')??0)*ppq/divisions;
          const duration=num(el,'duration')*ppq/divisions;
          for(const start of starts)values.set(`${Math.round(start+chordStart*ppq)}:${midi}:${hand}`,{velocity,attack,release,duration});
        }
        if(!isChord&&!child(el,'grace'))position+=num(el,'duration')/divisions;
      }
    }
  }
  for(const note of notes){
    const value=values.get(`${note.startTick}:${note.midi}:${note.hand}`);
    if(value===undefined)continue;
    if(value.velocity!==undefined)note.velocity=value.velocity;
    if(ticksToSeconds&&(value.attack||value.release)&&Number.isFinite(value.attack)&&Number.isFinite(value.release)) {
      const start=ticksToSeconds(note.startTick+value.attack);
      const end=ticksToSeconds(note.startTick+value.duration+value.release);
      if(Number.isFinite(start)&&Number.isFinite(end)&&end>start) {
        note.startSeconds=start;note.endSeconds=end;note.durationSeconds=end-start;
      }
    }
  }
}
