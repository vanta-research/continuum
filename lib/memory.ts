import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Memory types
interface MemoryEntry {
  id: string;
  timestamp: number;
  type: 'conversation' | 'learning' | 'preference';
  content: string;
  context: string;
  importance: number;
  tags?: string[];
}

interface UserMemory {
  userId: string;
  entries: MemoryEntry[];
  lastUpdated: number;
}

class MemorySystem {
  private memoryDir: string;
  private memoryFile: string;

  constructor(userId: string = 'default') {
    this.memoryDir = path.join(process.cwd(), 'data', 'memory');
    this.memoryFile = path.join(this.memoryDir, `${userId}.json`);
    
    // Ensure directory exists
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true });
    }
  }

  // Load memory from file
  loadMemory(): UserMemory {
    try {
      if (fs.existsSync(this.memoryFile)) {
        const data = fs.readFileSync(this.memoryFile, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading memory:', error);
    }
    
    // Return empty memory if file doesn't exist or can't be read
    return { userId: 'default', entries: [], lastUpdated: Date.now() };
  }

  // Save memory to file
  saveMemory(memory: UserMemory): void {
    try {
      const data = JSON.stringify(memory, null, 2);
      fs.writeFileSync(this.memoryFile, data, 'utf-8');
    } catch (error) {
      console.error('Error saving memory:', error);
    }
  }

  // Add a new memory entry
  addMemoryEntry(type: 'conversation' | 'learning' | 'preference', 
                content: string, 
                context: string = '',
                importance: number = 1,
                tags: string[] = []): MemoryEntry {
    
    const memory = this.loadMemory();
    
    const entry: MemoryEntry = {
      id: uuidv4(),
      timestamp: Date.now(),
      type,
      content,
      context,
      importance,
      tags
    };
    
    memory.entries.push(entry);
    memory.lastUpdated = Date.now();
    
    this.saveMemory(memory);
    return entry;
  }

  // Get relevant memories based on current context
  getRelevantMemories(currentContext: string, limit: number = 3): MemoryEntry[] {
    const memory = this.loadMemory();
    
    // Simple relevance scoring - could be enhanced with embeddings
    const scoredEntries = memory.entries.map(entry => {
      let score = 0;
      
      // Score based on context similarity
      if (entry.context && currentContext) {
        const contextMatch = this.simpleTextSimilarity(entry.context, currentContext);
        score += contextMatch * entry.importance;
      }
      
      // Score based on content similarity
      if (entry.content) {
        const contentMatch = this.simpleTextSimilarity(entry.content, currentContext);
        score += contentMatch * entry.importance;
      }
      
      // Boost recent memories
      const timeDecay = Math.max(0, 1 - (Date.now() - entry.timestamp) / (1000 * 60 * 60 * 24 * 7));
      score *= (1 + timeDecay);
      
      return { ...entry, score };
    });
    
    // Sort by score and return top results
    return scoredEntries
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ score, ...rest }) => rest); // Remove score from result
  }

  // Simple text similarity (could be replaced with proper embeddings)
  private simpleTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = [...new Set([...words1, ...words2])].length;
    
    return totalWords > 0 ? commonWords.length / totalWords : 0;
  }

  // Get all memories of a specific type
  getMemoriesByType(type: 'conversation' | 'learning' | 'preference'): MemoryEntry[] {
    const memory = this.loadMemory();
    return memory.entries.filter(entry => entry.type === type);
  }

  // Extract learnings from conversation
  async extractLearningsFromConversation(conversation: string): Promise<string[]> {
    // This would ideally use the AI model to extract key learnings
    // For now, implement a simple version
    
    const learnings: string[] = [];
    
    // Look for patterns like "I prefer", "I like", "My favorite", etc.
    const preferencePatterns = [
      /I prefer ([^.!?]+)/i,
      /I like ([^.!?]+)/i,
      /My favorite ([^.!?]+)/i,
      /I always ([^.!?]+)/i,
      /I never ([^.!?]+)/i
    ];
    
    for (const pattern of preferencePatterns) {
      const match = conversation.match(pattern);
      if (match && match[1]) {
        learnings.push(`User preference: ${match[1].trim()}`);
      }
    }
    
    return learnings;
  }

  // Get memory statistics
  getMemoryStats(): { total: number; byType: Record<string, number> } {
    const memory = this.loadMemory();
    const byType: Record<string, number> = {};
    
    memory.entries.forEach(entry => {
      byType[entry.type] = (byType[entry.type] || 0) + 1;
    });
    
    return {
      total: memory.entries.length,
      byType
    };
  }

  // Clear all memory
  clearMemory(): void {
    const emptyMemory: UserMemory = {
      userId: 'default',
      entries: [],
      lastUpdated: Date.now()
    };
    
    this.saveMemory(emptyMemory);
  }
}

export default MemorySystem;
