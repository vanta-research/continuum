import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { fileName } = await request.json();

    if (!fileName) {
      return NextResponse.json(
        { success: false, error: 'fileName is required' },
        { status: 400 }
      );
    }

    // Sanitize the filename to prevent path traversal
    const sanitizedFileName = path.basename(fileName);
    const modelsDir = path.join(process.cwd(), 'data', 'models');
    const partFilePath = path.join(modelsDir, `${sanitizedFileName}.part`);

    // Delete the partial file if it exists
    if (fs.existsSync(partFilePath)) {
      fs.unlinkSync(partFilePath);
      return NextResponse.json({
        success: true,
        message: 'Partial download file cleaned up',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'No partial file found to clean up',
    });
  } catch (error) {
    console.error('Error cancelling download:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel download',
      },
      { status: 500 }
    );
  }
}
