'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface MemoryEntry {
  id: string;
  timestamp: number;
  type: 'conversation' | 'learning' | 'preference';
  content: string;
  context: string;
  importance: number;
  tags?: string[];
}

export default function MemoryPage() {
  const [stats, setStats] = useState({
    total: 0,
    byType: {} as Record<string, number>
  });
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMemory() {
      try {
        const response = await fetch('/api/memory');
        if (!response.ok) {
          throw new Error('Failed to load memory');
        }
        const data = await response.json();
        
        if (data.success) {
          setStats(data.stats);
          setMemories(data.memories);
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (error) {
        console.error('Error loading memory:', error);
        setError(error instanceof Error ? error.message : 'Failed to load memory');
      } finally {
        setLoading(false);
      }
    }

    loadMemory();
  }, []);

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Memory & Context</h1>
        <Link href="/">
          <Button variant="outline">Back to Chat</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
            <p className="text-sm text-muted-foreground">Total Memories</p>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{stats.byType.learning || 0}</CardTitle>
            <p className="text-sm text-muted-foreground">Learnings</p>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">{stats.byType.preference || 0}</CardTitle>
            <p className="text-sm text-muted-foreground">Preferences</p>
          </CardHeader>
        </Card>
      </div>

      <div className="flex gap-4 mb-6">
            <Button variant="outline" onClick={() => {
              alert('Memory extraction would run here');
            }}>
              Extract Learnings from Recent Chats
            </Button>

            <Button variant="destructive" onClick={async () => {
              if (confirm('Are you sure you want to clear all memory?')) {
                try {
                  const response = await fetch('/api/memory', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ action: 'clear' })
                  });
                  
                  if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                      alert('Memory cleared!');
                      window.location.reload();
                    } else {
                      alert('Failed to clear memory: ' + (data.error || 'Unknown error'));
                    }
                  } else {
                    alert('Failed to clear memory');
                  }
                } catch (error) {
                  console.error('Error clearing memory:', error);
                  alert('Error clearing memory');
                }
              }
            }}>
              Clear All Memory
            </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Learned Memories</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground">Loading memories...</p>
          ) : error ? (
            <p className="text-destructive">Error: {error}</p>
          ) : memories.length === 0 ? (
            <p className="text-muted-foreground">No learned memories yet. Start chatting and the AI will learn from your interactions!</p>
          ) : (
            <div className="space-y-4">
              {memories.map((memoryEntry) => (
                <div key={memoryEntry.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <span className="px-2 py-1 bg-secondary text-secondary-foreground text-xs rounded-full">
                      {memoryEntry.type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(memoryEntry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="font-medium mb-1">Context: {memoryEntry.context}</p>
                  <p className="text-sm">{memoryEntry.content}</p>
                  {memoryEntry.tags && memoryEntry.tags.length > 0 && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {memoryEntry.tags.map(tag => (
                        <span key={tag} className="px-2 py-1 bg-background border border-border text-xs rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
