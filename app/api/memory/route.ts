import { NextResponse } from 'next/server';
import MemorySystem from '@/lib/memory';
import path from 'path';

export async function GET() {
  try {
    const memoryDir = path.join(process.cwd(), 'data', 'memory');
    const memory = new MemorySystem();
    const stats = memory.getMemoryStats();
    const allMemories = memory.getMemoriesByType('learning');
    
    return NextResponse.json({
      success: true,
      stats,
      memories: allMemories
    });
  } catch (error) {
    console.error('Memory API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to load memory'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { action } = await request.json();
    const memoryDir = path.join(process.cwd(), 'data', 'memory');
    const memory = new MemorySystem();
    
    if (action === 'clear') {
      memory.clearMemory();
      return NextResponse.json({
        success: true,
        message: 'Memory cleared successfully'
      });
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 });
    
  } catch (error) {
    console.error('Memory API error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to process memory action'
    }, { status: 500 });
  }
}
