'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { StateField, StateEffect, RangeSetBuilder } from '@codemirror/state';
import { useLoom } from './loom-provider';
import { cn } from '@/lib/utils';

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
            Decoration.line({ class: 'model-cursor-line' })
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

// Custom theme for the loom editor
const loomTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
  },
  '.cm-scroller': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    overflow: 'auto',
  },
  '.cm-content': {
    padding: '16px 0',
  },
  '.cm-line': {
    padding: '0 16px',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'hsl(var(--muted-foreground) / 0.5)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'hsl(var(--accent) / 0.3)',
  },
  '.cm-activeLine': {
    backgroundColor: 'hsl(var(--accent) / 0.1)',
  },
  '&.cm-focused .cm-cursor': {
    borderLeftColor: 'hsl(var(--primary))',
  },
  '&.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'hsl(var(--primary) / 0.2)',
  },
  '.model-cursor-line': {
    backgroundColor: 'hsl(270 70% 60% / 0.15)',
    borderLeft: '3px solid hsl(270 70% 60%)',
    marginLeft: '-3px',
  },
});

interface LoomEditorProps {
  className?: string;
  placeholder?: string;
  readOnly?: boolean;
}

export function LoomEditor({
  className,
  placeholder = 'Start typing or ask the AI to help you draft...',
  readOnly = false,
}: LoomEditorProps) {
  const { state, updateContent, updateUserCursor } = useLoom();
  const { document, modelCursor, modelEdit } = state;

  const content = document?.content || '';

  // Handle content changes from user typing
  const handleChange = useCallback(
    (value: string) => {
      if (!modelEdit.isEditing) {
        updateContent(value);
      }
    },
    [modelEdit.isEditing, updateContent]
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
    [updateUserCursor]
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
            if ((update.docChanged || update.viewportChanged) && !this.pendingUpdate) {
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
        }
      ),
    [modelCursor?.line]
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
    [modelCursorPlugin, handleUpdate]
  );

  // Effect to update model cursor decoration when it changes
  useEffect(() => {
    // This will trigger re-render with new modelCursorPlugin
  }, [modelCursor?.line]);

  return (
    <div className={cn('loom-editor h-full w-full overflow-hidden', className)}>
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
