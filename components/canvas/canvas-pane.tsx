"use client";

import React, { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCanvas } from "./canvas-provider";
import { CanvasToolbar } from "./canvas-toolbar";
import { CanvasEditor } from "./canvas-editor";
import { CanvasPreview } from "./canvas-preview";
import { ModelTypingIndicator } from "./model-typing-indicator";
import { cn } from "@/lib/utils";

interface CanvasPaneProps {
  sessionId: string;
  modelName?: string;
  onClose?: () => void;
  className?: string;
}

export function CanvasPane({
  sessionId,
  modelName = "Model",
  onClose,
  className,
}: CanvasPaneProps) {
  const { state, createDocument } = useCanvas();
  const { document, modelEdit } = state;
  const [viewMode, setViewMode] = useState<"edit" | "preview">("preview");

  // Create a document if one doesn't exist when pane opens
  useEffect(() => {
    if (!document) {
      createDocument(sessionId);
    }
  }, [document, sessionId, createDocument]);

  const handleCreateDocument = () => {
    createDocument(sessionId);
  };

  return (
    <div
      className={cn(
        "canvas-pane flex h-full flex-col",
        "bg-background/30 backdrop-blur-md",
        "border-l border-border/50",
        className,
      )}
    >
      <CanvasToolbar
        onClose={onClose}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />

      <div className="relative flex-1 overflow-hidden">
        {document ? (
          <>
            {viewMode === "edit" ? (
              <CanvasEditor />
            ) : (
              <CanvasPreview content={document.content} />
            )}
            <ModelTypingIndicator modelName={modelName} />

            {/* Model edit preview overlay */}
            {modelEdit.isEditing && modelEdit.streamBuffer && (
              <div className="absolute top-4 right-4 z-10 max-w-xs">
                <div className="rounded-lg border border-primary/30 bg-primary/10 backdrop-blur-sm p-3">
                  <div className="text-xs font-medium text-primary mb-1">
                    Incoming edit:
                  </div>
                  <pre className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-auto">
                    {modelEdit.streamBuffer.slice(0, 200)}
                    {modelEdit.streamBuffer.length > 200 && "..."}
                  </pre>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center p-8">
            <div className="rounded-full bg-primary/10 p-4 mb-4">
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Document Open</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-xs">
              Create a new document to start collaborating with the AI.
            </p>
            <Button onClick={handleCreateDocument} className="gap-2">
              <Plus className="h-4 w-4" />
              New Document
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
