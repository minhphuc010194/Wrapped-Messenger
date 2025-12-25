const { contextBridge } = require('electron');

// Expose safe APIs to renderer process
// Currently minimal - can be extended if needed for IPC communication

contextBridge.exposeInMainWorld('electronAPI', {
  // Placeholder for future IPC needs
  // Example: window.electronAPI.someMethod()
});

