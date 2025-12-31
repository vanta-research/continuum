'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Send, Settings, MessageSquare, Plus, X, Brain, PanelRightOpen, PanelRightClose, ChevronDown } from 'lucide-react';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import FileUpload from '@/components/file-upload';
import { processFile, FileAttachment, formatFileSize, getFileIcon } from '@/lib/file-utils';
import { LoomProvider, useLoom } from '@/components/loom/loom-provider';
import { LoomPane } from '@/components/loom/loom-pane';
import { SplitPane } from '@/components/ui/split-pane';
import { LoomEditParser, getModelDisplayName, applyEditToDocument, parseProjectToolMarkers, cleanProjectToolMarkers, parseAddFileMarkers, cleanAddFileMarkers } from '@/lib/loom-utils';
import type { LoomDocument } from '@/lib/loom-types';
import { ProjectProvider, useProject } from '@/components/projects/project-provider';
import { ProjectSwitcher } from '@/components/projects/project-switcher';
import type { StoredSession, StoredMessage, StoredLoomDocument } from '@/lib/project-types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  attachments?: FileAttachment[];
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: Date;
  loomDocument?: LoomDocument;
}

// Helper functions to convert between ChatSession and StoredSession
function sessionToStored(session: ChatSession): StoredSession {
  return {
    id: session.id,
    title: session.title,
    timestamp: session.timestamp.getTime(),
    messages: session.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      attachments: m.attachments?.map(a => ({
        fileId: a.id,
        name: a.name,
        type: a.type,
        size: a.size,
      })),
      timestamp: m.timestamp.getTime(),
    })),
    loomDocument: session.loomDocument ? {
      id: session.loomDocument.id,
      title: session.loomDocument.title,
      content: session.loomDocument.content,
      createdAt: session.loomDocument.createdAt.getTime(),
      updatedAt: session.loomDocument.updatedAt.getTime(),
    } : undefined,
  };
}

function storedToSession(stored: StoredSession): ChatSession {
  return {
    id: stored.id,
    title: stored.title,
    timestamp: new Date(stored.timestamp),
    messages: stored.messages.map(m => ({
      id: m.id,
      role: m.role,
      content: m.content,
      attachments: m.attachments?.map(a => ({
        id: a.fileId,
        name: a.name,
        type: a.type,
        size: a.size,
      })),
      timestamp: new Date(m.timestamp),
    })),
    loomDocument: stored.loomDocument ? {
      id: stored.loomDocument.id,
      title: stored.loomDocument.title,
      content: stored.loomDocument.content,
      createdAt: new Date(stored.loomDocument.createdAt),
      updatedAt: new Date(stored.loomDocument.updatedAt),
    } : undefined,
  };
}

