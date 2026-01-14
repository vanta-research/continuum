"use client";

import React from "react";
import { useLoom } from "./loom-provider";
import { cn } from "@/lib/utils";

interface ModelTypingIndicatorProps {
  modelName?: string;
  className?: string;
}

export function ModelTypingIndicator({
  modelName = "Model",
  className,
}: ModelTypingIndicatorProps) {
  const { state } = useLoom();
  const { modelEdit } = state;

  if (!modelEdit.isEditing) {
    return null;
  }

  return (
    <div
      className={cn(
        "absolute bottom-4 left-4 z-10",
        "flex items-center gap-2 px-3 py-2",
        "rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm",
        "text-sm text-primary",
        className,
      )}
    >
      <span className="font-medium">{modelName}</span>
      <span className="text-primary">
        is editing line {modelEdit.targetLine}
      </span>
      <div className="flex gap-0.5">
        <div
          className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <div
          className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <div
          className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}
