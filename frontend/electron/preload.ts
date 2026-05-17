import { contextBridge } from 'electron';

/**
 * Expõe APIs seguras para o renderer via contextBridge.
 * NÃO expor ipcRenderer diretamente — apenas wraps específicos.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node:     process.versions.node,
    chrome:   process.versions.chrome,
    electron: process.versions.electron,
  },
});
