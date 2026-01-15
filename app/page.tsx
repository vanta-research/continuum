"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Send,
  Square,
  Settings,
  MessageSquare,
  Plus,
  X,
  Brain,
  PanelRightOpen,
  PanelRightClose,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  RefreshCw,
  Pencil,
  FileText,
} from "lucide-react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import FileUpload from "@/components/file-upload";
import {
  processFile,
  FileAttachment,
  formatFileSize,
  getFileIcon,
} from "@/lib/file-utils";
import { LoomProvider, useLoom } from "@/components/loom/loom-provider";
import { LoomPane } from "@/components/loom/loom-pane";
import { SplitPane } from "@/components/ui/split-pane";
import {
  LoomEditParser,
  getModelDisplayName,
  applyEditToDocument,
  parseProjectToolMarkers,
  cleanProjectToolMarkers,
  parseAddFileMarkers,
  cleanAddFileMarkers,
} from "@/lib/loom-utils";
import { extractOriginalContent, computeDiff } from "@/lib/diff-utils";
import {
  parseSurgicalEdits,
  applySurgicalEdits,
  containsSurgicalEdits,
  surgicalEditToPendingFormat,
} from "@/lib/surgical-edit";
import type { LoomDocument } from "@/lib/loom-types";
import {
  ProjectProvider,
  useProject,
} from "@/components/projects/project-provider";
import { ProjectSwitcher } from "@/components/projects/project-switcher";
import { loadClientKeys } from "@/lib/client-keys";
import type {
  StoredSession,
  StoredMessage,
  StoredLoomDocument,
} from "@/lib/project-types";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: FileAttachment[];
  timestamp: Date;
  isEditing?: boolean;
  loomContent?: string; // Content that was added to the loom (for display in collapsible)
}

// Message action buttons component
function MessageActions({
  message,
  isLoading,
  copiedMessageId,
  editingMessageId,
  onCopy,
  onEdit,
  onRegenerate,
}: {
  message: Message;
  isLoading: boolean;
  copiedMessageId: string | null;
  editingMessageId: string | null;
  onCopy: (id: string, content: string) => void;
  onEdit: (message: Message) => void;
  onRegenerate: (id: string) => void;
}) {
  if (
    message.role !== "assistant" ||
    !message.content ||
    editingMessageId === message.id
  ) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/20">
      <button
        onClick={() => onCopy(message.id, message.content)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
        title="Copy to clipboard"
      >
        {copiedMessageId === message.id ? (
          <>
            <Check className="h-3.5 w-3.5 text-green-500" />
            <span className="text-green-500">Copied</span>
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" />
            <span>Copy</span>
          </>
        )}
      </button>
      <button
        onClick={() => onEdit(message)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors"
        title="Edit response"
      >
        <Pencil className="h-3.5 w-3.5" />
        <span>Edit</span>
      </button>
      <button
        onClick={() => onRegenerate(message.id)}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Regenerate response"
      >
        <RefreshCw
          className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
        />
        <span>Regenerate</span>
      </button>
    </div>
  );
}

// Collapsible component to show loom content that was added
function LoomContentIndicator({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!content) return null;

  return (
    <div className="mt-3 border border-primary/20 rounded-lg overflow-hidden bg-primary/5">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-primary hover:bg-primary/10 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
        <FileText className="h-3.5 w-3.5" />
        <span className="font-medium">Added to Loom</span>
        <span className="text-muted-foreground ml-1">
          ({content.split("\n").length} lines)
        </span>
      </button>
      {isExpanded && (
        <div className="border-t border-primary/20 px-3 py-2 bg-background/50 max-h-64 overflow-auto">
          <div className="prose prose-sm prose-invert dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
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
    messages: session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      attachments: m.attachments?.map((a) => ({
        fileId: a.id,
        name: a.name,
        type: a.type,
        size: a.size,
      })),
      timestamp: m.timestamp.getTime(),
      loomContent: m.loomContent,
    })),
    loomDocument: session.loomDocument
      ? {
          id: session.loomDocument.id,
          title: session.loomDocument.title,
          content: session.loomDocument.content,
          createdAt: session.loomDocument.createdAt.getTime(),
          updatedAt: session.loomDocument.updatedAt.getTime(),
          lastModifiedBy: session.loomDocument.lastModifiedBy,
        }
      : undefined,
  };
}

function storedToSession(stored: StoredSession): ChatSession {
  return {
    id: stored.id,
    title: stored.title,
    timestamp: new Date(stored.timestamp),
    messages: stored.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      attachments: m.attachments?.map((a) => ({
        id: a.fileId,
        name: a.name,
        type: a.type,
        size: a.size,
      })),
      timestamp: new Date(m.timestamp),
      loomContent: m.loomContent,
    })),
    loomDocument: stored.loomDocument
      ? {
          id: stored.loomDocument.id,
          title: stored.loomDocument.title,
          content: stored.loomDocument.content,
          createdAt: new Date(stored.loomDocument.createdAt),
          updatedAt: new Date(stored.loomDocument.updatedAt),
          lastModifiedBy: stored.loomDocument.lastModifiedBy || "user",
        }
      : undefined,
  };
}

