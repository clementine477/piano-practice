const {contextBridge,ipcRenderer,webUtils}=require('electron');
contextBridge.exposeInMainWorld('localUpdates',{
 info:()=>ipcRenderer.invoke('localUpdates:info'),
 prepare:()=>ipcRenderer.invoke('localUpdates:prepare'),
 prepareFile:file=>ipcRenderer.invoke('localUpdates:prepare',webUtils.getPathForFile(file)),
 install:()=>ipcRenderer.invoke('localUpdates:install')
});
