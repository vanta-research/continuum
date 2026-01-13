import { NextResponse } from 'next/server';
import ModelSystem from '@/lib/models';
import fs from 'fs';
import path from 'path';

export async function POST(request: Request) {
  try {
    const { modelId, fileName, downloadUrl, size, quantization, token } =
      await request.json();

    if (!modelId || !fileName || !downloadUrl) {
      return NextResponse.json(
        {
          success: false,
          error: 'modelId, fileName, and downloadUrl are required',
        },
        { status: 400 }
      );
    }

    const modelSystem = new ModelSystem();

    // Check if already downloaded
    if (modelSystem.isModelDownloaded(modelId, fileName)) {
      return NextResponse.json({
        success: true,
        message: 'Model already downloaded',
        alreadyExists: true,
        model: modelSystem
          .getLocalModels()
          .find((m) => m.modelId === modelId && m.fileName === fileName),
      });
    }

    // Set up headers for the download
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Start the download
    const response = await fetch(downloadUrl, { headers });

    if (!response.ok) {
      throw new Error(
        `Download failed: ${response.status} ${response.statusText}`
      );
    }

    // Get the file path
    const filePath = modelSystem.getModelPath(fileName);

    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Stream the response to a file
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    // Register the model in the index
    const localModel = modelSystem.registerDownloadedModel(
      modelId,
      fileName,
      size || buffer.length,
      quantization || 'Unknown'
    );

    return NextResponse.json({
      success: true,
      message: 'Model downloaded successfully',
      model: localModel,
    });
  } catch (error) {
    console.error('Error downloading model:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to download model',
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check download status / if model exists
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const fileName = searchParams.get('fileName');

    if (!modelId || !fileName) {
      return NextResponse.json(
        {
          success: false,
          error: 'modelId and fileName are required',
        },
        { status: 400 }
      );
    }

    const modelSystem = new ModelSystem();
    const isDownloaded = modelSystem.isModelDownloaded(modelId, fileName);

    return NextResponse.json({
      success: true,
      isDownloaded,
      model: isDownloaded
        ? modelSystem
            .getLocalModels()
            .find((m) => m.modelId === modelId && m.fileName === fileName)
        : null,
    });
  } catch (error) {
    console.error('Error checking model status:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to check model status',
      },
      { status: 500 }
    );
  }
}
