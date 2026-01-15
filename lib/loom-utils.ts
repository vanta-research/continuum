import type { ParsedLoomEdit } from "./loom-types";

// Regex patterns for loom edit markers
// Support both CANVAS_EDIT (legacy) and ADD_FILE (preferred) formats
const LOOM_EDIT_START_PATTERN = /\[CANVAS_EDIT_START:(\d+)\]/;
const LOOM_EDIT_END_PATTERN = /\[CANVAS_EDIT_END\]/;
const ADD_FILE_START_PATTERN = /\[ADD_FILE\]/;
const ADD_FILE_END_PATTERN = /\[\/ADD_FILE\]/;

interface ParseResult {
  beforeMarker: string;
  type: "text" | "canvas_edit_start" | "canvas_edit_end" | "none";
  line?: number;
  afterMarker: string;
}

/**
 * Parse a streaming chunk for loom edit markers.
 * Supports both CANVAS_EDIT and ADD_FILE formats.
 * Returns information about any markers found and the remaining text.
 */
export function parseStreamChunk(chunk: string): ParseResult {
  // Check for CANVAS_EDIT start marker (legacy format)
  const startMatch = chunk.match(LOOM_EDIT_START_PATTERN);
  if (startMatch) {
    const markerIndex = chunk.indexOf(startMatch[0]);
    return {
      beforeMarker: chunk.slice(0, markerIndex),
      type: "canvas_edit_start",
      line: parseInt(startMatch[1], 10),
      afterMarker: chunk.slice(markerIndex + startMatch[0].length),
    };
  }

  // Check for ADD_FILE start marker (preferred format)
  const addFileStartMatch = chunk.match(ADD_FILE_START_PATTERN);
  if (addFileStartMatch) {
    const markerIndex = chunk.indexOf(addFileStartMatch[0]);
    return {
      beforeMarker: chunk.slice(0, markerIndex),
      type: "canvas_edit_start",
      line: 1, // ADD_FILE always targets line 1 (full document replace)
      afterMarker: chunk.slice(markerIndex + addFileStartMatch[0].length),
    };
  }

  // Check for CANVAS_EDIT end marker (legacy format)
  const endMatch = chunk.match(LOOM_EDIT_END_PATTERN);
  if (endMatch) {
    const markerIndex = chunk.indexOf(endMatch[0]);
    return {
      beforeMarker: chunk.slice(0, markerIndex),
      type: "canvas_edit_end",
      afterMarker: chunk.slice(markerIndex + endMatch[0].length),
    };
  }

  // Check for ADD_FILE end marker (preferred format)
  const addFileEndMatch = chunk.match(ADD_FILE_END_PATTERN);
  if (addFileEndMatch) {
    const markerIndex = chunk.indexOf(addFileEndMatch[0]);
    return {
      beforeMarker: chunk.slice(0, markerIndex),
      type: "canvas_edit_end",
      afterMarker: chunk.slice(markerIndex + addFileEndMatch[0].length),
    };
  }

  // No markers found
  return {
    beforeMarker: chunk,
    type: "none",
    afterMarker: "",
  };
}

/**
 * Extract content from ADD_FILE JSON format.
 * Handles: {"content": "..."} or just raw content
 */
export function extractAddFileContent(jsonOrContent: string): string {
  const trimmed = jsonOrContent.trim();

  // Try to parse as JSON first
  try {
    const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.content) {
        return parsed.content;
      }
    }
  } catch {
    // JSON parsing failed, try regex extraction
  }

  // Regex fallback for malformed JSON
  const contentMatch = trimmed.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (contentMatch) {
    return contentMatch[1]
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .replace(/\\t/g, "\t");
  }

  // If no JSON structure found, return as-is (might be raw content)
  return trimmed;
}

/**
 * State machine for parsing loom edits from a stream.
 */
