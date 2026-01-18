const { app, BrowserWindow, shell, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, execSync } = require("child_process");
const isDev = process.env.NODE_ENV === "development";

let mainWindow;
let nextServer;
let llamaServer = null;
let llamaServerStatus = {
  status: "stopped", // 'stopped' | 'starting' | 'running' | 'error'
  modelPath: null,
  modelName: null,
  port: 8082,
  error: null,
  pid: null,
};

// Settings file path
const getSettingsPath = () => {
  const appPath = app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.join(__dirname, "..");
  return path.join(appPath, "data", "settings.json");
};

// Load settings
const loadSettings = () => {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }
  return {};
};

// Save settings
const saveSettings = (settings) => {
  try {
    const settingsPath = getSettingsPath();
    const dir = path.dirname(settingsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error("Error saving settings:", error);
  }
};

// Detect llama-server binary
const detectLlamaServer = () => {
  // Check user-configured path first
  const settings = loadSettings();
  if (settings.llamaServerPath && fs.existsSync(settings.llamaServerPath)) {
    return settings.llamaServerPath;
  }

  // Try to find in PATH
  try {
    const whichResult = execSync("which llama-server", {
      encoding: "utf-8",
    }).trim();
    if (whichResult && fs.existsSync(whichResult)) {
      return whichResult;
    }
  } catch (e) {
    // Not found in PATH
  }

  // Check common locations
  const commonPaths = [
    path.join(process.env.HOME || "", ".local", "bin", "llama-server"),
    "/usr/local/bin/llama-server",
    "/usr/bin/llama-server",
    "/opt/llama.cpp/llama-server",
    path.join(process.env.HOME || "", "llama.cpp", "llama-server"),
  ];

  for (const p of commonPaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return null;
};

// Broadcast status change to renderer
const broadcastStatusChange = () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("llama:status-changed", llamaServerStatus);
  }
};

// Broadcast server output to renderer
const broadcastServerOutput = (output) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("llama:server-output", output);
  }
};

// Update status helper
const updateStatus = (updates) => {
  llamaServerStatus = { ...llamaServerStatus, ...updates };
  broadcastStatusChange();
};

// Kill llama server gracefully
const killLlamaServer = () => {
  return new Promise((resolve) => {
    if (!llamaServer) {
      resolve();
      return;
    }

    console.log("Stopping llama-server...");

    // Try graceful shutdown first
    llamaServer.kill("SIGTERM");

    // Force kill after 5 seconds if still running
    const forceKillTimeout = setTimeout(() => {
      if (llamaServer) {
        console.log("Force killing llama-server...");
        llamaServer.kill("SIGKILL");
      }
    }, 5000);

    llamaServer.on("exit", () => {
      clearTimeout(forceKillTimeout);
      llamaServer = null;
      updateStatus({
        status: "stopped",
        modelPath: null,
        modelName: null,
        error: null,
        pid: null,
      });
      resolve();
    });
  });
};

// ============================================
// IPC Handlers for llama-server management
// ============================================

