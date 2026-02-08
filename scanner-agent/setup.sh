#!/usr/bin/env bash
# Scanner Agent Setup Script
# Sets up Python virtual environment and installs dependencies

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "Help Math Scanner Agent Setup"
echo "=============================="
echo

# Check Python version
PYTHON=""
for cmd in python3 python; do
    if command -v "$cmd" &>/dev/null; then
        version=$("$cmd" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')" 2>/dev/null)
        major=$("$cmd" -c "import sys; print(sys.version_info.major)" 2>/dev/null)
        minor=$("$cmd" -c "import sys; print(sys.version_info.minor)" 2>/dev/null)
        if [ "$major" -ge 3 ] && [ "$minor" -ge 10 ]; then
            PYTHON="$cmd"
            echo "Found Python $version ($cmd)"
            break
        fi
    fi
done

if [ -z "$PYTHON" ]; then
    echo "Error: Python 3.10+ is required"
    echo "Install Python from https://python.org"
    exit 1
fi

# Create virtual environment
if [ ! -d "venv" ]; then
    echo
    echo "Creating virtual environment..."
    "$PYTHON" -m venv venv
fi

# Activate
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
elif [ -f "venv/Scripts/activate" ]; then
    source venv/Scripts/activate
fi

# Install dependencies
echo
echo "Installing dependencies..."
pip install --quiet --upgrade pip
pip install --quiet requests watchdog

# Optional: desktop notifications
if [ "$(uname)" = "Darwin" ] || [ "$(uname)" = "Linux" ]; then
    pip install --quiet plyer 2>/dev/null || echo "Note: plyer not installed (desktop notifications disabled)"
fi

# Python 3.10 compatibility
"$PYTHON" -c "import tomllib" 2>/dev/null || pip install --quiet tomli

# Create local config if not exists
if [ ! -f "config.local.toml" ]; then
    echo
    echo "Creating config.local.toml from template..."
    cp config.toml config.local.toml
    echo "IMPORTANT: Edit config.local.toml with your settings:"
    echo "  - auth.email    = your teacher email"
    echo "  - auth.password = your teacher password"
    echo "  - scanner.watch_dir = your scanner output folder"
fi

# Create default watch directory
WATCH_DIR=$(python3 -c "
try:
    import tomllib
except ImportError:
    import tomli as tomllib
with open('config.local.toml', 'rb') as f:
    c = tomllib.load(f)
import os
print(os.path.expanduser(c.get('scanner',{}).get('watch_dir','~/Documents/ScannerOutput')))
" 2>/dev/null || echo "$HOME/Documents/ScannerOutput")

mkdir -p "$WATCH_DIR"
echo
echo "Watch directory: $WATCH_DIR"

echo
echo "Setup complete! To run:"
echo "  source venv/bin/activate"
echo "  python agent.py"
echo
echo "Or upload files directly:"
echo "  python agent.py --upload scan1.pdf scan2.jpg"
