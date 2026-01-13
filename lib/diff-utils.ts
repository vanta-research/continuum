import type { DiffLine, DiffResult } from "./loom-types";

/**
 * Simple line-based diff algorithm using Longest Common Subsequence (LCS).
 * Computes the differences between two strings, treating each line as a unit.
 */

/**
 * Compute the Longest Common Subsequence table for two arrays of lines.
 */
function computeLCSTable(oldLines: string[], newLines: string[]): number[][] {
  const m = oldLines.length;
  const n = newLines.length;

  // Create a 2D table initialized with zeros
  const table: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Fill the table
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  return table;
}

/**
 * Backtrack through the LCS table to generate diff lines.
 */
function backtrackDiff(
  oldLines: string[],
  newLines: string[],
  table: number[][],
): DiffLine[] {
  let i = oldLines.length;
  let j = newLines.length;
  let oldLineNum = oldLines.length;
  let newLineNum = newLines.length;

  // Temporary storage for building the diff in reverse
  const tempDiff: DiffLine[] = [];

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // Lines match - unchanged
      tempDiff.push({
        type: "unchanged",
        lineNumber: { old: oldLineNum, new: newLineNum },
        content: oldLines[i - 1],
      });
      i--;
      j--;
      oldLineNum--;
      newLineNum--;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      // Line added in new version
      tempDiff.push({
        type: "added",
        lineNumber: { old: null, new: newLineNum },
        content: newLines[j - 1],
      });
      j--;
      newLineNum--;
    } else if (i > 0) {
      // Line removed from old version
      tempDiff.push({
        type: "removed",
        lineNumber: { old: oldLineNum, new: null },
        content: oldLines[i - 1],
      });
      i--;
      oldLineNum--;
    }
  }

  // Reverse to get correct order
  return tempDiff.reverse();
}

/**
 * Post-process diff to identify modified lines (adjacent remove + add pairs).
 */
function identifyModifiedLines(lines: DiffLine[]): DiffLine[] {
  const result: DiffLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const current = lines[i];
    const next = lines[i + 1];

    // Check if this is a remove followed by an add at adjacent positions
    if (
      current.type === "removed" &&
      next?.type === "added" &&
      current.lineNumber.old !== null &&
      next.lineNumber.new !== null
    ) {
      // Mark both as part of a modification
      result.push({
        ...current,
        type: "removed",
      });
      result.push({
        ...next,
        type: "added",
      });
      i++; // Skip the next line since we've processed it
    } else {
      result.push(current);
    }
  }

  return result;
}

// Maximum lines to process with full LCS algorithm
// Beyond this, use simplified diff to avoid performance issues
const MAX_DIFF_LINES = 200;

/**
 * Compute a diff between two strings.
 * Returns a detailed diff result with line-by-line changes.
 */
export function computeDiff(
  oldContent: string,
  newContent: string,
): DiffResult {
  // Handle empty content cases
  const oldLines = oldContent ? oldContent.split("\n") : [];
  const newLines = newContent ? newContent.split("\n") : [];

  // If both are empty, no changes
  if (oldLines.length === 0 && newLines.length === 0) {
    return {
      lines: [],
      additions: 0,
      deletions: 0,
      hasChanges: false,
    };
  }

  // If old is empty, everything is an addition (pure insertion)
  // Limit the number of lines shown to avoid UI overload
  if (oldLines.length === 0) {
    const linesToShow = Math.min(newLines.length, MAX_DIFF_LINES);
    const truncated = newLines.length > MAX_DIFF_LINES;

    const lines: DiffLine[] = newLines
      .slice(0, linesToShow)
      .map((content, idx) => ({
        type: "added" as const,
        lineNumber: { old: null, new: idx + 1 },
        content,
      }));

    // Add truncation indicator if needed
    if (truncated) {
      lines.push({
        type: "added" as const,
        lineNumber: { old: null, new: linesToShow + 1 },
        content: `... and ${newLines.length - linesToShow} more lines`,
      });
    }

    return {
      lines,
      additions: newLines.length,
      deletions: 0,
      hasChanges: true,
    };
  }

  // If new is empty, everything is a deletion
  if (newLines.length === 0) {
    const linesToShow = Math.min(oldLines.length, MAX_DIFF_LINES);
    const truncated = oldLines.length > MAX_DIFF_LINES;

    const lines: DiffLine[] = oldLines
      .slice(0, linesToShow)
      .map((content, idx) => ({
        type: "removed" as const,
        lineNumber: { old: idx + 1, new: null },
        content,
      }));

    if (truncated) {
      lines.push({
        type: "removed" as const,
        lineNumber: { old: linesToShow + 1, new: null },
        content: `... and ${oldLines.length - linesToShow} more lines`,
      });
    }

    return {
      lines,
      additions: 0,
      deletions: oldLines.length,
      hasChanges: true,
    };
  }

  // For very large diffs, use a simplified approach to avoid O(m*n) complexity
  const totalLines = oldLines.length + newLines.length;
  if (totalLines > MAX_DIFF_LINES * 2) {
    return computeSimplifiedDiff(oldLines, newLines);
  }

  // Compute LCS-based diff for smaller content
  const table = computeLCSTable(oldLines, newLines);
  const diffLines = backtrackDiff(oldLines, newLines, table);
  const processedLines = identifyModifiedLines(diffLines);

  // Count additions and deletions
  let additions = 0;
  let deletions = 0;
  for (const line of processedLines) {
    if (line.type === "added") additions++;
    if (line.type === "removed") deletions++;
  }

  return {
    lines: processedLines,
    additions,
    deletions,
    hasChanges: additions > 0 || deletions > 0,
  };
}

