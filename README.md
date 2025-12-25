# Facebook Messenger Desktop Wrapper

<img width="1335" height="870" alt="image" src="https://github.com/user-attachments/assets/91022f2c-8536-482d-830f-2bc531509f0b" />
Native macOS app wrapper for Facebook Messenger built with Electron.

## Features

- ✅ Auto-login persistence (no need to login again each time you open the app)
- ✅ Hide window instead of quit when clicking close button (macOS)
- ✅ Remember window size and position
- ✅ Display unread message count on Dock icon
- ✅ Support video calls (microphone & camera)
- ✅ Frameless window with custom title bar
- ✅ Native macOS traffic lights integration
- ✅ Customizable padding and scroll behavior
- ✅ Drag-to-move window from header area

## Requirements

**For running the app:**

- macOS (Apple Silicon M1/M2/M3) or Windows 10/11 (x64)
- Node.js (v16 or higher)
- pnpm or npm

**For building:**

- **macOS build:** Must run on macOS
- **Windows build:** Must run on Windows (or use CI/CD like GitHub Actions)

## Installation

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

   > **Note for pnpm:** After installation, run `pnpm approve-builds` and select `electron`, then reinstall:
   >
   > ```bash
   > pnpm remove electron && pnpm add -D electron
   > ```

## Development

To run the app in development mode:

```bash
pnpm dev
```

The app will open and load Messenger. You can open DevTools via `View > Toggle Developer Tools` to debug.

## Build Production

### Build for macOS

To build `.app` and `.dmg` files for macOS:

```bash
pnpm run dist
```

After building, you will find:

- **`.app` file:** `dist/mac-arm64/Messenger.app` - Drag to Applications folder to use
- **`.dmg` file:** `dist/Messenger-1.0.0-arm64.dmg` - Installation file

### Build for Windows

To build Windows installer and portable version:

```bash
pnpm run dist:win
```

After building, you will find:

- **`.exe` installer:** `dist/Messenger Setup 1.0.0.exe` - Windows installer (NSIS)
- **Portable `.exe`:** `dist/Messenger 1.0.0.exe` - Portable version (no installation needed)

**Requirements for building Windows version:**

- Must be built on Windows machine (or use CI/CD)
- Windows 10/11 (x64)

### Build for all platforms

To build for both macOS and Windows:

```bash
pnpm run dist:all
```

> **Note:** Building for Windows requires running on a Windows machine. You cannot build Windows executables on macOS.

### Using the built files:

**macOS:**

1. **Using `.app` file:**

   - Open `dist/mac-arm64/Messenger.app`
   - Or drag `Messenger.app` to Applications folder

2. **Using `.dmg` file:**
   - Double-click the `.dmg` file to mount
   - Drag `Messenger.app` to Applications folder
   - Eject disk image after installation

**Windows:**

1. **Using installer (`.exe`):**

   - Double-click `Messenger Setup 1.0.0.exe`
   - Follow the installation wizard
   - Choose installation directory if needed
   - Desktop and Start Menu shortcuts will be created

2. **Using portable version:**
   - Run `Messenger 1.0.0.exe` directly
   - No installation required
   - Can be run from USB drive or any location

> **Note:** The first time you open the app, macOS may display a warning because the app is not code signed. Go to System Settings > Privacy & Security and allow the app to run. Windows may also show a SmartScreen warning - click "More info" and "Run anyway" if you trust the app.

## Troubleshooting

### App won't run / "Electron failed to install correctly"

**With pnpm:**

```bash
# Run this command to approve build scripts
pnpm approve-builds
# Select "electron" when prompted

# Then reinstall electron
pnpm remove electron && pnpm add -D electron
```

**Or run quickly:**

```bash
node node_modules/.pnpm/electron@*/node_modules/electron/install.js
```

**With npm:**

```bash
rm -rf node_modules && npm install
```

### Build fails

**macOS:**

- Ensure you're running on macOS
- Check electron-builder is installed: `pnpm list electron-builder`

**Windows:**

- Ensure you're running on Windows (or using CI/CD)
- Check electron-builder is installed: `pnpm list electron-builder`
- Ensure `build/icon.ico` file exists (required for Windows build)

## Project Structure

```
facebook_messenger_clone/
├── package.json          # Dependencies and build scripts
├── main.js               # Main Electron process
├── preload.js            # Preload script
├── styles.css            # Custom CSS for window styling
├── build/                # Build configuration
│   ├── icon.icns         # macOS icon (auto-generated)
│   ├── icon.ico          # Windows icon (required for Windows build)
│   └── entitlements.mac.plist
├── build-icon.sh         # Script to create icon
└── README.md
```

### Creating/Updating Icon

**macOS:**

If you want to change the macOS app icon:

```bash
./build-icon.sh
```

The script will automatically download the Messenger logo and create the `build/icon.icns` file for macOS.

**Windows:**

For Windows builds, you need a `.ico` file. You can:

1. **Convert from existing image:**

   - Use online tools like [ConvertICO](https://convertio.co/png-ico/) or [ICO Convert](https://icoconvert.com/)
   - Upload a PNG image (256x256 or 512x512 recommended)
   - Download the `.ico` file and save it as `build/icon.ico`

2. **Create manually:**
   - Use tools like [IcoFX](https://icofx.ro/) or [GIMP](https://www.gimp.org/)
   - Create an icon with multiple sizes (16x16, 32x32, 48x48, 256x256)
   - Save as `build/icon.ico`

> **Note:** The Windows build will fail if `build/icon.ico` is missing. Make sure to create this file before building for Windows.

## Customization

### Change default window size

Edit `main.js`, find these lines:

```javascript
width: windowState?.width || 1200,  // Change 1200 to your desired width
height: windowState?.height || 800,  // Change 800 to your desired height
```

### Change app display name

Edit `package.json`, find the `productName` field:

```json
"productName": "Messenger"
```

Change it to your desired name. You may also want to update menu labels in `main.js`.

### Customize CSS

Edit `styles.css` to change the appearance. The file includes:

- Window scroll behavior configuration
- Content padding settings
- Header drag region styling
- Traffic lights area overlay
- Scrollbar hiding

### Adjust traffic lights position

Edit `main.js`, find the `titleBarOverlay` section:

```javascript
titleBarOverlay: {
  color: "transparent",
  symbolColor: "#000000",
  height: 30,  // Adjust height to move traffic lights up/down
}
```

### Adjust content padding

Edit `styles.css`, find the padding settings:

```css
html,
body {
  padding-top: 20px !important; // Adjust top padding
}
```

Or modify the root container padding:

```css
body > div:first-child {
  padding: 8px !important; // Adjust overall padding
}
```

## License

MIT