export class LoomEditParser {
  private inEditBlock = false;
  private currentLine: number | null = null;
  private editBuffer = "";
  private textBuffer = "";
  private isAddFileFormat = false; // Track if we're parsing ADD_FILE format

  /**
   * Process a chunk of streaming content.
   * Returns parsed events that occurred.
   */
  processChunk(chunk: string): ParsedLoomEdit[] {
    const events: ParsedLoomEdit[] = [];
    let remaining = chunk;

    while (remaining.length > 0) {
      const result = parseStreamChunk(remaining);

      if (result.type === "canvas_edit_start") {
        // Flush any text before the marker
        if (result.beforeMarker || this.textBuffer) {
          events.push({
            type: "text",
            content: this.textBuffer + result.beforeMarker,
          });
          this.textBuffer = "";
        }

        // Detect if this is ADD_FILE format (check original remaining text)
        this.isAddFileFormat = remaining.includes("[ADD_FILE]");

        // Start edit block
        this.inEditBlock = true;
        this.currentLine = result.line!;
        this.editBuffer = "";

        events.push({
          type: "canvas_edit_start",
          line: result.line,
        });

        remaining = result.afterMarker;
      } else if (result.type === "canvas_edit_end") {
        // Content before the end marker is part of the edit
        if (this.inEditBlock) {
          this.editBuffer += result.beforeMarker;

          // If ADD_FILE format, extract content from JSON wrapper
          let finalContent = this.editBuffer;
          if (this.isAddFileFormat) {
            finalContent = extractAddFileContent(this.editBuffer);
          }

          events.push({
            type: "canvas_content",
            content: finalContent,
          });

          events.push({
            type: "canvas_edit_end",
          });
        } else {
          // Not in edit block, treat as text
          this.textBuffer += result.beforeMarker;
        }

        this.inEditBlock = false;
        this.currentLine = null;
        this.editBuffer = "";
        this.isAddFileFormat = false;

        remaining = result.afterMarker;
      } else {
        // No marker found
        if (this.inEditBlock) {
          // Accumulate edit content
          this.editBuffer += result.beforeMarker;
        } else {
          // Accumulate regular text
          this.textBuffer += result.beforeMarker;
        }
        remaining = "";
      }
    }

    // Flush remaining text if not in edit block
    if (!this.inEditBlock && this.textBuffer) {
      events.push({
        type: "text",
        content: this.textBuffer,
      });
      this.textBuffer = "";
    }

    return events;
  }

  /**
   * Reset parser state.
   */
  reset() {
    this.inEditBlock = false;
    this.currentLine = null;
    this.editBuffer = "";
    this.textBuffer = "";
    this.isAddFileFormat = false;
  }

  /**
   * Check if currently inside an edit block.
   */
  isInEditBlock(): boolean {
    return this.inEditBlock;
  }

  /**
   * Get the current edit target line.
   */
  getCurrentLine(): number | null {
    return this.currentLine;
  }
}

/**
 * Apply an edit to document content at a specific line.
 */
export function applyEditToDocument(
  content: string,
  targetLine: number,
  newContent: string,
  mode: "replace" | "insert" = "replace",
): string {
  // Special case: if targetLine is 1 and mode is replace, replace entire document
  // This is the most common case for AI edits - full document updates
  if (targetLine === 1 && mode === "replace") {
    return newContent;
  }

  const lines = content.split("\n");

  if (targetLine < 1 || targetLine > lines.length + 1) {
    // Invalid line number, append at end
    return content + "\n" + newContent;
  }

  const newContentLines = newContent.split("\n");

  if (mode === "replace") {
    // Replace lines starting at targetLine with the new content lines
    // For partial replacements, we replace the same number of lines as the new content
    lines.splice(targetLine - 1, newContentLines.length, ...newContentLines);
  } else {
    // Insert before targetLine
    lines.splice(targetLine - 1, 0, ...newContentLines);
  }

  return lines.join("\n");
}

/**
 * Build loom context to send to the API.
 */
