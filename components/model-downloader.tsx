"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Download,
  Trash2,
  Check,
  AlertCircle,
  Loader2,
  HardDrive,
  ExternalLink,
  Key,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface GGUFFile {
  name: string;
  path: string;
  size: number;
  downloadUrl: string;
  quantization: string;
}

interface ModelInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  size: string;
  tags: string[];
  downloads: number;
  likes: number;
  ggufFiles: GGUFFile[];
  hasGGUF: boolean;
}

interface LocalModel {
  id: string;
  modelId: string;
  fileName: string;
  filePath: string;
  size: number;
  downloadedAt: number;
  quantization: string;
}

interface DownloadProgress {
  status: "starting" | "downloading" | "complete" | "error";
  progress: number;
  total: number;
  percent: number;
  message: string;
}

interface ModelDownloaderProps {
  hfToken: string;
  onTokenChange: (token: string) => void;
}

export default function ModelDownloader({
  hfToken,
  onTokenChange,
}: ModelDownloaderProps) {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [localModels, setLocalModels] = useState<LocalModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState(hfToken);
  const [tokenValidation, setTokenValidation] = useState<{
    valid: boolean;
    username?: string;
    checking: boolean;
  }>({ valid: false, checking: false });
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(
    new Set(),
  );
  const [downloadProgress, setDownloadProgress] = useState<
    Map<string, DownloadProgress>
  >(new Map());
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());

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

  // Fetch available models
  const fetchAvailableModels = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (hfToken) {
        params.set("token", hfToken);
      }

      const response = await fetch(`/api/models/available?${params}`);
      const data = await response.json();

      if (data.success) {
        setAvailableModels(data.models);
      } else {
        setError(data.error || "Failed to fetch models");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch models");
    } finally {
      setLoading(false);
    }
  }, [hfToken]);

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

  // Validate token
  const validateToken = async (token: string) => {
    if (!token) {
      setTokenValidation({ valid: false, checking: false });
      return;
    }

    setTokenValidation({ valid: false, checking: true });

    try {
      const response = await fetch("/api/models/validate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      setTokenValidation({
        valid: data.valid,
        username: data.username,
        checking: false,
      });

      if (data.valid) {
        onTokenChange(token);
      }
    } catch {
      setTokenValidation({ valid: false, checking: false });
    }
  };

  // Download a model file with streaming progress
  const downloadModel = async (model: ModelInfo, file: GGUFFile) => {
    const fileKey = `${model.id}/${file.name}`;
    setDownloadingFiles((prev) => new Set(prev).add(fileKey));
    setDownloadProgress((prev) => {
      const next = new Map(prev);
      next.set(fileKey, {
        status: "starting",
        progress: 0,
        total: file.size,
        percent: 0,
        message: "Starting download...",
      });
      return next;
    });

    try {
      const response = await fetch("/api/models/download-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: model.id,
          fileName: file.name,
          downloadUrl: file.downloadUrl,
          size: file.size,
          quantization: file.quantization,
          token: hfToken || undefined,
        }),
      });

      // Check if we got JSON response (already downloaded or error)
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        if (data.alreadyExists) {
          setDownloadProgress((prev) => {
            const next = new Map(prev);
            next.set(fileKey, {
              status: "complete",
              progress: file.size,
              total: file.size,
              percent: 100,
              message: "Already downloaded!",
            });
            return next;
          });
          fetchLocalModels();
          return;
        }
        if (!data.success) {
          throw new Error(data.error || "Download failed");
        }
      }

      // Handle SSE stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (eventType === "progress" || eventType === "complete") {
                setDownloadProgress((prev) => {
                  const next = new Map(prev);
                  next.set(fileKey, {
                    status: data.status,
                    progress: data.progress || 0,
                    total: data.total || file.size,
                    percent: data.percent || 0,
                    message: data.message || "",
                  });
                  return next;
                });

                if (eventType === "complete") {
                  fetchLocalModels();
                }
              } else if (eventType === "error") {
                throw new Error(data.message || "Download failed");
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                console.error("Failed to parse SSE data:", line);
              } else {
                throw e;
              }
            }
          }
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Download failed";
      setError(errorMessage);
      setDownloadProgress((prev) => {
        const next = new Map(prev);
        next.set(fileKey, {
          status: "error",
          progress: 0,
          total: file.size,
          percent: 0,
          message: errorMessage,
        });
        return next;
      });
    } finally {
      setDownloadingFiles((prev) => {
        const next = new Set(prev);
        next.delete(fileKey);
        return next;
      });
    }
  };

  // Clear download progress for a file
  const clearDownloadProgress = (fileKey: string) => {
    setDownloadProgress((prev) => {
      const next = new Map(prev);
      next.delete(fileKey);
      return next;
    });
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

  // Check if a file is downloaded
  const isFileDownloaded = (modelId: string, fileName: string): boolean => {
    return localModels.some(
      (m) => m.modelId === modelId && m.fileName === fileName,
    );
  };

  // Toggle model expansion
  const toggleModelExpanded = (modelId: string) => {
    setExpandedModels((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };

  // Initial load
  useEffect(() => {
    fetchAvailableModels();
    fetchLocalModels();
  }, [fetchAvailableModels, fetchLocalModels]);

  // Validate token on mount if exists
  useEffect(() => {
    if (hfToken) {
      setTokenInput(hfToken);
      validateToken(hfToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hfToken]);

  // Progress bar component
  const ProgressBar = ({
    progress,
    fileKey,
  }: {
    progress: DownloadProgress;
    fileKey: string;
  }) => {
    const isComplete = progress.status === "complete";
    const isError = progress.status === "error";

    return (
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span
            className={
              isError
                ? "text-destructive"
                : isComplete
                  ? "text-green-500"
                  : "text-muted-foreground"
            }
          >
            {progress.message}
          </span>
          <div className="flex items-center gap-2">
            {!isError && progress.total > 0 && (
              <span className="text-muted-foreground">
                {formatSize(progress.progress)} / {formatSize(progress.total)}
              </span>
            )}
            {(isComplete || isError) && (
              <button
                onClick={() => clearDownloadProgress(fileKey)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ease-out rounded-full ${
              isError
                ? "bg-destructive"
                : isComplete
                  ? "bg-green-500"
                  : "bg-primary"
            }`}
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* HuggingFace Token Section */}
      <Card className="p-4 bg-background/50">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">HuggingFace Authentication</h3>
          </div>

          <p className="text-sm text-muted-foreground">
            Adding your HuggingFace token enables faster downloads without rate
            limits.{" "}
            <a
              href="https://huggingface.co/settings/tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Get your token here
              <ExternalLink className="h-3 w-3" />
            </a>
          </p>

          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                type="password"
                placeholder="hf_xxxxxxxxxxxxxxxxxxxx"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="bg-background/50 font-mono text-sm"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => validateToken(tokenInput)}
              disabled={tokenValidation.checking || !tokenInput}
            >
              {tokenValidation.checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Validate"
              )}
            </Button>
          </div>

          {tokenValidation.valid && tokenValidation.username && (
            <div className="flex items-center gap-2 text-sm text-green-500">
              <Check className="h-4 w-4" />
              Authenticated as {tokenValidation.username}
            </div>
          )}

          {!hfToken && (
            <div className="flex items-center gap-2 text-sm text-yellow-500">
              <AlertCircle className="h-4 w-4" />
              Unauthenticated downloads may be slow due to rate limits
            </div>
          )}
        </div>
      </Card>

      {/* Local Models Section */}
      {localModels.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Downloaded Models</h3>
            <span className="text-sm text-muted-foreground">
              ({localModels.length})
            </span>
          </div>

          {/* Usage instructions */}
          <Card className="p-4 bg-primary/5 border-primary/20">
            <div className="text-sm space-y-2">
              <div className="font-medium text-primary">
                How to use your downloaded models:
              </div>
              <div className="text-muted-foreground space-y-1">
                <p>1. Start llama.cpp server with your model:</p>
                <code className="block bg-background/50 px-3 py-2 rounded text-xs font-mono overflow-x-auto">
                  ./llama-server --model data/models/YOUR_MODEL.gguf --port 8082
                  --ctx-size 4096
                </code>
                <p className="pt-2">
                  2. In Settings → General, select &quot;Local (llama.cpp)&quot;
                  as your model
                </p>
                <p>
                  3. Make sure the server URL is set to http://localhost:8082
                </p>
                <p>
                  4. Click &quot;Test Connection&quot; to verify it&apos;s
                  working
                </p>
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            {localModels.map((model) => (
              <Card
                key={model.id}
                className="p-3 bg-background/50 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{model.fileName}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatSize(model.size)} • {model.quantization} •{" "}
                    {new Date(model.downloadedAt).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted-foreground/70 mt-1 font-mono truncate">
                    {model.filePath}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteModel(model)}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Available Models Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Available VANTA Research Models</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAvailableModels}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4" />
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto hover:text-destructive/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-2">
            {availableModels
              .filter((m) => m.hasGGUF)
              .map((model) => (
                <Card
                  key={model.id}
                  className="bg-background/50 overflow-hidden"
                >
                  <button
                    onClick={() => toggleModelExpanded(model.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {model.displayName}
                        </span>
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                          {model.ggufFiles.length} GGUF
                          {model.ggufFiles.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {model.description}
                      </div>
                    </div>
                    {expandedModels.has(model.id) ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                  </button>

                  {expandedModels.has(model.id) && (
                    <div className="border-t border-border/50 p-4 space-y-2">
                      <div className="text-sm text-muted-foreground mb-3">
                        Select a quantization to download:
                      </div>
                      {model.ggufFiles.map((file) => {
                        const fileKey = `${model.id}/${file.name}`;
                        const isDownloading = downloadingFiles.has(fileKey);
                        const isDownloaded = isFileDownloaded(
                          model.id,
                          file.name,
                        );
                        const progress = downloadProgress.get(fileKey);

                        return (
                          <div
                            key={file.path}
                            className="p-3 bg-muted/30 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="font-mono text-sm truncate">
                                  {file.name}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {formatSize(file.size)} • {file.quantization}
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant={isDownloaded ? "secondary" : "default"}
                                disabled={isDownloading || isDownloaded}
                                onClick={() => downloadModel(model, file)}
                                className="ml-2"
                              >
                                {isDownloading ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    Downloading
                                  </>
                                ) : isDownloaded ? (
                                  <>
                                    <Check className="h-4 w-4 mr-1" />
                                    Downloaded
                                  </>
                                ) : (
                                  <>
                                    <Download className="h-4 w-4 mr-1" />
                                    Download
                                  </>
                                )}
                              </Button>
                            </div>

                            {/* Progress bar */}
                            {progress && (
                              <ProgressBar
                                progress={progress}
                                fileKey={fileKey}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>
              ))}

            {availableModels.filter((m) => m.hasGGUF).length === 0 &&
              !loading && (
                <div className="text-center py-8 text-muted-foreground">
                  No models with GGUF quantizations found.
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}
