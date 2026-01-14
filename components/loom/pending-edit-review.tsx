"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  Component,
  ErrorInfo,
  ReactNode,
} from "react";
import {
  Check,
  X,
  Edit3,
  ChevronDown,
  ChevronUp,
  Clock,
  GitBranch,
  Plus,
  Minus,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useLoom } from "./loom-provider";
import type { PendingEdit, DiffLine } from "@/lib/loom-types";
import {
  computeDiff,
  getDiffHunks,
  formatHunkHeader,
  type DiffHunk,
} from "@/lib/diff-utils";

// Error boundary to catch rendering errors in the diff view
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class DiffErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("DiffErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="p-4 text-sm text-amber-500 bg-amber-500/10 rounded-md">
            <p className="font-medium">Unable to display diff</p>
            <p className="text-xs text-muted-foreground mt-1">
              The content is too large or complex to render. You can still
              accept or reject the edit.
            </p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

interface PendingEditReviewProps {
  className?: string;
}

export function PendingEditReview({ className }: PendingEditReviewProps) {
  const {
    state,
    acceptPendingEdit,
    rejectPendingEdit,
    modifyPendingEdit,
    clearPendingEdits,
  } = useLoom();

  const { pendingEdits } = state;

  // Debug logging
  useEffect(() => {
    console.log(
      "[PendingEditReview] Rendering with",
      pendingEdits.length,
      "pending edits",
    );
    if (pendingEdits.length > 0) {
      console.log("[PendingEditReview] First pending edit:", {
        id: pendingEdits[0].id,
        targetLine: pendingEdits[0].targetLine,
        originalContentLength: pendingEdits[0].originalContent?.length,
        newContentLength: pendingEdits[0].newContent?.length,
      });
    }
  }, [pendingEdits]);

  if (pendingEdits.length === 0) {
    console.log("[PendingEditReview] No pending edits, returning null");
    return null;
  }

  console.log("[PendingEditReview] Rendering edit review panel");

  return (
    <div
      className={cn(
        "border-t border-border/50 bg-background/80 backdrop-blur-sm",
        className,
      )}
    >
      <div className="px-4 py-2 flex items-center justify-between border-b border-border/30">
        <div className="flex items-center gap-2">
          <GitBranch className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-medium">
            {pendingEdits.length} Pending Edit
            {pendingEdits.length !== 1 ? "s" : ""}
          </span>
        </div>
        {pendingEdits.length > 1 && (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                pendingEdits.forEach((edit) => acceptPendingEdit(edit.id));
              }}
              className="h-7 text-xs text-green-500 hover:text-green-400 hover:bg-green-500/10"
            >
              <Check className="h-3 w-3 mr-1" />
              Accept All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearPendingEdits}
              className="h-7 text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10"
            >
              <X className="h-3 w-3 mr-1" />
              Reject All
            </Button>
          </div>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {pendingEdits.map((edit) => (
          <PendingEditCard
            key={edit.id}
            edit={edit}
            onAccept={() => acceptPendingEdit(edit.id)}
            onReject={() => rejectPendingEdit(edit.id)}
            onModify={(newContent) => modifyPendingEdit(edit.id, newContent)}
          />
        ))}
      </div>
    </div>
  );
}

interface PendingEditCardProps {
  edit: PendingEdit;
  onAccept: () => void;
  onReject: () => void;
  onModify: (newContent: string) => void;
}

