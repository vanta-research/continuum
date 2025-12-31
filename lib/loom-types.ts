// Loom feature type definitions

export interface CursorPosition {
  line: number;
  column: number;
}

export interface LoomDocument {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelEditState {
  isEditing: boolean;
  targetLine: number | null;
  streamBuffer: string;
  pendingEdit: {
    startLine: number;
    endLine: number;
    newContent: string;
  } | null;
}

export interface LoomState {
  // UI state
  isLoomMode: boolean;
  paneWidth: number; // percentage (0-100)

  // Document state
  document: LoomDocument | null;

  // Cursor state
  userCursor: CursorPosition;
  modelCursor: CursorPosition | null;

  // Model editing state
  modelEdit: ModelEditState;

  // File browser state
  fileSidebarOpen: boolean;
  openFileId: string | null;
  openFileName: string | null;
  isFileModified: boolean;
}

export type LoomAction =
  | { type: 'TOGGLE_LOOM_MODE' }
  | { type: 'SET_LOOM_MODE'; payload: boolean }
  | { type: 'SET_PANE_WIDTH'; payload: number }
  | { type: 'CREATE_DOCUMENT'; payload: { sessionId: string; title?: string } }
  | { type: 'UPDATE_CONTENT'; payload: string }
  | { type: 'SET_DOCUMENT'; payload: LoomDocument | null }
  | { type: 'UPDATE_DOCUMENT_TITLE'; payload: string }
  | { type: 'UPDATE_USER_CURSOR'; payload: CursorPosition }
  | { type: 'UPDATE_MODEL_CURSOR'; payload: CursorPosition | null }
  | { type: 'START_MODEL_EDIT'; payload: number }
  | { type: 'STREAM_MODEL_EDIT'; payload: string }
  | { type: 'COMPLETE_MODEL_EDIT' }
  | { type: 'CANCEL_MODEL_EDIT' }
  | { type: 'RESET_LOOM' }
  // File browser actions
  | { type: 'TOGGLE_FILE_SIDEBAR' }
  | { type: 'SET_FILE_SIDEBAR'; payload: boolean }
  | { type: 'OPEN_FILE'; payload: { id: string; name: string; content: string } }
  | { type: 'CLOSE_FILE' }
  | { type: 'SET_FILE_MODIFIED'; payload: boolean };

export interface LoomContextValue {
  state: LoomState;
  dispatch: React.Dispatch<LoomAction>;

  // Convenience methods
  toggleLoomMode: () => void;
  setLoomMode: (enabled: boolean) => void;
  setPaneWidth: (width: number) => void;
  createDocument: (sessionId: string, title?: string) => void;
  updateContent: (content: string) => void;
  updateDocumentTitle: (title: string) => void;
  updateUserCursor: (position: CursorPosition) => void;
  updateModelCursor: (position: CursorPosition | null) => void;
  startModelEdit: (targetLine: number) => void;
  streamModelEdit: (chunk: string) => void;
  completeModelEdit: () => void;
  cancelModelEdit: () => void;
  resetLoom: () => void;

  // File browser methods
  toggleFileSidebar: () => void;
  setFileSidebar: (open: boolean) => void;
  openFile: (id: string, name: string, content: string) => void;
  closeFile: () => void;
  setFileModified: (modified: boolean) => void;
}

// Edit marker types for parsing model responses
// Note: The type values match the CANVAS_EDIT markers the model outputs
export interface ParsedLoomEdit {
  type: 'text' | 'canvas_edit_start' | 'canvas_content' | 'canvas_edit_end';
  content?: string;
  line?: number;
}

// Extended ChatSession interface for loom persistence
export interface LoomEnabledChatSession {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    attachments?: Array<{
      id: string;
      name: string;
      type: string;
      size: number;
      content?: string;
      base64?: string;
    }>;
    timestamp: Date;
  }>;
  timestamp: Date;
  loomDocument?: LoomDocument;
}
