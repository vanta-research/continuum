"use client";

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
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
  GripHorizontal,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useLoom } from "./loom-provider";
import type { PendingEdit, DiffLine, LineDecision } from "@/lib/loom-types";
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

// Default and constraint values for panel height (in pixels)
const DEFAULT_PANEL_HEIGHT = 320; // 20rem / max-h-80
const MIN_PANEL_HEIGHT = 120;
const MAX_PANEL_HEIGHT = 600;

export function PendingEditReview({ className }: PendingEditReviewProps) {
  const {
    state,
    acceptPendingEdit,
    rejectPendingEdit,
    modifyPendingEdit,
    clearPendingEdits,
  } = useLoom();

  const { pendingEdits } = state;

  // Panel height state for drag resizing
  const [panelHeight, setPanelHeight] = useState(DEFAULT_PANEL_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  // Handle mouse down on the resize handle
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      dragStartY.current = e.clientY;
      dragStartHeight.current = panelHeight;
    },
    [panelHeight],
  );

  // Handle mouse move during drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Dragging up (negative delta) should increase height
      // Dragging down (positive delta) should decrease height
      const delta = dragStartY.current - e.clientY;
      const newHeight = Math.min(
        MAX_PANEL_HEIGHT,
        Math.max(MIN_PANEL_HEIGHT, dragStartHeight.current + delta),
      );
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging]);

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
        "border-t border-border/50 bg-background/80 backdrop-blur-sm flex flex-col",
        isDragging && "select-none",
        className,
      )}
    >
      {/* Resize handle */}
      <div
        className={cn(
          "h-2 flex items-center justify-center cursor-ns-resize group transition-colors",
          "hover:bg-primary/10",
          isDragging && "bg-primary/20",
        )}
        onMouseDown={handleMouseDown}
      >
        <GripHorizontal
          className={cn(
            "h-4 w-4 text-muted-foreground/50 transition-colors",
            "group-hover:text-primary/70",
            isDragging && "text-primary",
          )}
        />
      </div>

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

      <div
        className="overflow-y-auto flex flex-col"
        style={{ height: `${panelHeight}px` }}
      >
        {pendingEdits.map((edit) => (
          <PendingEditCard
            key={edit.id}
            edit={edit}
            onAccept={() => acceptPendingEdit(edit.id)}
            onReject={() => rejectPendingEdit(edit.id)}
            onModify={(newContent) => modifyPendingEdit(edit.id, newContent)}
            fillSpace={pendingEdits.length === 1}
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
  fillSpace?: boolean;
}

function PendingEditCard({
  edit,
  onAccept,
  onReject,
  onModify,
  fillSpace = false,
}: PendingEditCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(edit.newContent);

  // Line-level decision tracking: Map<globalLineIndex, {decision, editedContent?}>
  const [lineDecisions, setLineDecisions] = useState<
    Map<number, { decision: LineDecision; editedContent?: string }>
  >(new Map());

  // Track if we're in line-by-line mode (enabled once user makes first line decision)
  const [lineByLineMode, setLineByLineMode] = useState(false);

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

  // Flatten all diff lines for building final content
  const allDiffLines = useMemo((): DiffLine[] => {
    return hunks.flatMap((hunk) => hunk.lines as DiffLine[]);
  }, [hunks]);

  // Check if this is a large edit
  const isLargeEdit = edit.newContent.length > 5000 || diff.lines.length > 100;

  // Line-level action handlers
  const handleAcceptLine = useCallback((lineIndex: number) => {
    setLineByLineMode(true);
    setLineDecisions((prev) => {
      const next = new Map(prev);
      next.set(lineIndex, { decision: "accepted" });
      return next;
    });
  }, []);

  const handleRejectLine = useCallback((lineIndex: number) => {
    setLineByLineMode(true);
    setLineDecisions((prev) => {
      const next = new Map(prev);
      next.set(lineIndex, { decision: "rejected" });
      return next;
    });
  }, []);

  const handleEditLine = useCallback(
    (lineIndex: number, newContent: string) => {
      setLineByLineMode(true);
      setLineDecisions((prev) => {
        const next = new Map(prev);
        next.set(lineIndex, { decision: "edited", editedContent: newContent });
        return next;
      });
    },
    [],
  );

  const handleResetLine = useCallback((lineIndex: number) => {
    setLineDecisions((prev) => {
      const next = new Map(prev);
      next.delete(lineIndex);
      // If no more decisions, exit line-by-line mode
      if (next.size === 0) {
        setLineByLineMode(false);
      }
      return next;
    });
  }, []);

  // Build final content from line decisions
  const buildFinalContent = useCallback((): string => {
    const resultLines: string[] = [];

    allDiffLines.forEach((line, index) => {
      const decision = lineDecisions.get(index);

      if (line.type === "unchanged") {
        // Unchanged lines always included
        resultLines.push(line.content);
      } else if (line.type === "added") {
        // Added line: include if accepted/edited/pending, exclude if rejected
        if (decision?.decision === "rejected") {
          // Don't include this added line
        } else if (decision?.decision === "edited") {
          resultLines.push(decision.editedContent || line.content);
        } else {
          // Accepted or pending - include the line
          resultLines.push(line.content);
        }
      } else if (line.type === "removed") {
        // Removed line: exclude if accepted (confirm removal), include if rejected (keep original)
        if (decision?.decision === "rejected") {
          // User rejected the removal, keep the original line
          resultLines.push(line.content);
        } else if (decision?.decision === "edited") {
          // User edited the removal - use the edited content instead
          resultLines.push(decision.editedContent || "");
        }
        // If accepted or pending, the line is removed (not added to result)
      }
    });

    return resultLines.join("\n");
  }, [allDiffLines, lineDecisions]);

  // Handle accepting with line decisions
  const handleAcceptWithLineDecisions = useCallback(() => {
    if (lineByLineMode && lineDecisions.size > 0) {
      // Build final content from line decisions
      const finalContent = buildFinalContent();
      onModify(finalContent);
      // Then accept
      setTimeout(() => onAccept(), 0);
    } else {
      // No line decisions made, accept as-is
      onAccept();
    }
  }, [lineByLineMode, lineDecisions, buildFinalContent, onModify, onAccept]);

  const handleSaveEdit = () => {
    onModify(editedContent);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedContent(edit.newContent);
    setIsEditing(false);
  };

  // Count decisions for UI feedback
  const decisionCounts = useMemo(() => {
    let accepted = 0,
      rejected = 0,
      edited = 0,
      pending = 0;
    const totalActionable = allDiffLines.filter(
      (l) => l.type === "added" || l.type === "removed",
    ).length;

    lineDecisions.forEach(({ decision }) => {
      if (decision === "accepted") accepted++;
      else if (decision === "rejected") rejected++;
      else if (decision === "edited") edited++;
    });

    pending = totalActionable - accepted - rejected - edited;

    return { accepted, rejected, edited, pending, total: totalActionable };
  }, [lineDecisions, allDiffLines]);

  return (
    <div
      className={cn(
        "border-b border-border/30 last:border-b-0",
        fillSpace && "flex-1 flex flex-col min-h-0",
      )}
    >
      {/* Header */}
      <div
        className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors flex-shrink-0"
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
            onClick={handleAcceptWithLineDecisions}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-green-400"
            title={
              lineByLineMode ? "Accept with line changes" : "Accept this change"
            }
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Line-by-line mode indicator */}
      {lineByLineMode && lineDecisions.size > 0 && (
        <div className="px-4 py-1.5 bg-primary/5 border-b border-border/30 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Line-by-line mode:{" "}
            <span className="text-green-500">
              {decisionCounts.accepted} accepted
            </span>
            {decisionCounts.rejected > 0 && (
              <>
                ,{" "}
                <span className="text-red-500">
                  {decisionCounts.rejected} rejected
                </span>
              </>
            )}
            {decisionCounts.edited > 0 && (
              <>
                ,{" "}
                <span className="text-blue-500">
                  {decisionCounts.edited} edited
                </span>
              </>
            )}
            {decisionCounts.pending > 0 && (
              <>
                ,{" "}
                <span className="text-muted-foreground">
                  {decisionCounts.pending} pending
                </span>
              </>
            )}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setLineDecisions(new Map());
              setLineByLineMode(false);
            }}
            className="h-5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            Reset
          </Button>
        </div>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div
          className={cn(
            "px-4 pb-3",
            fillSpace && "flex-1 flex flex-col min-h-0",
          )}
        >
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
                className={cn(
                  "overflow-y-auto",
                  fillSpace
                    ? "flex-1 min-h-0"
                    : isLargeEdit
                      ? "max-h-64"
                      : "max-h-96",
                )}
              >
                <HunkDiffView
                  hunks={hunks}
                  lineDecisions={lineDecisions}
                  lineActions={{
                    onAcceptLine: handleAcceptLine,
                    onRejectLine: handleRejectLine,
                    onEditLine: handleEditLine,
                    onResetLine: handleResetLine,
                  }}
                  enableLineActions={true}
                />
              </div>
            </DiffErrorBoundary>
          )}

          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground flex-shrink-0">
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

// Line action callbacks for granular diff control
interface LineActionCallbacks {
  onAcceptLine: (lineIndex: number) => void;
  onRejectLine: (lineIndex: number) => void;
  onEditLine: (lineIndex: number, newContent: string) => void;
  onResetLine: (lineIndex: number) => void;
}

// Extended diff line with index for tracking
interface IndexedDiffLine extends DiffLine {
  globalIndex: number; // Index across all hunks for tracking decisions
}

interface HunkDiffViewProps {
  hunks: DiffHunk[];
  lineDecisions?: Map<
    number,
    { decision: LineDecision; editedContent?: string }
  >;
  lineActions?: LineActionCallbacks;
  enableLineActions?: boolean;
}

function HunkDiffView({
  hunks,
  lineDecisions,
  lineActions,
  enableLineActions = false,
}: HunkDiffViewProps) {
  if (hunks.length === 0) {
    return (
      <div className="text-xs text-muted-foreground italic py-2">
        No changes to display
      </div>
    );
  }

  // Build global line index across all hunks
  let globalLineIndex = 0;

  return (
    <div className="rounded-md border border-border/50 overflow-hidden bg-background/30">
      {hunks.map((hunk, hunkIdx) => {
        const hunkStartIndex = globalLineIndex;

        return (
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
                {enableLineActions && <col className="w-20" />}
              </colgroup>
              <tbody>
                {hunk.lines.map((line, lineIdx) => {
                  const currentGlobalIndex = hunkStartIndex + lineIdx;
                  globalLineIndex = currentGlobalIndex + 1;
                  const lineDecision = lineDecisions?.get(currentGlobalIndex);

                  return (
                    <DiffLineRow
                      key={lineIdx}
                      line={line}
                      globalIndex={currentGlobalIndex}
                      decision={lineDecision?.decision}
                      editedContent={lineDecision?.editedContent}
                      enableActions={
                        enableLineActions &&
                        (line.type === "added" || line.type === "removed")
                      }
                      onAccept={lineActions?.onAcceptLine}
                      onReject={lineActions?.onRejectLine}
                      onEdit={lineActions?.onEditLine}
                      onReset={lineActions?.onResetLine}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

interface DiffLineRowProps {
  line: DiffLine;
  globalIndex: number;
  decision?: LineDecision;
  editedContent?: string;
  enableActions?: boolean;
  onAccept?: (lineIndex: number) => void;
  onReject?: (lineIndex: number) => void;
  onEdit?: (lineIndex: number, newContent: string) => void;
  onReset?: (lineIndex: number) => void;
}

function DiffLineRow({
  line,
  globalIndex,
  decision,
  editedContent,
  enableActions = false,
  onAccept,
  onReject,
  onEdit,
  onReset,
}: DiffLineRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(line.content);

  // Determine colors based on line type and decision
  const getColors = () => {
    // If line has been decided, show different styling
    if (decision === "accepted") {
      return {
        bg: "bg-green-500/20",
        text: "text-green-300",
        border: "border-l-2 border-l-green-500",
      };
    }
    if (decision === "rejected") {
      return {
        bg: "bg-red-500/5 opacity-50",
        text: "text-muted-foreground line-through",
        border: "border-l-2 border-l-red-500/50",
      };
    }
    if (decision === "edited") {
      return {
        bg: "bg-blue-500/20",
        text: "text-blue-300",
        border: "border-l-2 border-l-blue-500",
      };
    }

    // Default colors based on line type
    if (line.type === "added") {
      return { bg: "bg-green-500/10", text: "text-green-400", border: "" };
    }
    if (line.type === "removed") {
      return { bg: "bg-red-500/10", text: "text-red-400", border: "" };
    }
    return { bg: "", text: "text-muted-foreground", border: "" };
  };

  const colors = getColors();
  const prefix =
    line.type === "added" ? "+" : line.type === "removed" ? "-" : " ";
  const displayContent =
    decision === "edited" && editedContent ? editedContent : line.content;

  const handleAccept = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAccept?.(globalIndex);
  };

  const handleReject = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReject?.(globalIndex);
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(displayContent);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onEdit?.(globalIndex, editValue);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditValue(line.content);
    setIsEditing(false);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReset?.(globalIndex);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  return (
    <tr
      className={cn(
        "border-b border-border/20 last:border-b-0 group transition-colors",
        // Yellow highlight on hover for actionable lines, otherwise use decision/type-based colors
        isHovered && enableActions ? "bg-yellow-500/15" : colors.bg,
        colors.border,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Old line number */}
      <td className="px-2 py-0.5 text-right text-muted-foreground/50 select-none border-r border-border/20 align-top">
        {line.lineNumber.old ?? ""}
      </td>
      {/* New line number */}
      <td className="px-2 py-0.5 text-right text-muted-foreground/50 select-none border-r border-border/20 align-top">
        {line.lineNumber.new ?? ""}
      </td>
      {/* Prefix */}
      <td className={cn("px-1 py-0.5 select-none align-top", colors.text)}>
        {prefix}
      </td>
      {/* Content */}
      <td
        className={cn(
          "px-2 py-0.5 whitespace-pre-wrap break-words",
          colors.text,
        )}
      >
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveEdit}
            autoFocus
            className="w-full bg-background/80 border border-border rounded px-1 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        ) : (
          displayContent || " "
        )}
      </td>
      {/* Action buttons column */}
      {enableActions && (
        <td className="px-1 py-0.5 align-top">
          {isHovered && !decision && !isEditing && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleAccept}
                className="p-0.5 rounded hover:bg-green-500/20 text-muted-foreground hover:text-green-400 transition-colors"
                title={
                  line.type === "added" ? "Keep this line" : "Remove this line"
                }
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                onClick={handleStartEdit}
                className="p-0.5 rounded hover:bg-blue-500/20 text-muted-foreground hover:text-blue-400 transition-colors"
                title="Edit this line"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <button
                onClick={handleReject}
                className="p-0.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                title={
                  line.type === "added"
                    ? "Don't add this line"
                    : "Keep original line"
                }
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          {decision && (
            <div className="flex items-center gap-1">
              <span
                className={cn(
                  "text-[10px] uppercase font-medium",
                  decision === "accepted" && "text-green-500",
                  decision === "rejected" && "text-red-500/50",
                  decision === "edited" && "text-blue-500",
                )}
              >
                {decision}
              </span>
              {isHovered && (
                <button
                  onClick={handleReset}
                  className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Undo - reset to pending"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </td>
      )}
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
