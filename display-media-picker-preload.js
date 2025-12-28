const { contextBridge, ipcRenderer } = require("electron");

const INIT_CHANNEL = "display-media-picker:init";
const SELECT_CHANNEL = "display-media-picker:select";
const CANCEL_CHANNEL = "display-media-picker:cancel";

let currentToken = null;

contextBridge.exposeInMainWorld("displayMediaPicker", {
  onInit: (handler) => {
    if (typeof handler !== "function") return;

    ipcRenderer.on(INIT_CHANNEL, (_event, payload) => {
      currentToken = payload?.token ?? null;
      handler(payload);
    });
  },
  selectSource: (sourceId) => {
    if (!currentToken) return;
    if (typeof sourceId !== "string" || sourceId.trim().length === 0) return;

    ipcRenderer.send(SELECT_CHANNEL, {
      token: currentToken,
      sourceId,
    });
  },
  cancel: () => {
    if (!currentToken) return;
    ipcRenderer.send(CANCEL_CHANNEL, { token: currentToken });
  },
});


