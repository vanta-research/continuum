'use client';

import React from 'react';
import { useLoom } from './loom-provider';
import { cn } from '@/lib/utils';

interface ModelTypingIndicatorProps {
  modelName?: string;
  className?: string;
}

export function ModelTypingIndicator({
  modelName = 'Model',
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
        'absolute bottom-4 left-4 z-10',
        'flex items-center gap-2 px-3 py-2',
        'rounded-full border border-purple-500/30 bg-purple-500/10 backdrop-blur-sm',
        'text-sm text-purple-300',
        className
      )}
    >
      <span className="font-medium">{modelName}</span>
      <span className="text-purple-400">is editing line {modelEdit.targetLine}</span>
      <div className="flex gap-0.5">
        <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
