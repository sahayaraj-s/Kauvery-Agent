const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kauveryDesktop', {
  resizeWindow: (width, height) => ipcRenderer.send('window-resize', { width, height }),
  collapseWindow: () => ipcRenderer.send('window-collapse'),
  expandWindow: (width, height) => ipcRenderer.send('window-expand', { width, height }),
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  toggleAlwaysOnTop: (always) => ipcRenderer.send('window-toggle-top', always),
  dragWindow: (movementX, movementY) => ipcRenderer.send('window-drag', { movementX, movementY }),
  saveExportedFile: (data) => ipcRenderer.invoke('save-exported-file', data),
  openExternal: (url) => ipcRenderer.send('open-external', url),
  onShortcutTriggered: (callback) => {
    ipcRenderer.on('shortcut-toggle', () => callback());
  },
  isElectron: true
});
