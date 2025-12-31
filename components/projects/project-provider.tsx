'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type {
  Project,
  ProjectSummary,
  ProjectFile,
  StoredSession,
  StoredMessage,
  StoredLoomDocument,
} from '@/lib/project-types';

// ============================================================
// Types
// ============================================================

interface ProjectState {
  projects: ProjectSummary[];
  activeProject: Project | null;
  activeProjectId: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

type ProjectAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_INITIALIZED'; payload: boolean }
  | { type: 'SET_PROJECTS'; payload: { projects: ProjectSummary[]; activeProjectId?: string } }
  | { type: 'SET_ACTIVE_PROJECT'; payload: Project | null }
  | { type: 'ADD_PROJECT'; payload: ProjectSummary }
  | { type: 'UPDATE_PROJECT'; payload: { id: string; updates: Partial<ProjectSummary> } }
  | { type: 'REMOVE_PROJECT'; payload: string }
  | { type: 'UPDATE_SESSION'; payload: StoredSession }
  | { type: 'ADD_SESSION'; payload: StoredSession }
  | { type: 'REMOVE_SESSION'; payload: string }
  | { type: 'ADD_FILE'; payload: ProjectFile }
  | { type: 'REMOVE_FILE'; payload: string };

interface ProjectContextValue {
  state: ProjectState;

  // Project operations
  createProject: (name: string, description?: string) => Promise<Project | null>;
  switchProject: (projectId: string) => Promise<void>;
  updateProject: (projectId: string, updates: { name?: string; description?: string }) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  refreshProjects: () => Promise<void>;
  refreshActiveProject: () => Promise<void>;

  // Session operations
  saveSession: (session: StoredSession) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  setActiveSession: (sessionId: string) => Promise<void>;

  // File operations
  uploadFile: (file: File, extractedContent?: string) => Promise<ProjectFile | null>;
  deleteFile: (fileId: string) => Promise<void>;
  getFileUrl: (fileId: string) => string;
}

// ============================================================
// Initial State
// ============================================================

const initialState: ProjectState = {
  projects: [],
  activeProject: null,
  activeProjectId: null,
  isLoading: true,
  isInitialized: false,
  error: null,
};

// ============================================================
// Reducer
// ============================================================

function projectReducer(state: ProjectState, action: ProjectAction): ProjectState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_INITIALIZED':
      return { ...state, isInitialized: action.payload };

    case 'SET_PROJECTS':
      return {
        ...state,
        projects: action.payload.projects,
        activeProjectId: action.payload.activeProjectId || state.activeProjectId,
      };

    case 'SET_ACTIVE_PROJECT':
      return {
        ...state,
        activeProject: action.payload,
        activeProjectId: action.payload?.id || null,
      };

    case 'ADD_PROJECT':
      return {
        ...state,
        projects: [action.payload, ...state.projects],
      };

    case 'UPDATE_PROJECT': {
      const { id, updates } = action.payload;
      return {
        ...state,
        projects: state.projects.map(p =>
          p.id === id ? { ...p, ...updates } : p
        ),
        activeProject: state.activeProject?.id === id
          ? { ...state.activeProject, ...updates }
          : state.activeProject,
      };
    }

    case 'REMOVE_PROJECT':
      return {
        ...state,
        projects: state.projects.filter(p => p.id !== action.payload),
        activeProject: state.activeProject?.id === action.payload ? null : state.activeProject,
        activeProjectId: state.activeProjectId === action.payload ? null : state.activeProjectId,
      };

    case 'UPDATE_SESSION': {
      if (!state.activeProject) return state;
      const existingIndex = state.activeProject.sessions.findIndex(
        s => s.id === action.payload.id
      );
      const newSessions =
        existingIndex >= 0
          ? state.activeProject.sessions.map((s, i) =>
              i === existingIndex ? action.payload : s
            )
          : [action.payload, ...state.activeProject.sessions];

      return {
        ...state,
        activeProject: {
          ...state.activeProject,
          sessions: newSessions,
        },
      };
    }

    case 'ADD_SESSION': {
      if (!state.activeProject) return state;
      return {
        ...state,
        activeProject: {
          ...state.activeProject,
          sessions: [action.payload, ...state.activeProject.sessions],
        },
      };
    }

