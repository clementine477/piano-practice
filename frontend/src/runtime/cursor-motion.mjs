/** Interpolate engraving positions without moving the note onset anchors.
 * Monotone Hermite slopes share a velocity at each anchor and cannot overshoot.
 */
export function fitCursorPath(points) {
  if(points.length<2)return points.map(p=>({...p,slope:0}));
  const gaps=[],rates=[];
  for(let i=0;i<points.length-1;i++){
    gaps.push(points[i+1].seconds-points[i].seconds);
    rates.push((points[i+1].x-points[i].x)/gaps[i]);
  }
  return points.map((point,i)=>{
    let slope;
    if(i===0)slope=rates[0];
    else if(i===points.length-1)slope=rates.at(-1);
    else if(rates[i-1]<=0||rates[i]<=0)slope=0;
    else {
      const a=2*gaps[i]+gaps[i-1],b=gaps[i]+2*gaps[i-1];
      slope=(a+b)/(a/rates[i-1]+b/rates[i]);
    }
    return {...point,slope};
  });
}

export function cursorPathX(left,right,seconds){
  if(!right||right.seconds<=left.seconds)return left.x;
  const span=right.seconds-left.seconds,t=Math.max(0,Math.min(1,(seconds-left.seconds)/span));
  return (2*t*t*t-3*t*t+1)*left.x+(t*t*t-2*t*t+t)*span*left.slope+
    (-2*t*t*t+3*t*t)*right.x+(t*t*t-t*t)*span*right.slope;
}

// alphaTab's public tick lookup uses 960 ticks per quarter, independently of
// the imported document's PPQ. Convert once when a rendered score is indexed.
function tickTimes(doc){
  const ppq=doc.ppq??480,changes=doc.tempoMap?.length?doc.tempoMap:[{tick:0,bpm:120}];
  let seconds=0,previous=0,bpm=changes[0].bpm;
  const entries=changes.map(change=>{
    seconds+=(change.tick-previous)*60/(ppq*bpm);previous=change.tick;bpm=change.bpm;
    return {tick:change.tick*960/ppq,seconds,bpm};
  });
  return tick=>{
    let lo=0,hi=entries.length;
    while(lo<hi){const mid=(lo+hi)>>>1;if(entries[mid].tick<=tick)lo=mid+1;else hi=mid;}
    const entry=entries[Math.max(0,lo-1)];
    return entry.seconds+(tick-entry.tick)*60/(960*entry.bpm);
  };
}

/** The audio transport owns cursor painting. Seeking a muted synth on every
 * frame used to introduce worker/RAF latency and stale positions after seeks.
 * Only public alphaTab lookup APIs and its custom cursor hook are used here.
 */
export function createScoreCursor(api,root,getDocument,secondsToTick){
  let paths=[],segments=[],cache=null,bounds=null,source=null,dirty=true;
  let beatElement=null,barElement=null,lastBar=null;
  const handler={onAttach(){},onDetach(){},placeBarCursor(){},placeBeatCursor(){},transitionBeatCursor(){}};
  api.customCursorHandler=handler;
  function index(){
    const doc=getDocument(),ticks=api.tickCache,lookup=api.boundsLookup;
    if(!doc||!ticks||!lookup)return false;
    if(!dirty&&cache===ticks&&bounds===lookup&&source===doc)return paths.length>0;
    cache=ticks;bounds=lookup;source=doc;dirty=false;paths=[];segments=[];lastBar=null;
    const toSeconds=tickTimes(doc),tracks=new Set(api.tracks.map(track=>track.index));
    let current=ticks.findBeat(tracks,0),points=[],previous=null;
    const finish=()=>{if(points.length){const path=fitCursorPath(points);paths.push(path);for(let i=0;i<path.length-1;i++)segments.push({left:path[i],right:path[i+1]});points=[];}};
    // Each lookup advances in performance order, including repeated bars.
    for(let count=0;current&&count<100000;count++){
      const bound=lookup.findBeat(current.beat),nextTick=current.end;
      if(bound){
        const bar=bound.barBounds.masterBarBounds;
        const point={seconds:toSeconds(current.start),tick:current.start,x:bound.onNotesX,bound,bar};
        if(previous&&(previous.bar.staffSystemBounds!==bar.staffSystemBounds||point.x<=previous.x||point.seconds<=previous.seconds))finish();
        points.push(point);previous=point;
        const next=nextTick>current.start?ticks.findBeat(tracks,nextTick,current):null;
        const nextBounds=next&&lookup.findBeat(next.beat);
        if(!next||!nextBounds||nextBounds.barBounds.masterBarBounds.staffSystemBounds!==bar.staffSystemBounds||nextBounds.onNotesX<=point.x){
          if(nextTick>current.start)points.push({...point,seconds:toSeconds(nextTick),tick:nextTick,x:Math.max(point.x,bound.realBounds.x+bound.realBounds.w)});
          finish();previous=null;
        }
        if(!next||next.start<=current.start)break;
        current=next;
      }else{
        if(nextTick<=current.start)break;
        const next=ticks.findBeat(tracks,nextTick,current);if(!next||next.start<=current.start)break;current=next;
      }
    }
    finish();return segments.length>0;
  }
  return {
    invalidate(){dirty=true;},
    paint(seconds){
      if(!index())return null;
      beatElement=root.querySelector('.at-cursor-beat');barElement=root.querySelector('.at-cursor-bar');
      if(!beatElement||!barElement)return null;
      let lo=0,hi=segments.length;
      while(lo<hi){const mid=(lo+hi)>>>1;if(segments[mid].left.seconds<=seconds)lo=mid+1;else hi=mid;}
      const {left,right}=segments[Math.max(0,lo-1)],bar=left.bar.visualBounds;
      const x=cursorPathX(left,right,seconds),zoom=Number(root.style.zoom||1),pixels=(devicePixelRatio||1)*zoom;
      const snapped=Math.round(x*pixels)/pixels;
      Object.assign(beatElement.style,{width:`${1.5/zoom}px`,height:`${bar.h}px`,transform:`translate(${snapped}px, ${bar.y}px)`,transformOrigin:'0 0',transition:'none'});
      if(lastBar!==left.bar){
        Object.assign(barElement.style,{width:`${bar.w}px`,height:`${bar.h}px`,transform:`translate(${bar.x}px, ${bar.y}px)`,transformOrigin:'0 0',transition:'none'});
        lastBar=left.bar;
      }
      const doc=getDocument();
      const state={seconds,tick:secondsToTick(seconds,doc.tempoMap??[],doc.ppq??480),x:snapped,bar:left.bar.index,anchorTick:left.tick,anchorX:left.x,nextX:right.x,segments:segments.length};
      beatElement.dataset.pianoSeconds=String(seconds);
      api.pianoCursor=state;
      return state;
    },
    destroy(){api.pianoCursor=null;paths=[];segments=[];}
  };
}
