import test from 'node:test';
import assert from 'node:assert/strict';
import {SampledPiano} from '../frontend/src/runtime/sampled-piano.mjs';

test('lazy preparation loads both recorded dynamics before a crossfaded performance',async()=>{
  const piano=Object.create(SampledPiano.prototype);
  piano.manifest={lazy:true};piano.layers=[40,80,120];
  piano.resident=new Set(['60:80']);
  piano.buffers=new Map([['60:80',{}],['21:40',{}]]);
  piano.load=async()=>{};
  let requested;
  piano.ensureSamples=async ids=>{requested=[...ids].sort();};
  await piano.prepareNotes([{midi:60,velocity:61},{midi:72,velocity:84},{midi:108,velocity:127},{midi:21,velocity:0}]);
  assert.deepEqual(requested,['108:120','60:40','60:80','72:120','72:80']);
  assert(!piano.buffers.has('21:40'),'Previous piece samples are released');
  assert(piano.buffers.has('60:80'),'Live keyboard middle dynamic remains resident');
});

test('region-mapped libraries retain their single recorded dynamic',async()=>{
  const piano=Object.create(SampledPiano.prototype);
  piano.manifest={lazy:true,keyRegions:[{low:68,high:70,midi:69}],velocityRanges:[{low:1,high:64,layer:4},{low:65,high:127,layer:11}]};
  piano.layers=[4,11];piano.resident=new Set();piano.buffers=new Map();
  piano.load=async()=>{};
  let requested;piano.ensureSamples=async ids=>{requested=[...ids].sort();};
  await piano.prepareNotes([{midi:70,velocity:84}]);
  assert.deepEqual(requested,['69:11']);
});
