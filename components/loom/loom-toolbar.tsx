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
  Upload,
  FileUp,
  FileType,
  FolderOpen,
  FolderX,
  Undo2,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useLoom } from "./loom-provider";
import { cn } from "@/lib/utils";
import {
  exportAsMarkdown,
  exportAsPlainText,
  exportAsPdf,
  selectExportDirectory,
  getSavedDirectoryHandle,
  clearSavedDirectory,
  isFileSystemAccessSupported,
  type PdfExportOptions,
} from "@/lib/export-utils";

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
  const { state, updateDocumentTitle, setAutoAcceptEdits, undoLastEdit } =
    useLoom();
  const { document, pendingEdits, autoAcceptEdits, editHistory } = state;

  // Check if there's an edit to undo (only accepted edits can be undone)
  const canUndo = editHistory.some((entry) => entry.action === "accepted");

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

  // Track export directory state
  const [hasExportDir, setHasExportDir] = useState(false);
  const [exportDirName, setExportDirName] = useState<string | null>(null);

  // Check for existing directory handle on mount
  React.useEffect(() => {
    const handle = getSavedDirectoryHandle();
    if (handle) {
      setHasExportDir(true);
      setExportDirName(handle.name);
    }
  }, []);

  const handleSelectExportDir = useCallback(async () => {
    const handle = await selectExportDirectory();
    if (handle) {
      setHasExportDir(true);
      setExportDirName(handle.name);
    }
  }, []);

  const handleClearExportDir = useCallback(() => {
    clearSavedDirectory();
    setHasExportDir(false);
    setExportDirName(null);
  }, []);

  const handleExportMarkdown = useCallback(async () => {
    if (document) {
      await exportAsMarkdown(document.content, document.title);
    }
  }, [document]);

  const handleExportPlainText = useCallback(async () => {
    if (document) {
      await exportAsPlainText(document.content, document.title);
    }
  }, [document]);

  // PDF export options state
  const [showPdfDialog, setShowPdfDialog] = useState(false);
  const [pdfOptions, setPdfOptions] = useState<PdfExportOptions>({
    showPageNumbers: true,
    showDate: true,
  });

  const handleExportPdf = useCallback(async () => {
    if (document) {
      try {
        await exportAsPdf(document.content, document.title, pdfOptions);
        setShowPdfDialog(false);
      } catch (error) {
        console.error("Failed to export PDF:", error);
        alert(error instanceof Error ? error.message : "Failed to export PDF");
      }
    }
  }, [document, pdfOptions]);

  const openPdfDialog = useCallback(() => {
    setShowPdfDialog(true);
  }, []);

  return (
    <>
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

          {/* Export dropdown */}
          {document && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  <span className="text-xs">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {hasExportDir && (
                  <>
                    <div className="px-2 py-1.5 text-xs text-muted-foreground">
                      Saving to:{" "}
                      <span className="font-medium text-foreground">
                        {exportDirName}
                      </span>
                    </div>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleExportMarkdown}>
                  <FileUp className="h-4 w-4 mr-2" />
                  <span>Markdown (.md)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportPlainText}>
                  <FileType className="h-4 w-4 mr-2" />
                  <span>Plain Text (.txt)</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={openPdfDialog}>
                  <FileText className="h-4 w-4 mr-2" />
                  <span>PDF (Print)...</span>
                </DropdownMenuItem>
                {isFileSystemAccessSupported() && (
                  <>
                    <DropdownMenuSeparator />
                    {hasExportDir ? (
                      <DropdownMenuItem onClick={handleClearExportDir}>
                        <FolderX className="h-4 w-4 mr-2" />
                        <span>Clear Export Folder</span>
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={handleSelectExportDir}>
                        <FolderOpen className="h-4 w-4 mr-2" />
                        <span>Set Export Folder...</span>
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Undo button */}
          {canUndo && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={undoLastEdit}
              title="Undo last accepted edit"
            >
              <Undo2 className="h-3.5 w-3.5" />
              <span className="text-xs">Undo</span>
            </Button>
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

      {/* PDF Export Options Dialog */}
      <Dialog open={showPdfDialog} onOpenChange={setShowPdfDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>PDF Export Options</DialogTitle>
            <DialogDescription>
              Configure what to include in your exported PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Tip about browser headers */}
            <div className="rounded-md bg-muted/50 border border-border/50 px-3 py-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Tip:</span> To
                hide the browser&apos;s URL and title in the PDF, uncheck
                &quot;Headers and footers&quot; in the print dialog (under More
                settings).
              </p>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Page Numbers</label>
                <p className="text-xs text-muted-foreground">
                  Add page numbers to footer
                </p>
              </div>
              <Switch
                checked={pdfOptions.showPageNumbers}
                onCheckedChange={(checked) =>
                  setPdfOptions((prev) => ({
                    ...prev,
                    showPageNumbers: checked,
                  }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Date</label>
                <p className="text-xs text-muted-foreground">
                  Add export date to footer
                </p>
              </div>
              <Switch
                checked={pdfOptions.showDate}
                onCheckedChange={(checked) =>
                  setPdfOptions((prev) => ({ ...prev, showDate: checked }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPdfDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleExportPdf}>Export PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
