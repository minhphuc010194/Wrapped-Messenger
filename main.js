const {
  app,
  BrowserWindow,
  Menu,
  session,
  ipcMain,
  desktopCapturer,
  dialog,
  systemPreferences,
} = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Suppress harmless macOS system warnings
// These warnings are printed to stderr by Electron itself and are harmless
if (process.platform === "darwin") {
  // Filter stderr to suppress known harmless warnings
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk, encoding, fd) => {
    const message = chunk.toString();
    if (
      message.includes("IMKCFRunLoopWakeUpReliable") ||
      message.includes("sysctlbyname") ||
      message.includes("kern.hv_vmm_present")
    ) {
      return true; // Suppress these warnings
    }
    return originalStderrWrite(chunk, encoding, fd);
  };
}

let mainWindow = null;
let isQuitting = false;
const WINDOW_STATE_FILE = path.join(
  app.getPath("userData"),
  "window-state.json"
);

const TRUSTED_HOST_SUFFIXES = ["messenger.com", "facebook.com"];
const DISPLAY_MEDIA_PICKER_PRELOAD = path.join(
  __dirname,
  "display-media-picker-preload.js"
);
const DISPLAY_MEDIA_PICKER_HTML = path.join(
  __dirname,
  "display-media-picker.html"
);

function tryGetHostname(urlOrOrigin) {
  if (typeof urlOrOrigin !== "string" || urlOrOrigin.trim().length === 0) {
    return null;
  }

  try {
    return new URL(urlOrOrigin).hostname;
  } catch {
    return null;
  }
}

function isTrustedOrigin(urlOrOrigin) {
  const hostname = tryGetHostname(urlOrOrigin);
  if (!hostname) return false;

  return TRUSTED_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );
}

function isAllowedPermission(permission) {
  return (
    permission === "media" ||
    permission === "microphone" ||
    permission === "camera" ||
    permission === "display-capture"
  );
}

function buildContextMenuTemplate(params) {
  const editFlags = params?.editFlags || {};

  const hasSelectionText =
    typeof params?.selectionText === "string" && params.selectionText.length > 0;

  const template = [];

  if (params?.isEditable) {
    template.push(
      { role: "undo", enabled: Boolean(editFlags.canUndo) },
      { role: "redo", enabled: Boolean(editFlags.canRedo) },
      { type: "separator" },
      { role: "cut", enabled: Boolean(editFlags.canCut) },
      { role: "copy", enabled: Boolean(editFlags.canCopy) },
      { role: "paste", enabled: Boolean(editFlags.canPaste) },
      { type: "separator" },
      { role: "selectAll", enabled: Boolean(editFlags.canSelectAll) }
    );
    return template;
  }

  template.push(
    { role: "copy", enabled: Boolean(editFlags.canCopy) || hasSelectionText },
    { type: "separator" },
    { role: "selectAll", enabled: Boolean(editFlags.canSelectAll) }
  );

  return template;
}

function installContextMenuForWebContents(webContents) {
  webContents.on("context-menu", (event, params) => {
    event.preventDefault();

    const menuTemplate = buildContextMenuTemplate(params);
    const menu = Menu.buildFromTemplate(menuTemplate);
    const targetWindow = BrowserWindow.fromWebContents(webContents);

    menu.popup({
      window: targetWindow || undefined,
    });
  });
}

function createRandomToken() {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return crypto.randomBytes(16).toString("hex");
}

function serializeDesktopSource(source) {
  const thumbnailDataUrl =
    typeof source?.thumbnail?.toDataURL === "function"
      ? source.thumbnail.toDataURL()
      : null;
  const appIconDataUrl =
    typeof source?.appIcon?.toDataURL === "function"
      ? source.appIcon.toDataURL()
      : null;

  return {
    id: source.id,
    name: source.name,
    thumbnailDataUrl,
    appIconDataUrl,
  };
}

function getMacScreenCaptureAccessStatus() {
  if (process.platform !== "darwin") return null;
  try {
    return systemPreferences.getMediaAccessStatus("screen");
  } catch (error) {
    console.warn("Unable to read macOS screen capture access status:", error);
    return null;
  }
}

async function askForMacScreenCaptureAccessIfNeeded() {
  if (process.platform !== "darwin") return true;

  const status = getMacScreenCaptureAccessStatus();
  if (status === "granted") return true;
  if (status && status !== "not-determined") return false;

  try {
    // On some macOS versions, Electron can trigger the OS prompt.
    // If the OS doesn't support prompting, this will resolve to false.
    return await systemPreferences.askForMediaAccess("screen");
  } catch (error) {
    console.warn("Unable to request macOS screen capture access:", error);
    return false;
  }
}

