"use client";

import React, { useState } from "react";
import { ChevronDown, Plus, FolderOpen, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProject } from "./project-provider";
import { ProjectModal } from "./project-modal";

export function ProjectSwitcher() {
  const { state, switchProject, deleteProject } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<{
    id: string;
    name: string;
    description: string;
  } | null>(null);

  const currentProject = state.projects.find(
    (p) => p.id === state.activeProjectId,
  );

  const handleProjectSelect = async (projectId: string) => {
    if (projectId !== state.activeProjectId) {
      await switchProject(projectId);
    }
    setIsOpen(false);
  };

  const handleDeleteProject = async (
    e: React.MouseEvent,
    projectId: string,
  ) => {
    e.stopPropagation();
    if (state.projects.length <= 1) {
      alert("Cannot delete the last project");
      return;
    }
    if (
      confirm(
        "Are you sure you want to delete this project? This cannot be undone.",
      )
    ) {
      await deleteProject(projectId);
    }
  };

  const handleEditProject = (
    e: React.MouseEvent,
    project: (typeof state.projects)[0],
  ) => {
    e.stopPropagation();
    setEditingProject({
      id: project.id,
      name: project.name,
      description: project.description,
    });
    setIsOpen(false);
  };

  if (state.isLoading && !state.isInitialized) {
    return (
      <div className="px-1">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-white/5 animate-pulse">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-1 relative">
      {/* Current Project Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
      >
        <FolderOpen className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-medium truncate flex-1">
          {currentProject?.name || "Select Project"}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Menu */}
          <div className="absolute left-1 right-1 top-full mt-1 z-50 bg-zinc-900 border border-white/10 rounded-lg shadow-xl overflow-hidden">
            {/* Project List */}
            <div className="max-h-48 overflow-y-auto">
              {state.projects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => handleProjectSelect(project.id)}
                  className={`flex items-center gap-2 p-2 cursor-pointer hover:bg-white/5 transition-colors group ${
                    project.id === state.activeProjectId ? "bg-white/10" : ""
                  }`}
                >
                  <FolderOpen className="h-4 w-4 text-primary/70 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {project.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {project.sessionCount} chats, {project.fileCount} files
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleEditProject(e, project)}
                      className="p-1 hover:bg-white/10 rounded"
                      title="Edit project"
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground" />
                    </button>
                    {state.projects.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteProject(e, project.id)}
                        className="p-1 hover:bg-red-500/20 rounded"
                        title="Delete project"
                      >
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Create New Button */}
            <div className="border-t border-white/10 p-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setShowCreateModal(true);
                }}
                className="w-full flex items-center gap-2 p-2 rounded hover:bg-white/5 transition-colors text-primary"
              >
                <Plus className="h-4 w-4" />
                <span className="text-sm">New Project</span>
              </button>
            </div>
          </div>
        </>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <ProjectModal mode="create" onClose={() => setShowCreateModal(false)} />
      )}

      {/* Edit Modal */}
      {editingProject && (
        <ProjectModal
          mode="edit"
          projectId={editingProject.id}
          initialName={editingProject.name}
          initialDescription={editingProject.description}
          onClose={() => setEditingProject(null)}
        />
      )}
    </div>
  );
}
