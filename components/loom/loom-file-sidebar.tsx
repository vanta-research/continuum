'use client';

import React, { useState, useRef } from 'react';
import { FileText, Image, File, ChevronLeft, ChevronRight, Upload, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLoom } from './loom-provider';
import { useProject } from '@/components/projects/project-provider';
import type { ProjectFile } from '@/lib/project-types';

function getFileIcon(type: string) {
  if (type.startsWith('image/')) return <Image className="h-4 w-4 text-blue-400" />;
  if (type === 'application/pdf') return <FileText className="h-4 w-4 text-red-400" />;
  if (type.includes('text') || type.includes('markdown')) return <FileText className="h-4 w-4 text-green-400" />;
  return <File className="h-4 w-4 text-gray-400" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

interface LoomFileSidebarProps {
  className?: string;
}

export function LoomFileSidebar({ className = '' }: LoomFileSidebarProps) {
  const loom = useLoom();
  const { state: projectState, deleteFile, getFileUrl, uploadFile } = useProject();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const files = projectState.activeProject?.files || [];
  const isOpen = loom.state.fileSidebarOpen;

  const handleFileClick = async (file: ProjectFile) => {
    // Check if it's a text-based file we can edit
    const isEditable = file.type.includes('text') ||
                       file.type.includes('markdown') ||
                       file.name.endsWith('.md') ||
                       file.name.endsWith('.txt');

    if (isEditable) {
      // Fetch the file content
      try {
        const response = await fetch(getFileUrl(file.id));
        if (response.ok) {
          const content = await response.text();
          loom.openFile(file.id, file.name, content);
        }
      } catch (error) {
        console.error('Failed to load file:', error);
      }
    } else if (file.content) {
      // Use extracted content for PDFs etc
      loom.openFile(file.id, file.name, file.content);
    } else {
      // For images or other binary files, show a placeholder
      loom.openFile(file.id, file.name, `[Binary file: ${file.name}]\n\nThis file type cannot be edited directly.`);
    }
  };

  const handleDeleteFile = async (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    if (confirm('Delete this file?')) {
      await deleteFile(fileId);
      if (loom.state.openFileId === fileId) {
        loom.closeFile();
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectState.activeProject) return;

    setIsUploading(true);
    try {
      // Use uploadFile from provider - this updates state immediately
      await uploadFile(file);
    } catch (error) {
      console.error('Failed to upload file:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleNewDocument = () => {
    const name = prompt('Document name:', 'untitled.md');
    if (name) {
      loom.openFile(`new-${Date.now()}`, name, '');
    }
  };

  if (!isOpen) {
    return (
      <div className={`w-8 flex flex-col items-center py-2 border-r border-white/10 bg-zinc-900/50 ${className}`}>
        <button
          onClick={() => loom.setFileSidebar(true)}
          className="p-1.5 hover:bg-white/10 rounded transition-colors"
          title="Show files"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className={`w-48 flex flex-col border-r border-white/10 bg-zinc-900/50 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-white/10">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Files</span>
        <button
          onClick={() => loom.setFileSidebar(false)}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          title="Hide files"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-1">
        {files.length === 0 ? (
          <div className="p-2 text-xs text-muted-foreground text-center">
            No files yet
          </div>
        ) : (
          <div className="space-y-0.5">
            {files.map((file) => (
              <div
                key={file.id}
                onClick={() => handleFileClick(file)}
                className={`group flex items-center gap-2 p-1.5 rounded cursor-pointer transition-colors ${
                  loom.state.openFileId === file.id
                    ? 'bg-purple-500/20 text-purple-200'
                    : 'hover:bg-white/5'
                }`}
              >
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <div className="text-xs truncate">{file.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatFileSize(file.size)}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDeleteFile(e, file.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
                  title="Delete file"
                >
                  <Trash2 className="h-3 w-3 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-2 border-t border-white/10 space-y-1">
        <button
          onClick={handleNewDocument}
          className="w-full flex items-center gap-2 p-1.5 text-xs hover:bg-white/5 rounded transition-colors"
        >
          <Plus className="h-3 w-3" />
          New Document
        </button>
        <button
          onClick={handleUploadClick}
          disabled={isUploading}
          className="w-full flex items-center gap-2 p-1.5 text-xs hover:bg-white/5 rounded transition-colors disabled:opacity-50"
        >
          <Upload className="h-3 w-3" />
          {isUploading ? 'Uploading...' : 'Upload File'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileUpload}
          accept=".txt,.md,.pdf,image/*"
        />
      </div>
    </div>
  );
}
