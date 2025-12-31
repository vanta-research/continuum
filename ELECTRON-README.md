# Continuum - Electron Desktop App

Continuum is now available as a standalone desktop application for Linux!

## Installation

The application is packaged as an AppImage, which is a portable format that works on most Linux distributions without installation.

### Location

The built application is located at:
```
vanta-chat/dist/Continuum-0.1.0.AppImage
```

### Quick Start

1. **Make the AppImage executable** (if not already):
   ```bash
   chmod +x vanta-chat/dist/Continuum-0.1.0.AppImage
   ```

2. **Run Continuum**:
   ```bash
   ./vanta-chat/dist/Continuum-0.1.0.AppImage --no-sandbox
   ```

   Or use the launcher script:
   ```bash
   ./vanta-chat/launch-continuum.sh
   ```

## Development

### Run in Development Mode

To run Continuum in development mode with live reload:

```bash
cd vanta-chat
npm run electron:dev
```

This will:
- Start the Next.js development server on port 3000
- Launch Electron with DevTools open
- Enable hot module replacement for rapid development

### Build the App

To rebuild the Electron app after making changes:

```bash
cd vanta-chat
npm run build              # Build Next.js app
npm run electron:build     # Build Electron app for current platform
```

## Features

- **Native Desktop Experience**: Runs as a native application with system tray integration
- **Custom Icon**: Uses your continuum.png icon
- **Self-contained**: Bundles Next.js server and all dependencies
- **Cross-platform Ready**: Can be built for Linux, macOS, and Windows

## File Size

The AppImage is approximately 4.1GB because it includes:
- Electron runtime
- Node.js
- Next.js and all dependencies
- All application code and assets

## Troubleshooting

If the app doesn't start:
1. Make sure port 3000 is not already in use
2. Check the console output for errors
3. Try running with the `--no-sandbox` flag (required on some systems)

## Configuration

The app uses the same environment files as the web version:
- `.env.local` - Main configuration
- `.env.search` - Search API configuration

These are bundled with the app during the build process.