// Select model file dialog
ipcMain.handle("llama:select-model", async () => {
  const appPath = app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.join(__dirname, "..");
  const modelsDir = path.join(appPath, "data", "models");

  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Select GGUF Model",
    defaultPath: fs.existsSync(modelsDir) ? modelsDir : app.getPath("home"),
    filters: [
      { name: "GGUF Models", extensions: ["gguf"] },
      { name: "All Files", extensions: ["*"] },
    ],
    properties: ["openFile"],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// Detect llama-server binary
ipcMain.handle("llama:detect-binary", () => {
  return detectLlamaServer();
});

// Set llama-server path
ipcMain.handle("llama:set-binary-path", (_event, binaryPath) => {
  const settings = loadSettings();
  settings.llamaServerPath = binaryPath;
  saveSettings(settings);
  return true;
});

// Get current server status
ipcMain.handle("llama:get-status", () => {
  return llamaServerStatus;
});

// Launch llama-server
ipcMain.handle(
  "llama:launch-server",
  async (_event, modelPath, options = {}) => {
    // Check if already running
    if (llamaServer && llamaServerStatus.status === "running") {
      return {
        success: false,
        error: "Server is already running. Stop it first.",
      };
    }

    // Validate model file exists
    if (!modelPath || !fs.existsSync(modelPath)) {
      return { success: false, error: `Model file not found: ${modelPath}` };
    }

    // Find llama-server binary
    const binaryPath = detectLlamaServer();
    if (!binaryPath) {
      return {
        success: false,
        error:
          "llama-server not found. Please install llama.cpp or configure the path in settings.",
      };
    }

    // Extract model name from path
    const modelName = path.basename(modelPath);

    // Build arguments
    const args = [
      "--model",
      modelPath,
      "--port",
      String(options.port || 8082),
      "--ctx-size",
      String(options.contextSize || 4096),
      "--host",
      "127.0.0.1",
    ];

    // Add GPU layers if specified
    if (options.gpuLayers && options.gpuLayers > 0) {
      args.push("--n-gpu-layers", String(options.gpuLayers));
    }

    console.log(`Launching llama-server: ${binaryPath} ${args.join(" ")}`);

    updateStatus({
      status: "starting",
      modelPath,
      modelName,
      port: options.port || 8082,
      error: null,
    });

    try {
      llamaServer = spawn(binaryPath, args, {
        env: { ...process.env },
      });

      llamaServerStatus.pid = llamaServer.pid;

      let startupOutput = "";

      llamaServer.stdout.on("data", (data) => {
        const output = data.toString();
        console.log(`llama-server: ${output}`);
        broadcastServerOutput({ type: "stdout", data: output });
        startupOutput += output;

        // Check for successful startup indicators
        if (
          output.includes("HTTP server listening") ||
          output.includes("server listening") ||
          output.includes("starting the main loop")
        ) {
          updateStatus({ status: "running" });
        }
      });

      llamaServer.stderr.on("data", (data) => {
        const output = data.toString();
        console.error(`llama-server error: ${output}`);
        broadcastServerOutput({ type: "stderr", data: output });
        startupOutput += output;

        // Some llama.cpp builds output progress to stderr
        if (
          output.includes("HTTP server listening") ||
          output.includes("server listening") ||
          output.includes("starting the main loop")
        ) {
          updateStatus({ status: "running" });
        }
      });

      llamaServer.on("error", (error) => {
        console.error("llama-server spawn error:", error);
        updateStatus({
          status: "error",
          error: error.message,
        });
        llamaServer = null;
      });

      llamaServer.on("exit", (code, signal) => {
        console.log(`llama-server exited with code ${code}, signal ${signal}`);

        // Only update to error if we weren't already stopped intentionally
        if (llamaServerStatus.status !== "stopped") {
          if (code !== 0 && code !== null) {
            updateStatus({
              status: "error",
              error: `Server exited with code ${code}. ${startupOutput.slice(-500)}`,
              pid: null,
            });
          } else {
            updateStatus({
              status: "stopped",
              modelPath: null,
              modelName: null,
              error: null,
              pid: null,
            });
          }
        }
        llamaServer = null;
      });

      // Wait a bit to check for immediate failures
      await new Promise((resolve) => setTimeout(resolve, 2000));

      if (llamaServerStatus.status === "error") {
        return { success: false, error: llamaServerStatus.error };
      }

      return { success: true };
    } catch (error) {
      updateStatus({
        status: "error",
        error: error.message,
      });
      return { success: false, error: error.message };
    }
  },
);

// Stop llama-server
ipcMain.handle("llama:stop-server", async () => {
  if (!llamaServer) {
    return { success: true, message: "Server was not running" };
  }

  try {
    await killLlamaServer();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================
// Next.js Server Management
// ============================================

function startNextServer() {
  if (isDev) {
    // In dev mode, assume Next.js is already running on port 3000
    console.log("Development mode - expecting Next.js on port 3000");
    process.env.CONTINUUM_PORT = "3000";
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    console.log("Starting Next.js server...");

    // Determine the correct paths for packaged app
    let appPath;

    if (app.isPackaged) {
      // When packaged without ASAR, files are in resources/app
      const resourcesPath = process.resourcesPath;
      appPath = path.join(resourcesPath, "app");
      console.log("Running from packaged app");
    } else {
      appPath = path.join(__dirname, "..");
      console.log("Running from source");
    }

    console.log("App path:", appPath);

    // Use a random port to avoid conflicts
    const port = Math.floor(Math.random() * 10000) + 10000;
    process.env.CONTINUUM_PORT = port.toString();
    console.log("Using port:", port);

    // Use node to run next directly instead of using the shell script
    nextServer = spawn(
      "node",
      [
        path.join(appPath, "node_modules", "next", "dist", "bin", "next"),
        "start",
        "-p",
        port.toString(),
      ],
      {
        cwd: appPath,
        env: { ...process.env, NODE_ENV: "production", PORT: port.toString() },
      },
    );

    nextServer.stdout.on("data", (data) => {
      console.log(`Next.js: ${data}`);
      if (
        data.toString().includes("started server") ||
        data.toString().includes("Ready") ||
        data.toString().includes("Local:")
      ) {
        console.log("Next.js server is ready!");
        resolve();
      }
    });

    nextServer.stderr.on("data", (data) => {
      console.error(`Next.js Error: ${data}`);
    });

    nextServer.on("error", (error) => {
      console.error("Failed to start Next.js server:", error);
      reject(error);
    });

    // Fallback timeout - resolve anyway after 8 seconds
    setTimeout(() => {
      console.log("Timeout reached, proceeding to open window");
      resolve();
    }, 8000);
  });
}

function createWindow() {
  console.log("Creating main window...");

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: "Continuum",
    icon: path.join(__dirname, "..", "continuum.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: path.join(__dirname, "preload.js"),
    },
    backgroundColor: "#000000",
    show: true, // Show immediately
  });

  // Handle page load errors
  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription) => {
      console.error("Failed to load:", errorCode, errorDescription);
      const port = process.env.PORT || "3001";
      mainWindow.loadURL(
        `data:text/html,<html><body style="background: #000; color: #fff; font-family: sans-serif; padding: 40px;"><h1>Failed to load Continuum</h1><p>Error: ${errorDescription}</p><p>Please make sure the Next.js server is running on port ${port}.</p><p>Error code: ${errorCode}</p></body></html>`,
      );
    },
  );

  // Log when page is loaded
  mainWindow.webContents.on("did-finish-load", () => {
    console.log("Page loaded successfully!");
  });

  // Load the Next.js app
  const port = process.env.CONTINUUM_PORT || "3001";
  console.log(`Loading http://localhost:${port}`);
  mainWindow.loadURL(`http://localhost:${port}`);

  // Open DevTools in development or if there are issues
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  console.log("Electron app ready");
  console.log("isDev:", isDev);
  console.log("__dirname:", __dirname);

  try {
    await startNextServer();
    // Wait a bit more for server to be fully ready
    await new Promise((resolve) => setTimeout(resolve, 2000));
  } catch (error) {
    console.error("Error starting Next.js server:", error);
  }

  createWindow();

  app.on("activate", () => {
    // On macOS it's common to re-create a window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed
app.on("window-all-closed", async () => {
  // Kill llama-server if running
  if (llamaServer) {
    console.log("Killing llama-server");
    await killLlamaServer();
  }

  // Kill Next.js server if running
  if (nextServer) {
    console.log("Killing Next.js server");
    nextServer.kill();
  }

  // On macOS apps stay active until the user quits explicitly
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  // Kill llama-server when app quits
  if (llamaServer) {
    console.log("Killing llama-server on quit");
    await killLlamaServer();
  }

  // Kill Next.js server when app quits
  if (nextServer) {
    console.log("Killing Next.js server on quit");
    nextServer.kill();
  }
});

// Handle any uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
});
