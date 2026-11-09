const {createHash, verify} = require('node:crypto');
function httpsUrl(value) { const u=new URL(value); if(u.protocol!=='https:'||u.username||u.password) throw Error('Only HTTPS URLs are allowed'); return u.href; }
function newer(a,b) { const parse=v=>{if(!/^\d+\.\d+\.\d+$/.test(v))throw Error('Invalid stable version');return v.split('.').map(Number)}; const x=parse(a),y=parse(b);return x.some((v,i)=>v>y[i]&&x.slice(0,i).every((n,j)=>n===y[j])); }
function validateRelease(envelope,key,current) {
 if(!key)throw Error('Update signing public key is not configured');
 if(typeof envelope.payload!=='string'||!verify(null,Buffer.from(envelope.payload),key,Buffer.from(envelope.signature||'','base64')))throw Error('Invalid release signature');
 const r=JSON.parse(envelope.payload);
 if(r.schema!==1||r.channel!=='stable'||r.platform!=='darwin'||r.arch!=='arm64'||!Number.isSafeInteger(r.size)||r.size<1||r.size>600*1024*1024||!/^([a-f0-9]{64})$/.test(r.sha256))throw Error('Invalid release metadata');
 httpsUrl(r.url); if(typeof r.notes!=='string'||r.notes.length>20000)throw Error('Invalid release notes');
 return newer(r.version,current)?r:null;
}
function verifyBytes(bytes,r){if(bytes.length!==r.size||createHash('sha256').update(bytes).digest('hex')!==r.sha256)throw Error('Update checksum/size mismatch');}
async function download(url,limit,fetcher=fetch){
 const response=await fetcher(httpsUrl(url),{redirect:'error',signal:AbortSignal.timeout(120000)});
 if(!response.ok)throw Error(`HTTP ${response.status}`); const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.length;if(size>limit)throw Error('Download exceeds limit');chunks.push(Buffer.from(chunk));}
 return Buffer.concat(chunks);
}
module.exports={httpsUrl,newer,validateRelease,verifyBytes,download};
