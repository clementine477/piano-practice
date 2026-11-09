import {test} from 'node:test';
import assert from 'node:assert/strict';
import {beatEvents,createSampledMetronome} from '../frontend/src/runtime/sampled-metronome.mjs';

test('score beat times preserve tempo changes, meter and final boundary',()=>{
 const beats=beatEvents([
  {startSeconds:0,beatSeconds:[0,.5,1]},
  {startSeconds:1.5,beatSeconds:[1.5,1.9,2.25]},
  {startSeconds:2.5,beatSeconds:[2.5,2.75,3,3.25,3.5,3.75]},
 ],4);
 assert.deepEqual(beats.filter(b=>b.accent).map(b=>b.time),[0,1.5,2.5]);
 assert.equal(beats.length,12);
 assert.deepEqual(beats.slice(3,6).map(b=>b.time),[1.5,1.9,2.25]);
 assert.deepEqual(beatEvents([{startSeconds:0,beatSeconds:[0,1,2]}],2).map(b=>b.time),[0,1]);
});

function setup(){
 const starts=[],stops=[],handlers=new Map();
 const param=()=>({value:1,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;},linearRampToValueAtTime(v){this.value=v;},cancelScheduledValues(){}});
 const ctx={currentTime:10,destination:{},createGain:()=>({gain:param(),connect(){},disconnect(){}}),
  createBufferSource:()=>({connect(){},disconnect(){},start(t){starts.push(t);},stop(t){stops.push(t);}}),decodeAudioData:async()=>({duration:.32})};
 const engine={metronomeVolumeDb:()=>-14,doc:{totalDuration:4,measures:[{startSeconds:0,beatSeconds:[0,.5,1,1.5]},{startSeconds:2,beatSeconds:[2,2.5,3,3.5]}]},_state:{metronomeEnabled:true,tempoMultiplier:1}};
 const clock={context:{rawContext:ctx,now:()=>ctx.currentTime+.1},on:(e,f)=>handlers.set('clock:'+e,f),off:()=>{}};
 const met=createSampledMetronome({engine,transport:()=>clock,measures:d=>d.measures,bus:{on:(e,f)=>handlers.set(e,f),off:()=>{}},fetcher:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(1)})});
 return {starts,stops,ctx,engine,met,handlers};
}
test('scheduled clicks do not repeat, skip past beats on seek, and respect speed',async()=>{
 const {starts,met,engine}=setup();await met.load();
 met.schedule(0,10);met.schedule(.1,10.1);assert.deepEqual(starts,[10]);
 met.schedule(.3,10.3);assert.deepEqual(starts,[10,10.5]);
 met.reset();engine._state.tempoMultiplier=2;met.schedule(2.2,12);
 assert(Math.abs(starts.at(-1)-12.15)<1e-9);
 met.dispose();
});
test('pause cancels all future count-in attacks without waiting for timers',async()=>{
 const {starts,stops,met,handlers}=setup();await met.load();met.countIn(8,.5,4);
 assert.equal(starts.length,8);assert.equal(met.state.voices,8);
 handlers.get('transport:stateChange')({status:'paused'});
 assert.equal(stops.length,8);assert.equal(met.state.voices,0);assert(stops.every(t=>t===10));
});
test('loop boundary cannot sound a click outside the selected loop',async()=>{
 const {starts,met,engine}=setup();await met.load();engine._state.loopEnd=1;
 met.schedule(.8,10.8);assert.deepEqual(starts,[]);
});
test('transport start primes the downbeat even when the first tick is late',async()=>{
 const {starts,met,handlers}=setup();await met.load();
 handlers.get('clock:start')(10.1);met.schedule(.04,10.14);
 assert.deepEqual(starts,[10.1]);
});
