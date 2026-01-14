"use client";

import React, { useState, useCallback } from "react";
import { FileText, X, Check, Edit2, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCanvas } from "./canvas-provider";
import { cn } from "@/lib/utils";

interface CanvasToolbarProps {
  onClose?: () => void;
  className?: string;
  viewMode: "edit" | "preview";
  onViewModeChange: (mode: "edit" | "preview") => void;
}

export function CanvasToolbar({
  onClose,
  className,
  viewMode,
  onViewModeChange,
}: CanvasToolbarProps) {
  const { state, updateDocumentTitle } = useCanvas();
  const { document } = state;

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(
    document?.title || "Untitled Document",
  );

  const handleTitleSubmit = useCallback(() => {
    if (titleInput.trim()) {
      updateDocumentTitle(titleInput.trim());
    }
    setIsEditingTitle(false);
  }, [titleInput, updateDocumentTitle]);

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        handleTitleSubmit();
      } else if (e.key === "Escape") {
        setTitleInput(document?.title || "Untitled Document");
        setIsEditingTitle(false);
      }
    },
    [handleTitleSubmit, document?.title],
  );

  const startEditingTitle = useCallback(() => {
    setTitleInput(document?.title || "Untitled Document");
    setIsEditingTitle(true);
  }, [document?.title]);

  return (
    <div
      className={cn(
        "flex h-12 items-center justify-between border-b border-border/50 px-4",
        "bg-background/50 backdrop-blur-sm",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <FileText className="h-4 w-4 text-primary" />

        {isEditingTitle ? (
          <div className="flex items-center gap-1">
            <Input
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleSubmit}
              className="h-7 w-48 text-sm"
              autoFocus
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleTitleSubmit}
            >
              <Check className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <button
            onClick={startEditingTitle}
            className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors group"
          >
            <span>{document?.title || "Untitled Document"}</span>
            <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2">
        {document && (
          <span className="text-xs text-muted-foreground">
            {document.content.split("\n").length} lines
          </span>
        )}

        {/* Edit/Preview Toggle */}
        <div className="flex items-center rounded-md border border-border/50 bg-background/50 p-0.5">
          <Button
            variant={viewMode === "edit" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 gap-1"
            onClick={() => onViewModeChange("edit")}
          >
            <Pencil className="h-3 w-3" />
            <span className="text-xs">Edit</span>
          </Button>
          <Button
            variant={viewMode === "preview" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 px-2 gap-1"
            onClick={() => onViewModeChange("preview")}
          >
            <Eye className="h-3 w-3" />
            <span className="text-xs">Preview</span>
          </Button>
        </div>

        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
