const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File selection
  selectModelFile: () => ipcRenderer.invoke('llama:select-model'),

  // Server management
  launchServer: (modelPath, options) => ipcRenderer.invoke('llama:launch-server', modelPath, options),
  stopServer: () => ipcRenderer.invoke('llama:stop-server'),
  getServerStatus: () => ipcRenderer.invoke('llama:get-status'),

  // Binary detection
  detectLlamaServer: () => ipcRenderer.invoke('llama:detect-binary'),
  setLlamaServerPath: (path) => ipcRenderer.invoke('llama:set-binary-path', path),

  // Status change subscription
  onServerStatusChange: (callback) => {
    const subscription = (_event, status) => callback(status);
    ipcRenderer.on('llama:status-changed', subscription);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('llama:status-changed', subscription);
    };
  },

  // Server output subscription (for logs)
  onServerOutput: (callback) => {
    const subscription = (_event, output) => callback(output);
    ipcRenderer.on('llama:server-output', subscription);

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeListener('llama:server-output', subscription);
    };
  },

  // Check if running in Electron
  isElectron: true,
});
