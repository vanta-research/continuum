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
import { useLoom } from "./loom-provider";
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

// One Dark theme colors - accent color comes from CSS variable
const oneDark = {
  background: "#282c34",
  backgroundDarker: "#21252b",
  foreground: "#abb2bf",
  selection: "#3e4451",
  comment: "#5c6370",
  red: "#e06c75",
  green: "#98c379",
  yellow: "#e5c07b",
  blue: "#61afef",
  purple: "#c678dd",
  cyan: "#56b6c2",
  orange: "#d19a66",
  gutter: "#4b5263",
};

// Custom theme for the loom editor - One Dark
const loomTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "14px",
    backgroundColor: oneDark.background,
    color: oneDark.foreground,
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
    backgroundColor: oneDark.backgroundDarker,
    border: "none",
    color: oneDark.gutter,
  },
  ".cm-gutter": {
    backgroundColor: oneDark.backgroundDarker,
  },
  ".cm-lineNumbers .cm-gutterElement": {
    color: oneDark.gutter,
  },
  ".cm-activeLineGutter": {
    backgroundColor: oneDark.selection,
    color: oneDark.foreground,
  },
  ".cm-activeLine": {
    backgroundColor: `${oneDark.selection}66`,
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--accent-color, #61afef)",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: oneDark.selection,
  },
  ".cm-selectionBackground": {
    backgroundColor: oneDark.selection,
  },
  ".model-cursor-line": {
    backgroundColor: "var(--accent-color-subtle, #61afef26)",
    borderLeft: "3px solid var(--accent-color, #61afef)",
    marginLeft: "-3px",
  },
  // Syntax highlighting overrides for One Dark
  ".cm-keyword": { color: oneDark.purple },
  ".cm-operator": { color: oneDark.cyan },
  ".cm-variable": { color: oneDark.red },
  ".cm-variable-2": { color: oneDark.orange },
  ".cm-string": { color: oneDark.green },
  ".cm-string-2": { color: oneDark.green },
  ".cm-comment": { color: oneDark.comment, fontStyle: "italic" },
  ".cm-number": { color: oneDark.orange },
  ".cm-atom": { color: oneDark.orange },
  ".cm-property": { color: oneDark.red },
  ".cm-qualifier": { color: oneDark.yellow },
  ".cm-tag": { color: oneDark.red },
  ".cm-attribute": { color: oneDark.orange },
  ".cm-link": { color: oneDark.cyan, textDecoration: "underline" },
  ".cm-header": { color: oneDark.red, fontWeight: "bold" },
  ".cm-strong": { color: oneDark.orange, fontWeight: "bold" },
  ".cm-em": { color: oneDark.purple, fontStyle: "italic" },
  // Markdown specific
  ".cm-meta": { color: oneDark.comment },
  ".cm-url": { color: oneDark.cyan },
  // Matching brackets
  ".cm-matchingBracket": {
    backgroundColor: "var(--accent-color-subtle, #61afef26)",
    color: oneDark.foreground,
    outline: "1px solid var(--accent-color, #61afef)",
  },
});

interface LoomEditorProps {
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
}

export function LoomEditor({
  className,
  placeholder = "Start typing or ask the AI to help you draft...",
  readOnly = false,
}: LoomEditorProps) {
  const { state, updateContent, updateUserCursor } = useLoom();
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
      loomTheme,
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
    <div className={cn("loom-editor h-full w-full overflow-hidden", className)}>
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
