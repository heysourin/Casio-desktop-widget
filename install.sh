#!/usr/bin/env bash
set -e

# ==============================================================================
# Casio A158W macOS Desktop Widget Installer
# For Apple Silicon (M1/M2/M3/M4) & Intel Macs
# ==============================================================================

echo "⌚ Installing Casio A158W Desktop Widget for macOS (Übersicht)..."

ARCH=$(uname -m)
echo "💻 Architecture detected: $ARCH"

# Determine Homebrew path
if [ -f "/opt/homebrew/bin/brew" ]; then
    BREW_CMD="/opt/homebrew/bin/brew"
elif [ -f "/usr/local/bin/brew" ]; then
    BREW_CMD="/usr/local/bin/brew"
elif which brew >/dev/null 2>&1; then
    BREW_CMD=$(which brew)
else
    BREW_CMD=""
fi

# 1. Check or install Übersicht
if ! ls -d /Applications/*bersicht.app >/dev/null 2>&1; then
    echo "⚠️  Übersicht is not currently installed in /Applications."
    if [ -n "$BREW_CMD" ]; then
        echo "📦 Installing Übersicht via Homebrew Cask..."
        # Use reinstall with --force in case the app was deleted from /Applications but cached in brew
        $BREW_CMD reinstall --cask --force ubersicht || $BREW_CMD install --cask ubersicht
    else
        echo "⚠️  Homebrew was not found. You can download Übersicht manually from:"
        echo "   👉 https://tracesof.net/uebersicht/"
        echo "   Drag Übersicht.app into your /Applications folder, then re-run this script."
        exit 1
    fi
else
    echo "✅ Übersicht.app is already installed in /Applications."
fi

# Remove Gatekeeper quarantine attribute if present so it launches seamlessly
xattr -d -r com.apple.quarantine /Applications/*bersicht.app 2>/dev/null || true

# 2. Setup Übersicht Widgets Directory
WIDGETS_DIR="$HOME/Library/Application Support/Übersicht/widgets"
mkdir -p "$WIDGETS_DIR"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SOURCE_WIDGET="$SCRIPT_DIR/casio-a158.widget"
TARGET_WIDGET="$WIDGETS_DIR/casio-a158.widget"

if [ ! -d "$SOURCE_WIDGET" ]; then
    echo "❌ Source widget directory not found at $SOURCE_WIDGET"
    exit 1
fi

echo "📁 Installing widget to: $TARGET_WIDGET"
# Remove existing symlink or folder if present
rm -rf "$TARGET_WIDGET"
# Create symbolic link for live updates
ln -s "$SOURCE_WIDGET" "$TARGET_WIDGET"
echo "✅ Symlink created! Changes made to this repo will immediately reflect on your desktop."

# 3. Launch or restart Übersicht
echo "🚀 Launching Übersicht..."
killall "Übersicht" 2>/dev/null || pkill -i "uebersicht" 2>/dev/null || true
sleep 1
open /Applications/*bersicht.app 2>/dev/null || open -b "tracesOf.Uebersicht" 2>/dev/null || open -a "Übersicht"

echo ""
echo "======================================================================"
echo "🎉 Casio A158W Desktop Widget is now installed and active!"
echo "======================================================================"
echo "🕹 Controls:"
echo "   • Top-Left Pusher (or 'L' key)  : Green Micro-LED Backlight / Lap / Reset"
echo "   • Bottom-Left Pusher (or 'M' key): Switch Timekeeping <-> Stopwatch"
echo "   • Bottom-Right Pusher (or 'S' key): Start/Stop Stopwatch or 12/24H format"
echo "   • Press 'B' key (or bell icon)  : Mute/Unmute Piezo buzzer beep"
echo "   • Press '+' / '-' keys          : Resize/zoom watch up or down"
echo "   • Drag the watch case with mouse: Reposition anywhere on your desktop!"
echo "======================================================================"
