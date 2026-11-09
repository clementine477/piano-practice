import test from 'node:test';
import assert from 'node:assert/strict';
import {installPedalPlayback} from '../frontend/src/runtime/pedal-playback.mjs';
// Tone.PolySynth creates a new voice for every attack and releases only the
// first unreleased matching pitch. Model its documented queue, not one bool/pitch.
function fixture(){
 const voices=[],jobs=[];let now=0,dropped=0;
 const audio={midiOutput:null,playMidi(midi){if(voices.filter(v=>!v.released).length>=32){dropped++;return;}voices.push({midi,released:false});},stopNote(midi){const v=voices.find(v=>v.midi===midi&&!v.released);if(v)v.released=true;},stopAll(){voices.forEach(v=>v.released=true);}};
 const engine={audio,doc:{sustainRanges:[{startSeconds:0,endSeconds:1}]},renderOffsetMs:0,_state:{demo:true,tempoMultiplier:1}};
 const api=installPedalPlayback({engine,transport:()=>({scheduleOnce(fn,t){jobs.push({fn,time:now+Number(t)});return jobs.length;},clear(){}})});
 const advance=t=>{now=t;for(const j of jobs)if(j.time<=t&&!j.done){j.done=true;j.fn();}};
 return {audio,api,voices,advance,get dropped(){return dropped;}};
}
test('every repeated-pitch voice ends when pedal lifts',()=>{
 const f=fixture();f.api.schedule(0);
 for(let i=0;i<8;i++){f.audio.playNote({id:String(i),midi:60,velocity:80});f.audio.stopNote(60,String(i));}
 assert.equal(f.voices.filter(v=>!v.released).length,8);
 f.advance(1);
 assert.equal(f.voices.filter(v=>!v.released).length,0,'No sustained voice may survive pedal-up');
});
test('a currently held repeated key survives pedal-up then all voices finish',()=>{
 const f=fixture();f.api.schedule(0);
 f.audio.playNote({id:'old',midi:60,velocity:80});f.audio.stopNote(60,'old');
 f.audio.playNote({id:'held',midi:60,velocity:80});f.advance(1);
 assert(f.voices.some(v=>!v.released));
 f.audio.stopNote(60,'held');assert.equal(f.voices.filter(v=>!v.released).length,0);
});
