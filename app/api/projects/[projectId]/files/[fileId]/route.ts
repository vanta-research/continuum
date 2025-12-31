import { NextResponse } from 'next/server';
import ProjectSystem from '@/lib/projects';
import fs from 'fs';

interface RouteParams {
  params: Promise<{ projectId: string; fileId: string }>;
}

/**
 * GET /api/projects/[projectId]/files/[fileId]
 * Download a file
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { projectId, fileId } = await params;
    const projectSystem = new ProjectSystem();

    // Get file metadata
    const fileInfo = projectSystem.getFile(projectId, fileId);
    if (!fileInfo) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    // Get file path
    const filePath = projectSystem.getFilePath(projectId, fileId);
    if (!filePath || !fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: 'File not found on disk' },
        { status: 404 }
      );
    }

    // Read file and return it
    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': fileInfo.type,
        'Content-Disposition': `attachment; filename="${fileInfo.name}"`,
        'Content-Length': fileInfo.size.toString(),
      },
    });
  } catch (error) {
    console.error('File download error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to download file' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[projectId]/files/[fileId]
 * Update file content
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { projectId, fileId } = await params;
    const { content } = await request.json();

    if (typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    const projectSystem = new ProjectSystem();
    const updated = projectSystem.updateFileContent(projectId, fileId, content);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('File update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update file' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[projectId]/files/[fileId]
 * Delete a file
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { projectId, fileId } = await params;
    const projectSystem = new ProjectSystem();
    const deleted = projectSystem.deleteFile(projectId, fileId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('File delete error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete file' },
      { status: 500 }
    );
  }
}
