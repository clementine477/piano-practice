import test from 'node:test';
import assert from 'node:assert/strict';
import {installPedalPlayback,sustainRangesFromMidi} from '../frontend/src/runtime/pedal-playback.mjs';

function setup({hardware=false,tempo=1,demo=true}={}) {
  const log=[],queue=new Map();let id=0,now=0;
  const output=hardware?{sendControlChange:(cc,v)=>log.push([now,'cc',cc,v]),sendNoteOff:n=>log.push([now,'midiOff',n])}:null;
  const audio={midiOutput:output,playMidi:(n,v)=>log.push([now,'on',n]),stopNote:n=>log.push([now,'off',n]),stopAll:()=>log.push([now,'allOff'])};
  const engine={audio,doc:{sustainRanges:[{startSeconds:.25,endSeconds:1.5}]},renderOffsetMs:0,_state:{demo,tempoMultiplier:tempo}};
  const transport=()=>({scheduleOnce(fn,delay){queue.set(++id,{time:now+Number(delay),fn});return id;},clear:id=>queue.delete(id)});
  const api=installPedalPlayback({engine,transport});
  function advance(time){for(;;){const next=[...queue].filter(([,v])=>v.time<=time).sort((a,b)=>a[1].time-b[1].time)[0];if(!next)break;queue.delete(next[0]);now=next[1].time;next[1].fn();}now=time;}
  return {engine,audio,api,log,queue,advance};
}
test('local piano holds key release until pedal-up',()=>{
  const s=setup();s.api.schedule(0);s.audio.playNote({id:'n',midi:60,velocity:80});
  s.advance(.5);s.audio.stopNote(60,'n');
  assert.equal(s.log.filter(e=>e[1]==='off').length,0);
  s.advance(1.5);assert.deepEqual(s.log.find(e=>e[1]==='off'),[1.5,'off',60]);
});
test('hardware gets real note-off and independently timed CC64',()=>{
  const s=setup({hardware:true});s.api.schedule(0);s.audio.playNote({id:'n',midi:60,velocity:80});
  s.advance(.5);s.audio.stopNote(60,'n');s.advance(1.5);
  assert.ok(s.log.some(e=>e[0]===.25&&e[1]==='cc'&&e[3]===127));
  assert.ok(s.log.some(e=>e[0]===.5&&e[1]==='midiOff'));
  assert.ok(s.log.some(e=>e[0]===1.5&&e[1]==='cc'&&e[3]===0));
});
test('seek or pause resets pedal and invalidates queued events',()=>{
  const s=setup({hardware:true});s.api.schedule(0);s.advance(.4);s.audio.stopAll();s.advance(3);
  assert.equal(s.api.state.down,false);assert.equal(s.queue.size,0);
  assert.ok(s.log.some(e=>e[0]===.4&&e[1]==='cc'&&e[3]===0));
});
test('starting inside a held pedal restores it and schedules its release',()=>{
  const s=setup();s.api.schedule(1);assert.equal(s.api.state.down,true);
  s.advance(.5);assert.equal(s.api.state.down,false);
});
test('tempo multiplier scales pedal timing along with notes',()=>{
  const s=setup({tempo:2});s.api.schedule(0);s.advance(.125);assert.equal(s.api.state.down,true);
  s.advance(.75);assert.equal(s.api.state.down,false);
});
test('repeated notes and muted note-offs cannot kill a currently held key',()=>{
  const s=setup();s.api.schedule(0);s.audio.playNote({id:'a',midi:60,velocity:80});
  s.advance(.5);s.audio.stopNote(60,'a');s.audio.playNote({id:'b',midi:60,velocity:80});
  s.audio.stopNote(60,'muted');s.advance(1.5);
  assert.equal(s.log.filter(e=>e[1]==='off').length,0);
  s.audio.stopNote(60,'b');assert.equal(s.log.filter(e=>e[1]==='off').length,2);
});
test('score automation never presses the pedal during physical practice',()=>{
  const s=setup({hardware:true,demo:false});s.api.schedule(0);s.advance(2);
  assert.equal(s.log.some(e=>e[1]==='cc'&&e[3]===127),false);
});
test('range import respects MIDI channels and exact changes',()=>{
  const tracks=[{channel:0,controlChanges:{64:[{time:0,value:1},{time:2,value:0},{time:2,value:1},{time:3,value:0}]}},
    {channel:1,controlChanges:{64:[{time:1,value:1},{time:1.5,value:0}]}}];
  assert.deepEqual(sustainRangesFromMidi(tracks,4),[{startSeconds:0,endSeconds:2},{startSeconds:2,endSeconds:3}]);
});
test('switching documents cancels pedal events from the previous song',()=>{
  const s=setup();s.api.schedule(0);s.advance(.4);s.audio.stopAll();s.engine.doc={sustainRanges:[]};s.api.schedule(0);s.advance(4);
  assert.equal(s.api.state.down,false);assert.equal(s.queue.size,0);
});
