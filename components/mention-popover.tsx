"use client";

import React, { useEffect, useRef } from "react";
import { FileText } from "lucide-react";
import type { RegistryDocument } from "@/lib/document-registry";

interface MentionPopoverProps {
  /** Filtered list of documents to display */
  documents: RegistryDocument[];
  /** Currently selected index */
  selectedIndex: number;
  /** Callback when a document is selected */
  onSelect: (doc: RegistryDocument) => void;
  /** Callback to close the popover */
  onClose: () => void;
  /** Position relative to textarea */
  position: { top: number; left: number };
}

export function MentionPopover({
  documents,
  selectedIndex,
  onSelect,
  onClose,
  position,
}: MentionPopoverProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  // Close on escape (backup, main handler is in page.tsx)
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  if (documents.length === 0) {
    return (
      <div
        className="absolute z-50 bg-background border border-border rounded-lg shadow-lg p-3 min-w-[250px] max-w-[400px]"
        style={{ top: position.top, left: position.left }}
      >
        <p className="text-sm text-muted-foreground">
          No documents found. Create a document in Loom first.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      className="absolute z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden min-w-[280px] max-w-[400px] max-h-[300px] overflow-y-auto"
      style={{ top: position.top, left: position.left }}
      role="listbox"
      aria-label="Select a document"
    >
      <div className="p-2 border-b border-border/50">
        <p className="text-xs text-muted-foreground font-medium">
          Select a document to include as context
        </p>
      </div>
      <div className="py-1">
        {documents.map((doc, index) => (
          <button
            key={doc.id}
            ref={index === selectedIndex ? selectedRef : null}
            className={`w-full text-left px-3 py-2 flex items-start gap-3 transition-colors ${
              index === selectedIndex
                ? "bg-primary/10 text-primary"
                : "hover:bg-muted/50"
            }`}
            onClick={() => onSelect(doc)}
            role="option"
            aria-selected={index === selectedIndex}
          >
            <FileText className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm truncate">{doc.title}</p>
              <p className="text-xs text-muted-foreground truncate">
                {doc.preview}
              </p>
            </div>
          </button>
        ))}
      </div>
      <div className="p-2 border-t border-border/50 bg-muted/30">
        <p className="text-xs text-muted-foreground">
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">↑↓</kbd> to
          navigate,{" "}
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Enter</kbd>{" "}
          to select,{" "}
          <kbd className="px-1 py-0.5 rounded bg-muted text-[10px]">Esc</kbd> to
          cancel
        </p>
      </div>
    </div>
  );
}

/**
 * Displays mentioned documents as chips above the input
 */
interface MentionChipsProps {
  mentions: Array<{ id: string; title: string }>;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export function MentionChips({ mentions, onRemove, disabled }: MentionChipsProps) {
  if (mentions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {mentions.map((mention) => (
        <div
          key={mention.id}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-sm"
        >
          <FileText className="h-3 w-3 text-primary" />
          <span className="text-primary font-medium max-w-[150px] truncate">
            {mention.title}
          </span>
          {!disabled && (
            <button
              onClick={() => onRemove(mention.id)}
              className="ml-1 text-primary/60 hover:text-primary transition-colors"
              aria-label={`Remove ${mention.title}`}
            >
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
