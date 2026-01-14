"use client";

import React, { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useProject } from "./project-provider";

interface ProjectModalProps {
  mode: "create" | "edit";
  projectId?: string;
  initialName?: string;
  initialDescription?: string;
  onClose: () => void;
}

export function ProjectModal({
  mode,
  projectId,
  initialName = "",
  initialDescription = "",
  onClose,
}: ProjectModalProps) {
  const { createProject, updateProject } = useProject();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert("Project name is required");
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === "create") {
        await createProject(name.trim(), description.trim());
      } else if (mode === "edit" && projectId) {
        await updateProject(projectId, {
          name: name.trim(),
          description: description.trim(),
        });
      }
      onClose();
    } catch (error) {
      console.error("Failed to save project:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "Create New Project" : "Edit Project"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="project-name"
              className="text-sm font-medium text-muted-foreground"
            >
              Project Name
            </label>
            <Input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Project"
              className="bg-white/5 border-white/10"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="project-description"
              className="text-sm font-medium text-muted-foreground"
            >
              Description (optional)
            </label>
            <Textarea
              id="project-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this project about?"
              className="bg-white/5 border-white/10 resize-none h-20"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting
                ? "Saving..."
                : mode === "create"
                  ? "Create Project"
                  : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
