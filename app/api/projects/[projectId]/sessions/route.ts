import { NextResponse } from 'next/server';
import ProjectSystem from '@/lib/projects';
import type { StoredSession } from '@/lib/project-types';

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * GET /api/projects/[projectId]/sessions
 * List all sessions in a project
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
      sessions: project.sessions,
      activeSessionId: project.activeSessionId,
    });
  } catch (error) {
    console.error('Sessions API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load sessions' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[projectId]/sessions
 * Create or save a session
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const { session } = await request.json() as { session: StoredSession };

    if (!session || !session.id) {
      return NextResponse.json(
        { success: false, error: 'Session data is required' },
        { status: 400 }
      );
    }

    const projectSystem = new ProjectSystem();
    const savedSession = projectSystem.saveSession(projectId, session);

    if (!savedSession) {
      return NextResponse.json(
        { success: false, error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session: savedSession,
    });
  } catch (error) {
    console.error('Sessions API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save session' },
      { status: 500 }
    );
  }
}
