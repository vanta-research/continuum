"use client";

import React, { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  FileText,
  Image,
  File,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Upload,
  Trash2,
  Plus,
  Folder,
  FolderOpen,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLoom } from "./loom-provider";
import { useProject } from "@/components/projects/project-provider";
import type { ProjectFile, FileTreeNode } from "@/lib/project-types";

function getFileIcon(type: string, name: string) {
  if (type.startsWith("image/"))
    return <Image className="h-4 w-4 text-blue-400 flex-shrink-0" />;
  if (type === "application/pdf")
    return <FileText className="h-4 w-4 text-red-400 flex-shrink-0" />;
  if (
    type.includes("text") ||
    type.includes("markdown") ||
    name.endsWith(".md")
  )
    return <FileText className="h-4 w-4 text-green-400 flex-shrink-0" />;
  return <File className="h-4 w-4 text-gray-400 flex-shrink-0" />;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// Simple context menu component
interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  children: React.ReactNode;
}

function ContextMenu({ x, y, onClose, children }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    // Small delay to prevent the opening click from immediately closing the menu
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] min-w-[140px] bg-zinc-900 border border-white/10 rounded-md shadow-lg py-1"
      style={{ left: x, top: y }}
    >
      {children}
    </div>,
    document.body,
  );
}

interface ContextMenuItemProps {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
}

