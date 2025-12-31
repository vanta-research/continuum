import { NextResponse } from 'next/server';
import ProjectSystem from '@/lib/projects';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * GET /api/projects/[projectId]
 * Get a single project with all data
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const projectSystem = new ProjectSystem();
    const project = projectSystem.loadProject(projectId);

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error('Project API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load project' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[projectId]
 * Update project metadata
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const updates = await request.json();
    const projectSystem = new ProjectSystem();

    const project = projectSystem.updateProject(projectId, {
      name: updates.name,
      description: updates.description,
      activeSessionId: updates.activeSessionId,
    });

    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error('Project API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[projectId]
 * Delete a project and all its contents
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const projectSystem = new ProjectSystem();
    const deleted = projectSystem.deleteProject(projectId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete project' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Project API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[projectId]
 * Set as active project
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const projectSystem = new ProjectSystem();

    // Verify project exists
    const project = projectSystem.loadProject(projectId);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    projectSystem.setActiveProject(projectId);

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error) {
    console.error('Project API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to set active project' },
      { status: 500 }
    );
  }
}
