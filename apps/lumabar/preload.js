'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// The only surface the renderer can reach. Everything else stays in the main process.
contextBridge.exposeInMainWorld('lumabar', {
  getState: () => ipcRenderer.invoke('state:get'),
  setState: (patch) => ipcRenderer.invoke('state:set', patch),
  onState: (cb) => ipcRenderer.on('state:update', (_e, s) => cb(s)),
  stats: () => ipcRenderer.invoke('stats:get'),
  fetchJson: (url) => ipcRenderer.invoke('fetch:json', url),
  launch: (target) => ipcRenderer.invoke('launch', target),
  fileIcon: (p) => ipcRenderer.invoke('icon:get', p),
  pickApp: () => ipcRenderer.invoke('pick:app'),
  openFlyout: (id, anchorX) => ipcRenderer.send('flyout:open', { id, anchorX }),
  closeFlyout: () => ipcRenderer.send('flyout:close'),
  dockWidth: (w) => ipcRenderer.send('dock:width', w),
  quit: () => ipcRenderer.send('app:quit'),
});
