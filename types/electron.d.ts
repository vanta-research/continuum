// Type declarations for Electron IPC API exposed via preload script

export interface LlamaServerStatus {
  status: 'stopped' | 'starting' | 'running' | 'error';
  modelPath: string | null;
  modelName: string | null;
  port: number;
  error: string | null;
  pid: number | null;
}

export interface LaunchServerOptions {
  port?: number;
  contextSize?: number;
  gpuLayers?: number;
}

export interface LaunchServerResult {
  success: boolean;
  error?: string;
}

export interface StopServerResult {
  success: boolean;
  message?: string;
  error?: string;
}

export interface ServerOutput {
  type: 'stdout' | 'stderr';
  data: string;
}

export interface ElectronAPI {
  // File selection
  selectModelFile: () => Promise<string | null>;

  // Server management
  launchServer: (modelPath: string, options?: LaunchServerOptions) => Promise<LaunchServerResult>;
  stopServer: () => Promise<StopServerResult>;
  getServerStatus: () => Promise<LlamaServerStatus>;

  // Binary detection
  detectLlamaServer: () => Promise<string | null>;
  setLlamaServerPath: (path: string) => Promise<boolean>;

  // Status change subscription
  onServerStatusChange: (callback: (status: LlamaServerStatus) => void) => () => void;

  // Server output subscription (for logs)
  onServerOutput: (callback: (output: ServerOutput) => void) => () => void;

  // Check if running in Electron
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
