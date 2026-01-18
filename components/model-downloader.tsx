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
  Search,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useDownloadManager } from "@/components/download-manager-provider";

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
  status: "starting" | "downloading" | "complete" | "error" | "cancelled";
  progress: number;
  total: number;
  percent: number;
  message: string;
}

interface HFSearchResult {
  id: string;
  name: string;
  displayName: string;
  description: string;
  author: string;
  downloads: number;
  likes: number;
  tags: string[];
  hasGGUF: boolean;
  ggufFiles: GGUFFile[];
  createdAt: string;
  lastModified: string;
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
  const [expandedModels, setExpandedModels] = useState<Set<string>>(new Set());

  // HuggingFace search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<HFSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [expandedSearchResults, setExpandedSearchResults] = useState<
    Set<string>
  >(new Set());

  // Use global download manager
  const {
    downloadProgress,
    startDownload,
    cancelDownload,
    clearDownloadProgress,
    isDownloading,
    setOnDownloadComplete,
  } = useDownloadManager();

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

  // Download a model file using global download manager
  const downloadModel = async (model: ModelInfo, file: GGUFFile) => {
    await startDownload({
      modelId: model.id,
      fileName: file.name,
      downloadUrl: file.downloadUrl,
      size: file.size,
      quantization: file.quantization,
      token: hfToken || undefined,
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

  // Toggle search result expansion
  const toggleSearchResultExpanded = (modelId: string) => {
    setExpandedSearchResults((prev) => {
      const next = new Set(prev);
      if (next.has(modelId)) {
        next.delete(modelId);
      } else {
        next.add(modelId);
      }
      return next;
    });
  };

  // Search HuggingFace models
  const searchHuggingFace = async () => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchError("Search query must be at least 2 characters");
      return;
    }

    if (!hfToken || !tokenValidation.valid) {
      setSearchError("Please authenticate with HuggingFace first");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    try {
      const params = new URLSearchParams({
        q: searchQuery.trim(),
        token: hfToken,
        limit: "20",
      });

      const response = await fetch(`/api/models/search?${params}`);
      const data = await response.json();

      if (data.success) {
        setSearchResults(data.results);
        if (data.results.length === 0) {
          setSearchError("No GGUF models found matching your search");
        }
      } else {
        setSearchError(data.error || "Search failed");
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setIsSearching(false);
    }
  };

  // Download from search result (uses same global download manager)
  const downloadSearchResult = async (
    result: HFSearchResult,
    file: GGUFFile,
  ) => {
    await startDownload({
      modelId: result.id,
      fileName: file.name,
      downloadUrl: file.downloadUrl,
      size: file.size,
      quantization: file.quantization,
      token: hfToken || undefined,
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

  // Set up callback to refresh local models when downloads complete
  useEffect(() => {
    setOnDownloadComplete(fetchLocalModels);
    return () => setOnDownloadComplete(undefined);
  }, [setOnDownloadComplete, fetchLocalModels]);

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
    const isCancelled = progress.status === "cancelled";
    const isActive =
      progress.status === "downloading" || progress.status === "starting";

    return (
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span
            className={
              isError || isCancelled
                ? "text-destructive"
                : isComplete
                  ? "text-green-500"
                  : "text-muted-foreground"
            }
          >
            {progress.message}
          </span>
          <div className="flex items-center gap-2">
            {!isError && !isCancelled && progress.total > 0 && (
              <span className="text-muted-foreground">
                {formatSize(progress.progress)} / {formatSize(progress.total)}
              </span>
            )}
            {isActive && (
              <button
                onClick={() => cancelDownload(fileKey)}
                className="text-destructive hover:text-destructive/80 flex items-center gap-1"
                title="Cancel download"
              >
                <Square className="h-3 w-3 fill-current" />
                <span>Cancel</span>
              </button>
            )}
            {(isComplete || isError || isCancelled) && (
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
              isError || isCancelled
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

      {/* HuggingFace Search Section - Only visible when authenticated */}
      {tokenValidation.valid && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Search HuggingFace Models</h3>
          </div>

          <Card className="p-4 bg-background/50">
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Search for GGUF models on HuggingFace. Results are filtered to
                only show models with downloadable GGUF files.
              </p>

              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder="Search for models (e.g., llama, mistral, phi)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        searchHuggingFace();
                      }
                    }}
                    className="bg-background/50"
                  />
                </div>
                <Button
                  onClick={searchHuggingFace}
                  disabled={isSearching || searchQuery.trim().length < 2}
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-1" />
                      Search
                    </>
                  )}
                </Button>
              </div>

              {searchError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                  <AlertCircle className="h-4 w-4" />
                  {searchError}
                  <button
                    onClick={() => setSearchError(null)}
                    className="ml-auto hover:text-destructive/80"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {isSearching && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-muted-foreground">
                    Searching HuggingFace...
                  </span>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Found {searchResults.length} model
                    {searchResults.length !== 1 ? "s" : ""} with GGUF files
                  </div>
                  {searchResults.map((result) => (
                    <Card
                      key={result.id}
                      className="bg-muted/30 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleSearchResultExpanded(result.id)}
                        className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">
                              {result.displayName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              by {result.author}
                            </span>
                            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">
                              {result.ggufFiles.length} GGUF
                              {result.ggufFiles.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground truncate mt-1">
                            {result.description}
                          </div>
                          <div className="text-xs text-muted-foreground/70 mt-1">
                            {result.downloads.toLocaleString()} downloads
                          </div>
                        </div>
                        {expandedSearchResults.has(result.id) ? (
                          <ChevronUp className="h-5 w-5 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-muted-foreground shrink-0" />
                        )}
                      </button>

                      {expandedSearchResults.has(result.id) && (
                        <div className="border-t border-border/50 p-4 space-y-2">
                          <div className="text-sm text-muted-foreground mb-3">
                            Select a quantization to download:
                          </div>
                          {result.ggufFiles.map((file) => {
                            const fileKey = `${result.id}/${file.name}`;
                            const downloading = isDownloading(fileKey);
                            const isDownloaded = isFileDownloaded(
                              result.id,
                              file.name,
                            );
                            const progress = downloadProgress.get(fileKey);

                            return (
                              <div
                                key={file.path}
                                className="p-3 bg-background/50 rounded-lg"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-mono text-sm truncate">
                                      {file.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {formatSize(file.size)} •{" "}
                                      {file.quantization}
                                    </div>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant={
                                      isDownloaded ? "secondary" : "default"
                                    }
                                    disabled={downloading || isDownloaded}
                                    onClick={() =>
                                      downloadSearchResult(result, file)
                                    }
                                    className="ml-2"
                                  >
                                    {downloading ? (
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
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Prompt to authenticate for HF search */}
      {!tokenValidation.valid && (
        <Card className="p-4 bg-muted/30 border-dashed">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Search className="h-5 w-5" />
            <div>
              <div className="font-medium">Search HuggingFace Models</div>
              <div className="text-sm">
                Authenticate with your HuggingFace token above to search for
                GGUF models from the entire HuggingFace Hub.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Available VANTA Research Models Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Latest VANTA Research Model</h3>
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
                        const downloading = isDownloading(fileKey);
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
                                disabled={downloading || isDownloaded}
                                onClick={() => downloadModel(model, file)}
                                className="ml-2"
                              >
                                {downloading ? (
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
