'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SplitPaneProps {
  children: [React.ReactNode, React.ReactNode];
  defaultSize?: number; // percentage for left pane
  minSize?: number; // minimum percentage
  maxSize?: number; // maximum percentage
  onResize?: (size: number) => void;
  className?: string;
}

export function SplitPane({
  children,
  defaultSize = 50,
  minSize = 20,
  maxSize = 80,
  onResize,
  className,
}: SplitPaneProps) {
  const [leftSize, setLeftSize] = useState(defaultSize);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const newSize = ((e.clientX - rect.left) / rect.width) * 100;
      const clampedSize = Math.min(Math.max(newSize, minSize), maxSize);

      setLeftSize(clampedSize);
      onResize?.(clampedSize);
    },
    [isDragging, minSize, maxSize, onResize]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Sync with external size changes
  useEffect(() => {
    setLeftSize(defaultSize);
  }, [defaultSize]);

  return (
    <div
      ref={containerRef}
      className={cn('flex h-full w-full overflow-hidden', className)}
    >
      {/* Left Pane */}
      <div
        className="h-full overflow-hidden"
        style={{ width: `${leftSize}%` }}
      >
        {children[0]}
      </div>

      {/* Resize Handle */}
      <div
        className={cn(
          'resize-handle relative z-10 flex h-full w-1 cursor-col-resize items-center justify-center',
          'bg-border/30 transition-colors hover:bg-primary/50',
          isDragging && 'bg-primary/70'
        )}
        onMouseDown={handleMouseDown}
      >
        <div
          className={cn(
            'h-8 w-1 rounded-full bg-muted-foreground/30 transition-colors',
            'hover:bg-muted-foreground/50',
            isDragging && 'bg-primary'
          )}
        />
      </div>

      {/* Right Pane */}
      <div
        className="h-full flex-1 overflow-hidden"
        style={{ width: `${100 - leftSize}%` }}
      >
        {children[1]}
      </div>
    </div>
  );
}