function ContextMenuItem({
  onClick,
  icon,
  label,
  destructive,
}: ContextMenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-white/10 transition-colors ${
        destructive ? "text-red-400" : ""
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ContextMenuSeparator() {
  return <div className="h-px bg-white/10 my-1" />;
}

interface FileTreeItemProps {
  node: FileTreeNode;
  depth: number;
  onFileClick: (file: ProjectFile) => void;
  onFolderToggle: (path: string) => void;
  onDeleteFile: (fileId: string) => void;
  onDeleteFolder: (path: string) => void;
  onRenameFolder: (path: string) => void;
  onCreateFolder: (parentPath: string) => void;
  onUploadToFolder: (path: string) => void;
  onMoveFile: (fileId: string, targetFolderPath: string) => void;
  selectedFileId?: string | null;
  draggedFileId: string | null;
  setDraggedFileId: (id: string | null) => void;
  dropTargetPath: string | null;
  setDropTargetPath: (path: string | null) => void;
}

function FileTreeItem({
  node,
  depth,
  onFileClick,
  onFolderToggle,
  onDeleteFile,
  onDeleteFolder,
  onRenameFolder,
  onCreateFolder,
  onUploadToFolder,
  onMoveFile,
  selectedFileId,
  draggedFileId,
  setDraggedFileId,
  dropTargetPath,
  setDropTargetPath,
}: FileTreeItemProps) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const paddingLeft = 8 + depth * 16;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Drag and drop handlers for folders
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedFileId && node.type === "folder") {
      setDropTargetPath(node.path);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear if we're actually leaving this element
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDropTargetPath(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedFileId && node.type === "folder") {
      onMoveFile(draggedFileId, node.path);
    }
    setDraggedFileId(null);
    setDropTargetPath(null);
  };

  if (node.type === "folder") {
    const isDropTarget = dropTargetPath === node.path;

    return (
      <div>
        <div
          className={`group flex items-center gap-1 py-1 pr-1 cursor-pointer transition-colors rounded ${
            isDropTarget
              ? "bg-primary/30 ring-1 ring-primary"
              : "hover:bg-white/5"
          }`}
          style={{ paddingLeft }}
          onClick={() => onFolderToggle(node.path)}
          onContextMenu={handleContextMenu}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
            {node.isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </span>
          {node.isExpanded ? (
            <FolderOpen className="h-4 w-4 text-yellow-500 flex-shrink-0" />
          ) : (
            <Folder className="h-4 w-4 text-yellow-500 flex-shrink-0" />
          )}
          <span className="text-xs truncate flex-1 ml-1">{node.name}</span>

          <button
            type="button"
            className="p-0.5 hover:bg-white/10 rounded opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              handleContextMenu(e);
            }}
          >
            <MoreHorizontal className="h-3 w-3" />
          </button>
        </div>

        {contextMenu && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
          >
            <ContextMenuItem
              onClick={() => {
                onCreateFolder(node.path);
                setContextMenu(null);
              }}
              icon={<FolderPlus className="h-3 w-3" />}
              label="New Folder"
            />
            <ContextMenuItem
              onClick={() => {
                onUploadToFolder(node.path);
                setContextMenu(null);
              }}
              icon={<Upload className="h-3 w-3" />}
              label="Upload Here"
            />
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => {
                onRenameFolder(node.path);
                setContextMenu(null);
              }}
              icon={<Pencil className="h-3 w-3" />}
              label="Rename"
            />
            <ContextMenuItem
              onClick={() => {
                if (
                  confirm(`Delete folder "${node.name}" and all its contents?`)
                ) {
                  onDeleteFolder(node.path);
                }
                setContextMenu(null);
              }}
              icon={<Trash2 className="h-3 w-3" />}
              label="Delete"
              destructive
            />
          </ContextMenu>
        )}

        {node.isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeItem
                key={child.id}
                node={child}
                depth={depth + 1}
                onFileClick={onFileClick}
                onFolderToggle={onFolderToggle}
                onDeleteFile={onDeleteFile}
                onDeleteFolder={onDeleteFolder}
                onRenameFolder={onRenameFolder}
                onCreateFolder={onCreateFolder}
                onUploadToFolder={onUploadToFolder}
                onMoveFile={onMoveFile}
                selectedFileId={selectedFileId}
                draggedFileId={draggedFileId}
                setDraggedFileId={setDraggedFileId}
                dropTargetPath={dropTargetPath}
                setDropTargetPath={setDropTargetPath}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File node
  const file = node.file!;
  const isSelected = selectedFileId === file.id;
  const isDragging = draggedFileId === file.id;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", file.id);
    setDraggedFileId(file.id);
  };

  const handleDragEnd = () => {
    setDraggedFileId(null);
    setDropTargetPath(null);
  };

  return (
    <>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className={`group flex items-center gap-1 py-1 pr-1 cursor-pointer transition-colors rounded ${
          isSelected
            ? "bg-primary/20 text-primary"
            : isDragging
              ? "opacity-50 bg-white/10"
              : "hover:bg-white/5"
        }`}
        style={{ paddingLeft: paddingLeft + 20 }}
        onClick={() => onFileClick(file)}
        onContextMenu={handleContextMenu}
      >
        {getFileIcon(file.type, file.name)}
        <div className="flex-1 min-w-0 ml-1">
          <div className="text-xs truncate">{file.name}</div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete "${file.name}"?`)) {
              onDeleteFile(file.id);
            }
          }}
          className="p-0.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded transition-all"
          title="Delete file"
        >
          <Trash2 className="h-3 w-3 text-red-400" />
        </button>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        >
          <ContextMenuItem
            onClick={() => {
              if (confirm(`Delete "${file.name}"?`)) {
                onDeleteFile(file.id);
              }
              setContextMenu(null);
            }}
            icon={<Trash2 className="h-3 w-3" />}
            label="Delete"
            destructive
          />
        </ContextMenu>
      )}
    </>
  );
}

interface FileTreeSidebarProps {
  className?: string;
}

export function FileTreeSidebar({ className = "" }: FileTreeSidebarProps) {
  const loom = useLoom();
  const {
    state: projectState,
    deleteFile,
    getFileUrl,
    uploadFile,
    refreshActiveProject,
  } = useProject();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([]);
  const [uploadTargetFolder, setUploadTargetFolder] = useState<string>("");

  // Drag and drop state
  const [draggedFileId, setDraggedFileId] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);

  const isOpen = loom.state.fileSidebarOpen;
  const projectId = projectState.activeProjectId;

  // Fetch file tree
  const fetchFileTree = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/files`);
      if (response.ok) {
        const data = await response.json();
        setFileTree(data.tree || []);
      }
    } catch (error) {
      console.error("Failed to fetch file tree:", error);
    }
  }, [projectId]);

  // Fetch on mount and when project changes
  React.useEffect(() => {
    fetchFileTree();
  }, [fetchFileTree]);

  const handleFileClick = async (file: ProjectFile) => {
    const isEditable =
      file.type.includes("text") ||
      file.type.includes("markdown") ||
      file.name.endsWith(".md") ||
      file.name.endsWith(".txt");

    if (isEditable) {
      try {
        const response = await fetch(getFileUrl(file.id));
        if (response.ok) {
          const content = await response.text();
          loom.openFile(file.id, file.name, content);
        }
      } catch (error) {
        console.error("Failed to load file:", error);
      }
    } else if (file.content) {
      loom.openFile(file.id, file.name, file.content);
    } else {
      loom.openFile(
        file.id,
        file.name,
        `[Binary file: ${file.name}]\n\nThis file type cannot be edited directly.`,
      );
    }
  };

  const handleFolderToggle = async (folderPath: string) => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/folders`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: folderPath, action: "toggle" }),
      });
      if (response.ok) {
        const data = await response.json();
        setFileTree(data.tree || []);
      }
    } catch (error) {
      console.error("Failed to toggle folder:", error);
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    await deleteFile(fileId);
    if (loom.state.openFileId === fileId) {
      loom.closeFile();
    }
    fetchFileTree();
  };

  const handleDeleteFolder = async (folderPath: string) => {
    if (!projectId) return;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/folders?path=${encodeURIComponent(folderPath)}`,
        { method: "DELETE" },
      );
      if (response.ok) {
        const data = await response.json();
        setFileTree(data.tree || []);
        refreshActiveProject();
      }
    } catch (error) {
      console.error("Failed to delete folder:", error);
    }
  };

  const handleRenameFolder = async (folderPath: string) => {
    const currentName = folderPath.split("/").pop() || "";
    const newName = prompt("Rename folder:", currentName);
    if (!newName || newName === currentName || !projectId) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/folders`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: folderPath,
          action: "rename",
          newName,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setFileTree(data.tree || []);
        refreshActiveProject();
      }
    } catch (error) {
      console.error("Failed to rename folder:", error);
    }
  };

  const handleCreateFolder = async (parentPath: string = "") => {
    const name = prompt("Folder name:");
    if (!name || !projectId) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentPath }),
      });
      if (response.ok) {
        const data = await response.json();
        setFileTree(data.tree || []);
        refreshActiveProject();
      }
    } catch (error) {
      console.error("Failed to create folder:", error);
    }
  };

  const handleUploadClick = (folderPath: string = "") => {
    setUploadTargetFolder(folderPath);
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !projectId) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (uploadTargetFolder) {
        formData.append("folderPath", uploadTargetFolder);
      }

      const response = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setFileTree(data.tree || []);
        refreshActiveProject();
      }
    } catch (error) {
      console.error("Failed to upload file:", error);
    } finally {
      setIsUploading(false);
      setUploadTargetFolder("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleMoveFile = async (fileId: string, targetFolderPath: string) => {
    if (!projectId) return;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/files/${fileId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "move",
            targetFolderPath,
          }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        setFileTree(data.tree || []);
        refreshActiveProject();
      }
    } catch (error) {
      console.error("Failed to move file:", error);
    }
  };

  // Handle drop on root area (move to root)
  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedFileId) {
      setDropTargetPath("");
    }
  };

  const handleRootDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDropTargetPath(null);
    }
  };

  const handleRootDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedFileId) {
      handleMoveFile(draggedFileId, "");
    }
    setDraggedFileId(null);
    setDropTargetPath(null);
  };

  const handleNewDocument = () => {
    const name = prompt("Document name:", "untitled.md");
    if (name) {
      loom.openFile(`new-${Date.now()}`, name, "");
    }
  };

  if (!isOpen) {
    return (
      <div
        className={`w-8 flex flex-col items-center py-2 border-r border-white/10 bg-zinc-900/50 ${className}`}
      >
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

  const isRootDropTarget = dropTargetPath === "";

  return (
    <div
      className={`w-56 flex flex-col border-r border-white/10 bg-zinc-900/50 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b border-white/10">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Files
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleCreateFolder("")}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="New folder"
          >
            <FolderPlus className="h-3 w-3" />
          </button>
          <button
            onClick={() => loom.setFileSidebar(false)}
            className="p-1 hover:bg-white/10 rounded transition-colors"
            title="Hide files"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div
        className={`flex-1 overflow-y-auto py-1 ${
          isRootDropTarget && draggedFileId ? "bg-primary/10" : ""
        }`}
        onDragOver={handleRootDragOver}
        onDragLeave={handleRootDragLeave}
        onDrop={handleRootDrop}
      >
        {fileTree.length === 0 ? (
          <div className="p-4 text-xs text-muted-foreground text-center">
            <p className="mb-2">No files yet</p>
            <p className="text-[10px]">
              Create a folder or upload files to get started
            </p>
          </div>
        ) : (
          <div>
            {fileTree.map((node) => (
              <FileTreeItem
                key={node.id}
                node={node}
                depth={0}
                onFileClick={handleFileClick}
                onFolderToggle={handleFolderToggle}
                onDeleteFile={handleDeleteFile}
                onDeleteFolder={handleDeleteFolder}
                onRenameFolder={handleRenameFolder}
                onCreateFolder={handleCreateFolder}
                onUploadToFolder={handleUploadClick}
                onMoveFile={handleMoveFile}
                selectedFileId={loom.state.openFileId}
                draggedFileId={draggedFileId}
                setDraggedFileId={setDraggedFileId}
                dropTargetPath={dropTargetPath}
                setDropTargetPath={setDropTargetPath}
              />
            ))}
          </div>
        )}

        {/* Drop zone indicator when dragging */}
        {draggedFileId && (
          <div
            className={`mx-2 mt-2 p-2 border-2 border-dashed rounded text-center text-xs text-muted-foreground transition-colors ${
              isRootDropTarget
                ? "border-primary bg-primary/10"
                : "border-white/20"
            }`}
          >
            Drop here to move to root
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
          onClick={() => handleUploadClick("")}
          disabled={isUploading}
          className="w-full flex items-center gap-2 p-1.5 text-xs hover:bg-white/5 rounded transition-colors disabled:opacity-50"
        >
          <Upload className="h-3 w-3" />
          {isUploading ? "Uploading..." : "Upload File"}
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
