# Facebook Messenger Desktop Wrapper
<img width="1392" height="1018" alt="image" src="https://github.com/user-attachments/assets/5ca5f1c1-a0a3-4b27-98a7-b8725ca02cd6" />

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

- macOS (Apple Silicon M1/M2/M3)
- Node.js (v16 or higher)
- pnpm or npm

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

To build `.app` and `.dmg` files for distribution:

```bash
pnpm run dist
```

After building, you will find:

- **`.app` file:** `dist/mac-arm64/Messenger.app` - Drag to Applications folder to use
- **`.dmg` file:** `dist/Messenger-1.0.0-arm64.dmg` - Installation file

### Using the built files:

1. **Using `.app` file:**

   - Open `dist/mac-arm64/Messenger.app`
   - Or drag `Messenger.app` to Applications folder

2. **Using `.dmg` file:**
   - Double-click the `.dmg` file to mount
   - Drag `Messenger.app` to Applications folder
   - Eject disk image after installation

> **Note:** The first time you open the app, macOS may display a warning because the app is not code signed. Go to System Settings > Privacy & Security and allow the app to run.

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

- Ensure you're running on macOS
- Check electron-builder is installed: `pnpm list electron-builder`

## Project Structure

```
facebook_messenger_clone/
├── package.json          # Dependencies and build scripts
├── main.js               # Main Electron process
├── preload.js            # Preload script
├── styles.css            # Custom CSS for window styling
├── build/                # Build configuration
│   ├── icon.icns         # Messenger icon (auto-generated)
│   └── entitlements.mac.plist
├── build-icon.sh         # Script to create icon
└── README.md
```

### Creating/Updating Icon

If you want to change the app icon:

```bash
./build-icon.sh
```

The script will automatically download the Messenger logo and create the `build/icon.icns` file for macOS.

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
