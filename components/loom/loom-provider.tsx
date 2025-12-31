'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { LoomState, LoomAction, LoomContextValue, CursorPosition, LoomDocument } from '@/lib/loom-types';

const PANE_WIDTH_STORAGE_KEY = 'loom-pane-width';
const DEFAULT_PANE_WIDTH = 50;

const initialState: LoomState = {
  isLoomMode: false,
  paneWidth: DEFAULT_PANE_WIDTH,
  document: null,
  userCursor: { line: 1, column: 0 },
  modelCursor: null,
  modelEdit: {
    isEditing: false,
    targetLine: null,
    streamBuffer: '',
    pendingEdit: null,
  },
  // File browser state
  fileSidebarOpen: true,
  openFileId: null,
  openFileName: null,
  isFileModified: false,
};

function loomReducer(state: LoomState, action: LoomAction): LoomState {
  switch (action.type) {
    case 'TOGGLE_LOOM_MODE':
      return { ...state, isLoomMode: !state.isLoomMode };

    case 'SET_LOOM_MODE':
      return { ...state, isLoomMode: action.payload };

    case 'SET_PANE_WIDTH':
      return { ...state, paneWidth: Math.min(Math.max(action.payload, 20), 80) };

    case 'CREATE_DOCUMENT': {
      const newDoc: LoomDocument = {
        id: `doc-${Date.now()}`,
        title: action.payload.title || 'Untitled Document',
        content: '',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return { ...state, document: newDoc };
    }

    case 'UPDATE_CONTENT':
      if (!state.document) return state;
      return {
        ...state,
        document: {
          ...state.document,
          content: action.payload,
          updatedAt: new Date(),
        },
      };

    case 'SET_DOCUMENT':
      return { ...state, document: action.payload };

    case 'UPDATE_DOCUMENT_TITLE':
      if (!state.document) return state;
      return {
        ...state,
        document: {
          ...state.document,
          title: action.payload,
          updatedAt: new Date(),
        },
      };

    case 'UPDATE_USER_CURSOR':
      return { ...state, userCursor: action.payload };

    case 'UPDATE_MODEL_CURSOR':
      return { ...state, modelCursor: action.payload };

    case 'START_MODEL_EDIT':
      return {
        ...state,
        modelEdit: {
          isEditing: true,
          targetLine: action.payload,
          streamBuffer: '',
          pendingEdit: null,
        },
        modelCursor: { line: action.payload, column: 0 },
      };

    case 'STREAM_MODEL_EDIT':
      return {
        ...state,
        modelEdit: {
          ...state.modelEdit,
          streamBuffer: state.modelEdit.streamBuffer + action.payload,
        },
      };

    case 'COMPLETE_MODEL_EDIT': {
      if (!state.document || !state.modelEdit.isEditing) return state;

      const lines = state.document.content.split('\n');
      const targetLine = state.modelEdit.targetLine || 1;
      const newContent = state.modelEdit.streamBuffer;

      // Replace the target line with the new content
      const newLines = [...lines];
      const newContentLines = newContent.split('\n');

      // Remove old line(s) and insert new content
      newLines.splice(targetLine - 1, newContentLines.length, ...newContentLines);

      return {
        ...state,
        document: {
          ...state.document,
          content: newLines.join('\n'),
          updatedAt: new Date(),
        },
        modelEdit: {
          isEditing: false,
          targetLine: null,
          streamBuffer: '',
          pendingEdit: null,
        },
        modelCursor: null,
      };
    }

    case 'CANCEL_MODEL_EDIT':
      return {
        ...state,
        modelEdit: {
          isEditing: false,
          targetLine: null,
          streamBuffer: '',
          pendingEdit: null,
        },
        modelCursor: null,
      };

    case 'RESET_LOOM':
      return {
        ...initialState,
        paneWidth: state.paneWidth, // Preserve pane width preference
        fileSidebarOpen: state.fileSidebarOpen, // Preserve sidebar preference
      };

    // File browser actions
    case 'TOGGLE_FILE_SIDEBAR':
      return { ...state, fileSidebarOpen: !state.fileSidebarOpen };

    case 'SET_FILE_SIDEBAR':
      return { ...state, fileSidebarOpen: action.payload };

    case 'OPEN_FILE': {
      const { id, name, content } = action.payload;
      const fileDoc: LoomDocument = {
        id: `file-${id}`,
        title: name,
        content: content,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return {
        ...state,
        openFileId: id,
        openFileName: name,
        document: fileDoc,
        isFileModified: false,
      };
    }

    case 'CLOSE_FILE':
      return {
        ...state,
        openFileId: null,
        openFileName: null,
        document: null,
        isFileModified: false,
      };

    case 'SET_FILE_MODIFIED':
      return { ...state, isFileModified: action.payload };

    default:
      return state;
  }
}

const LoomContext = createContext<LoomContextValue | null>(null);

export function LoomProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(loomReducer, initialState);

  // Load pane width from localStorage on mount
  useEffect(() => {
    const savedWidth = localStorage.getItem(PANE_WIDTH_STORAGE_KEY);
    if (savedWidth) {
      dispatch({ type: 'SET_PANE_WIDTH', payload: parseFloat(savedWidth) });
    }
  }, []);

  // Save pane width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(PANE_WIDTH_STORAGE_KEY, state.paneWidth.toString());
  }, [state.paneWidth]);

  // Convenience methods
  const toggleLoomMode = useCallback(() => {
    dispatch({ type: 'TOGGLE_LOOM_MODE' });
  }, []);

  const setLoomMode = useCallback((enabled: boolean) => {
    dispatch({ type: 'SET_LOOM_MODE', payload: enabled });
  }, []);

  const setPaneWidth = useCallback((width: number) => {
    dispatch({ type: 'SET_PANE_WIDTH', payload: width });
  }, []);

  const createDocument = useCallback((sessionId: string, title?: string) => {
    dispatch({ type: 'CREATE_DOCUMENT', payload: { sessionId, title } });
  }, []);

  const updateContent = useCallback((content: string) => {
    dispatch({ type: 'UPDATE_CONTENT', payload: content });
  }, []);

  const updateDocumentTitle = useCallback((title: string) => {
    dispatch({ type: 'UPDATE_DOCUMENT_TITLE', payload: title });
  }, []);

  const updateUserCursor = useCallback((position: CursorPosition) => {
    dispatch({ type: 'UPDATE_USER_CURSOR', payload: position });
  }, []);

  const updateModelCursor = useCallback((position: CursorPosition | null) => {
    dispatch({ type: 'UPDATE_MODEL_CURSOR', payload: position });
  }, []);

  const startModelEdit = useCallback((targetLine: number) => {
    dispatch({ type: 'START_MODEL_EDIT', payload: targetLine });
  }, []);

  const streamModelEdit = useCallback((chunk: string) => {
    dispatch({ type: 'STREAM_MODEL_EDIT', payload: chunk });
  }, []);

  const completeModelEdit = useCallback(() => {
    dispatch({ type: 'COMPLETE_MODEL_EDIT' });
  }, []);

  const cancelModelEdit = useCallback(() => {
    dispatch({ type: 'CANCEL_MODEL_EDIT' });
  }, []);

  const resetLoom = useCallback(() => {
    dispatch({ type: 'RESET_LOOM' });
  }, []);

  // File browser methods
  const toggleFileSidebar = useCallback(() => {
    dispatch({ type: 'TOGGLE_FILE_SIDEBAR' });
  }, []);

  const setFileSidebar = useCallback((open: boolean) => {
    dispatch({ type: 'SET_FILE_SIDEBAR', payload: open });
  }, []);

  const openFile = useCallback((id: string, name: string, content: string) => {
    dispatch({ type: 'OPEN_FILE', payload: { id, name, content } });
  }, []);

  const closeFile = useCallback(() => {
    dispatch({ type: 'CLOSE_FILE' });
  }, []);

  const setFileModified = useCallback((modified: boolean) => {
    dispatch({ type: 'SET_FILE_MODIFIED', payload: modified });
  }, []);

  const value: LoomContextValue = {
    state,
    dispatch,
    toggleLoomMode,
    setLoomMode,
    setPaneWidth,
    createDocument,
    updateContent,
    updateDocumentTitle,
    updateUserCursor,
    updateModelCursor,
    startModelEdit,
    streamModelEdit,
    completeModelEdit,
    cancelModelEdit,
    resetLoom,
    // File browser methods
    toggleFileSidebar,
    setFileSidebar,
    openFile,
    closeFile,
    setFileModified,
  };

  return (
    <LoomContext.Provider value={value}>
      {children}
    </LoomContext.Provider>
  );
}

export function useLoom(): LoomContextValue {
  const context = useContext(LoomContext);
  if (!context) {
    throw new Error('useLoom must be used within a LoomProvider');
  }
  return context;
}
