const { contextBridge, ipcRenderer } = require('electron');

// 화면(index.html)에서 창을 조절할 수 있게 연결
contextBridge.exposeInMainWorld('winApi', {
  minimize: () => ipcRenderer.invoke('win', 'min'),
  maximize: () => ipcRenderer.invoke('win', 'max'),
  close: () => ipcRenderer.invoke('win', 'close'),
  mini: on => ipcRenderer.invoke('win', on ? 'mini-on' : 'mini-off')
});
