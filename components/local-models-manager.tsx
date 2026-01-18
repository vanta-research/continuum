"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Square,
  AlertCircle,
  Loader2,
  HardDrive,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  X,
  Settings2,
  Terminal,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useLocalServer } from "@/components/local-server-provider";

interface LocalModel {
  id: string;
  modelId: string;
  fileName: string;
  filePath: string;
  size: number;
  downloadedAt: number;
  quantization: string;
}

export default function LocalModelsManager() {
  const {
    status,
    isElectron,
    launchServer,
    stopServer,
    selectModelFile,
    llamaServerPath,
    detectLlamaServer,
    setLlamaServerPath,
    serverLogs,
    clearLogs,
  } = useLocalServer();

  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [contextSize, setContextSize] = useState("4096");
  const [customBinaryPath, setCustomBinaryPath] = useState("");
  const [isDetectingBinary, setIsDetectingBinary] = useState(false);

  // Format file size
  const formatSize = (bytes: number): string => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Fetch local models
  const fetchLocalModels = useCallback(async () => {
    try {
      const response = await fetch("/api/models/local");
      const data = await response.json();

      if (data.success) {
        setLocalModels(data.models);
      }
    } catch (err) {
      console.error("Failed to fetch local models:", err);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchLocalModels();
  }, [fetchLocalModels]);

  // Update custom binary path when detected
  useEffect(() => {
    if (llamaServerPath) {
      setCustomBinaryPath(llamaServerPath);
    }
  }, [llamaServerPath]);

  // Handle launch server
  const handleLaunch = async (modelPath: string) => {
    setError(null);
    const result = await launchServer(modelPath, {
      contextSize: parseInt(contextSize) || 4096,
    });

    if (!result.success) {
      setError(result.error || "Failed to launch server");
    }
  };

  // Handle stop server
  const handleStop = async () => {
    setError(null);
    const result = await stopServer();

    if (!result.success) {
      setError(result.error || "Failed to stop server");
    }
  };

  // Handle browse for model
  const handleBrowseModel = async () => {
    const filePath = await selectModelFile();
    if (filePath) {
      handleLaunch(filePath);
    }
  };

  // Handle detect binary
  const handleDetectBinary = async () => {
    setIsDetectingBinary(true);
    const path = await detectLlamaServer();
    setIsDetectingBinary(false);

    if (!path) {
      setError("llama-server not found. Please install llama.cpp or set the path manually.");
    }
  };

  // Handle save binary path
  const handleSaveBinaryPath = async () => {
    if (customBinaryPath) {
      const success = await setLlamaServerPath(customBinaryPath);
      if (!success) {
        setError("Failed to save binary path");
      }
    }
  };

  // Delete a local model
  const deleteModel = async (model: LocalModel) => {
    if (!confirm(`Are you sure you want to delete ${model.fileName}?`)) {
      return;
    }

    try {
      const response = await fetch("/api/models/local", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model.modelId,
          fileName: model.fileName,
        }),
      });

      const data = await response.json();

      if (data.success) {
        fetchLocalModels();
      } else {
        setError(data.error || "Delete failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  // Status indicator component
  const StatusIndicator = () => {
    const statusConfig = {
      stopped: { color: "bg-muted-foreground", text: "Stopped", pulse: false },
      starting: { color: "bg-yellow-500", text: "Starting...", pulse: true },
      running: { color: "bg-green-500", text: `Running on port ${status.port}`, pulse: false },
      error: { color: "bg-destructive", text: "Error", pulse: false },
    };

    const config = statusConfig[status.status];

    return (
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${config.color} ${config.pulse ? "animate-pulse" : ""}`} />
        <span className={status.status === "error" ? "text-destructive" : "text-muted-foreground"}>
          {config.text}
        </span>
      </div>
    );
  };

  // If not running in Electron, show message
  if (!isElectron) {
    return (
      <Card className="p-6 bg-background/50">
        <div className="text-center space-y-4">
          <HardDrive className="h-12 w-12 mx-auto text-muted-foreground" />
          <div>
            <h3 className="font-semibold text-lg">Local Server Management</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This feature is only available when running in the Electron desktop app.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              To use local models, start llama-server manually:
            </p>
            <code className="block bg-muted/50 px-4 py-2 rounded mt-3 text-xs font-mono">
              llama-server --model your-model.gguf --port 8082 --ctx-size 4096
            </code>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Server Status Card */}
      <Card className="p-4 bg-background/50">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Local AI Server</h3>
            </div>
            <StatusIndicator />
          </div>

          {/* Running model info */}
          {status.status === "running" && status.modelName && (
            <div className="flex items-center justify-between bg-green-500/10 border border-green-500/20 rounded-lg p-3">
              <div>
                <p className="text-sm font-medium text-green-500">Model Running</p>
                <p className="text-xs text-muted-foreground font-mono">{status.modelName}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleStop}
                className="text-destructive border-destructive/50 hover:bg-destructive/10"
              >
                <Square className="h-4 w-4 mr-1 fill-current" />
                Stop Server
              </Button>
            </div>
          )}

          {/* Starting indicator */}
          {status.status === "starting" && (
            <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
              <div>
                <p className="text-sm font-medium text-yellow-500">Loading Model...</p>
                <p className="text-xs text-muted-foreground">This may take a moment for large models</p>
              </div>
            </div>
          )}

          {/* Error display */}
          {(status.status === "error" || error) && (
            <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Error</p>
                <p className="text-xs mt-1 whitespace-pre-wrap">{status.error || error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="hover:text-destructive/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Local Models List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Your Models</h3>
            <span className="text-sm text-muted-foreground">({localModels.length})</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchLocalModels} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>

        {localModels.length > 0 ? (
          <div className="space-y-2">
            {localModels.map((model) => {
              const isCurrentModel = status.modelPath === model.filePath;
              const isRunning = status.status === "running" && isCurrentModel;
              const isStarting = status.status === "starting" && isCurrentModel;

              return (
                <Card
                  key={model.id}
                  className={`p-3 bg-background/50 ${isRunning ? "border-green-500/50" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{model.fileName}</span>
                        {isRunning && (
                          <span className="text-xs bg-green-500/20 text-green-500 px-2 py-0.5 rounded">
                            Running
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatSize(model.size)} • {model.quantization}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isRunning ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleStop}
                          className="text-destructive border-destructive/50 hover:bg-destructive/10"
                        >
                          <Square className="h-4 w-4 mr-1 fill-current" />
                          Stop
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleLaunch(model.filePath)}
                          disabled={status.status === "starting" || status.status === "running"}
                        >
                          {isStarting ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Starting...
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-1" />
                              Launch
                            </>
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteModel(model)}
                        disabled={isRunning}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-6 bg-muted/30 border-dashed">
            <div className="text-center text-muted-foreground">
              <p>No models downloaded yet.</p>
              <p className="text-sm mt-1">Download a model from HuggingFace or browse for a .gguf file.</p>
            </div>
          </Card>
        )}

        {/* Browse for model button */}
        <Button
          variant="outline"
          className="w-full"
          onClick={handleBrowseModel}
          disabled={status.status === "starting" || status.status === "running"}
        >
          <FolderOpen className="h-4 w-4 mr-2" />
          Browse for Model File...
        </Button>
      </div>

      {/* Advanced Settings */}
      <Card className="bg-background/50 overflow-hidden">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold">Advanced Settings</span>
          </div>
          {showAdvanced ? (
            <ChevronUp className="h-5 w-5 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-5 w-5 text-muted-foreground" />
          )}
        </button>

        {showAdvanced && (
          <div className="border-t border-border/50 p-4 space-y-4">
            {/* llama-server path */}
            <div className="space-y-2">
              <label className="text-sm font-medium">llama-server Binary Path</label>
              <div className="flex gap-2">
                <Input
                  value={customBinaryPath}
                  onChange={(e) => setCustomBinaryPath(e.target.value)}
                  placeholder="/path/to/llama-server"
                  className="bg-background/50 font-mono text-sm"
                />
                <Button variant="outline" onClick={handleDetectBinary} disabled={isDetectingBinary}>
                  {isDetectingBinary ? <Loader2 className="h-4 w-4 animate-spin" /> : "Detect"}
                </Button>
                <Button variant="outline" onClick={handleSaveBinaryPath}>
                  Save
                </Button>
              </div>
              {llamaServerPath ? (
                <p className="text-xs text-green-500">Detected: {llamaServerPath}</p>
              ) : (
                <p className="text-xs text-yellow-500">
                  llama-server not found. Install llama.cpp or set the path manually.
                </p>
              )}
            </div>

            {/* Context size */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Context Size</label>
              <Input
                type="number"
                value={contextSize}
                onChange={(e) => setContextSize(e.target.value)}
                placeholder="4096"
                className="bg-background/50 w-32"
              />
              <p className="text-xs text-muted-foreground">
                Higher values use more memory but allow longer conversations.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Server Logs */}
      {serverLogs.length > 0 && (
        <Card className="bg-background/50 overflow-hidden">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold">Server Logs</span>
              <span className="text-xs text-muted-foreground">({serverLogs.length} lines)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  clearLogs();
                }}
              >
                Clear
              </Button>
              {showLogs ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </button>

          {showLogs && (
            <div className="border-t border-border/50 p-4">
              <div className="bg-black/50 rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-xs">
                {serverLogs.map((log, i) => (
                  <div key={i} className={log.includes("[stderr]") ? "text-yellow-500" : "text-muted-foreground"}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
