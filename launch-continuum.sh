#!/bin/bash
# Continuum Launcher Script

cd "$(dirname "$0")"

# Make sure the AppImage is executable
chmod +x dist/Continuum-0.1.0.AppImage

# Launch Continuum
./dist/Continuum-0.1.0.AppImage --no-sandbox "$@"