// Inner component that uses loom context
function ChatInterfaceInner() {
  const loom = useLoom();
  const {
    state: projectState,
    saveSession,
    deleteSession: projectDeleteSession,
    createProject,
    switchProject,
    refreshProjects,
    refreshActiveProject,
    uploadFile,
  } = useProject();
  const loomEditParserRef = useRef(new LoomEditParser());

  // Keep a ref to the current loom state to avoid stale closures in async handlers
  const loomRef = useRef(loom);
  useEffect(() => {
    loomRef.current = loom;
  }, [loom]);

  // State for project creation notification
  const [projectCreatedNotification, setProjectCreatedNotification] = useState<{
    show: boolean;
    projectName: string;
    projectId: string;
  } | null>(null);

  // Derive sessions from project state
  const projectSessions: ChatSession[] =
    projectState.activeProject?.sessions.map(storedToSession) || [];

  // Local state for sessions (synced with project)
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: "1",
      title: "New Chat",
      messages: [],
      timestamp: new Date(),
    },
  ]);
  const [currentSessionId, setCurrentSessionId] = useState("1");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedModel, setSelectedModel] = useState("atom");
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const [enabledModels, setEnabledModels] = useState<
    Array<{ id: string; name: string; provider: string }>
  >([]);
  const [loadingEnabledModels, setLoadingEnabledModels] = useState(true); // Start true to prevent flash

  // Check if user has configured any models
  const hasConfiguredModels = enabledModels.length > 0;
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSavedRef = useRef<string>("");
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const isNearBottomRef = useRef(true);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const abortControllerRef = useRef<AbortController | null>(null);

  // Function to fetch enabled models from settings
  const fetchEnabledModels = useCallback(async () => {
    setLoadingEnabledModels(true);

    try {
      const response = await fetch("/api/settings");
      const data = await response.json();

      if (data.success && data.settings?.enabledModels) {
        setEnabledModels(data.settings.enabledModels);
      }
    } catch (error) {
      console.error("Failed to fetch enabled models:", error);
    } finally {
      setLoadingEnabledModels(false);
    }
  }, []);

  // Sync sessions from project when project loads
  useEffect(() => {
    if (projectState.activeProject && projectState.isInitialized) {
      const converted = projectState.activeProject.sessions.map((stored) => {
        const session = storedToSession(stored);
        // Filter out incomplete assistant messages (empty content) that may have been
        // saved during an interrupted response - these cause a stuck "loading" state
        session.messages = session.messages.filter(
          (m) => m.role === "user" || (m.role === "assistant" && m.content),
        );
        return session;
      });
      if (converted.length > 0) {
        setSessions(converted);
        // Set current session to active or first
        const activeId =
          projectState.activeProject.activeSessionId || converted[0].id;
        setCurrentSessionId(activeId);
      } else {
        // Create a new session if project has none
        const newSession: ChatSession = {
          id: Date.now().toString(),
          title: "New Chat",
          messages: [],
          timestamp: new Date(),
        };
        setSessions([newSession]);
        setCurrentSessionId(newSession.id);
      }
    }
  }, [projectState.activeProject?.id, projectState.isInitialized]);

  const currentSession =
    sessions.find((s) => s.id === currentSessionId) || sessions[0];

  // Auto-save current session when messages change
  useEffect(() => {
    if (!projectState.activeProject || !currentSession) return;

    // Create a signature of the current session for change detection
    const sessionSignature = JSON.stringify({
      id: currentSession.id,
      title: currentSession.title,
      messageCount: currentSession.messages.length,
      lastMessageContent:
        currentSession.messages[currentSession.messages.length - 1]?.content ||
        "",
    });

    // Skip if nothing changed
    if (sessionSignature === lastSavedRef.current) return;
    lastSavedRef.current = sessionSignature;

    // Save to project (debounced by the provider)
    const storedSession = sessionToStored(currentSession);
    saveSession(storedSession);
  }, [currentSession, projectState.activeProject, saveSession]);

  // Fetch enabled models when component mounts
  useEffect(() => {
    fetchEnabledModels();
  }, [fetchEnabledModels]);

  // Check if user is near the bottom of the scroll area
  const checkIfNearBottom = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return true;
    const threshold = 100; // pixels from bottom
    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
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
        behavior: "smooth",
      });
      setIsUserScrolledUp(false);
      isNearBottomRef.current = true;
    }
  }, []);

  // Auto-scroll during streaming only if user is near bottom
  useEffect(() => {
    // Only auto-scroll if user hasn't scrolled up
    if (isNearBottomRef.current && scrollViewportRef.current) {
      scrollViewportRef.current.scrollTop =
        scrollViewportRef.current.scrollHeight;
    }
  }, [currentSession.messages]);

  // Reset scroll state when switching sessions
  useEffect(() => {
    setIsUserScrolledUp(false);
    isNearBottomRef.current = true;
    // Scroll to bottom when switching sessions
    setTimeout(() => {
      if (scrollViewportRef.current) {
        scrollViewportRef.current.scrollTop =
          scrollViewportRef.current.scrollHeight;
      }
    }, 50);
  }, [currentSessionId]);

  const handleNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: "New Chat",
      messages: [],
      timestamp: new Date(),
    };
    setSessions([newSession, ...sessions]);
    setCurrentSessionId(newSession.id);
    setInput("");
    setAttachments([]);
  };

  const handleAddFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      return;
    }
    const attachment = await processFile(file);
    setAttachments([...attachments, attachment]);
  };

  const handleRemoveFile = (id: string) => {
    setAttachments(attachments.filter((a) => a.id !== id));
  };

  const handleSendMessage = async () => {
    if ((!input.trim() && attachments.length === 0) || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      attachments: attachments.length > 0 ? [...attachments] : undefined,
      timestamp: new Date(),
    };

    setSessions((prevSessions) => {
      return prevSessions.map((session) =>
        session.id === currentSessionId
          ? {
              ...session,
              messages: [...session.messages, userMessage],
              title:
                session.messages.length === 0
                  ? (input.trim() || "File upload").slice(0, 50)
                  : session.title,
            }
          : session,
      );
    });

    setInput("");
    setAttachments([]);
    setIsLoading(true);

    // Re-focus the textarea so user can keep typing
    textareaRef.current?.focus();

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    setSessions((prevSessions) => {
      return prevSessions.map((session) =>
        session.id === currentSessionId
          ? { ...session, messages: [...session.messages, assistantMessage] }
          : session,
      );
    });

    try {
      // Build loom context if loom mode is active
      console.log("[Loom Debug] Building loom payload:");
      console.log("[Loom Debug] - isLoomMode:", loom.state.isLoomMode);
      console.log("[Loom Debug] - document exists:", !!loom.state.document);
      console.log(
        "[Loom Debug] - document content length:",
        loom.state.document?.content?.length,
      );

      const loomPayload =
        loom.state.isLoomMode && loom.state.document
          ? {
              loomEnabled: true,
              loomContext: {
                content: loom.state.document.content,
                cursorLine: loom.state.userCursor.line,
                lineCount: loom.state.document.content.split("\n").length,
              },
            }
          : { loomEnabled: false };

      console.log("[Loom Debug] Final loomPayload:", {
        loomEnabled: loomPayload.loomEnabled,
        hasContext: "loomContext" in loomPayload,
        contextContentLength:
          "loomContext" in loomPayload
            ? loomPayload.loomContext?.content?.length
            : 0,
      });

      // Debug: Log the model being sent
      console.log("[Chat Client] Sending request with model:", selectedModel);

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Load API keys from client-side storage
      const clientKeys = loadClientKeys();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId: currentSessionId,
          model: selectedModel,
          attachments: userMessage.attachments,
          webSearchEnabled: webSearchEnabled,
          // Send conversation history (excluding the message we just added)
          history: currentSession.messages.slice(0, -1).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          // Pass API keys from client-side storage (never stored on server)
          apiKeys: {
            openaiApiKey: clientKeys.openaiApiKey,
            anthropicApiKey: clientKeys.anthropicApiKey,
            mistralApiKey: clientKeys.mistralApiKey,
            openrouterApiKey: clientKeys.openrouterApiKey,
            customEndpointApiKey: clientKeys.customEndpointApiKey,
          },
          ...loomPayload,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to send message (${response.status})`,
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = ""; // Accumulate complete response

      // Helper to clean loom edit markers from text for display
      const cleanLoomMarkers = (text: string): string => {
        // Remove complete loom edit blocks (model still uses CANVAS_EDIT markers)
        // Also handles markdown formatting (---) around the markers
        let cleaned = text.replace(
          /---\s*\[CANVAS_EDIT_START:\d+\]\s*---[\s\S]*?---\s*\[CANVAS_EDIT_END\]\s*---/g,
          "",
        );
        cleaned = cleaned.replace(
          /\[CANVAS_EDIT_START:\d+\]\s*(?:---\s*)?[\s\S]*?(?:\s*---\s*)?\[CANVAS_EDIT_END\]/g,
          "",
        );
        // Remove partial/incomplete start markers (in case we're mid-stream)
        cleaned = cleaned.replace(/\[CANVAS_EDIT_START:\d+\][\s\S]*$/, "");
        // Remove any trailing partial marker that might be forming
        cleaned = cleaned.replace(/\[CANVAS_EDIT_START[^\]]*$/, "");
        cleaned = cleaned.replace(/\[CANVAS[^\]]*$/, "");
        cleaned = cleaned.replace(/\[[^\]]*$/, ""); // Any incomplete bracket
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
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed === "" || trimmed === "[DONE]") {
            continue;
          }

          if (trimmed.startsWith("data: ")) {
            const data = trimmed.slice(6);
            try {
              const parsed = JSON.parse(data);
              const content = parsed.content;
              if (content) {
                fullResponse += content;

                // Debug: log when we see edit markers being streamed
                if (content.includes("[ADD_FILE]")) {
                  console.log(
                    "[Loom Debug] ADD_FILE marker received in stream chunk",
                  );
                }
                if (content.includes("[/ADD_FILE]")) {
                  console.log(
                    "[Loom Debug] /ADD_FILE marker received in stream chunk",
                  );
                }

                // Update chat with cleaned content (all tool markers stripped out)
                const displayContent = cleanAllToolMarkers(fullResponse);

                setSessions((prevSessions) => {
                  return prevSessions.map((session) =>
                    session.id === currentSessionId
                      ? {
                          ...session,
                          messages: session.messages.map((msg) =>
                            msg.id === assistantMessage.id
                              ? { ...msg, content: displayContent }
                              : msg,
                          ),
                        }
                      : session,
                  );
                });
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e, "Line:", trimmed);
            }
          }
        }
      }

      // After streaming completes, extract and apply loom edits
      // Use loomRef.current to get the latest loom state (avoids stale closure)
      const currentLoom = loomRef.current;
      const isLoomStillActive =
        currentLoom.state.isLoomMode && currentLoom.state.document;

      // Debug logging for loom edit detection
      console.log("[Loom Debug] === Streaming Complete ===");
      console.log("[Loom Debug] isLoomStillActive:", isLoomStillActive);
      console.log(
        "[Loom Debug] loom.state.isLoomMode:",
        currentLoom.state.isLoomMode,
      );
      console.log(
        "[Loom Debug] loom.state.document exists:",
        !!currentLoom.state.document,
      );
      console.log("[Loom Debug] fullResponse length:", fullResponse.length);
      console.log(
        "[Loom Debug] fullResponse preview:",
        fullResponse.substring(0, 500),
      );
      console.log(
        "[Loom Debug] fullResponse end:",
        fullResponse.substring(Math.max(0, fullResponse.length - 200)),
      );
      console.log(
        "[Loom Debug] Contains ADD_FILE:",
        fullResponse.includes("[ADD_FILE]"),
      );
      console.log(
        "[Loom Debug] Contains /ADD_FILE:",
        fullResponse.includes("[/ADD_FILE]"),
      );

      if (isLoomStillActive) {
        // Debug: log the full response before attempting to match
        console.log(
          "[Loom Debug] Full response for regex match (first 1000 chars):",
          fullResponse.substring(0, 1000),
        );
        console.log(
          "[Loom Debug] Full response for regex match (last 500 chars):",
          fullResponse.substring(Math.max(0, fullResponse.length - 500)),
        );

        // Track if we handled edits via surgical mode
        let handledBySurgicalEdit = false;

        // Check for surgical edits first (for large documents)
        if (containsSurgicalEdits(fullResponse)) {
          console.log("[Loom Debug] Found SURGICAL_EDIT markers");
          const surgicalEdits = parseSurgicalEdits(fullResponse);
          console.log(
            "[Loom Debug] Parsed surgical edits count:",
            surgicalEdits.length,
          );

          if (surgicalEdits.length > 0) {
            const currentDocContent = currentLoom.state.document?.content || "";

            if (currentLoom.state.autoAcceptEdits) {
              // Apply surgical edits directly
              console.log(
                "[Loom Debug] Auto-accept ON, applying surgical edits directly",
              );
              const result = applySurgicalEdits(
                currentDocContent,
                surgicalEdits,
              );
              if (result.success) {
                currentLoom.updateContent(result.newContent);
                console.log(
                  "[Loom Debug] Applied",
                  result.appliedEdits,
                  "surgical edits",
                );
              } else {
                console.error(
                  "[Loom Debug] Surgical edit errors:",
                  result.errors,
                );
              }

              // Clean up chat message
              const cleanedMessage = fullResponse
                .replace(/\[SURGICAL_EDIT\][\s\S]*?\[\/SURGICAL_EDIT\]/g, "")
                .trim();
              setSessions((prevSessions) => {
                return prevSessions.map((s) =>
                  s.id === currentSessionId
                    ? {
                        ...s,
                        messages: s.messages.map((msg) =>
                          msg.id === assistantMessage.id
                            ? {
                                ...msg,
                                content:
                                  cleanedMessage ||
                                  `Done! Applied ${result.appliedEdits} edit${result.appliedEdits !== 1 ? "s" : ""} to the document.`,
                              }
                            : msg,
                        ),
                      }
                    : s,
                );
              });
            } else {
              // Queue surgical edits for review
              console.log(
                "[Loom Debug] Auto-accept OFF, queuing surgical edits for review",
              );
              for (const edit of surgicalEdits) {
                const pending = surgicalEditToPendingFormat(
                  edit,
                  currentDocContent,
                );
                currentLoom.addPendingEdit(
                  pending.targetLine,
                  pending.originalContent,
                  pending.newContent,
                );
              }

              // Clean up chat message
              const cleanedMessage = fullResponse
                .replace(/\[SURGICAL_EDIT\][\s\S]*?\[\/SURGICAL_EDIT\]/g, "")
                .trim();
              setSessions((prevSessions) => {
                return prevSessions.map((s) =>
                  s.id === currentSessionId
                    ? {
                        ...s,
                        messages: s.messages.map((msg) =>
                          msg.id === assistantMessage.id
                            ? {
                                ...msg,
                                content:
                                  cleanedMessage ||
                                  `I've prepared ${surgicalEdits.length} edit${surgicalEdits.length !== 1 ? "s" : ""} for your review. Check the Loom panel to accept or reject the changes.`,
                              }
                            : msg,
                        ),
                      }
                    : s,
                );
              });
            }
            // Mark that we handled this via surgical edits
            handledBySurgicalEdit = true;
          }
        }

        // Only process edits if we didn't already handle surgical edits
        if (!handledBySurgicalEdit) {
          // Try CANVAS_EDIT format first (legacy)
          const editMatch = fullResponse.match(
            /\[CANVAS_EDIT_START:(\d+)\]\s*(?:---\s*)?([\s\S]*?)(?:\s*---\s*)?\[CANVAS_EDIT_END\]/,
          );

          // If no CANVAS_EDIT, try ADD_FILE format (preferred)
          let targetLine = 1;
          let editContent = "";

          if (editMatch) {
            console.log("[Loom Debug] Found CANVAS_EDIT format");
            targetLine = parseInt(editMatch[1], 10);
            editContent = editMatch[2].trim();
          } else {
            // Try ADD_FILE format
            const addFileMatch = fullResponse.match(
              /\[ADD_FILE\]([\s\S]*?)\[\/ADD_FILE\]/,
            );
            if (addFileMatch) {
              console.log("[Loom Debug] Found ADD_FILE format");
              const jsonContent = addFileMatch[1];

              // Extract content from JSON wrapper
              try {
                const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  const parsed = JSON.parse(jsonMatch[0]);
                  if (parsed.content) {
                    editContent = parsed.content;
                    console.log(
                      "[Loom Debug] Extracted content from ADD_FILE JSON, length:",
                      editContent.length,
                    );
                  }
                }
              } catch {
                // Try regex fallback for malformed JSON
                const contentMatch = jsonContent.match(
                  /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/,
                );
                if (contentMatch) {
                  editContent = contentMatch[1]
                    .replace(/\\n/g, "\n")
                    .replace(/\\"/g, '"')
                    .replace(/\\\\/g, "\\")
                    .replace(/\\t/g, "\t");
                  console.log(
                    "[Loom Debug] Extracted content via regex fallback, length:",
                    editContent.length,
                  );
                }
              }
            }
          }

          console.log(
            "[Loom Debug] editContent found:",
            editContent.length > 0,
          );
          if (editContent.length > 0) {
            console.log("[Loom Debug] Target line:", targetLine);
            console.log(
              "[Loom Debug] Edit content length:",
              editContent.length,
            );
            console.log(
              "[Loom Debug] autoAcceptEdits:",
              currentLoom.state.autoAcceptEdits,
            );
          }

          if (editContent.length > 0) {
            const currentDocContent = currentLoom.state.document?.content || "";

            console.log("[Loom Debug] Processing edit:");
            console.log("[Loom Debug] - targetLine:", targetLine);
            console.log(
              "[Loom Debug] - editContent preview:",
              editContent.substring(0, 200),
            );
            console.log(
              "[Loom Debug] - currentDocContent length:",
              currentDocContent.length,
            );

            // Check if auto-accept is enabled (use current state, not stale)
            if (currentLoom.state.autoAcceptEdits) {
              // Apply edit directly to loom (existing behavior)
              console.log(
                "[Loom Debug] Auto-accept is ON, applying edit directly",
              );
              const newContent = applyEditToDocument(
                currentDocContent,
                targetLine,
                editContent,
              );
              console.log(
                "[Loom Debug] New content length after apply:",
                newContent.length,
              );
              console.log(
                "[Loom Debug] New content preview:",
                newContent.substring(0, 200),
              );
              currentLoom.updateContent(newContent);
              console.log("[Loom Debug] Content updated in Loom");

              // Final cleanup of chat message (handles both ADD_FILE and CANVAS_EDIT)
              const cleanedMessage = cleanAllToolMarkers(fullResponse);

              // Compute just the added lines for display
              const diff = computeDiff(currentDocContent, editContent);
              const addedLines = diff.lines
                .filter((line) => line.type === "added")
                .map((line) => line.content)
                .join("\n");

              setSessions((prevSessions) => {
                return prevSessions.map((s) =>
                  s.id === currentSessionId
                    ? {
                        ...s,
                        messages: s.messages.map((msg) =>
                          msg.id === assistantMessage.id
                            ? {
                                ...msg,
                                content:
                                  cleanedMessage ||
                                  "Done! I've updated the Loom for you.",
                                loomContent: addedLines || editContent,
                              }
                            : msg,
                        ),
                      }
                    : s,
                );
              });
            } else {
              // Queue the edit for review (new diff-based workflow)
              console.log(
                "[Loom Debug] Auto-accept is OFF, queuing edit for review",
              );
              const editContentLines = editContent.split("\n").length;
              const originalContent = extractOriginalContent(
                currentDocContent,
                targetLine,
                editContentLines,
              );

              console.log("[Loom Debug] Creating pending edit:");
              console.log("[Loom Debug] - editContentLines:", editContentLines);
              console.log(
                "[Loom Debug] - originalContent length:",
                originalContent.length,
              );
              console.log(
                "[Loom Debug] - originalContent preview:",
                originalContent.substring(0, 100),
              );

              // Add to pending edits queue
              currentLoom.addPendingEdit(
                targetLine,
                originalContent,
                editContent,
              );
              console.log("[Loom Debug] Pending edit added to queue");
              console.log(
                "[Loom Debug] Current pending edits count:",
                currentLoom.state.pendingEdits.length + 1,
              );

              // Update chat message to indicate pending review
              const cleanedMessage = cleanLoomMarkers(fullResponse);

              // Compute just the added lines for display
              const diff = computeDiff(originalContent, editContent);
              const addedLines = diff.lines
                .filter((line) => line.type === "added")
                .map((line) => line.content)
                .join("\n");

              setSessions((prevSessions) => {
                return prevSessions.map((s) =>
                  s.id === currentSessionId
                    ? {
                        ...s,
                        messages: s.messages.map((msg) =>
                          msg.id === assistantMessage.id
                            ? {
                                ...msg,
                                content:
                                  cleanedMessage ||
                                  "I've prepared an edit for your review. Check the Loom panel to accept or reject the changes.",
                                loomContent: addedLines || editContent,
                              }
                            : msg,
                        ),
                      }
                    : s,
                );
              });
            }
          }
        } // End of !handledBySurgicalEdit block
      }

      // After streaming completes, check for project creation tool
      const projectToolResult = parseProjectToolMarkers(fullResponse);
      if (projectToolResult.found && projectToolResult.payload) {
        try {
          // Create the project via API (with initial file support)
          const response = await fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: projectToolResult.payload.name,
              description: projectToolResult.payload.description || "",
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
            const cleanedContent =
              projectToolResult.cleanedContent ||
              `I've created the project "${data.project.name}" for you! You can find it in the project switcher.`;

            setSessions((prevSessions) => {
              return prevSessions.map((s) =>
                s.id === currentSessionId
                  ? {
                      ...s,
                      messages: s.messages.map((msg) =>
                        msg.id === assistantMessage.id
                          ? { ...msg, content: cleanedContent }
                          : msg,
                      ),
                    }
                  : s,
              );
            });
          }
        } catch (error) {
          console.error("Failed to create project from AI response:", error);
        }
      }

      // Check for ADD_FILE tool in response
      const addFileResult = parseAddFileMarkers(fullResponse);
      if (
        addFileResult.found &&
        addFileResult.payload &&
        projectState.activeProjectId
      ) {
        try {
          const fileName = addFileResult.payload.name;
          // Determine MIME type from file extension
          const ext = fileName.split(".").pop()?.toLowerCase() || "";
          const mimeTypes: Record<string, string> = {
            md: "text/markdown",
            txt: "text/plain",
            js: "text/javascript",
            ts: "text/typescript",
            jsx: "text/jsx",
            tsx: "text/tsx",
            py: "text/x-python",
            json: "application/json",
            html: "text/html",
            css: "text/css",
            yaml: "text/yaml",
            yml: "text/yaml",
          };
          const mimeType = mimeTypes[ext] || "text/plain";

          const blob = new Blob([addFileResult.payload.content], {
            type: mimeType,
          });
          const file = new File([blob], fileName, { type: mimeType });

          // Use uploadFile from project provider - this updates state immediately
          const uploadedFile = await uploadFile(file);

          if (uploadedFile) {
            // Update the message to show cleaned content
            const cleanedContent =
              addFileResult.cleanedContent ||
              `I've created the file "${fileName}" in your workspace.`;

            setSessions((prevSessions) => {
              return prevSessions.map((s) =>
                s.id === currentSessionId
                  ? {
                      ...s,
                      messages: s.messages.map((msg) =>
                        msg.id === assistantMessage.id
                          ? { ...msg, content: cleanedContent }
                          : msg,
                      ),
                    }
                  : s,
              );
            });
          } else {
            console.error("Failed to create file");
          }
        } catch (error) {
          console.error("Failed to create file from AI response:", error);
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      setSessions((prevSessions) => {
        return prevSessions.map((session) =>
          session.id === currentSessionId
            ? {
                ...session,
                messages: session.messages.map((msg, idx) =>
                  idx === session.messages.length - 1 &&
                  msg.role === "assistant"
                    ? {
                        ...msg,
                        content: `⚠️ Error: ${errorMessage}`,
                        isLoading: false,
                      }
                    : msg,
                ),
              }
            : session,
        );
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Stop generation handler
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Copy message content to clipboard
  const handleCopyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Start editing a message
  const handleStartEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  // Save edited message
  const handleSaveEdit = (messageId: string) => {
    setSessions((prevSessions) => {
      return prevSessions.map((session) =>
        session.id === currentSessionId
          ? {
              ...session,
              messages: session.messages.map((msg) =>
                msg.id === messageId ? { ...msg, content: editContent } : msg,
              ),
            }
          : session,
      );
    });
    setEditingMessageId(null);
    setEditContent("");
  };

  // Cancel editing
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  // Regenerate response - resend the previous user message
  const handleRegenerateResponse = async (assistantMessageId: string) => {
    if (isLoading) return;

    // Find the user message that preceded this assistant message
    const messageIndex = currentSession.messages.findIndex(
      (m) => m.id === assistantMessageId,
    );
    if (messageIndex <= 0) return;

    const userMessage = currentSession.messages[messageIndex - 1];
    if (userMessage.role !== "user") return;

    // Store the user message content and attachments before modifying state
    const messageContent = userMessage.content;
    const messageAttachments = userMessage.attachments || [];

    // Remove the assistant message and update sessions
    setSessions((prevSessions) => {
      return prevSessions.map((session) =>
        session.id === currentSessionId
          ? {
              ...session,
              messages: session.messages.filter(
                (msg) => msg.id !== assistantMessageId,
              ),
            }
          : session,
      );
    });

    // Start regeneration
    setIsLoading(true);

    // Create new assistant message for the response
    const newAssistantMessage: Message = {
      id: Date.now().toString(),
      role: "assistant",
      content: "",
      timestamp: new Date(),
    };

    // Add the new assistant message placeholder
    setSessions((prevSessions) => {
      return prevSessions.map((session) =>
        session.id === currentSessionId
          ? { ...session, messages: [...session.messages, newAssistantMessage] }
          : session,
      );
    });

    try {
      // Build loom context if active
      const loomPayload =
        loom.state.isLoomMode && loom.state.document
          ? {
              loomEnabled: true,
              loomContext: {
                content: loom.state.document.content,
                cursorLine: loom.state.userCursor.line,
                lineCount: loom.state.document.content.split("\n").length,
              },
            }
          : { loomEnabled: false };

      // Get history up to (but not including) the message being regenerated
      const historyMessages = currentSession.messages
        .slice(0, messageIndex - 1)
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      // Load API keys from client-side storage
      const clientKeys = loadClientKeys();

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageContent,
          sessionId: currentSessionId,
          model: selectedModel,
          attachments: messageAttachments,
          webSearchEnabled: webSearchEnabled,
          history: historyMessages,
          // Pass API keys from client-side storage (never stored on server)
          apiKeys: {
            openaiApiKey: clientKeys.openaiApiKey,
            anthropicApiKey: clientKeys.anthropicApiKey,
            mistralApiKey: clientKeys.mistralApiKey,
            openrouterApiKey: clientKeys.openrouterApiKey,
            customEndpointApiKey: clientKeys.customEndpointApiKey,
          },
          ...loomPayload,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || `Failed to regenerate (${response.status})`,
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      if (!reader) {
        throw new Error("No response body");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === "" || trimmed === "[DONE]") continue;

          if (trimmed.startsWith("data: ")) {
            const data = trimmed.slice(6);
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullResponse += parsed.content;
                setSessions((prevSessions) => {
                  return prevSessions.map((session) =>
                    session.id === currentSessionId
                      ? {
                          ...session,
                          messages: session.messages.map((msg) =>
                            msg.id === newAssistantMessage.id
                              ? { ...msg, content: fullResponse }
                              : msg,
                          ),
                        }
                      : session,
                  );
                });
              }
            } catch (e) {
              console.error("Error parsing SSE data:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error regenerating response:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to regenerate";
      setSessions((prevSessions) => {
        return prevSessions.map((session) =>
          session.id === currentSessionId
            ? {
                ...session,
                messages: session.messages.map((msg) =>
                  msg.id === newAssistantMessage.id
                    ? { ...msg, content: `⚠️ Error: ${errorMessage}` }
                    : msg,
                ),
              }
            : session,
        );
      });
    } finally {
      setIsLoading(false);
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
                  {`"${projectCreatedNotification.projectName}"`}
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
              <span className="text-lg font-semibold tracking-wide">
                Continuum
              </span>
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
                  <div className="flex items-center justify-between px-2.5 py-1.5">
                    <div className="flex-1 truncate text-sm font-medium">
                      {session.title || "New Chat"}
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
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                Model
              </label>
              {!loadingEnabledModels && !hasConfiguredModels ? (
                /* Show setup prompt when no models configured */
                <Link href="/settings">
                  <div className="flex items-center justify-between w-full h-9 px-3 py-2 text-sm rounded-md border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-colors cursor-pointer">
                    <span className="text-primary">
                      Configure a model provider
                    </span>
                    <Settings className="h-4 w-4 text-primary" />
                  </div>
                </Link>
              ) : (
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="w-full bg-background/50">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Loading state */}
                    {loadingEnabledModels && (
                      <div className="px-2 py-1 text-xs text-muted-foreground">
                        Loading models...
                      </div>
                    )}

                    {/* User-configured models from settings */}
                    {enabledModels.map((model) => (
                      <SelectItem
                        key={model.id}
                        value={`${model.provider}:${model.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded ${
                              model.provider === "openai"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : model.provider === "anthropic"
                                  ? "bg-orange-500/20 text-orange-400"
                                  : model.provider === "mistral"
                                    ? "bg-blue-500/20 text-blue-400"
                                    : model.provider === "openrouter"
                                      ? "bg-purple-500/20 text-purple-400"
                                      : "bg-zinc-500/20 text-zinc-400"
                            }`}
                          >
                            {model.provider}
                          </span>
                          <span>{model.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Web Search
                </label>
                <span className="relative">
                  <span className="text-xs text-yellow-400 cursor-help">ⓘ</span>
                  <span className="absolute -left-20 bottom-6 w-60 p-2 bg-background border border-border/50 rounded-md text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                    Enable real-time web search.
                    <span className="font-semibold">
                      Configure Google API
                    </span>{" "}
                    in .env.search for real results.
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
              {loom.state.isLoomMode ? "Close Loom" : "Open Loom"}
            </Button>
            <Link href="/memory">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Brain className="h-4 w-4" />
                Memory & Context
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="ghost" className="w-full justify-start gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </Link>
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
              title={loom.state.isLoomMode ? "Close Loom" : "Open Loom"}
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
              <ScrollArea
                className="flex-1 p-6"
                ref={scrollAreaRef}
                viewportRef={scrollViewportRef}
                onScroll={handleScroll}
              >
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
                        Start a conversation. Ask questions, get insights, and
                        explore new ideas.
                      </p>
                    </div>
                  ) : (
                    currentSession.messages.map((message) => (
                      <div
                        key={message.id}
                        className={
                          "flex " +
                          (message.role === "user"
                            ? "justify-end"
                            : "justify-start")
                        }
                      >
                        <div
                          className={
                            message.role === "user"
                              ? "max-w-[85%] ml-auto"
                              : "max-w-[90%] mr-auto"
                          }
                        >
                          {message.role === "user" ? (
                            <Card className="glass backdrop-blur-xl border-0 bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 shadow-md shadow-primary/5 rounded-2xl">
                              <div className="px-3 py-2">
                                {message.attachments &&
                                  message.attachments.length > 0 && (
                                    <div className="mb-3 space-y-2">
                                      {message.attachments.map((attachment) => (
                                        <div
                                          key={attachment.id}
                                          className="flex items-center gap-3 rounded-xl bg-background/50 border border-border/30 p-2.5"
                                        >
                                          {attachment.type.startsWith(
                                            "image/",
                                          ) && attachment.base64 ? (
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
                                            <p className="text-sm font-medium truncate">
                                              {attachment.name}
                                            </p>
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
                          ) : (
                            <div className="py-2">
                              {!message.content && !message.attachments && (
                                <div className="flex gap-1.5">
                                  <div
                                    className="h-2 w-2 animate-bounce rounded-full bg-primary"
                                    style={{ animationDelay: "0ms" }}
                                  />
                                  <div
                                    className="h-2 w-2 animate-bounce rounded-full bg-primary"
                                    style={{ animationDelay: "150ms" }}
                                  />
                                  <div
                                    className="h-2 w-2 animate-bounce rounded-full bg-primary"
                                    style={{ animationDelay: "300ms" }}
                                  />
                                </div>
                              )}
                              {editingMessageId === message.id ? (
                                <div className="space-y-2">
                                  <Textarea
                                    value={editContent}
                                    onChange={(e) =>
                                      setEditContent(e.target.value)
                                    }
                                    className="min-h-[100px] bg-background/50 text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => handleSaveEdit(message.id)}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={handleCancelEdit}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                message.content && (
                                  <div className="prose prose-sm prose-invert dark:prose-invert max-w-none">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {message.content}
                                    </ReactMarkdown>
                                  </div>
                                )
                              )}
                              {message.loomContent && (
                                <LoomContentIndicator
                                  content={message.loomContent}
                                />
                              )}
                              <MessageActions
                                message={message}
                                isLoading={isLoading}
                                copiedMessageId={copiedMessageId}
                                editingMessageId={editingMessageId}
                                onCopy={handleCopyMessage}
                                onEdit={handleStartEdit}
                                onRegenerate={handleRegenerateResponse}
                              />
                            </div>
                          )}
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
                {!loadingEnabledModels && !hasConfiguredModels ? (
                  /* Show setup prompt when no models configured */
                  <div className="space-y-3">
                    <Link href="/settings" className="block">
                      <div className="flex items-center justify-center gap-3 p-4 rounded-lg border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-colors cursor-pointer">
                        <Settings className="h-5 w-5 text-primary" />
                        <div className="text-center">
                          <p className="text-sm font-medium text-primary">
                            Configure a model provider to start chatting
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Click here to set up OpenAI, Anthropic, Mistral, or
                            other providers
                          </p>
                        </div>
                      </div>
                    </Link>
                    <p className="text-xs text-center text-muted-foreground">
                      Don&apos;t have an API key?{" "}
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Get a free one from OpenRouter
                      </a>
                    </p>
                  </div>
                ) : (
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
                      {isLoading ? (
                        <Button
                          onClick={handleStopGeneration}
                          className="h-[50px] w-[50px] shrink-0 bg-gradient-to-br from-destructive to-destructive/90 hover:from-destructive/90 hover:to-destructive shadow-lg shadow-destructive/20 transition-all duration-200"
                          size="icon"
                          title="Stop generation"
                        >
                          <Square className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          onClick={handleSendMessage}
                          disabled={!input.trim() && attachments.length === 0}
                          className="h-[50px] w-[50px] shrink-0 bg-gradient-to-br from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20 transition-all duration-200"
                          size="icon"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )}
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
            <ScrollArea
              className="flex-1 p-6"
              ref={scrollAreaRef}
              viewportRef={scrollViewportRef}
              onScroll={handleScroll}
            >
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
                      Start a conversation. Ask questions, get insights, and
                      explore new ideas.
                    </p>
                  </div>
                ) : (
                  currentSession.messages.map((message) => (
                    <div
                      key={message.id}
                      className={
                        "flex " +
                        (message.role === "user"
                          ? "justify-end"
                          : "justify-start")
                      }
                    >
                      <div
                        className={
                          message.role === "user"
                            ? "max-w-[75%] ml-auto"
                            : "max-w-[85%] mr-auto"
                        }
                      >
                        {message.role === "user" ? (
                          <Card className="glass backdrop-blur-xl border-0 bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 shadow-md shadow-primary/5 rounded-2xl">
                            <div className="px-3 py-2">
                              {message.attachments &&
                                message.attachments.length > 0 && (
                                  <div className="mb-3 space-y-2">
                                    {message.attachments.map((attachment) => (
                                      <div
                                        key={attachment.id}
                                        className="flex items-center gap-3 rounded-xl bg-background/50 border border-border/30 p-2.5"
                                      >
                                        {attachment.type.startsWith("image/") &&
                                        attachment.base64 ? (
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
                                          <p className="text-sm font-medium truncate">
                                            {attachment.name}
                                          </p>
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
                        ) : (
                          <div className="py-2">
                            {!message.content && !message.attachments && (
                              <div className="flex gap-1.5">
                                <div
                                  className="h-2 w-2 animate-bounce rounded-full bg-primary"
                                  style={{ animationDelay: "0ms" }}
                                />
                                <div
                                  className="h-2 w-2 animate-bounce rounded-full bg-primary"
                                  style={{ animationDelay: "150ms" }}
                                />
                                <div
                                  className="h-2 w-2 animate-bounce rounded-full bg-primary"
                                  style={{ animationDelay: "300ms" }}
                                />
                              </div>
                            )}
                            {editingMessageId === message.id ? (
                              <div className="space-y-2">
                                <Textarea
                                  value={editContent}
                                  onChange={(e) =>
                                    setEditContent(e.target.value)
                                  }
                                  className="min-h-[100px] bg-background/50 text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveEdit(message.id)}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleCancelEdit}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              message.content && (
                                <div className="prose prose-sm prose-invert dark:prose-invert max-w-none">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {message.content}
                                  </ReactMarkdown>
                                </div>
                              )
                            )}
                            {message.loomContent && (
                              <LoomContentIndicator
                                content={message.loomContent}
                              />
                            )}
                            <MessageActions
                              message={message}
                              isLoading={isLoading}
                              copiedMessageId={copiedMessageId}
                              editingMessageId={editingMessageId}
                              onCopy={handleCopyMessage}
                              onEdit={handleStartEdit}
                              onRegenerate={handleRegenerateResponse}
                            />
                          </div>
                        )}
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
                {!loadingEnabledModels && !hasConfiguredModels ? (
                  /* Show setup prompt when no models configured */
                  <div className="space-y-3">
                    <Link href="/settings" className="block">
                      <div className="flex items-center justify-center gap-3 p-6 rounded-lg border border-dashed border-primary/50 bg-primary/5 hover:bg-primary/10 hover:border-primary transition-colors cursor-pointer">
                        <Settings className="h-6 w-6 text-primary" />
                        <div className="text-center">
                          <p className="text-base font-medium text-primary">
                            Configure a model provider to start chatting
                          </p>
                          <p className="text-sm text-muted-foreground mt-1">
                            Click here to set up OpenAI, Anthropic, Mistral, or
                            other providers
                          </p>
                        </div>
                      </div>
                    </Link>
                    <p className="text-sm text-center text-muted-foreground">
                      Don&apos;t have an API key?{" "}
                      <a
                        href="https://openrouter.ai/keys"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Get a free one from OpenRouter
                      </a>
                    </p>
                  </div>
                ) : (
                  <>
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
                      {isLoading ? (
                        <Button
                          onClick={handleStopGeneration}
                          className="h-[60px] w-[60px] shrink-0 bg-gradient-to-br from-destructive to-destructive/90 hover:from-destructive/90 hover:to-destructive shadow-lg shadow-destructive/20 transition-all duration-200"
                          size="icon"
                          title="Stop generation"
                        >
                          <Square className="h-5 w-5" />
                        </Button>
                      ) : (
                        <Button
                          onClick={handleSendMessage}
                          disabled={!input.trim() && attachments.length === 0}
                          className="h-[60px] w-[60px] shrink-0 bg-gradient-to-br from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20 transition-all duration-200"
                          size="icon"
                        >
                          <Send className="h-5 w-5" />
                        </Button>
                      )}
                    </div>
                  </>
                )}
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
