/**
 * Surgical Edit System
 *
 * This module provides types and utilities for targeted document edits,
 * allowing the model to send precise changes instead of rewriting entire documents.
 * This significantly reduces token consumption for large documents.
 */

/**
 * Types of surgical edit operations
 */
export type EditOperation = "replace" | "insert" | "delete";

/**
 * A surgical edit that targets specific lines in a document
 */
export interface SurgicalEdit {
  operation: EditOperation;
  startLine: number;
  endLine?: number; // For replace/delete operations
  content?: string; // For replace/insert operations
  description?: string; // Optional description of the change
}

/**
 * A batch of surgical edits to apply to a document
 */
export interface EditBatch {
  edits: SurgicalEdit[];
  documentId?: string;
}

/**
 * Result of applying surgical edits
 */
export interface EditResult {
  success: boolean;
  newContent: string;
  appliedEdits: number;
  errors: string[];
}

/**
 * Context window for sending to the model
 * Contains only the relevant portion of a document
 */
export interface DocumentContext {
  fullLineCount: number;
  contextStartLine: number;
  contextEndLine: number;
  content: string;
  surroundingContext: {
    before: string | null; // Summary or first few lines before context
    after: string | null; // Summary or last few lines after context
  };
}

// Marker format for surgical edits from the model
export const SURGICAL_EDIT_START = "[SURGICAL_EDIT]";
export const SURGICAL_EDIT_END = "[/SURGICAL_EDIT]";

// Threshold for switching to surgical edit mode
export const LARGE_DOCUMENT_THRESHOLD_LINES = 100;
export const LARGE_DOCUMENT_THRESHOLD_CHARS = 5000;

/**
 * Check if a document is large enough to warrant surgical edits
 */
export function shouldUseSurgicalEdits(content: string): boolean {
  const lines = content.split("\n").length;
  const chars = content.length;
  return (
    lines > LARGE_DOCUMENT_THRESHOLD_LINES ||
    chars > LARGE_DOCUMENT_THRESHOLD_CHARS
  );
}

/**
 * Parse surgical edits from model output
 */
export function parseSurgicalEdits(output: string): SurgicalEdit[] {
  const edits: SurgicalEdit[] = [];

  // Find all surgical edit blocks
  const regex = new RegExp(
    `\\${SURGICAL_EDIT_START}([\\s\\S]*?)\\${SURGICAL_EDIT_END}`,
    "g"
  );

  let match;
  while ((match = regex.exec(output)) !== null) {
    const jsonContent = match[1].trim();

    try {
      const parsed = JSON.parse(jsonContent);

      // Handle single edit or array of edits
      if (Array.isArray(parsed)) {
        for (const edit of parsed) {
          if (isValidSurgicalEdit(edit)) {
            edits.push(normalizeEdit(edit));
          }
        }
      } else if (isValidSurgicalEdit(parsed)) {
        edits.push(normalizeEdit(parsed));
      }
    } catch (error) {
      console.error("[SurgicalEdit] Failed to parse edit JSON:", error);
      // Try to extract via regex as fallback
      const fallbackEdit = parseEditFallback(jsonContent);
      if (fallbackEdit) {
        edits.push(fallbackEdit);
      }
    }
  }

  return edits;
}

/**
 * Validate that an object is a valid surgical edit
 */
function isValidSurgicalEdit(obj: unknown): obj is SurgicalEdit {
  if (typeof obj !== "object" || obj === null) return false;

  const edit = obj as Record<string, unknown>;

  // Must have operation and startLine
  if (
    typeof edit.operation !== "string" ||
    !["replace", "insert", "delete"].includes(edit.operation)
  ) {
    return false;
  }

  if (typeof edit.startLine !== "number" || edit.startLine < 1) {
    return false;
  }

  // Replace and delete need endLine
  if (edit.operation === "replace" || edit.operation === "delete") {
    if (
      edit.endLine !== undefined &&
      (typeof edit.endLine !== "number" || edit.endLine < edit.startLine)
    ) {
      return false;
    }
  }

  // Replace and insert need content
  if (edit.operation === "replace" || edit.operation === "insert") {
    if (typeof edit.content !== "string") {
      return false;
    }
  }

  return true;
}

