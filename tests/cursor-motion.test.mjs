import assert from 'node:assert/strict';
import {fitCursorPath,cursorPathX} from '../frontend/src/runtime/cursor-motion.mjs';
// Includes a wide bar boundary between closely timed notes and a tempo change.
const points=[{seconds:0,x:20},{seconds:.2,x:36},{seconds:.4,x:52},{seconds:.6,x:121},{seconds:.9,x:137},{seconds:1.6,x:152}];
const path=fitCursorPath(points);
let previous=-Infinity,count=0,maxVelocityJump=0;
for(let i=0;i<path.length-1;i++){
 const a=path[i],b=path[i+1];assert.equal(cursorPathX(a,b,a.seconds),a.x);assert.equal(cursorPathX(a,b,b.seconds),b.x);
 for(let step=0;step<=1000;step++){
  const x=cursorPathX(a,b,a.seconds+(b.seconds-a.seconds)*step/1000);
  assert(x>=a.x-1e-8&&x<=b.x+1e-8);assert(x>=previous-1e-8);previous=x;count++;
 }
 if(i>0){const dt=1e-7,left=(a.x-cursorPathX(path[i-1],a,a.seconds-dt))/dt,right=(cursorPathX(a,b,a.seconds+dt)-a.x)/dt;
  maxVelocityJump=Math.max(maxVelocityJump,Math.abs(left-right));assert(Math.abs(left-right)<.002);}
}
console.log(JSON.stringify({positionsChecked:count,allNoteAnchorsExact:true,monotone:true,maxVelocityJump}));