// Inner component that uses loom context
function ChatInterfaceInner() {
  const loom = useLoom();
  const { state: projectState, saveSession, deleteSession: projectDeleteSession, createProject, switchProject, refreshProjects, refreshActiveProject, uploadFile } = useProject();
  const loomEditParserRef = useRef(new LoomEditParser());

  // State for project creation notification
  const [projectCreatedNotification, setProjectCreatedNotification] = useState<{
    show: boolean;
    projectName: string;
    projectId: string;
  } | null>(null);

  // Derive sessions from project state
  const projectSessions: ChatSession[] = projectState.activeProject?.sessions.map(storedToSession) || [];

  // Local state for sessions (synced with project)
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: '1',
      title: 'New Chat',
      messages: [],
      timestamp: new Date(),
    },
  ]);
  const [currentSessionId, setCurrentSessionId] = useState('1');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState('atom');
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSavedRef = useRef<string>('');
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const isNearBottomRef = useRef(true);

  // Sync sessions from project when project loads
  useEffect(() => {
    if (projectState.activeProject && projectState.isInitialized) {
      const converted = projectState.activeProject.sessions.map(storedToSession);
      if (converted.length > 0) {
        setSessions(converted);
        // Set current session to active or first
        const activeId = projectState.activeProject.activeSessionId || converted[0].id;
        setCurrentSessionId(activeId);
      } else {
        // Create a new session if project has none
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: 'New Chat',
          messages: [],
          timestamp: new Date(),
        };
        setSessions([newSession]);
        setCurrentSessionId(newSession.id);
      }
    }
  }, [projectState.activeProject?.id, projectState.isInitialized]);

  const currentSession = sessions.find((s) => s.id === currentSessionId) || sessions[0];

  // Auto-save current session when messages change
  useEffect(() => {
    if (!projectState.activeProject || !currentSession) return;

    // Create a signature of the current session for change detection
    const sessionSignature = JSON.stringify({
      id: currentSession.id,
      title: currentSession.title,
      messageCount: currentSession.messages.length,
      lastMessageContent: currentSession.messages[currentSession.messages.length - 1]?.content || '',
    });

    // Skip if nothing changed
    if (sessionSignature === lastSavedRef.current) return;
    lastSavedRef.current = sessionSignature;

    // Save to project (debounced by the provider)
    const storedSession = sessionToStored(currentSession);
    saveSession(storedSession);
  }, [currentSession, projectState.activeProject, saveSession]);

  // Check if user is near the bottom of the scroll area
  const checkIfNearBottom = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return true;
    const threshold = 100; // pixels from bottom
    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    return distanceFromBottom < threshold;
  }, []);

  // Handle scroll events to detect when user scrolls up
  const handleScroll = useCallback(() => {
    const nearBottom = checkIfNearBottom();
    isNearBottomRef.current = nearBottom;
    setIsUserScrolledUp(!nearBottom);
  }, [checkIfNearBottom]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (viewport) {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: 'smooth'
      });
      setIsUserScrolledUp(false);
      isNearBottomRef.current = true;
    }
  }, []);

  // Auto-scroll during streaming only if user is near bottom
  useEffect(() => {
    // Only auto-scroll if user hasn't scrolled up
    if (isNearBottomRef.current && scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
    }
  }, [currentSession.messages]);

  // Reset scroll state when switching sessions
  useEffect(() => {
    setIsUserScrolledUp(false);
    isNearBottomRef.current = true;
    // Scroll to bottom when switching sessions
    setTimeout(() => {
      if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTop = scrollViewportRef.current.scrollHeight;
      }
    }, 50);
  }, [currentSessionId]);

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [],
      timestamp: new Date(),
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setInput('');
    setAttachments([]);
  };

  const handleAddFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert('File size must be less than 10MB');
      return;
    }
    const attachment = await processFile(file);
    setAttachments([...attachments, attachment]);
  };

  const handleRemoveFile = (id: string) => {
    setAttachments(attachments.filter(a => a.id !== id));
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      timestamp: new Date(),
    };

    setSessions(prevSessions => {
      return prevSessions.map(session =>
        session.id === currentSessionId
          ? {
              ...session,
              messages: [...session.messages, userMessage],
              title: session.messages.length === 0 ? (input.trim() || 'File upload').slice(0, 50) : session.title,
            }
          : session
      );
    });

    setInput('');
    setAttachments([]);
    setIsLoading(true);

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setSessions(prevSessions => {
      return prevSessions.map(session =>
        session.id === currentSessionId
          ? { ...session, messages: [...session.messages, assistantMessage] }
          : session
      );
    });

    try {
      // Build loom context if loom mode is active
      const loomPayload = loom.state.isLoomMode && loom.state.document
        ? {
            loomEnabled: true,
            loomContext: {
              content: loom.state.document.content,
              cursorLine: loom.state.userCursor.line,
              lineCount: loom.state.document.content.split('\n').length,
            },
          }
        : { loomEnabled: false };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
         body: JSON.stringify({
           message: userMessage.content,
           sessionId: currentSessionId,
           model: selectedModel,
           attachments: userMessage.attachments,
           webSearchEnabled: webSearchEnabled,
           // Send conversation history (excluding the message we just added)
           history: currentSession.messages.slice(0, -1).map(m => ({
             role: m.role,
             content: m.content,
           })),
           ...loomPayload,
         }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to send message (${response.status})`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = ''; // Accumulate complete response

      const isLoomActive = loom.state.isLoomMode && loom.state.document;

      // Helper to clean loom edit markers from text for display
      const cleanLoomMarkers = (text: string): string => {
        // Remove complete loom edit blocks (model still uses CANVAS_EDIT markers)
        let cleaned = text.replace(/\[CANVAS_EDIT_START:\d+\][\s\S]*?\[CANVAS_EDIT_END\]/g, '');
        // Remove partial/incomplete start markers (in case we're mid-stream)
        cleaned = cleaned.replace(/\[CANVAS_EDIT_START:\d+\][\s\S]*$/, '');
        // Remove any trailing partial marker that might be forming
        cleaned = cleaned.replace(/\[CANVAS_EDIT_START[^\]]*$/, '');
        cleaned = cleaned.replace(/\[CANVAS[^\]]*$/, '');
        cleaned = cleaned.replace(/\[[^\]]*$/, ''); // Any incomplete bracket
        return cleaned.trim();
      };

      // Helper to clean all tool markers from text for display
      const cleanAllToolMarkers = (text: string): string => {
        let cleaned = cleanLoomMarkers(text);
        cleaned = cleanProjectToolMarkers(cleaned);
        cleaned = cleanAddFileMarkers(cleaned);
        return cleaned;
      };

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed === '' || trimmed === '[DONE]') {
            continue;
          }

          if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            try {
              const parsed = JSON.parse(data);
              const content = parsed.content;
              if (content) {
                fullResponse += content;

                // Update chat with cleaned content (all tool markers stripped out)
                const displayContent = cleanAllToolMarkers(fullResponse);

                setSessions(prevSessions => {
                  return prevSessions.map(session =>
                    session.id === currentSessionId
                      ? {
                          ...session,
                          messages: session.messages.map(msg =>
                            msg.id === assistantMessage.id
                              ? { ...msg, content: displayContent }
                              : msg
                          )
                        }
                      : session
                  );
                });
              }
            } catch (e) {
              console.error('Error parsing SSE data:', e, 'Line:', trimmed);
            }
          }
        }
      }

      // After streaming completes, extract and apply loom edits
      if (isLoomActive) {
        const editMatch = fullResponse.match(/\[CANVAS_EDIT_START:(\d+)\]([\s\S]*?)\[CANVAS_EDIT_END\]/);

        if (editMatch) {
          const targetLine = parseInt(editMatch[1], 10);
          const editContent = editMatch[2].trim();

          // Apply edit to loom
          const currentDocContent = loom.state.document?.content || '';
          const newContent = applyEditToDocument(currentDocContent, targetLine, editContent);
          loom.updateContent(newContent);

          // Final cleanup of chat message
          const cleanedMessage = cleanLoomMarkers(fullResponse);
          setSessions(prevSessions => {
            return prevSessions.map(s =>
              s.id === currentSessionId
                ? {
                    ...s,
                    messages: s.messages.map(msg =>
                      msg.id === assistantMessage.id
                        ? { ...msg, content: cleanedMessage || 'Done! I\'ve updated the Loom for you.' }
                        : msg
                    )
                  }
                : s
            );
          });
        }
      }

      // After streaming completes, check for project creation tool
      const projectToolResult = parseProjectToolMarkers(fullResponse);
      if (projectToolResult.found && projectToolResult.payload) {
        try {
          // Create the project via API (with initial file support)
          const response = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: projectToolResult.payload.name,
              description: projectToolResult.payload.description || '',
              initialFile: projectToolResult.payload.initialFile,
            }),
          });
          
          const data = await response.json();
          
          if (data.success && data.project) {
            // Refresh project list and switch to the new project
            await refreshProjects();
            await switchProject(data.project.id);

            // Show notification
            setProjectCreatedNotification({
              show: true,
              projectName: data.project.name,
              projectId: data.project.id,
            });
            
            // Auto-hide notification after 5 seconds
            setTimeout(() => {
              setProjectCreatedNotification(null);
            }, 5000);
            
            // Update the message to show cleaned content
            const cleanedContent = projectToolResult.cleanedContent || 
              `I've created the project "${data.project.name}" for you! You can find it in the project switcher.`;
            
            setSessions(prevSessions => {
              return prevSessions.map(s =>
                s.id === currentSessionId
                  ? {
                      ...s,
                      messages: s.messages.map(msg =>
                        msg.id === assistantMessage.id
                          ? { ...msg, content: cleanedContent }
                          : msg
                      )
                    }
                  : s
              );
            });
          }
        } catch (error) {
          console.error('Failed to create project from AI response:', error);
        }
      }

      // Check for ADD_FILE tool in response
      const addFileResult = parseAddFileMarkers(fullResponse);
      if (addFileResult.found && addFileResult.payload && projectState.activeProjectId) {
        try {
          const fileName = addFileResult.payload.name;
          // Determine MIME type from file extension
          const ext = fileName.split('.').pop()?.toLowerCase() || '';
          const mimeTypes: Record<string, string> = {
            'md': 'text/markdown',
            'txt': 'text/plain',
            'js': 'text/javascript',
            'ts': 'text/typescript',
            'jsx': 'text/jsx',
            'tsx': 'text/tsx',
            'py': 'text/x-python',
            'json': 'application/json',
            'html': 'text/html',
            'css': 'text/css',
            'yaml': 'text/yaml',
            'yml': 'text/yaml',
          };
          const mimeType = mimeTypes[ext] || 'text/plain';

          const blob = new Blob([addFileResult.payload.content], { type: mimeType });
          const file = new File([blob], fileName, { type: mimeType });

          // Use uploadFile from project provider - this updates state immediately
          const uploadedFile = await uploadFile(file);

          if (uploadedFile) {
            // Update the message to show cleaned content
            const cleanedContent = addFileResult.cleanedContent ||
              `I've created the file "${fileName}" in your workspace.`;

            setSessions(prevSessions => {
              return prevSessions.map(s =>
                s.id === currentSessionId
                  ? {
                      ...s,
                      messages: s.messages.map(msg =>
                        msg.id === assistantMessage.id
                          ? { ...msg, content: cleanedContent }
                          : msg
                      )
                    }
                  : s
              );
            });
          } else {
            console.error('Failed to create file');
          }
        } catch (error) {
          console.error('Failed to create file from AI response:', error);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setSessions(prevSessions => {
        return prevSessions.map(session =>
          session.id === currentSessionId
            ? {
                ...session,
                messages: session.messages.map((msg, idx) =>
                  idx === session.messages.length - 1 && msg.role === 'assistant'
                    ? { ...msg, content: `⚠️ Error: ${errorMessage}`, isLoading: false }
                    : msg
                ),
              }
            : session
        );
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (sessions.length === 1) return;
    const filtered = sessions.filter((s) => s.id !== sessionId);
    setSessions(filtered);
    if (currentSessionId === sessionId) {
      setCurrentSessionId(filtered[0].id);
    }
    // Also delete from project
    await projectDeleteSession(sessionId);
  };

  return (
    <div className="flex h-screen w-full bg-gradient-to-br from-background via-background to-zinc-950/50">
      {/* Project Created Notification */}
      {projectCreatedNotification?.show && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2 fade-in duration-300">
          <Card className="glass border-primary/30 shadow-lg shadow-primary/10">
            <div className="flex items-center gap-3 p-4">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">Project Created!</p>
                <p className="text-xs text-muted-foreground">
                  "{projectCreatedNotification.projectName}"
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={async () => {
                  await switchProject(projectCreatedNotification.projectId);
                  setProjectCreatedNotification(null);
                }}
              >
                Switch to Project
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setProjectCreatedNotification(null)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </Card>
        </div>
      )}
      
      {sidebarOpen && (
        <aside className="flex h-full w-80 flex-col border-r border-border/50 glass-strong">
          <div className="flex h-16 items-center justify-between border-b border-border/50 px-4">
            <div className="flex items-center gap-3">
              <div className="relative h-15 w-15 flex items-center justify-center">
                <Image
                  src="/images/logo-icon.png"
                  alt="VANTA Research"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="text-lg font-semibold tracking-wide">Continuum</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Project Switcher */}
          <div className="border-b border-border/50 py-3">
            <ProjectSwitcher />
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <Button
              onClick={handleNewChat}
              className="w-full justify-start gap-2 glass"
              variant="outline"
            >
              <Plus className="h-4 w-4" />
              New Chat
            </Button>

            <div className="mt-4 space-y-2">
              {sessions.map((session) => (
                <Card
                  key={session.id}
                  className="cursor-pointer border-0 transition-all hover:bg-accent/50 bg-transparent"
                  onClick={() => setCurrentSessionId(session.id)}
                >
                  <div className="flex items-center justify-between p-3">
                    <div className="flex-1 truncate text-sm font-medium">
                      {session.title || 'New Chat'}
                    </div>
                    {sessions.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <div className="border-t border-border/50 p-4 space-y-3">
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">Model</label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-full bg-background/50">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="atom">Atom (Local)</SelectItem>
                  <SelectItem value="atom-large-experimental">Atom-Large-Experimental</SelectItem>
                  <SelectItem value="loux-large-experimental">Loux-Large-Experimental</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">Web Search</label>
                <span className="relative">
                  <span className="text-xs text-yellow-400 cursor-help">ⓘ</span>
                  <span className="absolute -left-20 bottom-6 w-60 p-2 bg-background border border-border/50 rounded-md text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                    Enable real-time web search. 
                    <span className="font-semibold">Configure Google API</span> in .env.search for real results.
                  </span>
                </span>
              </div>
              <Switch
                checked={webSearchEnabled}
                onCheckedChange={setWebSearchEnabled}
                className="data-[state=checked]:bg-primary"
              />
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2"
              onClick={() => loom.toggleLoomMode()}
            >
              {loom.state.isLoomMode ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
              {loom.state.isLoomMode ? 'Close Loom' : 'Open Loom'}
            </Button>
            <Link href="/memory">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Brain className="h-4 w-4" />
                Memory & Context
              </Button>
            </Link>
            <Button variant="ghost" className="w-full justify-start gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </Button>
          </div>
        </aside>
      )}

      <main className="flex flex-1 flex-col">
        {!sidebarOpen && (
          <div className="flex h-16 items-center justify-between border-b border-border/50 px-6 glass">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="mr-4"
              >
                <MessageSquare className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="relative h-15 w-15 flex items-center justify-center">
                  <Image
                    src="/images/logo-icon.png"
                    alt="VANTA Research"
                    fill
                    className="object-contain"
                  />
                </div>
                <span className="text-lg font-semibold">Continuum</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => loom.toggleLoomMode()}
              className="h-9 w-9"
              title={loom.state.isLoomMode ? 'Close Loom' : 'Open Loom'}
            >
              {loom.state.isLoomMode ? (
                <PanelRightClose className="h-5 w-5" />
              ) : (
                <PanelRightOpen className="h-5 w-5" />
              )}
            </Button>
          </div>
        )}

        {/* Main content area - conditionally split when loom is open */}
        {loom.state.isLoomMode ? (
          <SplitPane
            defaultSize={loom.state.paneWidth}
            onResize={(size) => loom.setPaneWidth(size)}
            className="flex-1"
          >
            {/* Left pane: Chat */}
            <div className="flex h-full flex-col relative">
              <ScrollArea className="flex-1 p-6" ref={scrollAreaRef} viewportRef={scrollViewportRef} onScroll={handleScroll}>
                <div className="mx-auto max-w-4xl space-y-3">
                  {currentSession.messages.length === 0 ? (
                    <div className="flex min-h-[calc(100vh-16rem)] flex-col items-center justify-center text-center">
                      <h2 className="mb-2 text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                        Welcome to Continuum
                      </h2>
                      <p className="mb-4 text-sm font-medium tracking-wider text-muted-foreground/80 uppercase">
                        by VANTA Research
                      </p>
                      <p className="max-w-md text-lg text-muted-foreground leading-relaxed">
                        Start a conversation. Ask questions, get insights, and explore new ideas.
                      </p>
                    </div>
                  ) : (
                    currentSession.messages.map((message) => (
                      <div
                        key={message.id}
                        className={'flex ' + (message.role === 'user' ? 'justify-end' : 'justify-start')}
                      >
                        <div className={'max-w-[85%] ' + (message.role === 'user' ? 'ml-auto' : 'mr-auto')}>
                          <Card
                            className={'glass backdrop-blur-xl border-0 ' + (message.role === 'user' ? 'bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 shadow-md shadow-primary/5 rounded-2xl' : 'bg-gradient-to-br from-purple-500/20 via-primary/15 to-primary/10 shadow-md shadow-purple-500/10 rounded-2xl')}
                          >
                            <div className="px-4 py-3">
                              {message.role === 'assistant' && !message.content && !message.attachments && (
                                <div className="flex gap-1.5">
                                  <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500" style={{ animationDelay: '0ms' }} />
                                  <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500" style={{ animationDelay: '150ms' }} />
                                  <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500" style={{ animationDelay: '300ms' }} />
                                </div>
                              )}
                              {message.attachments && message.attachments.length > 0 && (
                                <div className="mb-3 space-y-2">
                                  {message.attachments.map((attachment) => (
                                    <div
                                      key={attachment.id}
                                      className="flex items-center gap-3 rounded-xl bg-background/50 border border-border/30 p-2.5"
                                    >
                                      {attachment.type.startsWith('image/') && attachment.base64 ? (
                                        <div className="relative h-16 w-16 overflow-hidden rounded-lg shadow-sm">
                                          <Image
                                            src={attachment.base64}
                                            alt={attachment.name}
                                            fill
                                            className="object-cover"
                                          />
                                        </div>
                                      ) : (
                                        <span className="text-2xl">
                                          {getFileIcon(attachment.type)}
                                        </span>
                                      )}
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{attachment.name}</p>
                                        <p className="text-xs text-muted-foreground/70">
                                          {formatFileSize(attachment.size)}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {message.content && (
                                <div className="prose prose-sm prose-invert dark:prose-invert max-w-none">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {message.content}
                                  </ReactMarkdown>
                                </div>
                              )}
                            </div>
                          </Card>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Scroll to bottom button */}
              {isUserScrolledUp && (
                <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-10">
                  <Button
                    onClick={scrollToBottom}
                    size="sm"
                    className="rounded-full shadow-lg bg-background/90 backdrop-blur-sm border border-border/50 hover:bg-background text-foreground gap-1 px-3"
                  >
                    <ChevronDown className="h-4 w-4" />
                    <span className="text-xs">New messages</span>
                  </Button>
                </div>
              )}

              <div className="border-t border-border/30 p-4 bg-background/20 backdrop-blur-xl">
                <div className="space-y-3">
                  <FileUpload
                    attachments={attachments}
                    onAddFile={handleAddFile}
                    onRemoveFile={handleRemoveFile}
                    disabled={isLoading}
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Message Continuum..."
                        className="min-h-[50px] resize-none bg-background/60 backdrop-blur-md border-border/30 focus:border-primary/50 transition-colors"
                        disabled={isLoading}
                      />
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={(!input.trim() && attachments.length === 0) || isLoading}
                      className="h-[50px] w-[50px] shrink-0 bg-gradient-to-br from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20 transition-all duration-200"
                      size="icon"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right pane: Loom */}
            <LoomPane
              sessionId={currentSessionId}
              modelName={getModelDisplayName(selectedModel)}
              onClose={() => loom.setLoomMode(false)}
            />
          </SplitPane>
        ) : (
          <div className="flex flex-1 flex-col relative">
            <ScrollArea className="flex-1 p-6" ref={scrollAreaRef} viewportRef={scrollViewportRef} onScroll={handleScroll}>
              <div className="mx-auto max-w-4xl space-y-3">
                {currentSession.messages.length === 0 ? (
                  <div className="flex min-h-[calc(100vh-16rem)] flex-col items-center justify-center text-center">
                    <h2 className="mb-2 text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                      Welcome to Continuum
                    </h2>
                    <p className="mb-4 text-sm font-medium tracking-wider text-muted-foreground/80 uppercase">
                      by VANTA Research
                    </p>
                    <p className="max-w-md text-lg text-muted-foreground leading-relaxed">
                      Start a conversation. Ask questions, get insights, and explore new ideas.
                    </p>
                  </div>
                ) : (
                  currentSession.messages.map((message) => (
                    <div
                      key={message.id}
                      className={'flex ' + (message.role === 'user' ? 'justify-end' : 'justify-start')}
                    >
                      <div className={'max-w-[75%] ' + (message.role === 'user' ? 'ml-auto' : 'mr-auto')}>
                        <Card
                          className={'glass backdrop-blur-xl border-0 ' + (message.role === 'user' ? 'bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 shadow-md shadow-primary/5 rounded-2xl' : 'bg-gradient-to-br from-purple-500/20 via-primary/15 to-primary/10 shadow-md shadow-purple-500/10 rounded-2xl')}
                        >
                          <div className="px-4 py-3">
                            {message.role === 'assistant' && !message.content && !message.attachments && (
                              <div className="flex gap-1.5">
                                <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500" style={{ animationDelay: '0ms' }} />
                                <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500" style={{ animationDelay: '150ms' }} />
                                <div className="h-2 w-2 animate-bounce rounded-full bg-purple-500" style={{ animationDelay: '300ms' }} />
                              </div>
                            )}
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mb-3 space-y-2">
                                {message.attachments.map((attachment) => (
                                  <div
                                    key={attachment.id}
                                    className="flex items-center gap-3 rounded-xl bg-background/50 border border-border/30 p-2.5"
                                  >
                                    {attachment.type.startsWith('image/') && attachment.base64 ? (
                                      <div className="relative h-16 w-16 overflow-hidden rounded-lg shadow-sm">
                                        <Image
                                          src={attachment.base64}
                                          alt={attachment.name}
                                          fill
                                          className="object-cover"
                                        />
                                      </div>
                                    ) : (
                                      <span className="text-2xl">
                                        {getFileIcon(attachment.type)}
                                      </span>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{attachment.name}</p>
                                      <p className="text-xs text-muted-foreground/70">
                                        {formatFileSize(attachment.size)}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {message.content && (
                              <div className="prose prose-sm prose-invert dark:prose-invert max-w-none">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {message.content}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </Card>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Scroll to bottom button */}
            {isUserScrolledUp && (
              <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10">
                <Button
                  onClick={scrollToBottom}
                  size="sm"
                  className="rounded-full shadow-lg bg-background/90 backdrop-blur-sm border border-border/50 hover:bg-background text-foreground gap-1 px-3"
                >
                  <ChevronDown className="h-4 w-4" />
                  <span className="text-xs">New messages</span>
                </Button>
              </div>
            )}

            <div className="border-t border-border/30 p-6 bg-background/20 backdrop-blur-xl">
              <div className="mx-auto max-w-4xl space-y-4">
                <FileUpload
                  attachments={attachments}
                  onAddFile={handleAddFile}
                  onRemoveFile={handleRemoveFile}
                  disabled={isLoading}
                />
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Message Continuum..."
                      className="min-h-[60px] resize-none bg-background/60 backdrop-blur-md border-border/30 focus:border-primary/50 transition-colors"
                      disabled={isLoading}
                    />
                  </div>
                  <Button
                    onClick={handleSendMessage}
                    disabled={(!input.trim() && attachments.length === 0) || isLoading}
                    className="h-[60px] w-[60px] shrink-0 bg-gradient-to-br from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20 transition-all duration-200"
                    size="icon"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
                <p className="text-center text-xs text-muted-foreground/70">
                  VANTA Research - AI for humans
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Main export wraps the inner component with providers
export default function ChatInterface() {
  return (
    <ProjectProvider>
      <LoomProvider>
        <ChatInterfaceInner />
      </LoomProvider>
    </ProjectProvider>
  );
}
