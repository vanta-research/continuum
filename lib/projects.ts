import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import type {
  Project,
  ProjectFile,
  ProjectSummary,
  ProjectsIndex,
  StoredSession,
} from './project-types';

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
    this.projectsDir = path.join(process.cwd(), 'data', 'projects');
    this.indexFile = path.join(this.projectsDir, 'index.json');
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
    return path.join(this.getProjectDir(projectId), 'project.json');
  }

  private getFilesDir(projectId: string): string {
    return path.join(this.getProjectDir(projectId), 'files');
  }

  // ============================================================
  // Index Operations
  // ============================================================

  loadIndex(): ProjectsIndex {
    try {
      if (fs.existsSync(this.indexFile)) {
        const data = fs.readFileSync(this.indexFile, 'utf-8');
        const parsed = JSON.parse(data);
        // Handle legacy format where index.json was just an array
        if (Array.isArray(parsed)) {
          return { projects: parsed, activeProjectId: undefined };
        }
        // Ensure proper structure
        if (parsed && typeof parsed === 'object') {
          return {
            projects: Array.isArray(parsed.projects) ? parsed.projects : [],
            activeProjectId: parsed.activeProjectId,
          };
        }
      }
    } catch (error) {
      console.error('Error loading projects index:', error);
    }
    return { projects: [], activeProjectId: undefined };
  }

  private saveIndex(index: ProjectsIndex): void {
    try {
      const data = JSON.stringify(index, null, 2);
      fs.writeFileSync(this.indexFile, data, 'utf-8');
    } catch (error) {
      console.error('Error saving projects index:', error);
    }
  }

  // ============================================================
  // Project CRUD
  // ============================================================

  /**
   * Create a new project
   */
  createProject(name: string, description: string = ''): Project {
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
      activeSessionId: undefined,
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
        const data = fs.readFileSync(projectFile, 'utf-8');
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
      fs.writeFileSync(projectFile, data, 'utf-8');

      // Update index with new timestamp
      const index = this.loadIndex();
      const indexEntry = index.projects.find(p => p.id === project.id);
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
  updateProject(projectId: string, updates: Partial<Pick<Project, 'name' | 'description' | 'activeSessionId'>>): Project | null {
    const project = this.loadProject(projectId);
    if (!project) return null;

    if (updates.name !== undefined) project.name = updates.name;
    if (updates.description !== undefined) project.description = updates.description;
    if (updates.activeSessionId !== undefined) project.activeSessionId = updates.activeSessionId;

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
      index.projects = index.projects.filter(p => p.id !== projectId);
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

    return index.projects.map(indexEntry => {
      const project = this.loadProject(indexEntry.id);
      return {
        id: indexEntry.id,
        name: indexEntry.name,
        description: project?.description || '',
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

    const existingIndex = project.sessions.findIndex(s => s.id === session.id);
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
    project.sessions = project.sessions.filter(s => s.id !== sessionId);

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
    return project.sessions.find(s => s.id === sessionId) || null;
  }

  // ============================================================
  // File Operations
  // ============================================================

  /**
   * Save a file to a project
   */
  saveFile(
    projectId: string,
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    extractedContent?: string
  ): ProjectFile | null {
    const project = this.loadProject(projectId);
    if (!project) return null;

    const fileId = `file_${uuidv4().slice(0, 8)}`;
    const ext = path.extname(originalName) || this.getExtensionFromMime(mimeType);
    const fileName = `${fileId}${ext}`;
    const relativePath = `files/${fileName}`;
    const absolutePath = path.join(this.getProjectDir(projectId), relativePath);

    // Ensure files directory exists
    const filesDir = this.getFilesDir(projectId);
    if (!fs.existsSync(filesDir)) {
      fs.mkdirSync(filesDir, { recursive: true });
    }

    // Write file to disk
    fs.writeFileSync(absolutePath, fileBuffer);

    const projectFile: ProjectFile = {
      id: fileId,
      name: originalName,
      type: mimeType,
      size: fileBuffer.length,
      path: relativePath,
      uploadedAt: Date.now(),
      content: extractedContent,
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

    const file = project.files.find(f => f.id === fileId);
    if (!file) return null;

    return path.join(this.getProjectDir(projectId), file.path);
  }

  /**
   * Get file metadata
   */
  getFile(projectId: string, fileId: string): ProjectFile | null {
    const project = this.loadProject(projectId);
    if (!project) return null;
    return project.files.find(f => f.id === fileId) || null;
  }

  /**
   * Delete a file from a project
   */
  deleteFile(projectId: string, fileId: string): boolean {
    const project = this.loadProject(projectId);
    if (!project) return false;

    const file = project.files.find(f => f.id === fileId);
    if (!file) return false;

    // Delete file from disk
    const absolutePath = path.join(this.getProjectDir(projectId), file.path);
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    // Remove from project
    project.files = project.files.filter(f => f.id !== fileId);
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
   * Update file content (for text files)
   */
  updateFileContent(projectId: string, fileId: string, content: string): boolean {
    const project = this.loadProject(projectId);
    if (!project) return false;

    const file = project.files.find(f => f.id === fileId);
    if (!file) return false;

    // Write content to file on disk
    const absolutePath = path.join(this.getProjectDir(projectId), file.path);
    try {
      fs.writeFileSync(absolutePath, content, 'utf-8');

      // Update size and content in metadata
      file.size = Buffer.from(content, 'utf-8').length;
      file.content = content;

      this.saveProject(project);
      return true;
    } catch (error) {
      console.error('Failed to update file content:', error);
      return false;
    }
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  private getExtensionFromMime(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'text/markdown': '.md',
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    return mimeMap[mimeType] || '';
  }

  /**
   * Create default project if none exist
   */
  ensureDefaultProject(): Project {
    const index = this.loadIndex();
    if (index.projects.length === 0) {
      return this.createProject('My First Project', 'Welcome to Continuum! This is your first project.');
    }
    return this.loadProject(index.projects[0].id)!;
  }
}

export default ProjectSystem;
