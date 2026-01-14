// Project system type definitions

import type { LoomDocument, ModifiedBy } from "./loom-types";

// ============================================================
// File Types
// ============================================================

/**
 * A file stored within a project
 */
export interface ProjectFile {
  id: string;
  name: string;
  type: string; // MIME type
  size: number;
  path: string; // Relative path within project: "files/notes/daily/2025-01-13.md"
  uploadedAt: number; // Unix timestamp
  content?: string; // Extracted text for PDFs/text files (for context)
  isFolder?: boolean; // True if this is a folder, not a file
  parentPath?: string; // Parent folder path, empty string for root
}

export interface ProjectFolder {
  id: string;
  name: string;
  path: string; // Full path from project root: "notes/daily"
  parentPath: string; // Parent folder path: "notes" or "" for root
  createdAt: number;
  isExpanded?: boolean; // UI state for tree view
}

export interface FileTreeNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileTreeNode[];
  file?: ProjectFile;
  folder?: ProjectFolder;
  isExpanded?: boolean;
}

/**
 * Lightweight reference to a file (used in messages)
 */
export interface ProjectFileReference {
  fileId: string;
  name: string;
  type: string;
  size: number;
}

// ============================================================
// Message Types
// ============================================================

/**
 * A message stored in a session (JSON-serializable version)
 */
export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ProjectFileReference[];
  timestamp: number; // Unix timestamp (Date not JSON-serializable)
}

// ============================================================
// Session Types
// ============================================================

/**
 * Serializable version of LoomDocument for storage
 */
export interface StoredLoomDocument {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  lastModifiedBy?: ModifiedBy; // Optional for backward compatibility
}

/**
 * A chat session stored within a project (JSON-serializable)
 */
export interface StoredSession {
  id: string;
  title: string;
  messages: StoredMessage[];
  timestamp: number; // Unix timestamp
  loomDocument?: StoredLoomDocument;
}

// ============================================================
// Project Types
// ============================================================

/**
 * Full project with all data
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
  sessions: StoredSession[];
  files: ProjectFile[];
  folders: ProjectFolder[]; // Folder structure
  activeSessionId?: string; // Last active session in this project
  expandedFolders?: string[]; // Paths of expanded folders in UI
}

/**
 * Lightweight project summary for listing
 */
export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  updatedAt: number;
  sessionCount: number;
  fileCount: number;
}

/**
 * Index file structure for listing all projects
 */
export interface ProjectsIndex {
  projects: {
    id: string;
    name: string;
    updatedAt: number;
  }[];
  activeProjectId?: string;
}

// ============================================================
// Conversion Helpers
// ============================================================

/**
 * Convert a LoomDocument (with Date objects) to StoredLoomDocument (with timestamps)
 */
export function loomDocumentToStored(doc: LoomDocument): StoredLoomDocument {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    createdAt: doc.createdAt.getTime(),
    updatedAt: doc.updatedAt.getTime(),
    lastModifiedBy: doc.lastModifiedBy,
  };
}

/**
 * Convert a StoredLoomDocument (with timestamps) to LoomDocument (with Date objects)
 */
export function storedToLoomDocument(doc: StoredLoomDocument): LoomDocument {
  return {
    id: doc.id,
    title: doc.title,
    content: doc.content,
    createdAt: new Date(doc.createdAt),
    updatedAt: new Date(doc.updatedAt),
    lastModifiedBy: doc.lastModifiedBy || "user", // Default to user for old documents
  };
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ProjectListResponse {
  projects: ProjectSummary[];
  activeProjectId?: string;
}

export interface ProjectResponse {
  project: Project;
}

export interface SessionResponse {
  session: StoredSession;
}

export interface FileResponse {
  file: ProjectFile;
}

export interface FilesListResponse {
  files: ProjectFile[];
  folders: ProjectFolder[];
  tree: FileTreeNode[];
}