/**
 * Normalize an edit (fill in defaults)
 */
function normalizeEdit(edit: SurgicalEdit): SurgicalEdit {
  return {
    operation: edit.operation,
    startLine: edit.startLine,
    endLine:
      edit.endLine ?? (edit.operation === "insert" ? undefined : edit.startLine),
    content: edit.content,
    description: edit.description,
  };
}

/**
 * Fallback parser using regex for malformed JSON
 */
function parseEditFallback(content: string): SurgicalEdit | null {
  const operationMatch = content.match(/"operation"\s*:\s*"(replace|insert|delete)"/);
  const startLineMatch = content.match(/"startLine"\s*:\s*(\d+)/);
  const endLineMatch = content.match(/"endLine"\s*:\s*(\d+)/);
  const contentMatch = content.match(/"content"\s*:\s*"([^"]*)"/);

  if (!operationMatch || !startLineMatch) {
    return null;
  }

  const operation = operationMatch[1] as EditOperation;
  const startLine = parseInt(startLineMatch[1], 10);
  const endLine = endLineMatch ? parseInt(endLineMatch[1], 10) : undefined;
  const editContent = contentMatch
    ? contentMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"')
    : undefined;

  // Validate based on operation
  if (
    (operation === "replace" || operation === "insert") &&
    editContent === undefined
  ) {
    return null;
  }

  return {
    operation,
    startLine,
    endLine,
    content: editContent,
  };
}

/**
 * Apply surgical edits to a document
 * Edits are applied in reverse order (bottom to top) to preserve line numbers
 */
export function applySurgicalEdits(
  documentContent: string,
  edits: SurgicalEdit[]
): EditResult {
  if (edits.length === 0) {
    return {
      success: true,
      newContent: documentContent,
      appliedEdits: 0,
      errors: [],
    };
  }

  const lines = documentContent.split("\n");
  const errors: string[] = [];
  let appliedCount = 0;

  // Sort edits by startLine descending (apply bottom-up)
  const sortedEdits = [...edits].sort((a, b) => b.startLine - a.startLine);

  for (const edit of sortedEdits) {
    try {
      const startIdx = edit.startLine - 1;
      const endIdx = (edit.endLine ?? edit.startLine) - 1;

      // Validate line numbers
      if (startIdx < 0) {
        errors.push(`Invalid start line ${edit.startLine}`);
        continue;
      }

      switch (edit.operation) {
        case "replace": {
          if (endIdx >= lines.length) {
            // Extend document if needed
            while (lines.length <= endIdx) {
              lines.push("");
            }
          }
          const newLines = edit.content?.split("\n") ?? [];
          lines.splice(startIdx, endIdx - startIdx + 1, ...newLines);
          appliedCount++;
          break;
        }

        case "insert": {
          if (startIdx > lines.length) {
            // Extend document if needed
            while (lines.length < startIdx) {
              lines.push("");
            }
          }
          const newLines = edit.content?.split("\n") ?? [];
          lines.splice(startIdx, 0, ...newLines);
          appliedCount++;
          break;
        }

        case "delete": {
          if (startIdx < lines.length) {
            const deleteCount = Math.min(
              endIdx - startIdx + 1,
              lines.length - startIdx
            );
            lines.splice(startIdx, deleteCount);
            appliedCount++;
          }
          break;
        }
      }
    } catch (error) {
      errors.push(`Failed to apply edit at line ${edit.startLine}: ${error}`);
    }
  }

  return {
    success: errors.length === 0,
    newContent: lines.join("\n"),
    appliedEdits: appliedCount,
    errors,
  };
}

/**
 * Extract a context window from a document for the model
 */