    case 'REMOVE_SESSION': {
      if (!state.activeProject) return state;
      return {
        ...state,
        activeProject: {
          ...state.activeProject,
          sessions: state.activeProject.sessions.filter(s => s.id !== action.payload),
        },
      };
    }

    case 'ADD_FILE': {
      if (!state.activeProject) return state;
      return {
        ...state,
        activeProject: {
          ...state.activeProject,
          files: [...state.activeProject.files, action.payload],
        },
      };
    }

    case 'REMOVE_FILE': {
      if (!state.activeProject) return state;
      return {
        ...state,
        activeProject: {
          ...state.activeProject,
          files: state.activeProject.files.filter(f => f.id !== action.payload),
        },
      };
    }

    default:
      return state;
  }
}

// ============================================================
// Context
// ============================================================

const ProjectContext = createContext<ProjectContextValue | null>(null);

// ============================================================
// Provider
// ============================================================

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(projectReducer, initialState);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  // Load active project when activeProjectId changes
  useEffect(() => {
    if (state.activeProjectId && state.isInitialized) {
      loadActiveProject(state.activeProjectId);
    }
  }, [state.activeProjectId, state.isInitialized]);

  // Track file count with a ref to avoid stale closure issues
  const fileCountRef = useRef<number>(0);
  useEffect(() => {
    fileCountRef.current = state.activeProject?.files?.length ?? 0;
  }, [state.activeProject?.files?.length]);

  // Auto-refresh files periodically to detect new files
  useEffect(() => {
    if (!state.activeProjectId || !state.isInitialized) return;

    const projectId = state.activeProjectId; // Capture for closure

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}`);
        const data = await response.json();
        if (data.success && data.project) {
          const newFileCount = data.project.files?.length ?? 0;
          const currentCount = fileCountRef.current;
          if (newFileCount !== currentCount) {
            dispatch({ type: 'SET_ACTIVE_PROJECT', payload: data.project });
          }
        }
      } catch (error) {
        // Silent fail for polling
      }
    }, 2000); // Poll every 2 seconds for faster discovery

    return () => clearInterval(pollInterval);
  }, [state.activeProjectId, state.isInitialized]);

  // ============================================================
  // API Functions
  // ============================================================

  async function loadProjects() {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });

      const response = await fetch('/api/projects');
      const data = await response.json();

      if (data.success) {
        dispatch({
          type: 'SET_PROJECTS',
          payload: {
            projects: data.projects,
            activeProjectId: data.activeProjectId,
          },
        });

        // If no projects exist, create a default one
        if (data.projects.length === 0) {
          await createProjectInternal('My First Project', 'Welcome to Continuum!');
        }
      } else {
        dispatch({ type: 'SET_ERROR', payload: data.error || 'Failed to load projects' });
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load projects' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_INITIALIZED', payload: true });
    }
  }

  async function loadActiveProject(projectId: string) {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      const data = await response.json();

      if (data.success) {
        dispatch({ type: 'SET_ACTIVE_PROJECT', payload: data.project });
      } else {
        console.error('Failed to load project:', data.error);
      }
    } catch (error) {
      console.error('Failed to load project:', error);
    }
  }

  async function createProjectInternal(name: string, description?: string): Promise<Project | null> {
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      const data = await response.json();

      if (data.success) {
        const summary: ProjectSummary = {
          id: data.project.id,
          name: data.project.name,
          description: data.project.description,
          updatedAt: data.project.updatedAt,
          sessionCount: 0,
          fileCount: 0,
        };
        dispatch({ type: 'ADD_PROJECT', payload: summary });
        dispatch({ type: 'SET_ACTIVE_PROJECT', payload: data.project });

        // Set as active
        await fetch(`/api/projects/${data.project.id}`, { method: 'PUT' });

        return data.project;
      }
      return null;
    } catch (error) {
      console.error('Failed to create project:', error);
      return null;
    }
  }

  // ============================================================
  // Context Methods
  // ============================================================

  const createProject = useCallback(async (name: string, description?: string): Promise<Project | null> => {
    return createProjectInternal(name, description);
  }, []);

  const switchProject = useCallback(async (projectId: string): Promise<void> => {
    try {
      await fetch(`/api/projects/${projectId}`, { method: 'PUT' });
      dispatch({ type: 'SET_ACTIVE_PROJECT', payload: null }); // Clear while loading
      await loadActiveProject(projectId);
    } catch (error) {
      console.error('Failed to switch project:', error);
    }
  }, []);

  const updateProject = useCallback(async (
    projectId: string,
    updates: { name?: string; description?: string }
  ): Promise<void> => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json();

      if (data.success) {
        dispatch({
          type: 'UPDATE_PROJECT',
          payload: { id: projectId, updates },
        });
      }
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  }, []);

  const deleteProject = useCallback(async (projectId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (data.success) {
        dispatch({ type: 'REMOVE_PROJECT', payload: projectId });

        // If we deleted the active project, switch to another
        if (state.activeProjectId === projectId && state.projects.length > 1) {
          const nextProject = state.projects.find(p => p.id !== projectId);
          if (nextProject) {
            await switchProject(nextProject.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  }, [state.activeProjectId, state.projects, switchProject]);

  const refreshProjects = useCallback(async (): Promise<void> => {
    await loadProjects();
  }, []);

  const refreshActiveProject = useCallback(async (): Promise<void> => {
    if (state.activeProjectId) {
      await loadActiveProject(state.activeProjectId);
    }
  }, [state.activeProjectId]);

  // Session operations
  const saveSession = useCallback(async (session: StoredSession): Promise<void> => {
    if (!state.activeProjectId) return;

    // Update local state immediately
    dispatch({ type: 'UPDATE_SESSION', payload: session });

    // Debounce API call
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/projects/${state.activeProjectId}/sessions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session }),
        });
      } catch (error) {
        console.error('Failed to save session:', error);
      }
    }, 1000); // 1 second debounce
  }, [state.activeProjectId]);

  const deleteSession = useCallback(async (sessionId: string): Promise<void> => {
    if (!state.activeProjectId) return;

    try {
      const response = await fetch(
        `/api/projects/${state.activeProjectId}/sessions/${sessionId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();

      if (data.success) {
        dispatch({ type: 'REMOVE_SESSION', payload: sessionId });
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  }, [state.activeProjectId]);

  const setActiveSession = useCallback(async (sessionId: string): Promise<void> => {
    if (!state.activeProjectId) return;

    try {
      await fetch(`/api/projects/${state.activeProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeSessionId: sessionId }),
      });
    } catch (error) {
      console.error('Failed to set active session:', error);
    }
  }, [state.activeProjectId]);

  // File operations
  const uploadFile = useCallback(async (
    file: File,
    extractedContent?: string
  ): Promise<ProjectFile | null> => {
    if (!state.activeProjectId) return null;

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (extractedContent) {
        formData.append('content', extractedContent);
      }

      const response = await fetch(
        `/api/projects/${state.activeProjectId}/files`,
        {
          method: 'POST',
          body: formData,
        }
      );
      const data = await response.json();

      if (data.success) {
        dispatch({ type: 'ADD_FILE', payload: data.file });
        return data.file;
      }
      return null;
    } catch (error) {
      console.error('Failed to upload file:', error);
      return null;
    }
  }, [state.activeProjectId]);

  const deleteFile = useCallback(async (fileId: string): Promise<void> => {
    if (!state.activeProjectId) return;

    try {
      const response = await fetch(
        `/api/projects/${state.activeProjectId}/files/${fileId}`,
        { method: 'DELETE' }
      );
      const data = await response.json();

      if (data.success) {
        dispatch({ type: 'REMOVE_FILE', payload: fileId });
      }
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }, [state.activeProjectId]);

  const getFileUrl = useCallback((fileId: string): string => {
    if (!state.activeProjectId) return '';
    return `/api/projects/${state.activeProjectId}/files/${fileId}`;
  }, [state.activeProjectId]);

  // ============================================================
  // Context Value
  // ============================================================

  const value: ProjectContextValue = {
    state,
    createProject,
    switchProject,
    updateProject,
    deleteProject,
    refreshProjects,
    refreshActiveProject,
    saveSession,
    deleteSession,
    setActiveSession,
    uploadFile,
    deleteFile,
    getFileUrl,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
}

// ============================================================
// Hook
// ============================================================

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
