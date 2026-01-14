"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { markdown } from "@codemirror/lang-markdown";
import {
  EditorView,
  Decoration,
  DecorationSet,
  ViewPlugin,
  ViewUpdate,
} from "@codemirror/view";
import { StateField, StateEffect, RangeSetBuilder } from "@codemirror/state";
import { useCanvas } from "./canvas-provider";
import { cn } from "@/lib/utils";

// State effect to update the model cursor line
const setModelCursorLine = StateEffect.define<number | null>();

// State field for model cursor decoration
const modelCursorField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setModelCursorLine)) {
        if (effect.value === null) {
          return Decoration.none;
        }
        try {
          const lineInfo = tr.state.doc.line(effect.value);
          const builder = new RangeSetBuilder<Decoration>();
          builder.add(
            lineInfo.from,
            lineInfo.from,
            Decoration.line({ class: "model-cursor-line" }),
          );
          return builder.finish();
        } catch {
          return Decoration.none;
        }
      }
    }
    return decorations.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

// One Dark theme for the canvas editor
const canvasTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
    backgroundColor: "#282c34",
  },
  ".cm-scroller": {
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    overflow: "auto",
  },
  ".cm-content": {
    padding: "16px 0",
    caretColor: "var(--accent-color, #61afef)",
  },
  ".cm-line": {
    padding: "0 16px",
  },
  ".cm-gutters": {
    backgroundColor: "#21252b",
    border: "none",
    color: "#495162",
  },
  ".cm-gutter.cm-lineNumbers .cm-gutterElement": {
    color: "#495162",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "#2c313c",
    color: "#abb2bf",
  },
  ".cm-activeLine": {
    backgroundColor: "#2c313c",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--accent-color, #61afef)",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "#3e4451",
  },
  ".cm-selectionBackground": {
    backgroundColor: "#3e4451 !important",
  },
  // One Dark syntax highlighting
  ".cm-keyword": { color: "#c678dd" },
  ".cm-operator": { color: "#56b6c2" },
  ".cm-variable": { color: "#e06c75" },
  ".cm-variable-2": { color: "#e5c07b" },
  ".cm-variable-3": { color: "#e5c07b" },
  ".cm-builtin": { color: "#e5c07b" },
  ".cm-atom": { color: "#d19a66" },
  ".cm-number": { color: "#d19a66" },
  ".cm-def": { color: "#61afef" },
  ".cm-string": { color: "#98c379" },
  ".cm-string-2": { color: "#98c379" },
  ".cm-comment": { color: "#5c6370", fontStyle: "italic" },
  ".cm-tag": { color: "#e06c75" },
  ".cm-bracket": { color: "#abb2bf" },
  ".cm-attribute": { color: "#d19a66" },
  ".cm-hr": { color: "#5c6370" },
  ".cm-link": { color: "#61afef" },
  ".cm-header": { color: "#e06c75", fontWeight: "bold" },
  ".cm-strong": { fontWeight: "bold", color: "#d19a66" },
  ".cm-em": { fontStyle: "italic", color: "#c678dd" },
  ".cm-quote": { color: "#5c6370", fontStyle: "italic" },
  // Model cursor line - uses accent color
  ".model-cursor-line": {
    backgroundColor: "var(--accent-color-subtle, #61afef26)",
    borderLeft: "3px solid var(--accent-color, #61afef)",
    marginLeft: "-3px",
  },
});

interface CanvasEditorProps {
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
}

export function CanvasEditor({
  className,
  placeholder = "Start typing or ask the AI to help you draft...",
  readOnly = false,
}: CanvasEditorProps) {
  const { state, updateContent, updateUserCursor } = useCanvas();
  const { document, modelCursor, modelEdit } = state;

  const content = document?.content || "";

  // Handle content changes from user typing
  const handleChange = useCallback(
    (value: string) => {
      if (!modelEdit.isEditing) {
        updateContent(value);
      }
    },
    [modelEdit.isEditing, updateContent],
  );

  // Track cursor position
  const handleUpdate = useCallback(
    (update: ViewUpdate) => {
      if (update.selectionSet) {
        const pos = update.state.selection.main.head;
        const line = update.state.doc.lineAt(pos);
        updateUserCursor({
          line: line.number,
          column: pos - line.from,
        });
      }
    },
    [updateUserCursor],
  );

  // Create a plugin to dispatch model cursor updates
  // Must defer dispatch to avoid "update during update" error
  const modelCursorPlugin = useMemo(
    () =>
      ViewPlugin.fromClass(
        class {
          private pendingUpdate = false;

          update(update: ViewUpdate) {
            const targetLine = modelCursor?.line ?? null;
            // Only schedule update if needed and not already pending
            if (
              (update.docChanged || update.viewportChanged) &&
              !this.pendingUpdate
            ) {
              this.pendingUpdate = true;
              // Defer dispatch to next frame to avoid nested update error
              requestAnimationFrame(() => {
                this.pendingUpdate = false;
                update.view.dispatch({
                  effects: setModelCursorLine.of(targetLine),
                });
              });
            }
          }
        },
      ),
    [modelCursor?.line],
  );

  // Extensions for CodeMirror
  const extensions = useMemo(
    () => [
      markdown(),
      canvasTheme,
      modelCursorField,
      modelCursorPlugin,
      EditorView.lineWrapping,
      EditorView.updateListener.of(handleUpdate),
    ],
    [modelCursorPlugin, handleUpdate],
  );

  // Effect to update model cursor decoration when it changes
  useEffect(() => {
    // This will trigger re-render with new modelCursorPlugin
  }, [modelCursor?.line]);

  return (
    <div
      className={cn("canvas-editor h-full w-full overflow-hidden", className)}
    >
      <CodeMirror
        value={content}
        onChange={handleChange}
        extensions={extensions}
        placeholder={placeholder}
        editable={!readOnly && !modelEdit.isEditing}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLineGutter: true,
          highlightActiveLine: true,
          foldGutter: false,
          dropCursor: true,
          allowMultipleSelections: false,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: false,
          rectangularSelection: false,
          crosshairCursor: false,
          highlightSelectionMatches: false,
          searchKeymap: true,
          history: true,
        }}
        className="h-full"
      />
    </div>
  );
}
