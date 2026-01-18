"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";

export interface DownloadProgress {
  status: "starting" | "downloading" | "complete" | "error" | "cancelled";
  progress: number;
  total: number;
  percent: number;
  message: string;
}

export interface ActiveDownload {
  fileKey: string;
  modelId: string;
  fileName: string;
  downloadUrl: string;
  size: number;
  quantization: string;
  token?: string;
  progress: DownloadProgress;
  abortController: AbortController;
}

interface DownloadManagerContextValue {
  activeDownloads: Map<string, ActiveDownload>;
  downloadProgress: Map<string, DownloadProgress>;
  startDownload: (params: {
    modelId: string;
    fileName: string;
    downloadUrl: string;
    size: number;
    quantization: string;
    token?: string;
  }) => Promise<void>;
  cancelDownload: (fileKey: string) => void;
  clearDownloadProgress: (fileKey: string) => void;
  isDownloading: (fileKey: string) => boolean;
  onDownloadComplete?: () => void;
  setOnDownloadComplete: (callback: (() => void) | undefined) => void;
}

const DownloadManagerContext =
  createContext<DownloadManagerContextValue | null>(null);

export function DownloadManagerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeDownloads, setActiveDownloads] = useState<
    Map<string, ActiveDownload>
  >(new Map());
  const [downloadProgress, setDownloadProgress] = useState<
    Map<string, DownloadProgress>
  >(new Map());
  const onDownloadCompleteRef = useRef<(() => void) | undefined>(undefined);

  // Track active readers for cleanup
  const activeReadersRef = useRef<
    Map<string, ReadableStreamDefaultReader<Uint8Array>>
  >(new Map());

  const setOnDownloadComplete = useCallback(
    (callback: (() => void) | undefined) => {
      onDownloadCompleteRef.current = callback;
    },
    [],
  );

  const updateProgress = useCallback(
    (fileKey: string, progress: DownloadProgress) => {
      setDownloadProgress((prev) => {
        const next = new Map(prev);
        next.set(fileKey, progress);
        return next;
      });

      setActiveDownloads((prev) => {
        const download = prev.get(fileKey);
        if (download) {
          const next = new Map(prev);
          next.set(fileKey, { ...download, progress });
          return next;
        }
        return prev;
      });
    },
    [],
  );

  const clearDownloadProgress = useCallback((fileKey: string) => {
    setDownloadProgress((prev) => {
      const next = new Map(prev);
      next.delete(fileKey);
      return next;
    });
  }, []);

  const isDownloading = useCallback(
    (fileKey: string) => {
      const download = activeDownloads.get(fileKey);
      return (
        download !== undefined &&
        download.progress.status !== "complete" &&
        download.progress.status !== "error" &&
        download.progress.status !== "cancelled"
      );
    },
    [activeDownloads],
  );

  const cancelDownload = useCallback((fileKey: string) => {
    setActiveDownloads((prev) => {
      const download = prev.get(fileKey);
      if (!download) {
        return prev;
      }

      // Abort the fetch request
      download.abortController.abort();

      // Cancel the reader if active
      const reader = activeReadersRef.current.get(fileKey);
      if (reader) {
        reader.cancel().catch(() => {
          // Ignore cancel errors
        });
        activeReadersRef.current.delete(fileKey);
      }

      // Update progress to cancelled
      setDownloadProgress((progressPrev) => {
        const next = new Map(progressPrev);
        next.set(fileKey, {
          status: "cancelled",
          progress: download.progress.progress,
          total: download.progress.total,
          percent: download.progress.percent,
          message: "Download cancelled",
        });
        return next;
      });

      // Call the cancel API to clean up the partial file on the server
      fetch("/api/models/cancel-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: download.fileName }),
      }).catch((err) => {
        console.error("Failed to notify server of cancellation:", err);
      });

      // Remove from active downloads
      const next = new Map(prev);
      next.delete(fileKey);
      return next;
    });
  }, []);

  const startDownload = useCallback(
    async (params: {
      modelId: string;
      fileName: string;
      downloadUrl: string;
      size: number;
      quantization: string;
      token?: string;
    }) => {
      const fileKey = `${params.modelId}/${params.fileName}`;
      const abortController = new AbortController();

      const initialProgress: DownloadProgress = {
        status: "starting",
        progress: 0,
        total: params.size,
        percent: 0,
        message: "Starting download...",
      };

      const download: ActiveDownload = {
        fileKey,
        ...params,
        progress: initialProgress,
        abortController,
      };

      setActiveDownloads((prev) => {
        const next = new Map(prev);
        next.set(fileKey, download);
        return next;
      });

      updateProgress(fileKey, initialProgress);

      try {
        const response = await fetch("/api/models/download-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelId: params.modelId,
            fileName: params.fileName,
            downloadUrl: params.downloadUrl,
            size: params.size,
            quantization: params.quantization,
            token: params.token || undefined,
          }),
          signal: abortController.signal,
        });

        // Check if we got JSON response (already downloaded or error)
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const data = await response.json();
          if (data.alreadyExists) {
            updateProgress(fileKey, {
              status: "complete",
              progress: params.size,
              total: params.size,
              percent: 100,
              message: "Already downloaded!",
            });
            onDownloadCompleteRef.current?.();
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

        // Track this reader for potential cancellation
        activeReadersRef.current.set(fileKey, reader);

        let buffer = "";

        try {
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
                    updateProgress(fileKey, {
                      status: data.status,
                      progress: data.progress || 0,
                      total: data.total || params.size,
                      percent: data.percent || 0,
                      message: data.message || "",
                    });

                    if (eventType === "complete") {
                      onDownloadCompleteRef.current?.();
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
        } finally {
          activeReadersRef.current.delete(fileKey);
        }
      } catch (err) {
        // Check if this was an abort
        if (err instanceof Error && err.name === "AbortError") {
          // Already handled in cancelDownload
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : "Download failed";
        updateProgress(fileKey, {
          status: "error",
          progress: 0,
          total: params.size,
          percent: 0,
          message: errorMessage,
        });
      } finally {
        // Remove from active downloads when done (but keep progress for display)
        setActiveDownloads((prev) => {
          const next = new Map(prev);
          next.delete(fileKey);
          return next;
        });
      }
    },
    [updateProgress],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cancel all active downloads when provider unmounts
      activeReadersRef.current.forEach((reader) => {
        reader.cancel().catch(() => {});
      });
    };
  }, []);

  return (
    <DownloadManagerContext.Provider
      value={{
        activeDownloads,
        downloadProgress,
        startDownload,
        cancelDownload,
        clearDownloadProgress,
        isDownloading,
        setOnDownloadComplete,
      }}
    >
      {children}
    </DownloadManagerContext.Provider>
  );
}

export function useDownloadManager() {
  const context = useContext(DownloadManagerContext);
  if (!context) {
    throw new Error(
      "useDownloadManager must be used within a DownloadManagerProvider",
    );
  }
  return context;
}
