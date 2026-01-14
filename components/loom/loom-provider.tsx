"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
} from "react";
import type {
  LoomState,
  LoomAction,
  LoomContextValue,
  CursorPosition,
  LoomDocument,
  PendingEdit,
  ModifiedBy,
} from "@/lib/loom-types";
import { applyPendingEdit } from "@/lib/diff-utils";

const PANE_WIDTH_STORAGE_KEY = "loom-pane-width";
const AUTO_ACCEPT_STORAGE_KEY = "loom-auto-accept-edits";
const LOOM_MODE_STORAGE_KEY = "loom-mode-enabled";
const LOOM_DOCUMENT_STORAGE_KEY = "loom-document-content";
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
    streamBuffer: "",
    pendingEdit: null,
  },
  // File browser state
  fileSidebarOpen: true,
  openFileId: null,
  openFileName: null,
  isFileModified: false,
  // Pending edits queue
  pendingEdits: [],
  autoAcceptEdits: false,
  // Edit history
  editHistory: [],
};

function loomReducer(state: LoomState, action: LoomAction): LoomState {
  switch (action.type) {
    case "TOGGLE_LOOM_MODE":
      return { ...state, isLoomMode: !state.isLoomMode };

    case "SET_LOOM_MODE":
      return { ...state, isLoomMode: action.payload };

    case "SET_PANE_WIDTH":
      return {
        ...state,
        paneWidth: Math.min(Math.max(action.payload, 20), 80),
      };

    case "CREATE_DOCUMENT": {
      const newDoc: LoomDocument = {
        id: `doc-${Date.now()}`,
        title: action.payload.title || "Untitled Document",
        content: "",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastModifiedBy: "user",
      };
      return { ...state, document: newDoc };
    }

    case "UPDATE_CONTENT":
      console.log("[LoomProvider] UPDATE_CONTENT action received");
      console.log("[LoomProvider] - payload length:", action.payload?.length);
      console.log(
        "[LoomProvider] - payload preview:",
        action.payload?.substring(0, 200),
      );
      console.log("[LoomProvider] - document exists:", !!state.document);
      if (!state.document) {
        console.log("[LoomProvider] No document, returning unchanged state");
        return state;
      }
      console.log(
        "[LoomProvider] Updating document content from",
        state.document.content.length,
        "to",
        action.payload?.length,
        "chars",
      );
      return {
        ...state,
        document: {
          ...state.document,
          content: action.payload,
          updatedAt: new Date(),
          lastModifiedBy: "user",
        },
      };

    case "SET_DOCUMENT":
      return { ...state, document: action.payload };

    case "UPDATE_DOCUMENT_TITLE":
      if (!state.document) return state;
      return {
        ...state,
        document: {
          ...state.document,
          title: action.payload,
          updatedAt: new Date(),
          lastModifiedBy: "user",
        },
      };

    case "UPDATE_USER_CURSOR":
      return { ...state, userCursor: action.payload };

    case "UPDATE_MODEL_CURSOR":
      return { ...state, modelCursor: action.payload };

    case "START_MODEL_EDIT":
      return {
        ...state,
        modelEdit: {
          isEditing: true,
          targetLine: action.payload,
          streamBuffer: "",
          pendingEdit: null,
        },
        modelCursor: { line: action.payload, column: 0 },
      };

    case "STREAM_MODEL_EDIT":
      return {
        ...state,
        modelEdit: {
          ...state.modelEdit,
          streamBuffer: state.modelEdit.streamBuffer + action.payload,
        },
      };

    case "COMPLETE_MODEL_EDIT": {
      if (!state.document || !state.modelEdit.isEditing) return state;

      const lines = state.document.content.split("\n");
      const targetLine = state.modelEdit.targetLine || 1;
      const newContent = state.modelEdit.streamBuffer;

      // Replace the target line with the new content
      const newLines = [...lines];
      const newContentLines = newContent.split("\n");

      // Remove old line(s) and insert new content
      newLines.splice(
        targetLine - 1,
        newContentLines.length,
        ...newContentLines,
      );

      return {
        ...state,
        document: {
          ...state.document,
          content: newLines.join("\n"),
          updatedAt: new Date(),
          lastModifiedBy: "ai",
        },
        modelEdit: {
          isEditing: false,
          targetLine: null,
          streamBuffer: "",
          pendingEdit: null,
        },
        modelCursor: null,
      };
    }

    case "CANCEL_MODEL_EDIT":
      return {
        ...state,
        modelEdit: {
          isEditing: false,
          targetLine: null,
          streamBuffer: "",
          pendingEdit: null,
        },
        modelCursor: null,
      };

    case "RESET_LOOM":
      return {
        ...initialState,
        paneWidth: state.paneWidth, // Preserve pane width preference
        fileSidebarOpen: state.fileSidebarOpen, // Preserve sidebar preference
        autoAcceptEdits: state.autoAcceptEdits, // Preserve auto-accept preference
      };

    // File browser actions
    case "TOGGLE_FILE_SIDEBAR":
      return { ...state, fileSidebarOpen: !state.fileSidebarOpen };

    case "SET_FILE_SIDEBAR":
      return { ...state, fileSidebarOpen: action.payload };

    case "OPEN_FILE": {
      const { id, name, content } = action.payload;
      const fileDoc: LoomDocument = {
        id: `file-${id}`,
        title: name,
        content: content,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastModifiedBy: "user",
      };
      return {
        ...state,
        openFileId: id,
        openFileName: name,
        document: fileDoc,
        isFileModified: false,
      };
    }

    case "CLOSE_FILE":
      return {
        ...state,
        openFileId: null,
        openFileName: null,
        document: null,
        isFileModified: false,
      };

    case "SET_FILE_MODIFIED":
      return { ...state, isFileModified: action.payload };

    // Pending edit actions
    case "ADD_PENDING_EDIT": {
      console.log("[LoomProvider] ADD_PENDING_EDIT action received");
      console.log("[LoomProvider] - targetLine:", action.payload.targetLine);
      console.log(
        "[LoomProvider] - originalContent length:",
        action.payload.originalContent?.length,
      );
      console.log(
        "[LoomProvider] - newContent length:",
        action.payload.newContent?.length,
      );
      console.log(
        "[LoomProvider] - current pendingEdits count:",
        state.pendingEdits.length,
      );

      const newPendingEdit: PendingEdit = {
        id: `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        targetLine: action.payload.targetLine,
        originalContent: action.payload.originalContent,
        newContent: action.payload.newContent,
        timestamp: new Date(),
        status: "pending",
      };
      console.log(
        "[LoomProvider] Created pending edit with id:",
        newPendingEdit.id,
      );
      console.log(
        "[LoomProvider] New pendingEdits count will be:",
        state.pendingEdits.length + 1,
      );

      return {
        ...state,
        pendingEdits: [...state.pendingEdits, newPendingEdit],
      };
    }

    case "ACCEPT_PENDING_EDIT": {
      const editId = action.payload;
      const editIndex = state.pendingEdits.findIndex((e) => e.id === editId);
      if (editIndex === -1 || !state.document) return state;

      const edit = state.pendingEdits[editIndex];

      // Apply the edit to the document
      const newDocumentContent = applyPendingEdit(
        state.document.content,
        edit.targetLine,
        edit.newContent,
      );

      // Update edit status and move to history
      const acceptedEdit: PendingEdit = { ...edit, status: "accepted" };
      const newHistory = [
        ...state.editHistory,
        {
          edit: acceptedEdit,
          appliedAt: new Date(),
          action: "accepted" as const,
        },
      ];

      // Remove from pending
      const newPendingEdits = state.pendingEdits.filter((e) => e.id !== editId);

      return {
        ...state,
        document: {
          ...state.document,
          content: newDocumentContent,
          updatedAt: new Date(),
          lastModifiedBy: "ai",
        },
        pendingEdits: newPendingEdits,
        editHistory: newHistory,
      };
    }

    case "REJECT_PENDING_EDIT": {
      const editId = action.payload;
      const editIndex = state.pendingEdits.findIndex((e) => e.id === editId);
      if (editIndex === -1) return state;

      const edit = state.pendingEdits[editIndex];

      // Move to history as rejected
      const rejectedEdit: PendingEdit = { ...edit, status: "rejected" };
      const newHistory = [
        ...state.editHistory,
        {
          edit: rejectedEdit,
          appliedAt: new Date(),
          action: "rejected" as const,
        },
      ];

      // Remove from pending
      const newPendingEdits = state.pendingEdits.filter((e) => e.id !== editId);

      return {
        ...state,
        pendingEdits: newPendingEdits,
        editHistory: newHistory,
      };
    }

    case "MODIFY_PENDING_EDIT": {
      const { id, newContent } = action.payload;
      const editIndex = state.pendingEdits.findIndex((e) => e.id === id);
      if (editIndex === -1) return state;

      const newPendingEdits = [...state.pendingEdits];
      newPendingEdits[editIndex] = {
        ...newPendingEdits[editIndex],
        newContent,
        status: "modified",
      };

      return {
        ...state,
        pendingEdits: newPendingEdits,
      };
    }

    case "CLEAR_PENDING_EDITS":
      return {
        ...state,
        pendingEdits: [],
      };

    case "SET_AUTO_ACCEPT_EDITS":
      return {
        ...state,
        autoAcceptEdits: action.payload,
      };

    case "UNDO_LAST_EDIT": {
      // Find the last accepted edit in history
      const lastAcceptedIndex = [...state.editHistory]
        .reverse()
        .findIndex((entry) => entry.action === "accepted");

      if (lastAcceptedIndex === -1 || !state.document) return state;

      // Convert reverse index to actual index
      const actualIndex = state.editHistory.length - 1 - lastAcceptedIndex;
      const lastAccepted = state.editHistory[actualIndex];

      // Restore the original content by replacing the new content with original
      const lines = state.document.content.split("\n");
      const targetLine = lastAccepted.edit.targetLine;
      const newContentLineCount =
        lastAccepted.edit.newContent.split("\n").length;

      // Remove the lines that were added and restore original
      const newLines = [
        ...lines.slice(0, targetLine - 1),
        lastAccepted.edit.originalContent,
        ...lines.slice(targetLine - 1 + newContentLineCount),
      ];

      // Remove this entry from history
      const newHistory = state.editHistory.filter((_, i) => i !== actualIndex);

      return {
        ...state,
        document: {
          ...state.document,
          content: newLines.join("\n"),
          updatedAt: new Date(),
          lastModifiedBy: "user" as ModifiedBy,
        },
        editHistory: newHistory,
      };
    }

    case "CLEAR_EDIT_HISTORY":
      return {
        ...state,
        editHistory: [],
      };

    default:
      return state;
  }
}

const LoomContext = createContext<LoomContextValue | null>(null);

export function LoomProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(loomReducer, initialState);

  // Load persisted state from localStorage on mount
  useEffect(() => {
    const savedWidth = localStorage.getItem(PANE_WIDTH_STORAGE_KEY);
    if (savedWidth) {
      dispatch({ type: "SET_PANE_WIDTH", payload: parseFloat(savedWidth) });
    }

    const savedAutoAccept = localStorage.getItem(AUTO_ACCEPT_STORAGE_KEY);
    if (savedAutoAccept) {
      dispatch({
        type: "SET_AUTO_ACCEPT_EDITS",
        payload: savedAutoAccept === "true",
      });
    }

    const savedLoomMode = localStorage.getItem(LOOM_MODE_STORAGE_KEY);
    if (savedLoomMode === "true") {
      dispatch({ type: "SET_LOOM_MODE", payload: true });
    }

    // Restore document content if it was saved
    const savedDocument = localStorage.getItem(LOOM_DOCUMENT_STORAGE_KEY);
    if (savedDocument) {
      try {
        const docData = JSON.parse(savedDocument);
        if (docData.content) {
          console.log(
            "[LoomProvider] Restoring saved document, content length:",
            docData.content.length,
          );
          dispatch({
            type: "SET_DOCUMENT",
            payload: {
              id: docData.id || `doc-${Date.now()}`,
              title: docData.title || "Untitled Document",
              content: docData.content,
              createdAt: new Date(docData.createdAt || Date.now()),
              updatedAt: new Date(docData.updatedAt || Date.now()),
              lastModifiedBy: docData.lastModifiedBy || "user",
            },
          });
        }
      } catch (e) {
        console.error("[LoomProvider] Failed to restore document:", e);
      }
    }
  }, []);

  // Auto-create document when Loom mode is enabled but no document exists
  useEffect(() => {
    if (state.isLoomMode && !state.document) {
      console.log(
        "[LoomProvider] Loom mode enabled but no document, auto-creating",
      );
      dispatch({
        type: "CREATE_DOCUMENT",
        payload: { sessionId: "auto", title: "Untitled Document" },
      });
    }
  }, [state.isLoomMode, state.document]);

  // Save document content to localStorage when it changes
  useEffect(() => {
    if (state.document) {
      const docData = {
        id: state.document.id,
        title: state.document.title,
        content: state.document.content,
        createdAt: state.document.createdAt,
        updatedAt: state.document.updatedAt,
        lastModifiedBy: state.document.lastModifiedBy,
      };
      localStorage.setItem(LOOM_DOCUMENT_STORAGE_KEY, JSON.stringify(docData));
    } else {
      // Clear saved document when document is removed
      localStorage.removeItem(LOOM_DOCUMENT_STORAGE_KEY);
    }
  }, [state.document]);

  // Save pane width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(PANE_WIDTH_STORAGE_KEY, state.paneWidth.toString());
  }, [state.paneWidth]);

  // Save auto-accept preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(
      AUTO_ACCEPT_STORAGE_KEY,
      state.autoAcceptEdits.toString(),
    );
  }, [state.autoAcceptEdits]);

  // Save loom mode preference to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(LOOM_MODE_STORAGE_KEY, state.isLoomMode.toString());
  }, [state.isLoomMode]);

  // Convenience methods
  const toggleLoomMode = useCallback(() => {
    dispatch({ type: "TOGGLE_LOOM_MODE" });
  }, []);

  const setLoomMode = useCallback((enabled: boolean) => {
    dispatch({ type: "SET_LOOM_MODE", payload: enabled });
  }, []);

  const setPaneWidth = useCallback((width: number) => {
    dispatch({ type: "SET_PANE_WIDTH", payload: width });
  }, []);

  const createDocument = useCallback((sessionId: string, title?: string) => {
    dispatch({ type: "CREATE_DOCUMENT", payload: { sessionId, title } });
  }, []);

  const updateContent = useCallback((content: string) => {
    dispatch({ type: "UPDATE_CONTENT", payload: content });
  }, []);

  const updateDocumentTitle = useCallback((title: string) => {
    dispatch({ type: "UPDATE_DOCUMENT_TITLE", payload: title });
  }, []);

  const updateUserCursor = useCallback((position: CursorPosition) => {
    dispatch({ type: "UPDATE_USER_CURSOR", payload: position });
  }, []);

  const updateModelCursor = useCallback((position: CursorPosition | null) => {
    dispatch({ type: "UPDATE_MODEL_CURSOR", payload: position });
  }, []);

  const startModelEdit = useCallback((targetLine: number) => {
    dispatch({ type: "START_MODEL_EDIT", payload: targetLine });
  }, []);

  const streamModelEdit = useCallback((chunk: string) => {
    dispatch({ type: "STREAM_MODEL_EDIT", payload: chunk });
  }, []);

  const completeModelEdit = useCallback(() => {
    dispatch({ type: "COMPLETE_MODEL_EDIT" });
  }, []);

  const cancelModelEdit = useCallback(() => {
    dispatch({ type: "CANCEL_MODEL_EDIT" });
  }, []);

  const resetLoom = useCallback(() => {
    dispatch({ type: "RESET_LOOM" });
  }, []);

  // File browser methods
  const toggleFileSidebar = useCallback(() => {
    dispatch({ type: "TOGGLE_FILE_SIDEBAR" });
  }, []);

  const setFileSidebar = useCallback((open: boolean) => {
    dispatch({ type: "SET_FILE_SIDEBAR", payload: open });
  }, []);

  const openFile = useCallback((id: string, name: string, content: string) => {
    dispatch({ type: "OPEN_FILE", payload: { id, name, content } });
  }, []);

  const closeFile = useCallback(() => {
    dispatch({ type: "CLOSE_FILE" });
  }, []);

  const setFileModified = useCallback((modified: boolean) => {
    dispatch({ type: "SET_FILE_MODIFIED", payload: modified });
  }, []);

  // Pending edit methods
  const addPendingEdit = useCallback(
    (targetLine: number, originalContent: string, newContent: string) => {
      dispatch({
        type: "ADD_PENDING_EDIT",
        payload: { targetLine, originalContent, newContent },
      });
    },
    [],
  );

  const acceptPendingEdit = useCallback((editId: string) => {
    dispatch({ type: "ACCEPT_PENDING_EDIT", payload: editId });
  }, []);

  const rejectPendingEdit = useCallback((editId: string) => {
    dispatch({ type: "REJECT_PENDING_EDIT", payload: editId });
  }, []);

  const modifyPendingEdit = useCallback(
    (editId: string, newContent: string) => {
      dispatch({
        type: "MODIFY_PENDING_EDIT",
        payload: { id: editId, newContent },
      });
    },
    [],
  );

  const clearPendingEdits = useCallback(() => {
    dispatch({ type: "CLEAR_PENDING_EDITS" });
  }, []);

  const setAutoAcceptEdits = useCallback((enabled: boolean) => {
    dispatch({ type: "SET_AUTO_ACCEPT_EDITS", payload: enabled });
  }, []);

  const clearEditHistory = useCallback(() => {
    dispatch({ type: "CLEAR_EDIT_HISTORY" });
  }, []);

  const undoLastEdit = useCallback(() => {
    dispatch({ type: "UNDO_LAST_EDIT" });
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
    // Pending edit methods
    addPendingEdit,
    acceptPendingEdit,
    rejectPendingEdit,
    modifyPendingEdit,
    clearPendingEdits,
    setAutoAcceptEdits,
    clearEditHistory,
    undoLastEdit,
  };

  return <LoomContext.Provider value={value}>{children}</LoomContext.Provider>;
}

export function useLoom(): LoomContextValue {
  const context = useContext(LoomContext);
  if (!context) {
    throw new Error("useLoom must be used within a LoomProvider");
  }
  return context;
}