async function showDisplayMediaPicker({ parentWindow, sources }) {
  const token = createRandomToken();
  const serializedSources = sources.map(serializeDesktopSource);

  return await new Promise((resolve) => {
    let isResolved = false;
    const resolveOnce = (value) => {
      if (isResolved) return;
      isResolved = true;
      resolve(value);
    };

    const pickerWindow = new BrowserWindow({
      width: 860,
      height: 620,
      show: false,
      title: "Share your screen",
      modal: Boolean(parentWindow),
      parent: parentWindow || undefined,
      resizable: true,
      minimizable: false,
      maximizable: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: DISPLAY_MEDIA_PICKER_PRELOAD,
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    const cleanupIpcHandlers = () => {
      ipcMain.removeListener("display-media-picker:select", onSelect);
      ipcMain.removeListener("display-media-picker:cancel", onCancel);
    };

    const onSelect = (event, payload) => {
      if (event.sender !== pickerWindow.webContents) return;
      if (!payload || payload.token !== token) return;
      cleanupIpcHandlers();
      resolveOnce(payload.sourceId || null);
      pickerWindow.close();
    };

    const onCancel = (event, payload) => {
      if (event.sender !== pickerWindow.webContents) return;
      if (!payload || payload.token !== token) return;
      cleanupIpcHandlers();
      resolveOnce(null);
      pickerWindow.close();
    };

    ipcMain.on("display-media-picker:select", onSelect);
    ipcMain.on("display-media-picker:cancel", onCancel);

    pickerWindow.on("closed", () => {
      cleanupIpcHandlers();
      resolveOnce(null);
    });

    pickerWindow
      .loadFile(DISPLAY_MEDIA_PICKER_HTML)
      .then(() => {
        pickerWindow.webContents.send("display-media-picker:init", {
          token,
          sources: serializedSources,
        });
        pickerWindow.show();
      })
      .catch((error) => {
        console.error("Failed to load display media picker:", error);
        cleanupIpcHandlers();
        resolveOnce(null);
        pickerWindow.close();
      });
  });
}

// Load window state from file
function loadWindowState() {
  try {
    if (fs.existsSync(WINDOW_STATE_FILE)) {
      const data = fs.readFileSync(WINDOW_STATE_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading window state:", error);
  }
  return null;
}

// Save window state to file
function saveWindowState() {
  if (!mainWindow) return;

  try {
    const bounds = mainWindow.getBounds();
    const state = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      isMaximized: mainWindow.isMaximized(),
    };
    fs.writeFileSync(WINDOW_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    console.error("Error saving window state:", error);
  }
}

// Parse unread count from page title
function parseUnreadCount(title) {
  if (!title) return 0;

  // Match patterns like "(2) Messenger" or "Messenger (2)" or "(2) Messenger - Facebook"
  const match = title.match(/\((\d+)\)/);
  if (match && match[1]) {
    const count = parseInt(match[1], 10);
    return isNaN(count) ? 0 : count;
  }

  return 0;
}

// Update dock badge with unread count
function updateDockBadge(title) {
  const count = parseUnreadCount(title);
  app.setBadgeCount(count);
}

// Inject CSS styles
function injectStyles(webContents) {
  const cssPath = path.join(__dirname, "styles.css");
  try {
    const css = fs.readFileSync(cssPath, "utf8");
    webContents.insertCSS(css);
  } catch (error) {
    console.error("Error injecting CSS:", error);
  }
}

function createWindow() {
  const windowState = loadWindowState();

  const windowOptions = {
    frame: false, // Remove default OS window frame
    width: windowState?.width || 1200,
    height: windowState?.height || 800,
    x: windowState?.x,
    y: windowState?.y,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      partition: "persist:messenger",
    },
  };

  // macOS-specific options
  if (process.platform === "darwin") {
    windowOptions.titleBarStyle = "hidden";
    windowOptions.titleBarOverlay = {
      color: "transparent",
      symbolColor: "#000000",
      height: 30,
    };
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Restore maximized state if applicable
  if (windowState?.isMaximized) {
    mainWindow.maximize();
  }

  // Load Messenger login page
  mainWindow.loadURL("https://www.messenger.com/login");

  // Inject CSS after page loads
  mainWindow.webContents.on("did-finish-load", () => {
    injectStyles(mainWindow.webContents);
  });

  // Also inject CSS when DOM is ready (in case did-finish-load fires too early)
  mainWindow.webContents.on("dom-ready", () => {
    setTimeout(() => {
      injectStyles(mainWindow.webContents);
    }, 1000); // Wait 1 second for Messenger to fully load
  });

  // Handle page title updates for dock badge
  mainWindow.webContents.on("page-title-updated", (event, title) => {
    updateDockBadge(title);
  });

  // Save window state on move/resize
  let saveStateTimeout;
  const throttledSaveState = () => {
    clearTimeout(saveStateTimeout);
    saveStateTimeout = setTimeout(() => {
      saveWindowState();
    }, 500);
  };

  mainWindow.on("move", throttledSaveState);
  mainWindow.on("resize", throttledSaveState);
  mainWindow.on("maximize", saveWindowState);
  mainWindow.on("unmaximize", saveWindowState);

  // Handle window close - hide instead of quit on macOS (only when clicking red X)
  mainWindow.on("close", (event) => {
    if (process.platform === "darwin" && !isQuitting) {
      // User clicked red X button - hide window instead of quitting
      event.preventDefault();
      mainWindow.hide();
      saveWindowState();
    } else {
      // App is quitting (Cmd+Q or Quit menu) - allow quit
      saveWindowState();
    }
  });

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Configure session permissions
function configurePermissions() {
  const persistentSession = session.fromPartition("persist:messenger");

  persistentSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin) => {
      if (!isAllowedPermission(permission)) return false;
      return isTrustedOrigin(requestingOrigin || webContents.getURL());
    }
  );

  persistentSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      const requestingOrigin =
        details?.requestingOrigin || details?.requestingUrl || webContents.getURL();

      if (!isAllowedPermission(permission)) {
        callback(false);
        return;
      }

      // Only auto-approve for trusted Messenger/Facebook origins.
      callback(isTrustedOrigin(requestingOrigin));
    }
  );

  // Handle media device access
  persistentSession.setDevicePermissionHandler((details) => {
    if (
      details.deviceType === "microphone" ||
      details.deviceType === "camera"
    ) {
      return true;
    }
    return false;
  });

  persistentSession.setDisplayMediaRequestHandler(
    async (request, callback) => {
      if (!isTrustedOrigin(request.securityOrigin)) {
        callback({});
        return;
      }

      // Only allow display capture from an explicit user gesture.
      if (!request.userGesture) {
        callback({});
        return;
      }

      if (!request.videoRequested) {
        callback({});
        return;
      }

      // macOS requires Screen Recording permission (System Settings -> Privacy & Security).
      // Electron may be able to trigger the system prompt, but users might need to grant it manually.
      const hasScreenPermission = await askForMacScreenCaptureAccessIfNeeded();
      if (!hasScreenPermission) {
        if (process.platform === "darwin") {
          const status = getMacScreenCaptureAccessStatus();
          const detail =
            status && status !== "not-determined"
              ? `Current status: ${status}`
              : undefined;

          try {
            await dialog.showMessageBox(mainWindow || undefined, {
              type: "warning",
              title: "Screen Recording permission required",
              message:
                "Screen sharing requires Screen Recording permission on macOS.",
              detail:
                (detail ? `${detail}\n\n` : "") +
                "Open System Settings → Privacy & Security → Screen Recording, enable permission for this app, then quit and re-open it.",
              buttons: ["OK"],
              defaultId: 0,
              noLink: true,
            });
          } catch (error) {
            console.warn("Unable to show Screen Recording permission dialog:", error);
          }
        }

        callback({});
        return;
      }

      try {
        const sources = await desktopCapturer.getSources({
          types: ["screen", "window"],
          thumbnailSize: { width: 320, height: 180 },
          fetchWindowIcons: true,
        });

        const selectedSourceId = await showDisplayMediaPicker({
          parentWindow: mainWindow,
          sources,
        });

        const selectedSource = sources.find((s) => s.id === selectedSourceId);
        if (!selectedSource) {
          callback({});
          return;
        }

        const streams = { video: selectedSource };
        if (request.audioRequested && process.platform === "win32") {
          streams.audio = "loopbackWithMute";
        }

        callback(streams);
      } catch (error) {
        console.error("Error while handling display media request:", error);
        callback({});
      }
    },
    process.platform === "darwin" ? { useSystemPicker: true } : undefined
  );
}

// Create application menu
function createMenu() {
  const template = [
    {
      label: app.getName(),
      submenu: [
        { role: "about", label: "About Messenger" },
        { type: "separator" },
        { role: "services", label: "Services", submenu: [] },
        { type: "separator" },
        { role: "hide", label: "Hide Messenger" },
        { role: "hideOthers", label: "Hide Others" },
        { role: "unhide", label: "Show All" },
        { type: "separator" },
        {
          role: "quit",
          label: "Quit Messenger",
          accelerator: "Command+Q",
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo", label: "Undo" },
        { role: "redo", label: "Redo" },
        { type: "separator" },
        { role: "cut", label: "Cut" },
        { role: "copy", label: "Copy" },
        { role: "paste", label: "Paste" },
        { role: "pasteAndMatchStyle", label: "Paste and Match Style" },
        { role: "delete", label: "Delete" },
        { role: "selectAll", label: "Select All" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload", label: "Reload" },
        { role: "forceReload", label: "Force Reload" },
        { role: "toggleDevTools", label: "Toggle Developer Tools" },
        { type: "separator" },
        { role: "resetZoom", label: "Actual Size" },
        { role: "zoomIn", label: "Zoom In" },
        { role: "zoomOut", label: "Zoom Out" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Toggle Full Screen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize", label: "Minimize" },
        { role: "close", label: "Close" },
        { type: "separator" },
        { role: "front", label: "Bring All to Front" },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event handlers
app.whenReady().then(() => {
  app.on("web-contents-created", (_event, contents) => {
    installContextMenuForWebContents(contents);
  });

  configurePermissions();
  createMenu();
  createWindow();

  // macOS: Re-create window when dock icon is clicked
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

// macOS: Don't quit when all windows are closed
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Save window state before quitting
app.on("before-quit", (event) => {
  isQuitting = true;
  saveWindowState();
});