export function extractContextWindow(
  documentContent: string,
  targetLine: number,
  contextLines: number = 20
): DocumentContext {
  const lines = documentContent.split("\n");
  const totalLines = lines.length;

  // Calculate context bounds
  const startLine = Math.max(1, targetLine - contextLines);
  const endLine = Math.min(totalLines, targetLine + contextLines);

  // Extract the context content
  const contextContent = lines.slice(startLine - 1, endLine).join("\n");

  // Create surrounding context summaries
  let beforeContext: string | null = null;
  let afterContext: string | null = null;

  if (startLine > 1) {
    // Show first 3 lines and line count before context
    const beforeLines = lines.slice(0, Math.min(3, startLine - 1));
    beforeContext = `[Lines 1-${startLine - 1}]: ${beforeLines.join(" | ")}${
      startLine > 4 ? "..." : ""
    }`;
  }

  if (endLine < totalLines) {
    // Show last 3 lines and line count after context
    const afterLines = lines.slice(
      Math.max(endLine, totalLines - 3),
      totalLines
    );
    afterContext = `[Lines ${endLine + 1}-${totalLines}]: ...${afterLines.join(
      " | "
    )}`;
  }

  return {
    fullLineCount: totalLines,
    contextStartLine: startLine,
    contextEndLine: endLine,
    content: contextContent,
    surroundingContext: {
      before: beforeContext,
      after: afterContext,
    },
  };
}

/**
 * Build instruction text for surgical edit mode
 */
export function buildSurgicalEditInstructions(
  context: DocumentContext
): string {
  return `
## SURGICAL EDIT MODE (Large Document)
The document has ${context.fullLineCount} lines. To save tokens, you're seeing lines ${context.contextStartLine}-${context.contextEndLine}.

${context.surroundingContext.before ? `**Before this context:** ${context.surroundingContext.before}` : ""}
${context.surroundingContext.after ? `**After this context:** ${context.surroundingContext.after}` : ""}

### HOW TO MAKE EDITS:
Instead of rewriting the entire document, use surgical edits:

${SURGICAL_EDIT_START}
{
  "operation": "replace",
  "startLine": 45,
  "endLine": 48,
  "content": "new content for lines 45-48\\ncan span multiple lines"
}
${SURGICAL_EDIT_END}

### Operations:
- **replace**: Replace lines startLine through endLine with new content
- **insert**: Insert new content BEFORE startLine (existing content shifts down)
- **delete**: Delete lines startLine through endLine

### Multiple edits:
${SURGICAL_EDIT_START}
[
  {"operation": "replace", "startLine": 10, "endLine": 12, "content": "new text"},
  {"operation": "insert", "startLine": 25, "content": "inserted line"},
  {"operation": "delete", "startLine": 30, "endLine": 32}
]
${SURGICAL_EDIT_END}

### Rules:
- Line numbers are 1-indexed (first line is 1)
- Use \\n for newlines in content
- Edits are applied bottom-to-top, so line numbers stay valid
- For small changes, prefer surgical edits over full rewrites
`;
}

/**
 * Convert a surgical edit to a format suitable for pending edit review
 */
export function surgicalEditToPendingFormat(
  edit: SurgicalEdit,
  documentContent: string
): { originalContent: string; newContent: string; targetLine: number } {
  const lines = documentContent.split("\n");
  const startIdx = edit.startLine - 1;
  const endIdx = (edit.endLine ?? edit.startLine) - 1;

  let originalContent: string;
  let newContent: string;

  switch (edit.operation) {
    case "replace":
      originalContent = lines.slice(startIdx, endIdx + 1).join("\n");
      newContent = edit.content ?? "";
      break;

    case "insert":
      originalContent = "";
      newContent = edit.content ?? "";
      break;

    case "delete":
      originalContent = lines.slice(startIdx, endIdx + 1).join("\n");
      newContent = "";
      break;

    default:
      originalContent = "";
      newContent = "";
  }

  return {
    originalContent,
    newContent,
    targetLine: edit.startLine,
  };
}

/**
 * Check if model output contains surgical edit markers
 */
export function containsSurgicalEdits(output: string): boolean {
  return (
    output.includes(SURGICAL_EDIT_START) && output.includes(SURGICAL_EDIT_END)
  );
}
