import { NextResponse } from 'next/server';
import ModelSystem from '@/lib/models';

export async function POST(request: Request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          valid: false,
          error: 'No token provided',
        },
        { status: 400 }
      );
    }

    const modelSystem = new ModelSystem();
    const validation = await modelSystem.validateHFToken(token);

    return NextResponse.json({
      success: true,
      valid: validation.valid,
      username: validation.username,
      error: validation.error,
    });
  } catch (error) {
    console.error('Error validating token:', error);
    return NextResponse.json(
      {
        success: false,
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to validate token',
      },
      { status: 500 }
    );
  }
}