export function buildLoomContext(
  documentContent: string,
  cursorLine: number,
  selectedText?: string,
) {
  return {
    content: documentContent,
    cursorLine,
    selectedText,
    lineCount: documentContent.split("\n").length,
  };
}

/**
 * Get a human-friendly model name for display.
 */
export function getModelDisplayName(modelId: string): string {
  const modelNames: Record<string, string> = {
    atom: "Atom",
    "atom-large-experimental": "Atom-Large",
    "loux-large-experimental": "Loux-Large",
  };
  return modelNames[modelId] || modelId;
}

// ============================================================
// Project Tool Utilities
// ============================================================

export interface ProjectToolPayload {
  name: string;
  description: string;
  initialFile?: {
    name: string;
    content: string;
  };
}

export interface ParsedProjectTool {
  found: boolean;
  payload?: ProjectToolPayload;
  cleanedContent: string;
  error?: string;
}

/**
 * Parse project creation markers from AI response.
 * Extracts the JSON payload and returns cleaned content.
 */
export function parseProjectToolMarkers(content: string): ParsedProjectTool {
  const projectMatch = content.match(
    /\[CREATE_PROJECT\]\s*([\s\S]*?)\s*\[\/CREATE_PROJECT\]/,
  );

  if (!projectMatch) {
    return {
      found: false,
      cleanedContent: content,
    };
  }

  try {
    // Parse the JSON payload
    const jsonStr = projectMatch[1].trim();
    const payload = JSON.parse(jsonStr) as ProjectToolPayload;

    // Validate required fields
    if (!payload.name || typeof payload.name !== "string") {
      return {
        found: true,
        cleanedContent: content,
        error: "Project name is required",
      };
    }

    // Clean the markers from the content
    const cleanedContent = content
      .replace(/\[CREATE_PROJECT\][\s\S]*?\[\/CREATE_PROJECT\]/g, "")
      .trim();

    return {
      found: true,
      payload,
      cleanedContent,
    };
  } catch (e) {
    return {
      found: true,
      cleanedContent: content,
      error: `Failed to parse project data: ${e instanceof Error ? e.message : "Unknown error"}`,
    };
  }
}

/**
 * Clean project tool markers from text for display during streaming.
 * This handles partial markers that may appear mid-stream.
 */
export function cleanProjectToolMarkers(text: string): string {
  // Remove complete project tool blocks
  let cleaned = text.replace(
    /\[CREATE_PROJECT\][\s\S]*?\[\/CREATE_PROJECT\]/g,
    "",
  );

  // Remove incomplete blocks (still streaming)
  cleaned = cleaned.replace(/\[CREATE_PROJECT\][\s\S]*$/, "");

  // Remove partial markers that might be forming
  cleaned = cleaned.replace(/\[CREATE_PROJECT[^\]]*$/, "");
  cleaned = cleaned.replace(/\[CREATE_P[^\]]*$/, "");
  cleaned = cleaned.replace(/\[CREATE[^\]]*$/, "");
  cleaned = cleaned.replace(/\[CREAT[^\]]*$/, "");
  cleaned = cleaned.replace(/\[CREA[^\]]*$/, "");
  cleaned = cleaned.replace(/\[CRE[^\]]*$/, "");
  cleaned = cleaned.replace(/\[CR[^\]]*$/, "");
  cleaned = cleaned.replace(/\[C[^\]]*$/, "");

  return cleaned.trim();
}

// ============================================================
// ADD_FILE Tool Parsing
// ============================================================

export interface AddFilePayload {
  name: string;
  content: string;
}

export interface ParsedAddFile {
  found: boolean;
  payload?: AddFilePayload;
  cleanedContent: string;
  error?: string;
}

/**
 * Parse ADD_FILE markers from AI response.
 * Extracts the JSON payload for creating a file in the current project.
 */
