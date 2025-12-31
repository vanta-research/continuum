import { NextResponse } from 'next/server';
import ProjectSystem from '@/lib/projects';
import type { StoredSession } from '@/lib/project-types';

interface RouteParams {
  params: Promise<{ projectId: string; sessionId: string }>;
}

/**
 * GET /api/projects/[projectId]/sessions/[sessionId]
 * Get a specific session
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { projectId, sessionId } = await params;
    const projectSystem = new ProjectSystem();
    const session = projectSystem.getSession(projectId, sessionId);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('Session API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load session' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[projectId]/sessions/[sessionId]
 * Update a session (auto-save)
 */
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { projectId, sessionId } = await params;
    const { session } = await request.json() as { session: StoredSession };

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session data is required' },
        { status: 400 }
      );
    }

    // Ensure the session ID matches
    if (session.id !== sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID mismatch' },
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
    console.error('Session API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[projectId]/sessions/[sessionId]
 * Delete a session
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { projectId, sessionId } = await params;
    const projectSystem = new ProjectSystem();
    const deleted = projectSystem.deleteSession(projectId, sessionId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Session API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
