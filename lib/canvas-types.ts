// Canvas feature type definitions

export interface CursorPosition {
  line: number;
  column: number;
}

export interface CanvasDocument {
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

export interface CanvasState {
  // UI state
  isCanvasMode: boolean;
  paneWidth: number; // percentage (0-100)

  // Document state
  document: CanvasDocument | null;

  // Cursor state
  userCursor: CursorPosition;
  modelCursor: CursorPosition | null;

  // Model editing state
  modelEdit: ModelEditState;
}

export type CanvasAction =
  | { type: 'TOGGLE_CANVAS_MODE' }
  | { type: 'SET_CANVAS_MODE'; payload: boolean }
  | { type: 'SET_PANE_WIDTH'; payload: number }
  | { type: 'CREATE_DOCUMENT'; payload: { sessionId: string; title?: string } }
  | { type: 'UPDATE_CONTENT'; payload: string }
  | { type: 'SET_DOCUMENT'; payload: CanvasDocument | null }
  | { type: 'UPDATE_DOCUMENT_TITLE'; payload: string }
  | { type: 'UPDATE_USER_CURSOR'; payload: CursorPosition }
  | { type: 'UPDATE_MODEL_CURSOR'; payload: CursorPosition | null }
  | { type: 'START_MODEL_EDIT'; payload: number }
  | { type: 'STREAM_MODEL_EDIT'; payload: string }
  | { type: 'COMPLETE_MODEL_EDIT' }
  | { type: 'CANCEL_MODEL_EDIT' }
  | { type: 'RESET_CANVAS' };

export interface CanvasContextValue {
  state: CanvasState;
  dispatch: React.Dispatch<CanvasAction>;

  // Convenience methods
  toggleCanvasMode: () => void;
  setCanvasMode: (enabled: boolean) => void;
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
  resetCanvas: () => void;
}

// Edit marker types for parsing model responses
export interface ParsedCanvasEdit {
  type: 'text' | 'canvas_edit_start' | 'canvas_content' | 'canvas_edit_end';
  content?: string;
  line?: number;
}

// Extended ChatSession interface for canvas persistence
export interface CanvasEnabledChatSession {
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
  canvasDocument?: CanvasDocument;
}
