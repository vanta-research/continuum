import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import type {
  Project,
  ProjectFile,
  ProjectFolder,
  ProjectSummary,
  ProjectsIndex,
  StoredSession,
  FileTreeNode,
} from "./project-types";

/**
 * ProjectSystem - Manages project storage following the MemorySystem pattern
 *
 * Storage layout:
 *   data/projects/
 *     index.json                 # List of all projects
 *     {project-id}/
 *       project.json             # Project metadata + sessions
 *       files/
 *         {file-id}.{ext}        # Uploaded files
 */
class ProjectSystem {
  private projectsDir: string;
  private indexFile: string;

  constructor() {
    this.projectsDir = path.join(process.cwd(), "data", "projects");
    this.indexFile = path.join(this.projectsDir, "index.json");
    this.ensureDirectoryExists();
  }

  // ============================================================
  // Directory Management
  // ============================================================

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.projectsDir)) {
      fs.mkdirSync(this.projectsDir, { recursive: true });
    }
  }

  private getProjectDir(projectId: string): string {
    return path.join(this.projectsDir, projectId);
  }

  private getProjectFile(projectId: string): string {
    return path.join(this.getProjectDir(projectId), "project.json");
  }

  private getFilesDir(projectId: string): string {
    return path.join(this.getProjectDir(projectId), "files");
  }

  // ============================================================
  // Index Operations
  // ============================================================

  loadIndex(): ProjectsIndex {
    try {
      if (fs.existsSync(this.indexFile)) {
        const data = fs.readFileSync(this.indexFile, "utf-8");
        const parsed = JSON.parse(data);
        // Handle legacy format where index.json was just an array
        if (Array.isArray(parsed)) {
          return { projects: parsed, activeProjectId: undefined };
        }
        // Ensure proper structure
        if (parsed && typeof parsed === "object") {
          return {
            projects: Array.isArray(parsed.projects) ? parsed.projects : [],
            activeProjectId: parsed.activeProjectId,
          };
        }
      }
    } catch (error) {
      console.error("Error loading projects index:", error);
    }
    return { projects: [], activeProjectId: undefined };
  }

  private saveIndex(index: ProjectsIndex): void {
    try {
      const data = JSON.stringify(index, null, 2);
      fs.writeFileSync(this.indexFile, data, "utf-8");
    } catch (error) {
      console.error("Error saving projects index:", error);
    }
  }

  // ============================================================
  // Project CRUD
  // ============================================================

  /**
   * Create a new project
   */
  createProject(name: string, description: string = ""): Project {
    const projectId = `proj_${uuidv4().slice(0, 8)}`;
    const now = Date.now();

    const project: Project = {
      id: projectId,
      name,
      description,
      createdAt: now,
      updatedAt: now,
      sessions: [],
      files: [],
      folders: [],
      activeSessionId: undefined,
      expandedFolders: [],
    };

    // Create project directory and files directory
    const projectDir = this.getProjectDir(projectId);
    const filesDir = this.getFilesDir(projectId);
    fs.mkdirSync(projectDir, { recursive: true });
    fs.mkdirSync(filesDir, { recursive: true });

    // Save project file
    this.saveProject(project);

    // Update index
    const index = this.loadIndex();
    index.projects.unshift({
      id: projectId,
      name,
      updatedAt: now,
    });
    // Set as active if it's the first project
    if (!index.activeProjectId) {
      index.activeProjectId = projectId;
    }
    this.saveIndex(index);

    return project;
  }

  /**
   * Load a project by ID
   */
  loadProject(projectId: string): Project | null {
    try {
      const projectFile = this.getProjectFile(projectId);
      if (fs.existsSync(projectFile)) {
        const data = fs.readFileSync(projectFile, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(`Error loading project ${projectId}:`, error);
    }
    return null;
  }

  /**
   * Save a project
   */
  saveProject(project: Project): void {
    try {
      project.updatedAt = Date.now();
      const projectFile = this.getProjectFile(project.id);
      const data = JSON.stringify(project, null, 2);
      fs.writeFileSync(projectFile, data, "utf-8");

      // Update index with new timestamp
      const index = this.loadIndex();
      const indexEntry = index.projects.find((p) => p.id === project.id);
      if (indexEntry) {
        indexEntry.name = project.name;
        indexEntry.updatedAt = project.updatedAt;
        this.saveIndex(index);
      }
    } catch (error) {
      console.error(`Error saving project ${project.id}:`, error);
    }
  }

  /**
   * Update project metadata
   */
  updateProject(
    projectId: string,
    updates: Partial<Pick<Project, "name" | "description" | "activeSessionId">>,
  ): Project | null {
    const project = this.loadProject(projectId);
    if (!project) return null;

    if (updates.name !== undefined) project.name = updates.name;
    if (updates.description !== undefined)
      project.description = updates.description;
    if (updates.activeSessionId !== undefined)
      project.activeSessionId = updates.activeSessionId;

    this.saveProject(project);
    return project;
  }

  /**
   * Delete a project and all its contents
   */
  deleteProject(projectId: string): boolean {
    try {
      const projectDir = this.getProjectDir(projectId);
      if (fs.existsSync(projectDir)) {
        fs.rmSync(projectDir, { recursive: true, force: true });
      }

      // Update index
      const index = this.loadIndex();
      index.projects = index.projects.filter((p) => p.id !== projectId);
      if (index.activeProjectId === projectId) {
        index.activeProjectId = index.projects[0]?.id;
      }
      this.saveIndex(index);

      return true;
    } catch (error) {
      console.error(`Error deleting project ${projectId}:`, error);
      return false;
    }
  }

  /**
   * List all projects with summary info
   */
  listProjects(): ProjectSummary[] {
    const index = this.loadIndex();

    return index.projects.map((indexEntry) => {
      const project = this.loadProject(indexEntry.id);
      return {
        id: indexEntry.id,
        name: indexEntry.name,
        description: project?.description || "",
        updatedAt: indexEntry.updatedAt,
        sessionCount: project?.sessions.length || 0,
        fileCount: project?.files.length || 0,
      };
    });
  }

  /**
   * Get/set active project
   */
  getActiveProjectId(): string | undefined {
    return this.loadIndex().activeProjectId;
  }

  setActiveProject(projectId: string): void {
    const index = this.loadIndex();
    index.activeProjectId = projectId;
    this.saveIndex(index);
  }

  // ============================================================
  // Session Operations
  // ============================================================

  /**
   * Save or update a session in a project
   */
  saveSession(projectId: string, session: StoredSession): StoredSession | null {
    const project = this.loadProject(projectId);
    if (!project) return null;

    const existingIndex = project.sessions.findIndex(
      (s) => s.id === session.id,
    );
    if (existingIndex >= 0) {
      project.sessions[existingIndex] = session;
    } else {
      project.sessions.unshift(session);
    }

    this.saveProject(project);
    return session;
  }

  /**
   * Delete a session from a project
   */
  deleteSession(projectId: string, sessionId: string): boolean {
    const project = this.loadProject(projectId);
    if (!project) return false;

    const initialLength = project.sessions.length;
    project.sessions = project.sessions.filter((s) => s.id !== sessionId);

    if (project.sessions.length < initialLength) {
      // Update active session if we deleted it
      if (project.activeSessionId === sessionId) {
        project.activeSessionId = project.sessions[0]?.id;
      }
      this.saveProject(project);
      return true;
    }
    return false;
  }

  /**
   * Get a specific session
   */
  getSession(projectId: string, sessionId: string): StoredSession | null {
    const project = this.loadProject(projectId);
    if (!project) return null;
    return project.sessions.find((s) => s.id === sessionId) || null;
  }

  // ============================================================
  // File Operations
  // ============================================================

  /**
   * Save a file to a project (optionally in a folder)
   */
  saveFile(
    projectId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    extractedContent?: string,
    folderPath?: string,
  ): ProjectFile | null {
    const project = this.loadProject(projectId);
    if (!project) return null;

    const fileId = `file_${uuidv4().slice(0, 8)}`;
    const ext =
      path.extname(originalName) || this.getExtensionFromMime(mimeType);

    // Use original name with a unique suffix if needed to avoid collisions
    const baseName = path.basename(originalName, ext);
    let fileName = originalName;
    let relativePath = folderPath
      ? `files/${folderPath}/${fileName}`
      : `files/${fileName}`;
    let absolutePath = path.join(this.getProjectDir(projectId), relativePath);

    // Handle name collisions by appending a number
    let counter = 1;
    while (fs.existsSync(absolutePath)) {
      fileName = `${baseName} (${counter})${ext}`;
      relativePath = folderPath
        ? `files/${folderPath}/${fileName}`
        : `files/${fileName}`;
      absolutePath = path.join(this.getProjectDir(projectId), relativePath);
      counter++;
    }

    // Ensure directory exists
    const targetDir = path.dirname(absolutePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Write file to disk
    fs.writeFileSync(absolutePath, fileBuffer);

    const projectFile: ProjectFile = {
      id: fileId,
      name: fileName,
      type: mimeType,
      size: fileBuffer.length,
      path: relativePath,
      uploadedAt: Date.now(),
      content: extractedContent,
      parentPath: folderPath || "",
    };

    project.files.push(projectFile);
    this.saveProject(project);

    return projectFile;
  }

  /**
   * Get the absolute path to a file
   */
  getFilePath(projectId: string, fileId: string): string | null {
    const project = this.loadProject(projectId);
    if (!project) return null;

    const file = project.files.find((f) => f.id === fileId);
    if (!file) return null;

    return path.join(this.getProjectDir(projectId), file.path);
  }

  /**
   * Get file metadata
   */
  getFile(projectId: string, fileId: string): ProjectFile | null {
    const project = this.loadProject(projectId);
    if (!project) return null;
    return project.files.find((f) => f.id === fileId) || null;
  }

  /**
   * Delete a file from a project
   */
  deleteFile(projectId: string, fileId: string): boolean {
    const project = this.loadProject(projectId);
    if (!project) return false;

    const file = project.files.find((f) => f.id === fileId);
    if (!file) return false;

    // Delete file from disk
    const absolutePath = path.join(this.getProjectDir(projectId), file.path);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    // Remove from project
    project.files = project.files.filter((f) => f.id !== fileId);
    this.saveProject(project);

    return true;
  }

  /**
   * List all files in a project
   */
  listFiles(projectId: string): ProjectFile[] {
    const project = this.loadProject(projectId);
    return project?.files || [];
  }

  /**
   * List all folders in a project
   */
  listFolders(projectId: string): ProjectFolder[] {
    const project = this.loadProject(projectId);
    return project?.folders || [];
  }

  // ============================================================
  // Folder Operations
  // ============================================================

  /**
   * Create a folder in a project
   */
  createFolder(
    projectId: string,
    folderPath: string,
    name: string,
  ): ProjectFolder | null {
    const project = this.loadProject(projectId);
    if (!project) return null;

    // Initialize folders array if it doesn't exist
    if (!project.folders) {
      project.folders = [];
    }

    // Normalize the full path
    const fullPath = folderPath ? `${folderPath}/${name}` : name;

    // Check if folder already exists
    if (project.folders.some((f) => f.path === fullPath)) {
      return project.folders.find((f) => f.path === fullPath) || null;
    }

    const folderId = `folder_${uuidv4().slice(0, 8)}`;
    const folder: ProjectFolder = {
      id: folderId,
      name,
      path: fullPath,
      parentPath: folderPath,
      createdAt: Date.now(),
      isExpanded: true,
    };

    // Create the actual directory on disk
    const absolutePath = path.join(this.getFilesDir(projectId), fullPath);
    if (!fs.existsSync(absolutePath)) {
      fs.mkdirSync(absolutePath, { recursive: true });
    }

    project.folders.push(folder);
    this.saveProject(project);

    return folder;
  }

  /**
   * Delete a folder and all its contents
   */
  deleteFolder(projectId: string, folderPath: string): boolean {
    const project = this.loadProject(projectId);
    if (!project) return false;

    // Remove folder from project metadata
    project.folders = (project.folders || []).filter(
      (f) => f.path !== folderPath && !f.path.startsWith(`${folderPath}/`),
    );

    // Remove all files in this folder
    project.files = project.files.filter((f) => {
      const fileFolderPath = f.parentPath || "";
      return (
        fileFolderPath !== folderPath &&
        !fileFolderPath.startsWith(`${folderPath}/`)
      );
    });

    // Delete the actual directory from disk
    const absolutePath = path.join(this.getFilesDir(projectId), folderPath);
    if (fs.existsSync(absolutePath)) {
      fs.rmSync(absolutePath, { recursive: true, force: true });
    }

    this.saveProject(project);
    return true;
  }

  /**
   * Rename a folder
   */
  renameFolder(
    projectId: string,
    oldPath: string,
    newName: string,
  ): ProjectFolder | null {
    const project = this.loadProject(projectId);
    if (!project) return null;

    const folder = (project.folders || []).find((f) => f.path === oldPath);
    if (!folder) return null;

    const parentPath = folder.parentPath;
    const newPath = parentPath ? `${parentPath}/${newName}` : newName;

    // Rename on disk
    const oldAbsolutePath = path.join(this.getFilesDir(projectId), oldPath);
    const newAbsolutePath = path.join(this.getFilesDir(projectId), newPath);

    if (fs.existsSync(oldAbsolutePath)) {
      fs.renameSync(oldAbsolutePath, newAbsolutePath);
    }

    // Update folder metadata
    folder.name = newName;
    folder.path = newPath;

    // Update all child folders' paths
    project.folders = (project.folders || []).map((f) => {
      if (f.path.startsWith(`${oldPath}/`)) {
        return {
          ...f,
          path: f.path.replace(oldPath, newPath),
          parentPath:
            f.parentPath === oldPath
              ? newPath
              : f.parentPath.replace(`${oldPath}/`, `${newPath}/`),
        };
      }
      return f;
    });

    // Update all files' paths in this folder
    project.files = project.files.map((f) => {
      if (f.parentPath === oldPath || f.parentPath?.startsWith(`${oldPath}/`)) {
        const newParentPath =
          f.parentPath === oldPath
            ? newPath
            : f.parentPath.replace(`${oldPath}/`, `${newPath}/`);
        const newFilePath = f.path.replace(
          `files/${oldPath}/`,
          `files/${newPath}/`,
        );
        return {
          ...f,
          path: newFilePath,
          parentPath: newParentPath,
        };
      }
      return f;
    });

    this.saveProject(project);
    return folder;
  }

  /**
   * Move a file to a different folder
   */
  moveFile(
    projectId: string,
    fileId: string,
    targetFolderPath: string,
  ): ProjectFile | null {
    const project = this.loadProject(projectId);
    if (!project) return null;

    const file = project.files.find((f) => f.id === fileId);
    if (!file) return null;

    // Get the filename
    const fileName = path.basename(file.path);

    // Calculate new path
    const newRelativePath = targetFolderPath
      ? `files/${targetFolderPath}/${fileName}`
      : `files/${fileName}`;

    // Move file on disk
    const oldAbsolutePath = path.join(this.getProjectDir(projectId), file.path);
    const newAbsolutePath = path.join(
      this.getProjectDir(projectId),
      newRelativePath,
    );

    // Ensure target directory exists
    const targetDir = path.dirname(newAbsolutePath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (fs.existsSync(oldAbsolutePath)) {
      fs.renameSync(oldAbsolutePath, newAbsolutePath);
    }

    // Update file metadata
    file.path = newRelativePath;
    file.parentPath = targetFolderPath;

    this.saveProject(project);
    return file;
  }

  /**
   * Toggle folder expanded state
   */
  toggleFolderExpanded(projectId: string, folderPath: string): boolean {
    const project = this.loadProject(projectId);
    if (!project) return false;

    if (!project.expandedFolders) {
      project.expandedFolders = [];
    }

    const index = project.expandedFolders.indexOf(folderPath);
    if (index >= 0) {
      project.expandedFolders.splice(index, 1);
    } else {
      project.expandedFolders.push(folderPath);
    }

    this.saveProject(project);
    return index < 0; // Return new expanded state
  }

  /**
   * Build a tree structure from files and folders
   */
  buildFileTree(projectId: string): FileTreeNode[] {
    const project = this.loadProject(projectId);
    if (!project) return [];

    const expandedFolders = new Set(project.expandedFolders || []);
    const tree: FileTreeNode[] = [];
    const nodeMap = new Map<string, FileTreeNode>();

    // Create folder nodes first
    const sortedFolders = [...(project.folders || [])].sort(
      (a, b) => a.path.split("/").length - b.path.split("/").length,
    );

    for (const folder of sortedFolders) {
      const node: FileTreeNode = {
        id: folder.id,
        name: folder.name,
        path: folder.path,
        type: "folder",
        children: [],
        folder,
        isExpanded: expandedFolders.has(folder.path),
      };
      nodeMap.set(folder.path, node);

      if (!folder.parentPath) {
        tree.push(node);
      } else {
        const parentNode = nodeMap.get(folder.parentPath);
        if (parentNode && parentNode.children) {
          parentNode.children.push(node);
        }
      }
    }

    // Add file nodes
    for (const file of project.files) {
      const node: FileTreeNode = {
        id: file.id,
        name: file.name,
        path: file.path,
        type: "file",
        file,
      };

      const parentPath = file.parentPath || "";
      if (!parentPath) {
        tree.push(node);
      } else {
        const parentNode = nodeMap.get(parentPath);
        if (parentNode && parentNode.children) {
          parentNode.children.push(node);
        } else {
          // Parent folder doesn't exist in metadata, add to root
          tree.push(node);
        }
      }
    }

    // Sort: folders first, then alphabetically
    const sortNodes = (nodes: FileTreeNode[]) => {
      nodes.sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "folder" ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      for (const node of nodes) {
        if (node.children) {
          sortNodes(node.children);
        }
      }
    };
    sortNodes(tree);

    return tree;
  }

  /**
   * Update file content (for text files)
   */
  updateFileContent(
    projectId: string,
    fileId: string,
    content: string,
  ): boolean {
    const project = this.loadProject(projectId);
    if (!project) return false;

    const file = project.files.find((f) => f.id === fileId);
    if (!file) return false;

    // Write content to file on disk
    const absolutePath = path.join(this.getProjectDir(projectId), file.path);
    try {
      fs.writeFileSync(absolutePath, content, "utf-8");

      // Update size and content in metadata
      file.size = Buffer.from(content, "utf-8").length;
      file.content = content;

      this.saveProject(project);
      return true;
    } catch (error) {
      console.error("Failed to update file content:", error);
      return false;
    }
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  private getExtensionFromMime(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      "application/pdf": ".pdf",
      "text/plain": ".txt",
      "text/markdown": ".md",
      "image/png": ".png",
      "image/jpeg": ".jpg",
      "image/gif": ".gif",
      "image/webp": ".webp",
    };
    return mimeMap[mimeType] || "";
  }

  /**
   * Create default project if none exist
   */
  ensureDefaultProject(): Project {
    const index = this.loadIndex();
    if (index.projects.length === 0) {
      return this.createProject(
        "My First Project",
        "Welcome to Continuum! This is your first project.",
      );
    }
    return this.loadProject(index.projects[0].id)!;
  }
}

export default ProjectSystem;