function PendingEditCard({
  edit,
  onAccept,
  onReject,
  onModify,
}: PendingEditCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(edit.newContent);

  // Safely compute diff and hunks with error handling
  const { diff, hunks } = useMemo(() => {
    try {
      const computedDiff = computeDiff(edit.originalContent, edit.newContent);
      const computedHunks = getDiffHunks(computedDiff, 3);
      return { diff: computedDiff, hunks: computedHunks };
    } catch (error) {
      console.error("Error computing diff:", error);
      // Return a fallback diff showing the new content as additions
      const newLines = edit.newContent.split("\n").slice(0, 20);
      const fallbackDiff = {
        lines: newLines.map((content, idx) => ({
          type: "added" as const,
          lineNumber: { old: null, new: idx + 1 },
          content,
        })),
        additions: edit.newContent.split("\n").length,
        deletions: edit.originalContent.split("\n").length,
        hasChanges: true,
      };
      return {
        diff: fallbackDiff,
        hunks: [
          {
            startLineOld: 1,
            startLineNew: 1,
            oldLineCount: edit.originalContent.split("\n").length,
            newLineCount: newLines.length,
            lines: fallbackDiff.lines,
          },
        ],
      };
    }
  }, [edit.originalContent, edit.newContent]);

  // Check if this is a large edit
  const isLargeEdit = edit.newContent.length > 5000 || diff.lines.length > 100;

  const handleSaveEdit = () => {
    onModify(editedContent);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedContent(edit.newContent);
    setIsEditing(false);
  };

  return (
    <div className="border-b border-border/30 last:border-b-0">
      {/* Header */}
      <div
        className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <button className="text-muted-foreground">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {hunks.length} change{hunks.length !== 1 ? "s" : ""}
            </span>
            <span className="text-muted-foreground">•</span>
            <DiffStats diff={diff} />
            {edit.status === "modified" && (
              <>
                <span className="text-muted-foreground">•</span>
                <span className="text-blue-400 text-xs">Modified</span>
              </>
            )}
          </div>
        </div>

        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-400"
            title="Edit before accepting"
          >
            <Edit3 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReject}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
            title="Reject this change"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onAccept}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-green-400"
            title="Accept this change"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-4 pb-3">
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="font-mono text-xs bg-background/50 min-h-[100px]"
                placeholder="Edit the proposed content..."
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-7 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveEdit}
                  className="h-7 text-xs"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          ) : (
            <DiffErrorBoundary>
              <div
                className={
                  isLargeEdit ? "max-h-64 overflow-y-auto" : "max-h-96"
                }
              >
                <HunkDiffView hunks={hunks} />
              </div>
            </DiffErrorBoundary>
          )}

          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>
              {edit.timestamp.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

interface DiffStatsProps {
  diff: ReturnType<typeof computeDiff>;
}

function DiffStats({ diff }: DiffStatsProps) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {diff.additions > 0 && (
        <span className="flex items-center gap-0.5 text-green-500">
          <Plus className="h-3 w-3" />
          {diff.additions}
        </span>
      )}
      {diff.deletions > 0 && (
        <span className="flex items-center gap-0.5 text-red-500">
          <Minus className="h-3 w-3" />
          {diff.deletions}
        </span>
      )}
      {!diff.hasChanges && (
        <span className="text-muted-foreground">No changes</span>
      )}
    </div>
  );
}

interface HunkDiffViewProps {
  hunks: DiffHunk[];
}

function HunkDiffView({ hunks }: HunkDiffViewProps) {
  if (hunks.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-2">
        No changes to display
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/50 overflow-hidden bg-background/30">
      {hunks.map((hunk, hunkIdx) => (
        <div key={hunkIdx}>
          {/* Hunk header */}
          <div className="px-3 py-1.5 bg-primary/10 border-b border-border/30 text-xs font-mono text-primary">
            {formatHunkHeader(hunk)}
          </div>

          {/* Hunk separator between multiple hunks */}
          {hunkIdx > 0 && (
            <div className="px-3 py-1 bg-muted/20 border-y border-border/30 text-xs text-muted-foreground flex items-center gap-2">
              <MoreHorizontal className="h-3 w-3" />
              <span>...</span>
            </div>
          )}

          {/* Hunk lines */}
          <table className="w-full text-xs font-mono table-fixed">
            <colgroup>
              <col className="w-10" />
              <col className="w-10" />
              <col className="w-4" />
              <col />
            </colgroup>
            <tbody>
              {hunk.lines.map((line, lineIdx) => (
                <DiffLineRow key={lineIdx} line={line} />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

interface DiffLineRowProps {
  line: DiffLine;
}

function DiffLineRow({ line }: DiffLineRowProps) {
  const bgColor =
    line.type === "added"
      ? "bg-green-500/10"
      : line.type === "removed"
        ? "bg-red-500/10"
        : "";

  const textColor =
    line.type === "added"
      ? "text-green-400"
      : line.type === "removed"
        ? "text-red-400"
        : "text-muted-foreground";

  const prefix =
    line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";

  return (
    <tr className={cn("border-b border-border/20 last:border-b-0", bgColor)}>
      {/* Old line number */}
      <td className="px-2 py-0.5 text-right text-muted-foreground/50 select-none border-r border-border/20 align-top">
        {line.lineNumber.old ?? ""}
      </td>
      {/* New line number */}
      <td className="px-2 py-0.5 text-right text-muted-foreground/50 select-none border-r border-border/20 align-top">
        {line.lineNumber.new ?? ""}
      </td>
      {/* Prefix */}
      <td className={cn("px-1 py-0.5 select-none align-top", textColor)}>
        {prefix}
      </td>
      {/* Content */}
      <td
        className={cn("px-2 py-0.5 whitespace-pre-wrap break-words", textColor)}
      >
        {line.content || " "}
      </td>
    </tr>
  );
}

// Compact inline diff view for the toolbar
interface InlineDiffBadgeProps {
  pendingCount: number;
  onClick: () => void;
}

export function InlineDiffBadge({
  pendingCount,
  onClick,
}: InlineDiffBadgeProps) {
  if (pendingCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
        "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors",
        "animate-pulse",
      )}
    >
      <GitBranch className="h-3 w-3" />
      <span>
        {pendingCount} pending edit{pendingCount !== 1 ? "s" : ""}
      </span>
    </button>
  );
}
