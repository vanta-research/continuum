"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useCanvas } from "./canvas-provider";

interface ModelTypingIndicatorProps {
  modelName?: string;
  className?: string;
}

export function ModelTypingIndicator({
  modelName = "Model",
  className,
}: ModelTypingIndicatorProps) {
  const { state } = useCanvas();
  const { modelEdit } = state;

  if (!modelEdit.isEditing) {
    return null;
  }

  return (
    <div
      className={cn(
        "typing-indicator-canvas",
        "absolute bottom-4 left-4 z-10",
        "flex items-center gap-2",
        "px-3 py-2 rounded-lg",
        "bg-background/80 backdrop-blur-md",
        "border border-border/50",
        "shadow-lg shadow-primary/10",
        "text-sm font-medium",
        "animate-in fade-in slide-in-from-bottom-2 duration-200",
        className,
      )}
    >
      <span className="text-primary">{modelName}</span>
      <span className="text-muted-foreground">is editing</span>
      {modelEdit.targetLine && (
        <span className="text-primary">line {modelEdit.targetLine}</span>
      )}
      <span className="flex gap-0.5 ml-1">
        <span
          className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </span>
    </div>
  );
}