export function parseAddFileMarkers(content: string): ParsedAddFile {
  const fileMatch = content.match(/\[ADD_FILE\]\s*([\s\S]*?)\s*\[\/ADD_FILE\]/);

  if (!fileMatch) {
    return {
      found: false,
      cleanedContent: content,
    };
  }

  try {
    const jsonStr = fileMatch[1].trim();
    const payload = JSON.parse(jsonStr) as AddFilePayload;

    if (!payload.name || typeof payload.name !== "string") {
      return {
        found: true,
        cleanedContent: content,
        error: "File name is required",
      };
    }

    if (typeof payload.content !== "string") {
      return {
        found: true,
        cleanedContent: content,
        error: "File content is required",
      };
    }

    const cleanedContent = content
      .replace(/\[ADD_FILE\][\s\S]*?\[\/ADD_FILE\]/g, "")
      .trim();

    return {
      found: true,
      payload,
      cleanedContent,
    };
  } catch (e) {
    return {
      found: true,
      cleanedContent: content,
      error: `Failed to parse file data: ${e instanceof Error ? e.message : "Unknown error"}`,
    };
  }
}

/**
 * Clean ADD_FILE markers from text for display during streaming.
 */
export function cleanAddFileMarkers(text: string): string {
  // Quick check - if no markers, return early
  if (!text.includes("[ADD_FILE]") && !text.includes("[/ADD_FILE]")) {
    return text;
  }

  console.log("[cleanAddFileMarkers] Found markers in text, cleaning...");
  console.log("[cleanAddFileMarkers] Input text length:", text.length);

  // Simple string-based approach that will definitely work
  // Find the start and end positions
  const startMarker = "[ADD_FILE]";
  const endMarker = "[/ADD_FILE]";

  let result = text;
  let iterations = 0;
  const maxIterations = 10; // Safety limit

  // Remove all complete [ADD_FILE]...[/ADD_FILE] blocks
  while (iterations < maxIterations) {
    const startIdx = result.indexOf(startMarker);
    console.log(
      "[cleanAddFileMarkers] Iteration",
      iterations,
      "- startIdx:",
      startIdx,
    );
    const endIdx = result.indexOf(endMarker);

    if (startIdx === -1 && endIdx === -1) {
      // No markers left
      break;
    }

    if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
      // Complete block found - remove it
      console.log(
        "[cleanAddFileMarkers] Found complete block, removing from",
        startIdx,
        "to",
        endIdx + endMarker.length,
      );
      const before = result.substring(0, startIdx);
      const after = result.substring(endIdx + endMarker.length);
      result = before + after;
      console.log(
        "[cleanAddFileMarkers] Result length after removal:",
        result.length,
      );
    } else if (startIdx !== -1 && (endIdx === -1 || endIdx < startIdx)) {
      // Only start marker, or end comes before start (malformed)
      // Remove from start marker to end of string (incomplete block)
      result = result.substring(0, startIdx);
      break;
    } else if (endIdx !== -1 && startIdx === -1) {
      // Only end marker (orphaned) - remove just the marker
      result =
        result.substring(0, endIdx) +
        result.substring(endIdx + endMarker.length);
    } else {
      break;
    }

    iterations++;
  }

  // Clean up any partial markers at the end
  const partials = [
    "[ADD_FILE",
    "[ADD_FIL",
    "[ADD_FI",
    "[ADD_F",
    "[ADD_",
    "[ADD",
    "[AD",
    "[/ADD_FILE",
    "[/ADD_FIL",
    "[/ADD_FI",
    "[/ADD_F",
    "[/ADD_",
    "[/ADD",
    "[/AD",
  ];

  for (const partial of partials) {
    if (result.endsWith(partial)) {
      result = result.substring(0, result.length - partial.length);
    }
  }

  console.log("[cleanAddFileMarkers] Final result length:", result.length);
  console.log(
    "[cleanAddFileMarkers] Final result preview:",
    result.substring(0, 200),
  );
  return result.trim();
}
