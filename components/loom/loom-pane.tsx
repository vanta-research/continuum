'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLoom } from './loom-provider';
import { LoomToolbar } from './loom-toolbar';
import { LoomEditor } from './loom-editor';
import { LoomPreview } from './loom-preview';
import { LoomFileSidebar } from './loom-file-sidebar';
import { ModelTypingIndicator } from './model-typing-indicator';
import { useProject } from '@/components/projects/project-provider';
import { cn } from '@/lib/utils';

interface LoomPaneProps {
  sessionId: string;
  modelName?: string;
  onClose?: () => void;
  className?: string;
}

export function LoomPane({
  sessionId,
  modelName = 'Model',
  onClose,
  className,
}: LoomPaneProps) {
  const { state, createDocument, setFileModified, updateContent } = useLoom();
  const { state: projectState, uploadFile } = useProject();
  const { document, modelEdit, openFileId, isFileModified } = state;
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastContentRef = useRef<string>('');

  // Auto-save file when content changes
  useEffect(() => {
    if (!openFileId || !document || !projectState.activeProject) return;

    // Check if content actually changed
    if (document.content === lastContentRef.current) return;
    lastContentRef.current = document.content;

    // Mark as modified
    if (!isFileModified) {
      setFileModified(true);
    }

    // Debounced save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        // Save file content via PATCH endpoint
        await fetch(`/api/projects/${projectState.activeProject!.id}/files/${openFileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: document.content }),
        });
        setFileModified(false);
      } catch (error) {
        console.error('Failed to save file:', error);
      }
    }, 1500); // 1.5 second debounce

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [document?.content, openFileId, projectState.activeProject, isFileModified, setFileModified]);

  const handleCreateDocument = () => {
    createDocument(sessionId);
  };

  return (
    <div
      className={cn(
        'loom-pane flex h-full',
        'bg-background/30 backdrop-blur-md',
        'border-l border-border/50',
        className
      )}
    >
      {/* File Sidebar */}
      <LoomFileSidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <LoomToolbar
          onClose={onClose}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <div className="relative flex-1 overflow-hidden">
          {document ? (
            <>
              {viewMode === 'edit' ? (
                <LoomEditor />
              ) : (
                <LoomPreview content={document.content} />
              )}
              <ModelTypingIndicator modelName={modelName} />

              {/* Save indicator */}
              {isFileModified && (
                <div className="absolute top-2 right-2 z-10">
                  <span className="text-xs text-yellow-400">Saving...</span>
                </div>
              )}

              {/* Model edit preview overlay */}
              {modelEdit.isEditing && modelEdit.streamBuffer && (
                <div className="absolute top-4 right-4 z-10 max-w-xs">
                  <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm p-3">
                    <div className="text-xs font-medium text-purple-400 mb-1">
                      Incoming edit:
                    </div>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-auto">
                      {modelEdit.streamBuffer.slice(0, 200)}
                      {modelEdit.streamBuffer.length > 200 && '...'}
                    </pre>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center p-8">
              <div className="rounded-full bg-purple-500/10 p-4 mb-4">
                <FileText className="h-8 w-8 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No Document Open</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                Select a file from the sidebar or create a new document.
              </p>
              <Button onClick={handleCreateDocument} className="gap-2">
                <Plus className="h-4 w-4" />
                New Document
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
