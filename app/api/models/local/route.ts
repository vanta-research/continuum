import { NextResponse } from 'next/server';
import ModelSystem from '@/lib/models';

export async function GET() {
  try {
    const modelSystem = new ModelSystem();
    const models = modelSystem.getLocalModels();

    return NextResponse.json({
      success: true,
      models,
      count: models.length,
      modelsDirectory: modelSystem.getModelsDirectory(),
    });
  } catch (error) {
    console.error('Error fetching local models:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch local models',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { modelId, fileName } = await request.json();

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
    const deleted = modelSystem.deleteLocalModel(modelId, fileName);

    if (deleted) {
      return NextResponse.json({
        success: true,
        message: 'Model deleted successfully',
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: 'Model not found or could not be deleted',
        },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error('Error deleting model:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete model',
      },
      { status: 500 }
    );
  }
}
