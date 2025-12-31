import { NextResponse } from 'next/server';
import ProjectSystem from '@/lib/projects';

/**
 * GET /api/projects
 * List all projects with summary info
 */
export async function GET() {
  try {
    const projectSystem = new ProjectSystem();
    const projects = projectSystem.listProjects();
    const activeProjectId = projectSystem.getActiveProjectId();

    return NextResponse.json({
      success: true,
      projects,
      activeProjectId,
    });
  } catch (error) {
    console.error('Projects API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load projects' },
      { status: 500 }
    );
  }
}

interface InitialFile {
  name: string;
  content: string;
}

/**
 * POST /api/projects
 * Create a new project with optional initial file
 */
export async function POST(request: Request) {
  try {
    const { name, description, initialFile } = await request.json() as {
      name: string;
      description?: string;
      initialFile?: InitialFile;
    };

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Project name is required' },
        { status: 400 }
      );
    }

    const projectSystem = new ProjectSystem();
    const project = projectSystem.createProject(name.trim(), description?.trim() || '');

    // If initial file is provided, save it to the project
    if (initialFile && initialFile.name && initialFile.content) {
      const fileBuffer = Buffer.from(initialFile.content, 'utf-8');
      const mimeType = getMimeType(initialFile.name);
      
      const savedFile = projectSystem.saveFile(
        project.id,
        fileBuffer,
        initialFile.name,
        mimeType,
        initialFile.content // Also store as extracted content for text files
      );

      if (savedFile) {
        project.files.push(savedFile);
      }
    }

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error('Projects API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create project' },
      { status: 500 }
    );
  }
}

/**
 * Get MIME type from filename
 */
function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'md': 'text/markdown',
    'txt': 'text/plain',
    'json': 'application/json',
    'js': 'text/javascript',
    'ts': 'text/typescript',
    'tsx': 'text/typescript',
    'jsx': 'text/javascript',
    'py': 'text/x-python',
    'html': 'text/html',
    'css': 'text/css',
    'yaml': 'text/yaml',
    'yml': 'text/yaml',
  };
  return mimeTypes[ext || ''] || 'text/plain';
}
