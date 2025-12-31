const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = process.env.NODE_ENV === 'development';

let mainWindow;
let nextServer;

function startNextServer() {
  if (isDev) {
    // In dev mode, assume Next.js is already running
    console.log('Development mode - expecting Next.js on port 3000');
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    console.log('Starting Next.js server...');
    
    // Determine the correct paths for packaged app
    let appPath;
    
    if (app.isPackaged) {
      // When packaged without ASAR, files are in resources/app
      const resourcesPath = process.resourcesPath;
      appPath = path.join(resourcesPath, 'app');
      console.log('Running from packaged app');
    } else {
      appPath = path.join(__dirname, '..');
      console.log('Running from source');
    }
    
    console.log('App path:', appPath);
    
    // Use a random port to avoid conflicts
    const port = Math.floor(Math.random() * 10000) + 10000;
    process.env.CONTINUUM_PORT = port.toString();
    console.log('Using port:', port);
    
    // Use node to run next directly instead of using the shell script
    nextServer = spawn('node', [
      path.join(appPath, 'node_modules', 'next', 'dist', 'bin', 'next'),
      'start',
      '-p',
      port.toString()
    ], {
      cwd: appPath,
      env: { ...process.env, NODE_ENV: 'production', PORT: port.toString() }
    });

    nextServer.stdout.on('data', (data) => {
      console.log(`Next.js: ${data}`);
      if (data.toString().includes('started server') || data.toString().includes('Ready') || data.toString().includes('Local:')) {
        console.log('Next.js server is ready!');
        resolve();
      }
    });

    nextServer.stderr.on('data', (data) => {
      console.error(`Next.js Error: ${data}`);
    });

    nextServer.on('error', (error) => {
      console.error('Failed to start Next.js server:', error);
      reject(error);
    });

    // Fallback timeout - resolve anyway after 8 seconds
    setTimeout(() => {
      console.log('Timeout reached, proceeding to open window');
      resolve();
    }, 8000);
  });
}

function createWindow() {
  console.log('Creating main window...');
  
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: 'Continuum',
    icon: path.join(__dirname, '..', 'continuum.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
    backgroundColor: '#000000',
    show: true, // Show immediately
  });

  // Handle page load errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
    const port = process.env.PORT || '3001';
    mainWindow.loadURL(`data:text/html,<html><body style="background: #000; color: #fff; font-family: sans-serif; padding: 40px;"><h1>Failed to load Continuum</h1><p>Error: ${errorDescription}</p><p>Please make sure the Next.js server is running on port ${port}.</p><p>Error code: ${errorCode}</p></body></html>`);
  });

  // Log when page is loaded
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully!');
  });

  // Load the Next.js app
  const port = process.env.CONTINUUM_PORT || '3001';
  console.log(`Loading http://localhost:${port}`);
  mainWindow.loadURL(`http://localhost:${port}`);

  // Open DevTools in development or if there are issues
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  console.log('Electron app ready');
  console.log('isDev:', isDev);
  console.log('__dirname:', __dirname);
  
  try {
    await startNextServer();
    // Wait a bit more for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  } catch (error) {
    console.error('Error starting Next.js server:', error);
  }
  
  createWindow();

  app.on('activate', () => {
    // On macOS it's common to re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // Kill Next.js server if running
  if (nextServer) {
    console.log('Killing Next.js server');
    nextServer.kill();
  }
  
  // On macOS apps stay active until the user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  // Kill Next.js server when app quits
  if (nextServer) {
    console.log('Killing Next.js server on quit');
    nextServer.kill();
  }
});

// Handle any uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});
