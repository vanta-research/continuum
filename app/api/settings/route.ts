import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverUrl, temperature, maxTokens, streamResponse } = body;

    if (serverUrl) {
      process.env.LLAMA_SERVER_URL = serverUrl;
    }

    return NextResponse.json({
      success: true,
      settings: {
        serverUrl: serverUrl || process.env.LLAMA_SERVER_URL || 'http://localhost:8080',
        temperature,
        maxTokens,
        streamResponse,
      },
    });
  } catch (error) {
    console.error('Settings API error:', error);
    return NextResponse.json(
      { error: 'Failed to save settings' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    serverUrl: process.env.LLAMA_SERVER_URL || 'http://localhost:8080',
  });
}
