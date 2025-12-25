#!/bin/bash

# Setup script for Facebook Messenger Clone
# This script helps set up the project with pnpm

echo "Setting up Facebook Messenger Clone..."
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "Error: pnpm is not installed."
    echo "Install it with: npm install -g pnpm"
    exit 1
fi

# Install dependencies
echo "Installing dependencies..."
pnpm install

# Check if electron build scripts need approval
echo ""
echo "Checking Electron build scripts..."
if pnpm list electron &> /dev/null; then
    echo ""
    echo "⚠️  IMPORTANT: pnpm requires approval for Electron's build scripts."
    echo "Please run the following command and select 'electron' when prompted:"
    echo ""
    echo "  pnpm approve-builds"
    echo ""
    echo "Then reinstall Electron:"
    echo ""
    echo "  pnpm remove electron && pnpm add -D electron"
    echo ""
    echo "Or simply run: pnpm install --force"
    echo ""
fi

echo "Setup complete!"
echo ""
echo "To start the app, run: pnpm start"

