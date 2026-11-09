const fs=(()=>{try{return require('original-fs').promises}catch{return require('node:fs/promises')}})(),path=require('node:path'),crypto=require('node:crypto');
const yauzl=require('yauzl');
const MAX_PACKAGE=600*1024*1024,MAX_EXPANDED=1800*1024*1024;
function newer(a,b){const parse=v=>{if(typeof v!=='string'||!/^\d+\.\d+\.\d+$/.test(v))throw Error('Invalid version');return v.split('.').map(Number)};const aa=parse(a),bb=parse(b);for(let i=0;i<3;i++){if(aa[i]!==bb[i])return aa[i]>bb[i]}return false}
function validateManifest(m,current){if(!m||m.schema!==1||m.platform!=='darwin'||m.arch!=='arm64'||m.bundleId!=='local.piano.practice'||typeof m.notes!=='string'||m.notes.length>20000||typeof m.payloadSha256!=='string'||!/^[a-f0-9]{64}$/.test(m.payloadSha256)||!newer(m.version,current))throw Error('更新包目标、版本或清单无效');return m}
function open(zip){return new Promise((res,rej)=>yauzl.open(zip,{lazyEntries:true,autoClose:false,strictFileNames:true,validateEntrySizes:true},(e,z)=>e?rej(e):res(z)))}
function entries(z){return new Promise((res,rej)=>{const all=[];let total=0;z.on('error',rej);z.on('entry',e=>{total+=e.uncompressedSize;if(all.length>=30000||total>MAX_EXPANDED||(e.generalPurposeBitFlag&1)){rej(Error('Archive limit/encryption'));return}all.push(e);z.readEntry()});z.once('end',()=>res(all));z.readEntry()})}
function stream(z,e){return new Promise((res,rej)=>z.openReadStream(e,(err,s)=>err?rej(err):res(s)))}
async function read(z,e,max){if(e.uncompressedSize>max)throw Error('Entry too large');const source=await stream(z,e);return new Promise((resolve,reject)=>{const chunks=[];let n=0;source.on('error',reject);source.on('data',c=>{n+=c.length;if(n>max){source.destroy();reject(Error('Entry too large'));return}chunks.push(c)});source.on('end',()=>resolve(Buffer.concat(chunks)));});}

function cleanName(name){const n=name.replace(/\/$/,'');if(!n||n.includes('\\')||n.includes('\0')||n.startsWith('/')||/^[A-Za-z]:/.test(n)||n.split('/').some(p=>!p||p==='..'||p==='.'||p.includes(':')))throw Error('Unsafe archive path');return n}
async function extractSafe(zip,dest,appOnly=false){const z=await open(zip);try{
 const all=await entries(z),names=new Map(),folded=new Set(),links=new Map();
 // Validate all paths and links before writing ANY payload file. Link creation
 // is deferred until every regular file is closed, so extraction never follows links.
 for(const e of all){const n=cleanName(e.fileName),fold=n.normalize('NFD').toLowerCase();if(folded.has(fold))throw Error('Duplicate/case-colliding path');folded.add(fold);if(appOnly&&n!=='Piano Practice.app'&&!n.startsWith('Piano Practice.app/'))throw Error('Unexpected app layout');names.set(n,e);const type=(e.externalFileAttributes>>>16)&0xf000;if(type&&![0x4000,0x8000,0xa000].includes(type))throw Error('Unsupported file type');if(type===0xa000)links.set(n,(await read(z,e,4096)).toString('utf8'));}
 for(const n of names.keys()){let p=path.posix.dirname(n);while(p!=='.'){const ancestor=names.get(p);if(links.has(p)||(ancestor&&!ancestor.fileName.endsWith('/')))throw Error('Non-directory ancestor');p=path.posix.dirname(p)}}
 function resolveLink(n,seen=new Set()){
  if(seen.has(n))throw Error('Symlink cycle');seen.add(n);const target=links.get(n);if(target===undefined)return n;
  if(!target||target.startsWith('/')||target.includes('\\')||target.includes('\0')||target.includes(':'))throw Error('Unsafe symlink');
  let result=path.posix.normalize(path.posix.join(path.posix.dirname(n),target));if(result==='..'||result.startsWith('../')||(appOnly&&!result.startsWith('Piano Practice.app/')))throw Error('Escaping symlink');
  const parts=result.split('/');for(let i=1;i<=parts.length;i++){const prefix=parts.slice(0,i).join('/');if(links.has(prefix)){result=path.posix.join(resolveLink(prefix,new Set(seen)),...parts.slice(i));break}}
  if(!names.has(result)&&!Array.from(names.keys()).some(k=>k.startsWith(result+'/')))throw Error('Broken symlink');return result;
 }
 for(const n of links.keys())resolveLink(n);
 await fs.mkdir(dest,{recursive:true,mode:0o700});
 for(const [n,e] of names){if(links.has(n))continue;const out=path.join(dest,n);if(e.fileName.endsWith('/')){await fs.mkdir(out,{recursive:true,mode:0o755});continue}await fs.mkdir(path.dirname(out),{recursive:true,mode:0o755});const h=await fs.open(out,'wx',((e.externalFileAttributes>>>16)&0o777)||0o644);try{await h.writeFile(await read(z,e,MAX_PACKAGE))}finally{await h.close()}}
 for(const [n,target] of links){await fs.mkdir(path.dirname(path.join(dest,n)),{recursive:true});await fs.symlink(target,path.join(dest,n));}
}finally{z.close()}}
async function unpackPackage(file,temp,current){
 const st=await fs.stat(file);if(!st.isFile()||st.size>MAX_PACKAGE)throw Error('更新包过大或不是文件');
 const z=await open(file);let manifest,payload;try{const all=await entries(z);if(all.length!==2||!all.some(e=>e.fileName==='manifest.json')||!all.some(e=>e.fileName==='app.zip'))throw Error('更新包必须包含 manifest.json 和 app.zip');manifest=validateManifest(JSON.parse((await read(z,all.find(e=>e.fileName==='manifest.json'),65536)).toString()),current);payload=await read(z,all.find(e=>e.fileName==='app.zip'),MAX_PACKAGE);}finally{z.close()}
 if(crypto.createHash('sha256').update(payload).digest('hex')!==manifest.payloadSha256)throw Error('更新包校验失败');
 const inner=path.join(temp,'app.zip');await fs.writeFile(inner,payload,{mode:0o600});payload=null;
 const root=path.join(temp,'payload');await extractSafe(inner,root,true);return {manifest,candidate:path.join(root,'Piano Practice.app')};
}
module.exports={unpackPackage,extractSafe,validateManifest,newer};
