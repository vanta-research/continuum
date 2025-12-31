import type { ParsedCanvasEdit } from './canvas-types';

// Regex patterns for canvas edit markers
const CANVAS_EDIT_START_PATTERN = /\[CANVAS_EDIT_START:(\d+)\]/;
const CANVAS_EDIT_END_PATTERN = /\[CANVAS_EDIT_END\]/;

interface ParseResult {
  beforeMarker: string;
  type: 'text' | 'canvas_edit_start' | 'canvas_edit_end' | 'none';
  line?: number;
  afterMarker: string;
}

/**
 * Parse a streaming chunk for canvas edit markers.
 * Returns information about any markers found and the remaining text.
 */
export function parseStreamChunk(chunk: string): ParseResult {
  // Check for edit start marker
  const startMatch = chunk.match(CANVAS_EDIT_START_PATTERN);
  if (startMatch) {
    const markerIndex = chunk.indexOf(startMatch[0]);
    return {
      beforeMarker: chunk.slice(0, markerIndex),
      type: 'canvas_edit_start',
      line: parseInt(startMatch[1], 10),
      afterMarker: chunk.slice(markerIndex + startMatch[0].length),
    };
  }

  // Check for edit end marker
  const endMatch = chunk.match(CANVAS_EDIT_END_PATTERN);
  if (endMatch) {
    const markerIndex = chunk.indexOf(endMatch[0]);
    return {
      beforeMarker: chunk.slice(0, markerIndex),
      type: 'canvas_edit_end',
      afterMarker: chunk.slice(markerIndex + endMatch[0].length),
    };
  }

  // No markers found
  return {
    beforeMarker: chunk,
    type: 'none',
    afterMarker: '',
  };
}

/**
 * State machine for parsing canvas edits from a stream.
 */
export class CanvasEditParser {
  private inEditBlock = false;
  private currentLine: number | null = null;
  private editBuffer = '';
  private textBuffer = '';

  /**
   * Process a chunk of streaming content.
   * Returns parsed events that occurred.
   */
  processChunk(chunk: string): ParsedCanvasEdit[] {
    const events: ParsedCanvasEdit[] = [];
    let remaining = chunk;

    while (remaining.length > 0) {
      const result = parseStreamChunk(remaining);

      if (result.type === 'canvas_edit_start') {
        // Flush any text before the marker
        if (result.beforeMarker || this.textBuffer) {
          events.push({
            type: 'text',
            content: this.textBuffer + result.beforeMarker,
          });
          this.textBuffer = '';
        }

        // Start edit block
        this.inEditBlock = true;
        this.currentLine = result.line!;
        this.editBuffer = '';

        events.push({
          type: 'canvas_edit_start',
          line: result.line,
        });

        remaining = result.afterMarker;
      } else if (result.type === 'canvas_edit_end') {
        // Content before the end marker is part of the edit
        if (this.inEditBlock) {
          this.editBuffer += result.beforeMarker;

          events.push({
            type: 'canvas_content',
            content: this.editBuffer,
          });

          events.push({
            type: 'canvas_edit_end',
          });
        } else {
          // Not in edit block, treat as text
          this.textBuffer += result.beforeMarker;
        }

        this.inEditBlock = false;
        this.currentLine = null;
        this.editBuffer = '';

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
        remaining = '';
      }
    }

    // Flush remaining text if not in edit block
    if (!this.inEditBlock && this.textBuffer) {
      events.push({
        type: 'text',
        content: this.textBuffer,
      });
      this.textBuffer = '';
    }

    return events;
  }

  /**
   * Reset parser state.
   */
  reset() {
    this.inEditBlock = false;
    this.currentLine = null;
    this.editBuffer = '';
    this.textBuffer = '';
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
  mode: 'replace' | 'insert' = 'replace'
): string {
  const lines = content.split('\n');

  if (targetLine < 1 || targetLine > lines.length + 1) {
    // Invalid line number, append at end
    return content + '\n' + newContent;
  }

  const newContentLines = newContent.split('\n');

  if (mode === 'replace') {
    // Replace lines starting at targetLine
    lines.splice(targetLine - 1, newContentLines.length, ...newContentLines);
  } else {
    // Insert before targetLine
    lines.splice(targetLine - 1, 0, ...newContentLines);
  }

  return lines.join('\n');
}

/**
 * Build canvas context to send to the API.
 */
export function buildCanvasContext(
  documentContent: string,
  cursorLine: number,
  selectedText?: string
) {
  return {
    content: documentContent,
    cursorLine,
    selectedText,
    lineCount: documentContent.split('\n').length,
  };
}

/**
 * Get a human-friendly model name for display.
 */
export function getModelDisplayName(modelId: string): string {
  const modelNames: Record<string, string> = {
    atom: 'Atom',
    'atom-large-experimental': 'Atom-Large',
    'loux-large-experimental': 'Loux-Large',
  };
  return modelNames[modelId] || modelId;
}
