const fs=require('node:fs/promises'),path=require('node:path');
const {execFile,spawn}=require('node:child_process');const run=require('node:util').promisify(execFile);
const {dialog}=require('electron');const service=require('./local-update-service.cjs');
function installUpdates({app,ipcMain,win,local}){
 let staged=null,busy=false,temp=null;
 function handle(name,fn){ipcMain.handle('localUpdates:'+name,async(e,...args)=>{if(e.sender!==win.webContents||e.senderFrame!==win.webContents.mainFrame||!local(e.senderFrame.url))throw Error('Forbidden');return fn(...args)})}
 handle('info',()=>({version:app.getVersion()}));
 handle('prepare',async file=>{if(busy)throw Error('更新操作进行中');busy=true;staged=null;try{
  if(process.platform!=='darwin'||process.arch!=='arm64'||!app.isPackaged)throw Error('请在已安装的 macOS arm64 App 中导入更新');
  if(!file){const result=await dialog.showOpenDialog(win,{title:'导入更新包',filters:[{name:'Piano Practice 更新包',extensions:['ppupdate']}],properties:['openFile']});if(result.canceled)return null;file=result.filePaths[0];}
  if(typeof file!=='string'||!file.toLowerCase().endsWith('.ppupdate'))throw Error('请选择 .ppupdate 文件');
  if(temp)await fs.rm(temp,{recursive:true,force:true});temp=await fs.mkdtemp(path.join(app.getPath('userData'),'local-update-'));
  staged=await service.prepare(file,temp,app.getVersion(),run);return {version:staged.manifest.version,notes:staged.manifest.notes,ready:true};
 }catch(e){if(temp)await fs.rm(temp,{recursive:true,force:true});temp=null;throw e}finally{busy=false}});
 handle('install',async()=>{if(busy||!staged)throw Error('请先导入并校验更新包');busy=true;let sibling;
  try{const live=path.resolve(process.execPath,'../../..');sibling=await service.stage(staged,live,run);
   const helper=path.join(app.getPath('userData'),'restart-update.sh');await fs.copyFile(path.join(__dirname,'restart-update.sh'),helper);
   const child=spawn('/bin/bash',[helper,String(process.pid),sibling.candidate,live,live+`.previous-${app.getVersion()}-${Date.now()}`,path.join(app.getPath('userData'),'update-install.log')],{detached:true,stdio:'ignore'});
   await new Promise((res,rej)=>{child.once('spawn',res);child.once('error',rej)});child.unref();app.quit();return true;
  }catch(e){if(sibling)await fs.rm(sibling.dir,{recursive:true,force:true});busy=false;throw e}
 });
}
module.exports={installUpdates};