/**
 * Simplified diff for large content - just shows removed and added sections
 * without trying to find the optimal LCS alignment.
 */
function computeSimplifiedDiff(
  oldLines: string[],
  newLines: string[],
): DiffResult {
  const lines: DiffLine[] = [];
  const maxToShow = Math.floor(MAX_DIFF_LINES / 2);

  // Show some removed lines
  const oldToShow = Math.min(oldLines.length, maxToShow);
  for (let i = 0; i < oldToShow; i++) {
    lines.push({
      type: "removed",
      lineNumber: { old: i + 1, new: null },
      content: oldLines[i],
    });
  }

  if (oldLines.length > maxToShow) {
    lines.push({
      type: "removed",
      lineNumber: { old: oldToShow + 1, new: null },
      content: `... and ${oldLines.length - maxToShow} more removed lines`,
    });
  }

  // Show some added lines
  const newToShow = Math.min(newLines.length, maxToShow);
  for (let i = 0; i < newToShow; i++) {
    lines.push({
      type: "added",
      lineNumber: { old: null, new: i + 1 },
      content: newLines[i],
    });
  }

  if (newLines.length > maxToShow) {
    lines.push({
      type: "added",
      lineNumber: { old: null, new: newToShow + 1 },
      content: `... and ${newLines.length - maxToShow} more added lines`,
    });
  }

  return {
    lines,
    additions: newLines.length,
    deletions: oldLines.length,
    hasChanges: true,
  };
}

/**
 * Compute a unified diff format string (similar to git diff).
 */
export function computeUnifiedDiff(
  oldContent: string,
  newContent: string,
  contextLines: number = 3,
): string {
  const diff = computeDiff(oldContent, newContent);

  if (!diff.hasChanges) {
    return "No changes";
  }

  const output: string[] = [];

  // Group consecutive changes with context
  let i = 0;
  while (i < diff.lines.length) {
    const line = diff.lines[i];

    if (line.type === "unchanged") {
      i++;
      continue;
    }

    // Found a change, gather context and the change block
    const startIdx = Math.max(0, i - contextLines);
    let endIdx = i;

    // Find the end of this change block
    while (
      endIdx < diff.lines.length &&
      (diff.lines[endIdx].type !== "unchanged" ||
        (endIdx < diff.lines.length - 1 &&
          diff.lines
            .slice(
              endIdx,
              Math.min(endIdx + contextLines * 2, diff.lines.length),
            )
            .some((l) => l.type !== "unchanged")))
    ) {
      endIdx++;
    }

    // Add trailing context
    endIdx = Math.min(diff.lines.length, endIdx + contextLines);

    // Output this hunk
    const hunkLines = diff.lines.slice(startIdx, endIdx);
    for (const hunkLine of hunkLines) {
      const prefix =
        hunkLine.type === "added"
          ? "+"
          : hunkLine.type === "removed"
            ? "-"
            : " ";
      output.push(`${prefix} ${hunkLine.content}`);
    }

    if (endIdx < diff.lines.length) {
      output.push("...");
    }

    i = endIdx;
  }

  return output.join("\n");
}

/**
 * Get a summary of changes for display.
 */
