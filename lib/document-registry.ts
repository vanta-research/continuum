/**
 * Document Registry
 *
 * Manages a registry of Loom documents in localStorage for @mention functionality.
 * This allows users to reference documents across chat sessions without requiring
 * Loom mode to be active.
 */

import type { LoomDocument } from "./loom-types";

const REGISTRY_STORAGE_KEY = "loom-document-registry";
const MAX_DOCUMENTS = 20;
const MAX_CONTENT_SIZE = 50000; // 50KB per document max

export interface RegistryDocument {
  id: string;
  title: string;
  content: string;
  updatedAt: number;
  preview: string; // First 100 chars for display in popover
}

export interface DocumentRegistry {
  documents: RegistryDocument[];
  version: number; // For future migrations
}

/**
 * Get the document registry from localStorage
 */
export function getDocumentRegistry(): DocumentRegistry {
  if (typeof window === "undefined") {
    return { documents: [], version: 1 };
  }

  try {
    const stored = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (stored) {
      const registry = JSON.parse(stored) as DocumentRegistry;
      return registry;
    }
  } catch (e) {
    console.error("[DocumentRegistry] Failed to load registry:", e);
  }

  return { documents: [], version: 1 };
}

/**
 * Save the registry to localStorage
 */
function saveRegistry(registry: DocumentRegistry): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  } catch (e) {
    console.error("[DocumentRegistry] Failed to save registry:", e);
    // If localStorage is full, try removing oldest documents
    if (e instanceof DOMException && e.name === "QuotaExceededError") {
      const trimmed = {
        ...registry,
        documents: registry.documents.slice(-Math.floor(MAX_DOCUMENTS / 2)),
      };
      try {
        localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(trimmed));
      } catch {
        console.error("[DocumentRegistry] Failed to save even after trimming");
      }
    }
  }
}

/**
 * Generate a preview from document content
 */
function generatePreview(content: string): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 100) return cleaned;
  return cleaned.slice(0, 97) + "...";
}

/**
 * Add or update a document in the registry
 */
export function addOrUpdateDocument(doc: LoomDocument): void {
  const registry = getDocumentRegistry();

  // Truncate content if too large
  let content = doc.content;
  if (content.length > MAX_CONTENT_SIZE) {
    content = content.slice(0, MAX_CONTENT_SIZE) + "\n\n[Content truncated...]";
  }

  const registryDoc: RegistryDocument = {
    id: doc.id,
    title: doc.title || "Untitled Document",
    content,
    updatedAt: doc.updatedAt.getTime(),
    preview: generatePreview(doc.content),
  };

  // Find existing document
  const existingIndex = registry.documents.findIndex((d) => d.id === doc.id);

  if (existingIndex !== -1) {
    // Update existing
    registry.documents[existingIndex] = registryDoc;
  } else {
    // Add new document
    registry.documents.push(registryDoc);

    // Remove oldest if over limit (FIFO)
    if (registry.documents.length > MAX_DOCUMENTS) {
      registry.documents = registry.documents.slice(-MAX_DOCUMENTS);
    }
  }

  // Sort by updatedAt (most recent first)
  registry.documents.sort((a, b) => b.updatedAt - a.updatedAt);

  saveRegistry(registry);
}

/**
 * Remove a document from the registry
 */
export function removeDocument(id: string): void {
  const registry = getDocumentRegistry();
  registry.documents = registry.documents.filter((d) => d.id !== id);
  saveRegistry(registry);
}

/**
 * Search documents by title (case-insensitive)
 */
export function searchDocuments(query: string): RegistryDocument[] {
  const registry = getDocumentRegistry();

  if (!query.trim()) {
    // Return all documents if no query
    return registry.documents;
  }

  const lowerQuery = query.toLowerCase();
  return registry.documents.filter(
    (doc) =>
      doc.title.toLowerCase().includes(lowerQuery) ||
      doc.preview.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Get a specific document by ID
 */
export function getDocument(id: string): RegistryDocument | null {
  const registry = getDocumentRegistry();
  return registry.documents.find((d) => d.id === id) || null;
}

/**
 * Get all documents (sorted by most recent)
 */
export function getAllDocuments(): RegistryDocument[] {
  const registry = getDocumentRegistry();
  return registry.documents;
}

/**
 * Clear all documents from registry
 */
export function clearRegistry(): void {
  saveRegistry({ documents: [], version: 1 });
}
