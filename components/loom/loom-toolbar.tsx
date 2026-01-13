"use client";

import React, { useState, useCallback } from "react";
import {
  FileText,
  X,
  Check,
  Edit2,
  Eye,
  Pencil,
  Zap,
  GitBranch,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useLoom } from "./loom-provider";
import { cn } from "@/lib/utils";

interface LoomToolbarProps {
  onClose?: () => void;
  className?: string;
  viewMode: "edit" | "preview";
  onViewModeChange: (mode: "edit" | "preview") => void;
}

// Format a date as relative time (e.g., "just now", "2 min ago", "1 hour ago")
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 10) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function LoomToolbar({
  onClose,
  className,
  viewMode,
  onViewModeChange,
}: LoomToolbarProps) {
  const { state, updateDocumentTitle, setAutoAcceptEdits } = useLoom();
  const { document, pendingEdits, autoAcceptEdits } = state;

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
        <FileText className="h-4 w-4 text-purple-400" />

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

        {/* Pending edits badge */}
        {pendingEdits.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/20 text-amber-400 animate-pulse">
            <GitBranch className="h-3 w-3" />
            <span className="text-xs font-medium">
              {pendingEdits.length} pending
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {document && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{document.content.split("\n").length} lines</span>
            <span className="text-border">•</span>
            <span className="flex items-center gap-1.5">
              {document.lastModifiedBy === "ai" ? (
                <Image
                  src="/images/robot.png"
                  alt="AI"
                  width={14}
                  height={14}
                  className="opacity-80"
                />
              ) : (
                <Image
                  src="/images/user.png"
                  alt="User"
                  width={14}
                  height={14}
                  className="opacity-80"
                />
              )}
              <span>
                {document.lastModifiedBy === "ai" ? "AI" : "You"}
                {" · "}
                {formatRelativeTime(document.updatedAt)}
              </span>
            </span>
          </div>
        )}

        {/* Auto-accept toggle */}
        <div
          className="flex items-center gap-2 px-2 py-1 rounded-md bg-background/50 border border-border/30"
          title={
            autoAcceptEdits
              ? "Model edits are applied automatically"
              : "Model edits require your approval"
          }
        >
          <Zap
            className={cn(
              "h-3.5 w-3.5 transition-colors",
              autoAcceptEdits ? "text-amber-400" : "text-muted-foreground",
            )}
          />
          <span className="text-xs text-muted-foreground">Auto</span>
          <Switch
            checked={autoAcceptEdits}
            onCheckedChange={setAutoAcceptEdits}
            className="h-4 w-7 data-[state=checked]:bg-amber-500"
          />
        </div>

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
