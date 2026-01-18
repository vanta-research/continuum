"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import type {
  LlamaServerStatus,
  LaunchServerOptions,
  ServerOutput,
} from "@/types/electron";

interface LocalServerContextValue {
  // Status
  status: LlamaServerStatus;
  isElectron: boolean;

  // Actions
  launchServer: (modelPath: string, options?: LaunchServerOptions) => Promise<{ success: boolean; error?: string }>;
  stopServer: () => Promise<{ success: boolean; error?: string }>;

  // File selection
  selectModelFile: () => Promise<string | null>;

  // Binary management
  llamaServerPath: string | null;
  detectLlamaServer: () => Promise<string | null>;
  setLlamaServerPath: (path: string) => Promise<boolean>;

  // Server output log
  serverLogs: string[];
  clearLogs: () => void;
}

const defaultStatus: LlamaServerStatus = {
  status: "stopped",
  modelPath: null,
  modelName: null,
  port: 8082,
  error: null,
  pid: null,
};

const LocalServerContext = createContext<LocalServerContextValue | null>(null);

const MAX_LOG_LINES = 100;

export function LocalServerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [status, setStatus] = useState<LlamaServerStatus>(defaultStatus);
  const [isElectron, setIsElectron] = useState(false);
  const [llamaServerPath, setLlamaServerPathState] = useState<string | null>(null);
  const [serverLogs, setServerLogs] = useState<string[]>([]);

  const unsubscribeStatusRef = useRef<(() => void) | null>(null);
  const unsubscribeOutputRef = useRef<(() => void) | null>(null);

  // Check if running in Electron and sync initial state
  useEffect(() => {
    const electronAPI = window.electronAPI;

    if (electronAPI?.isElectron) {
      setIsElectron(true);

      // Get initial status
      electronAPI.getServerStatus().then(setStatus);

      // Detect llama-server binary
      electronAPI.detectLlamaServer().then(setLlamaServerPathState);

      // Subscribe to status changes
      unsubscribeStatusRef.current = electronAPI.onServerStatusChange((newStatus) => {
        setStatus(newStatus);
      });

      // Subscribe to server output
      unsubscribeOutputRef.current = electronAPI.onServerOutput((output: ServerOutput) => {
        setServerLogs((prev) => {
          const newLogs = [...prev, `[${output.type}] ${output.data}`];
          // Keep only last MAX_LOG_LINES
          if (newLogs.length > MAX_LOG_LINES) {
            return newLogs.slice(-MAX_LOG_LINES);
          }
          return newLogs;
        });
      });
    }

    return () => {
      unsubscribeStatusRef.current?.();
      unsubscribeOutputRef.current?.();
    };
  }, []);

  const launchServer = useCallback(
    async (modelPath: string, options?: LaunchServerOptions) => {
      const electronAPI = window.electronAPI;
      if (!electronAPI) {
        return { success: false, error: "Not running in Electron" };
      }

      // Clear previous logs when starting new server
      setServerLogs([]);

      const result = await electronAPI.launchServer(modelPath, options);
      return result;
    },
    []
  );

  const stopServer = useCallback(async () => {
    const electronAPI = window.electronAPI;
    if (!electronAPI) {
      return { success: false, error: "Not running in Electron" };
    }

    const result = await electronAPI.stopServer();
    return result;
  }, []);

  const selectModelFile = useCallback(async () => {
    const electronAPI = window.electronAPI;
    if (!electronAPI) {
      return null;
    }

    return electronAPI.selectModelFile();
  }, []);

  const detectLlamaServer = useCallback(async () => {
    const electronAPI = window.electronAPI;
    if (!electronAPI) {
      return null;
    }

    const path = await electronAPI.detectLlamaServer();
    setLlamaServerPathState(path);
    return path;
  }, []);

  const setLlamaServerPath = useCallback(async (path: string) => {
    const electronAPI = window.electronAPI;
    if (!electronAPI) {
      return false;
    }

    const success = await electronAPI.setLlamaServerPath(path);
    if (success) {
      setLlamaServerPathState(path);
    }
    return success;
  }, []);

  const clearLogs = useCallback(() => {
    setServerLogs([]);
  }, []);

  return (
    <LocalServerContext.Provider
      value={{
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
      }}
    >
      {children}
    </LocalServerContext.Provider>
  );
}

export function useLocalServer() {
  const context = useContext(LocalServerContext);
  if (!context) {
    throw new Error("useLocalServer must be used within a LocalServerProvider");
  }
  return context;
}
