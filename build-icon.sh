#!/bin/bash

# Script to download Messenger icon and create .icns file for macOS

echo "Downloading Messenger icon..."

# Create build directory if it doesn't exist
mkdir -p build/icon.iconset

# Try multiple sources for Messenger icon
ICON_URL=""
ICON_DOWNLOADED=false

# Try downloading from different sources
for url in \
  "https://upload.wikimedia.org/wikipedia/commons/8/83/Facebook_Messenger_4_Logo.svg" \
  "https://www.facebook.com/images/fb_icon_325x325.png" \
  "https://static.xx.fbcdn.net/rsrc.php/v3/yz/r/ujTY9i_Jhs7.png"
do
  echo "Trying: $url"
  if curl -L -f -s "$url" -o build/messenger-icon-temp.png 2>/dev/null; then
    if [ -s build/messenger-icon-temp.png ]; then
      file build/messenger-icon-temp.png | grep -q "image" && ICON_DOWNLOADED=true && break
    fi
  fi
done

if [ "$ICON_DOWNLOADED" = false ]; then
  echo "⚠️  Could not download icon automatically."
  echo "Please download a Messenger icon (PNG, 1024x1024 recommended) and save it as: build/messenger-icon.png"
  echo "Then run this script again."
  exit 1
fi

mv build/messenger-icon-temp.png build/messenger-icon.png
echo "✓ Icon downloaded successfully"

# Resize to 1024x1024 if needed
echo "Preparing icon sizes..."
sips -z 1024 1024 build/messenger-icon.png --out build/messenger-icon-1024.png 2>/dev/null || cp build/messenger-icon.png build/messenger-icon-1024.png

# Create all required icon sizes
echo "Creating icon set..."
sips -z 16 16 build/messenger-icon-1024.png --out build/icon.iconset/icon_16x16.png
sips -z 32 32 build/messenger-icon-1024.png --out build/icon.iconset/icon_16x16@2x.png
sips -z 32 32 build/messenger-icon-1024.png --out build/icon.iconset/icon_32x32.png
sips -z 64 64 build/messenger-icon-1024.png --out build/icon.iconset/icon_32x32@2x.png
sips -z 128 128 build/messenger-icon-1024.png --out build/icon.iconset/icon_128x128.png
sips -z 256 256 build/messenger-icon-1024.png --out build/icon.iconset/icon_128x128@2x.png
sips -z 256 256 build/messenger-icon-1024.png --out build/icon.iconset/icon_256x256.png
sips -z 512 512 build/messenger-icon-1024.png --out build/icon.iconset/icon_256x256@2x.png
sips -z 512 512 build/messenger-icon-1024.png --out build/icon.iconset/icon_512x512.png
sips -z 1024 1024 build/messenger-icon-1024.png --out build/icon.iconset/icon_512x512@2x.png

# Create .icns file
echo "Creating .icns file..."
iconutil -c icns build/icon.iconset -o build/icon.icns

if [ -f build/icon.icns ]; then
  echo "✓ Icon created successfully: build/icon.icns"
  rm -rf build/icon.iconset build/messenger-icon-1024.png
  echo "✓ Cleanup completed"
else
  echo "✗ Failed to create .icns file"
  exit 1
fi

