import { NextResponse } from 'next/server';
import ModelSystem from '@/lib/models';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const token = searchParams.get('token');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    // Token is required for HuggingFace search
    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: 'HuggingFace token is required for searching models',
        },
        { status: 401 }
      );
    }

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        {
          success: false,
          error: 'Search query must be at least 2 characters',
        },
        { status: 400 }
      );
    }

    const modelSystem = new ModelSystem();
    const results = await modelSystem.searchHuggingFaceModels(
      query.trim(),
      token,
      Math.min(limit, 50) // Cap at 50 results max
    );

    return NextResponse.json({
      success: true,
      results,
      count: results.length,
      query: query.trim(),
    });
  } catch (error) {
    console.error('Error searching HuggingFace models:', error);

    const errorMessage = error instanceof Error ? error.message : 'Search failed';
    const status = errorMessage.includes('token') ? 401 : 500;

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status }
    );
  }
}