export function getDiffSummary(diff: DiffResult): string {
  if (!diff.hasChanges) {
    return "No changes";
  }

  const parts: string[] = [];
  if (diff.additions > 0) {
    parts.push(`+${diff.additions} line${diff.additions !== 1 ? "s" : ""}`);
  }
  if (diff.deletions > 0) {
    parts.push(`-${diff.deletions} line${diff.deletions !== 1 ? "s" : ""}`);
  }

  return parts.join(", ");
}

/**
 * Apply a pending edit to document content.
 * This replaces content starting at targetLine with the new content.
 */
export function applyPendingEdit(
  documentContent: string,
  targetLine: number,
  newContent: string,
): string {
  // Special case: if targetLine is 1, replace the entire document
  // This is the common case for AI edits where the model outputs a full document replacement
  if (targetLine === 1) {
    return newContent;
  }

  const lines = documentContent.split("\n");
  const newContentLines = newContent.split("\n");

  // Validate target line
  if (targetLine < 1) {
    targetLine = 1;
    return newContent; // Full replacement
  }

  // If target line is beyond the document, append
  if (targetLine > lines.length) {
    return documentContent + "\n" + newContent;
  }

  // Replace lines starting at targetLine
  // The model's edit replaces from targetLine for the length of the new content
  lines.splice(targetLine - 1, newContentLines.length, ...newContentLines);

  return lines.join("\n");
}

/**
 * Extract the original content that would be replaced by an edit.
 */
export function extractOriginalContent(
  documentContent: string,
  targetLine: number,
  newContentLineCount: number,
): string {
  // Special case: if targetLine is 1, return the entire document
  // This is the common case for AI edits where the model outputs a full document replacement
  if (targetLine === 1) {
    return documentContent;
  }

  const lines = documentContent.split("\n");

  if (targetLine < 1 || targetLine > lines.length) {
    return "";
  }

  const endLine = Math.min(targetLine - 1 + newContentLineCount, lines.length);
  return lines.slice(targetLine - 1, endLine).join("\n");
}

/**
 * Highlight inline changes within a line (character-level diff).
 * Returns segments with change markers.
 */
export interface InlineSegment {
  text: string;
  type: "unchanged" | "added" | "removed";
}

export function computeInlineDiff(
  oldLine: string,
  newLine: string,
): { old: InlineSegment[]; new: InlineSegment[] } {
  // Simple word-based diff for inline changes
  const oldWords = oldLine.split(/(\s+)/);
  const newWords = newLine.split(/(\s+)/);

  // Use a simple approach: find common prefix and suffix
  let commonPrefixLen = 0;
  while (
    commonPrefixLen < oldWords.length &&
    commonPrefixLen < newWords.length &&
    oldWords[commonPrefixLen] === newWords[commonPrefixLen]
  ) {
    commonPrefixLen++;
  }

  let commonSuffixLen = 0;
  while (
    commonSuffixLen < oldWords.length - commonPrefixLen &&
    commonSuffixLen < newWords.length - commonPrefixLen &&
    oldWords[oldWords.length - 1 - commonSuffixLen] ===
      newWords[newWords.length - 1 - commonSuffixLen]
  ) {
    commonSuffixLen++;
  }

  const oldSegments: InlineSegment[] = [];
  const newSegments: InlineSegment[] = [];

  // Common prefix
  if (commonPrefixLen > 0) {
    oldSegments.push({
      text: oldWords.slice(0, commonPrefixLen).join(""),
      type: "unchanged",
    });
    newSegments.push({
      text: newWords.slice(0, commonPrefixLen).join(""),
      type: "unchanged",
    });
  }

  // Changed middle part
  const oldMiddle = oldWords
    .slice(commonPrefixLen, oldWords.length - commonSuffixLen)
    .join("");
  const newMiddle = newWords
    .slice(commonPrefixLen, newWords.length - commonSuffixLen)
    .join("");

  if (oldMiddle) {
    oldSegments.push({ text: oldMiddle, type: "removed" });
  }
  if (newMiddle) {
    newSegments.push({ text: newMiddle, type: "added" });
  }

  // Common suffix
  if (commonSuffixLen > 0) {
    oldSegments.push({
      text: oldWords.slice(oldWords.length - commonSuffixLen).join(""),
      type: "unchanged",
    });
    newSegments.push({
      text: newWords.slice(newWords.length - commonSuffixLen).join(""),
      type: "unchanged",
    });
  }

  return { old: oldSegments, new: newSegments };
}
