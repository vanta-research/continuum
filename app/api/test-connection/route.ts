import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverUrl } = body;

    if (!serverUrl) {
      return NextResponse.json(
        { error: 'Server URL is required' },
        { status: 400 }
      );
    }

    const response = await fetch(`${serverUrl}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }).catch(() => null);

    if (response && response.ok) {
      return NextResponse.json({
        connected: true,
        message: 'Successfully connected to LLaMA server',
      });
    }

    const healthResponse = await fetch(`${serverUrl}/completion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1,
      }),
    }).catch(() => null);

    if (healthResponse && healthResponse.ok) {
      return NextResponse.json({
        connected: true,
        message: 'Successfully connected to LLaMA server',
      });
    }

    return NextResponse.json({
      connected: false,
      error: 'Failed to connect to LLaMA server',
    });
  } catch (error) {
    console.error('Test connection error:', error);
    return NextResponse.json(
      {
        connected: false,
        error: 'Failed to connect to LLaMA server',
      },
      { status: 503 }
    );
  }
}
