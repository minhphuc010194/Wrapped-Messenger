const { app, BrowserWindow, Menu, session, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

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
    titleBarStyle: "hidden",
    width: windowState?.width || 1200,
    height: windowState?.height || 800,
    x: windowState?.x,
    y: windowState?.y,
    minWidth: 800,
    minHeight: 600,
    titleBarOverlay: {
      color: "transparent",
      symbolColor: "#000000",
      height: 30,
    },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      partition: "persist:messenger",
    },
  };

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

  persistentSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      // Auto-approve microphone and camera permissions for video calls
      if (
        permission === "media" ||
        permission === "microphone" ||
        permission === "camera"
      ) {
        callback(true);
      } else {
        // Deny other permissions by default
        callback(false);
      }
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
