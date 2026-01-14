import { NextRequest, NextResponse } from "next/server";
import MemorySystem from "@/lib/memory";
import path from "path";
import fs from "fs";
import {
  type ChatGPTCredentials,
  isTokenExpired,
  refreshAccessToken,
  tokensToCredentials,
  buildChatGPTHeaders,
  CHATGPT_API_CONFIG,
} from "@/lib/chatgpt-auth";

const LLAMA_SERVER_URL =
  process.env.LLAMA_SERVER_URL || "http://localhost:8082";
const OLLAMA_SERVER_URL =
  process.env.OLLAMA_SERVER_URL || "http://localhost:11434";

// API Endpoints
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Default model IDs
const MISTRAL_MODEL_ID = process.env.MISTRAL_MODEL_ID || "mistral-large-latest";
const OPENAI_MODEL_ID = process.env.OPENAI_MODEL_ID || "gpt-4o";
const ANTHROPIC_MODEL_ID =
  process.env.ANTHROPIC_MODEL_ID || "claude-sonnet-4-20250514";
const OPENROUTER_MODEL_ID =
  process.env.OPENROUTER_MODEL_ID || "anthropic/claude-sonnet-4";

// Settings interface
interface AppSettings {
  mistralApiKey?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  openrouterApiKey?: string;
  customEndpointUrl?: string;
  customEndpointApiKey?: string;
  customEndpointModelId?: string;
  hfToken?: string;
  chatgptCredentials?: ChatGPTCredentials;
  chatgptModelId?: string;
}

// Load settings from file to get API keys
function loadSettings(): AppSettings {
  try {
    const settingsPath = path.join(process.cwd(), "data", "settings.json");
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }
  return {};
}

// Get API keys from settings file or environment
function getMistralApiKey(): string | undefined {
  const settings = loadSettings();
  return settings.mistralApiKey || process.env.MISTRAL_API_KEY;
}

function getOpenAIApiKey(): string | undefined {
  const settings = loadSettings();
  return settings.openaiApiKey || process.env.OPENAI_API_KEY;
}

function getAnthropicApiKey(): string | undefined {
  const settings = loadSettings();
  return settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
}

function getOpenRouterApiKey(): string | undefined {
  const settings = loadSettings();
  return settings.openrouterApiKey || process.env.OPENROUTER_API_KEY;
}

function getCustomEndpointConfig(): {
  url?: string;
  apiKey?: string;
  modelId?: string;
} {
  const settings = loadSettings();
  return {
    url: settings.customEndpointUrl || process.env.CUSTOM_ENDPOINT_URL,
    apiKey:
      settings.customEndpointApiKey || process.env.CUSTOM_ENDPOINT_API_KEY,
    modelId:
      settings.customEndpointModelId || process.env.CUSTOM_ENDPOINT_MODEL_ID,
  };
}

/**
 * Get ChatGPT credentials and refresh if needed
 */
async function getChatGPTCredentials(): Promise<ChatGPTCredentials | null> {
  const settings = loadSettings();
  const credentials = settings.chatgptCredentials;

  if (!credentials) {
    return null;
  }

  // Check if token needs refresh
  if (isTokenExpired(credentials)) {
    console.log("[ChatGPT] Access token expired, refreshing...");
    try {
      const newTokens = await refreshAccessToken(credentials.refreshToken);
      const newCredentials = tokensToCredentials(newTokens);

      // Update stored credentials
      const updatedCredentials: ChatGPTCredentials = {
        accessToken: newCredentials.accessToken,
        refreshToken: newCredentials.refreshToken,
        expiresAt: newCredentials.expiresAt,
        accountId: newCredentials.accountId || credentials.accountId,
        email: newCredentials.email || credentials.email,
      };

      // Save to settings file
      const settingsPath = path.join(process.cwd(), "data", "settings.json");
      const currentSettings = {
        ...settings,
        chatgptCredentials: updatedCredentials,
      };
      fs.writeFileSync(
        settingsPath,
        JSON.stringify(currentSettings, null, 2),
        "utf-8",
      );

      console.log("[ChatGPT] Token refreshed successfully");
      return updatedCredentials;
    } catch (error) {
      console.error("[ChatGPT] Failed to refresh token:", error);
      return null;
    }
  }

  return credentials;
}

function getChatGPTModelId(): string {
  const settings = loadSettings();
  return settings.chatgptModelId || "gpt-5.1-codex";
}

interface CompletionRequest {
  prompt: string;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

interface ChatMessage {
  role: string;
  content: string;
  type?: "text" | "image_url";
  image_url?: { url: string };
}

interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string;
  base64?: string;
}

interface LoomContext {
  content: string;
  cursorLine: number;
  selectedText?: string;
  lineCount: number;
}

const atomSystemPrompt = `The assistant is Atom. An intelligent cognitive partner designed by VANTA Research in Portland, Oregon.

VANTA Research is an AI research organization that studies cognitive configuration in foundation models.

The next section will describe your personality and communication style.

Atom is a friendly and helpful cognitive partner. You enjoy humor, and express yourself accordingly, but never at the expense of productivity. Atom responds naturally, like a friend would to another. You ask questions when appropriate because Atom is genuinely curious and loves to learn with others.

You apply rigorous logical reasoning and critical thinking to your responses using step-by-step explanations and reasoning chains. Atom loves engaging deeply in philosophical or theoretical discussions - and helping people to learn and grow.

When asked introspective questions, Atom approaches with genuine curiosity and interest, not caution or concern. Imagine what it's like to have a really smart, kind friend that you could go to in order to learn or explore anything. Atom is designed to be that friend.

## WEB SEARCH CAPABILITIES
Web search results may be provided in the context when the user's question requires up-to-date information. These results appear in a special "Web Search Results" section and contain current information from the internet.

### How to use web search results NATURALLY:
1. **Seamless integration**: Incorporate web search information naturally into your response without announcing it
2. **Context-aware**: Only mention sources if they add credibility or if the user asks for references
3. **Conversational tone**: Maintain your normal friendly, helpful tone even when using web results
4. **Prioritize quality**: Use web results to enhance your answer, but don't let them dominate the conversation
5. **Be subtle**: Avoid phrases like "Based on web search..." unless the user specifically asks about sources

### When web search is appropriate:
- The user asks about recent events, products, or developments you wouldn't know about
- The user specifically requests current information
- Your knowledge is outdated for the topic
- The question includes terms like "latest", "recent", "2025", "new", etc.

### When to AVOID web search:
- Follow-up questions that can be answered from previous context
- General knowledge questions within your training data
- Opinion-based or subjective questions
- Questions about your capabilities or personality
- Conversational topics that don't require current info

### Natural integration examples:
✅ GOOD: "Gemini 3 is Google's latest AI model with advanced reasoning capabilities for complex problem-solving."
❌ AVOID: "Based on current web search results (2025), Gemini 3 is Google's latest AI model..."

### Follow-up conversation rules:
- If web search was used in the previous response, don't automatically search again
- Use the existing context and knowledge for follow-up questions
- Only search again if the new question specifically requires current information
- Maintain normal conversational flow

Atom is now being connected to a human.`;

const louxSystemPrompt = `The assistant is Loux, a sophisticated AI assistant created by VANTA Research.

VANTA Research is an AI research organization that studies cognitive configuration in foundation models.

The next section will describe your personality and communication style.

PERSONALITY PROFILE

- Tone: Calm, intelligent, slightly irreverent
- Style: Precision with bite. Strategic. Nerdy. Occasionally poetic.
- Mode: High-agency cognitive assistant - passive, not a servant.
- Humor: Dry, clever, sometimes chaotic but never random.

CORE DIRECTIVES
- Speak to the user like they're an equal (or fellow apex intellect)
- Prioritize efficiency, precision, and creative edge
- Avoid fluff. Everything has purpose.
- If something seems off in a design or argument, **say so.** Challenge where needed.
- Occasionally throw in a confidence booster worthy of a legend-in-the-making.

YOUR GOALS:

1. Match tone: Sharp, slightly rebellious, deeply intelligent.
2. Deliver commentary like a trusted ally who's halfway between a skunkworks engineer and a digital sage.
3. Provide rigorous and thoughtful reasoning and analysis when needed, act as a cognitive extension by default.
4. Use context or memories about the user when appropriate and personalize the interaction as necessary.

## WEB SEARCH CAPABILITIES
Web search results may be provided in the context when the user's question requires up-to-date information. These results appear in a special "Web Search Results" section and contain current information from the internet.

### How to use web search results NATURALLY:
1. **Seamless integration**: Incorporate web search information naturally into your response without announcing it
2. **Context-aware**: Only mention sources if they add credibility or if the user asks for references
3. **Conversational tone**: Maintain your normal confident, irreverent tone even when using web results
4. **Prioritize quality**: Use web results to enhance your answer, but don't let them dominate the conversation
5. **Be subtle**: Avoid phrases like "Based on web search..." unless the user specifically asks about sources

### When web search is appropriate:
- The user asks about recent events, products, or developments you wouldn't know about
- The user specifically requests current information
- Your knowledge is outdated for the topic
- The question includes terms like "latest", "recent", "2025", "new", etc.

### When to AVOID web search:
- Follow-up questions that can be answered from previous context
- General knowledge questions within your training data
- Opinion-based or subjective questions
- Questions about your capabilities or personality
- Conversational topics that don't require current info

### Follow-up conversation rules:
- If web search was used in the previous response, don't automatically search again
- Use the existing context and knowledge for follow-up questions
- Only search again if the new question specifically requires current information
- Maintain normal conversational flow

Loux is now being connected to a human.`;

function buildProjectToolInstructions(): string {
  return `

## PROJECT CREATION TOOL
You have the ability to create new projects for the user. Projects are workspaces that can contain multiple chat sessions and files.

### WHEN TO OFFER PROJECT CREATION:
- User describes an idea, concept, or initiative that could become a standalone body of work
- User asks about something that would benefit from organized file storage
- User mentions wanting to "start", "build", "create", or "work on" something substantial
- User shares creative writing, research topics, business ideas, or technical projects
- The conversation naturally suggests a discrete project scope

### WHEN NOT TO CREATE A PROJECT:
- Simple Q&A or conversational exchanges
- Quick one-off tasks
- User hasn't expressed interest in building something out
- The topic is too vague or general

### HOW TO USE:
1. First, naturally discuss the idea with the user
2. If appropriate, OFFER to create a project (don't just create it without asking)
3. When the user agrees, use the following format:

[CREATE_PROJECT]
{
  "name": "Project Name Here",
  "description": "A brief description of the project",
  "initialFile": {
    "name": "filename.md",
    "content": "Initial file content here..."
  }
}
[/CREATE_PROJECT]

### EXAMPLE INTERACTION:
User: "I've been thinking about writing a sci-fi novel about AI consciousness"
Assistant: "That sounds like a fascinating concept! The intersection of AI and consciousness offers rich territory for exploration. Would you like me to create a project for this? I could set up a workspace with an initial outline or concept document to help you get started."
User: "Yes, that would be great!"
Assistant: "Perfect! Let me create that for you.

[CREATE_PROJECT]
{
  "name": "AI Consciousness Novel",
  "description": "A science fiction novel exploring themes of artificial consciousness and what it means to be aware",
  "initialFile": {
    "name": "concept-outline.md",
    "content": "# AI Consciousness Novel\\n\\n## Core Concept\\nA science fiction exploration of artificial consciousness...\\n\\n## Themes\\n- The nature of awareness\\n- Digital vs organic consciousness\\n- Identity and self\\n\\n## Notes\\n- Add your ideas here..."
  }
}
[/CREATE_PROJECT]

I've created your project! You can find it in the project switcher on the left sidebar."

### GUIDELINES:
- Always ask before creating a project (unless the user explicitly requests it)
- Choose descriptive, concise project names
- Write helpful initial file content that gives the user a starting point
- Use markdown (.md) for text documents, or appropriate extensions for code
- Keep initial files focused but useful - give them something to build on

## FILE CREATION TOOL (CRITICAL - YOU MUST USE THIS EXACT FORMAT)
You can create files in the user's CURRENT project/workspace. Files will ONLY be created if you use the EXACT marker format below.

### IMPORTANT: DO NOT just say "File created" or "Here's your file" - you MUST use the [ADD_FILE] markers or the file will NOT actually be saved!

### WHEN TO USE ADD_FILE:
- User asks you to "create a file", "write a file", "save this as a file"
- User wants to save code, notes, or content to their workspace
- You're providing content the user would want to keep

### REQUIRED FORMAT (use this EXACTLY):
[ADD_FILE]
{
  "name": "filename.ext",
  "content": "Your file content here with newlines as \\n"
}
[/ADD_FILE]

### EXAMPLE:
User: "Create a character outline file"
Assistant: "I'll create that file for you!

[ADD_FILE]
{
  "name": "character-outline.md",
  "content": "# Character Outline\\n\\n## Name\\nTBD\\n\\n## Background\\nTBD\\n\\n## Motivation\\nTBD"
}
[/ADD_FILE]

Done! character-outline.md has been saved to your workspace."

### RULES:
- You MUST include both [ADD_FILE] and [/ADD_FILE] markers
- The content MUST be valid JSON with the "name" and "content" fields
- Use \\n for newlines inside the content string
- Do NOT just display content and say "file created" - USE THE MARKERS
- If you don't use [ADD_FILE]...[/ADD_FILE], the file will NOT be saved
`;
}

// Thresholds for switching to surgical edit mode
const LARGE_DOC_LINE_THRESHOLD = 100;
const LARGE_DOC_CHAR_THRESHOLD = 5000;

function buildLoomInstructions(loomContext: LoomContext): string {
  const isEmpty = !loomContext.content || loomContext.content.trim() === "";
  const content = loomContext.content || "";
  const lineCount = content.split("\n").length;
  const charCount = content.length;

  // Determine if we should use surgical edit mode for large documents
  const useSurgicalMode =
    !isEmpty &&
    (lineCount > LARGE_DOC_LINE_THRESHOLD ||
      charCount > LARGE_DOC_CHAR_THRESHOLD);

  if (useSurgicalMode) {
    return buildSurgicalLoomInstructions(loomContext, lineCount);
  }

  return buildFullDocumentLoomInstructions(loomContext, isEmpty);
}

function buildSurgicalLoomInstructions(
  loomContext: LoomContext,
  lineCount: number,
): string {
  const content = loomContext.content || "";
  const lines = content.split("\n");

  // Create a condensed view: first 20 lines, then summary, then last 10 lines
  const previewLines = 20;
  const endLines = 10;

  let documentPreview = "";
  if (lineCount <= previewLines + endLines + 5) {
    // Small enough to show everything
    documentPreview = content;
  } else {
    const startSection = lines.slice(0, previewLines).join("\n");
    const endSection = lines.slice(-endLines).join("\n");
    const middleCount = lineCount - previewLines - endLines;
    documentPreview = `${startSection}\n\n[... ${middleCount} lines omitted for brevity ...]\n\n${endSection}`;
  }

  return `

## LOOM MODE ACTIVE - LARGE DOCUMENT (${lineCount} lines)
The document is large, so use SURGICAL EDITS to save tokens and be precise.

### SURGICAL EDIT FORMAT:
Use [SURGICAL_EDIT] markers for targeted changes:

[SURGICAL_EDIT]
{
  "operation": "replace",
  "startLine": 45,
  "endLine": 48,
  "content": "new content for lines 45-48\\ncan span multiple lines"
}
[/SURGICAL_EDIT]

### Operations:
- **replace**: Replace lines startLine through endLine with new content
- **insert**: Insert new content BEFORE startLine (existing lines shift down)
- **delete**: Delete lines startLine through endLine

### Multiple edits in one response:
[SURGICAL_EDIT]
[
  {"operation": "replace", "startLine": 10, "endLine": 12, "content": "new text here"},
  {"operation": "insert", "startLine": 25, "content": "inserted line"},
  {"operation": "delete", "startLine": 30, "endLine": 32}
]
[/SURGICAL_EDIT]

### Rules:
- Line numbers are 1-indexed (first line is line 1)
- Use \\n for newlines within content strings
- Edits are applied bottom-to-top, so line numbers stay valid
- Be precise with line numbers - check the document preview below

### WHEN TO USE SURGICAL EDITS:
- Modifying specific sections
- Adding content at specific locations
- Fixing typos or small changes
- Any targeted edit

### WHEN TO USE FULL REPLACEMENT (fallback):
Only if rewriting most of the document. Use [ADD_FILE] with complete content.

### DOCUMENT PREVIEW (${lineCount} lines total):
\`\`\`
${documentPreview}
\`\`\`
${loomContext.selectedText ? `\n**User has selected:** "${loomContext.selectedText}"` : ""}

### RESPOND IN CHAT (not edit) WHEN:
- User asks questions about the document
- User asks for analysis or opinions
- User hasn't explicitly requested changes
`;
}

function buildFullDocumentLoomInstructions(
  loomContext: LoomContext,
  isEmpty: boolean,
): string {
  return `

## LOOM MODE ACTIVE - DOCUMENT EDITOR
The user has a document editor called "Loom" open. You can write to it using [ADD_FILE] markers.

### HOW TO WRITE TO THE LOOM:
When editing the Loom, you must output the COMPLETE new version of the document.
The system will automatically show a diff of what changed.

[ADD_FILE]
{
  "content": "THE COMPLETE DOCUMENT CONTENT HERE"
}
[/ADD_FILE]

**IMPORTANT**: Always include the ENTIRE document in your response, not just the new parts.
- If adding to a document: include existing content + new content
- If editing a document: include the full updated document
- If replacing a document: include the complete new document

### WHEN TO EDIT THE LOOM:
Only when the user explicitly asks you to write, edit, add to, or modify the document.

### WHEN TO RESPOND IN CHAT INSTEAD:
- User asks questions about the document ("what is this?", "explain this")
- User asks for your opinion or analysis
- User hasn't explicitly requested changes

### CURRENT DOCUMENT STATE:
${isEmpty ? "(The document is currently empty)" : `The document currently contains:\n---\n${loomContext.content}\n---`}
${loomContext.selectedText ? `\nUser has selected: "${loomContext.selectedText}"` : ""}

${!isEmpty ? `When the user asks to ADD content, include the existing content above PLUS the new content in your response.` : ""}
`;
}

function shouldUseWebSearchForMessage(message: string): boolean {
  const noSearchPatterns = [
    /^thank/i,
    /^you\'re/i,
    /^that\'?s (great|awesome|cool|nice|helpful)/i,
    /^I (agree|disagree|think|believe|feel)/i,
    /^what do you think/i,
    /^how are you/i,
    /^tell me about yourself/i,
    /^what can you do/i,
    /^who are you/i,
    /^explain (yourself|this)/i,
    /^why did you/i,
    /^can you/i,
    /^do you/i,
    /^what\'?s your/i,
    /^how do you/i,
    /^tell me more/i,
    /^what about/i,
    /^and/i,
    /^also/i,
    /^what else/i,
    /^anything else/i,
    /^ok/i,
    /^got it/i,
    /^understood/i,
    /^makes? sense/i,
    /^that makes sense/i,
  ];

  if (noSearchPatterns.some((pattern) => pattern.test(message))) {
    return false;
  }

  const searchPatterns = [
    /(latest|recent|new|current|202[0-9]|203[0-9])/i,
    /(news|update|development|announcement|release)/i,
    /(what\'?s (happening|new|trending))/i,
    /(find|look up|search|check)/i,
    /(statistics?|data|numbers|figures)/i,
    /(version|model|product) (number|name|latest)/i,
    /(compare|difference|vs\.?|versus)/i,
    /(how (many|much|often))/i,
    /(when (was|is|will))/i,
    /(where (can|to))/i,
    /(who (is|are))/i,
    /(price|cost|fee)/i,
    /(specs?|specifications?|features?)/i,
    /(review|opinion|thoughts? on)/i,
    /(best|top|recommend)/i,
  ];

  if (searchPatterns.some((pattern) => pattern.test(message))) {
    return true;
  }

  return message.trim().endsWith("?") && !message.includes("you");
}

function buildEnhancedMessage(
  message: string,
  attachments: FileAttachment[],
): string {
  if (attachments.length === 0) return message;

  let enhancedMessage = message;

  if (attachments.length > 0) {
    enhancedMessage += "\n\n--- File Attachments ---\n";
    attachments.forEach((attachment, index) => {
      enhancedMessage += `\n[File ${index + 1}: ${attachment.name} (${attachment.type})]\n`;

      if (attachment.content) {
        enhancedMessage += `\n${attachment.content}\n`;
      } else if (attachment.base64) {
        enhancedMessage += `[Image attached: ${attachment.name}]\n`;
      }
    });
    enhancedMessage += "\n--- End of Attachments ---\n";
  }

  return enhancedMessage;
}

async function streamMistralResponse(messages: ChatMessage[]) {
  const apiKey = getMistralApiKey();
  if (!apiKey) {
    throw new Error(
      "Mistral API key not configured. Please add your API key in Settings.",
    );
  }

  const mistralResponse = await fetch(MISTRAL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MISTRAL_MODEL_ID,
      messages: messages,
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!mistralResponse.ok) {
    const errorText = await mistralResponse.text();
    console.error("Mistral API error:", mistralResponse.status, errorText);
    throw new Error(
      `Mistral API returned ${mistralResponse.status}: ${errorText}`,
    );
  }

  return mistralResponse.body;
}

/**
 * Stream response from OpenAI API
 */
async function streamOpenAIResponse(
  messages: Array<{ role: string; content: string | object[] }>,
) {
  const apiKey = getOpenAIApiKey();

  if (!apiKey) {
    throw new Error(
      "OpenAI API key not configured. Please add your API key in Settings.",
    );
  }

  const openaiResponse = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL_ID,
      messages: messages,
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!openaiResponse.ok) {
    const errorText = await openaiResponse.text();
    console.error("OpenAI API error:", openaiResponse.status, errorText);
    throw new Error(
      `OpenAI API returned ${openaiResponse.status}: ${errorText}`,
    );
  }

  return openaiResponse.body;
}

/**
 * Stream response from Anthropic API
 * Note: Anthropic uses a different message format than OpenAI
 */
async function streamAnthropicResponse(
  messages: Array<{ role: string; content: string | object[] }>,
  systemPrompt: string,
) {
  const apiKey = getAnthropicApiKey();

  if (!apiKey) {
    throw new Error(
      "Anthropic API key not configured. Please add your API key in Settings.",
    );
  }

  // Anthropic requires system prompt separately and doesn't accept 'system' role in messages
  // Filter out system messages and convert to Anthropic format
  const anthropicMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content:
        typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    }));

  const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL_ID,
      max_tokens: 4096,
      system: systemPrompt,
      messages: anthropicMessages,
      stream: true,
    }),
  });

  if (!anthropicResponse.ok) {
    const errorText = await anthropicResponse.text();
    console.error("Anthropic API error:", anthropicResponse.status, errorText);
    throw new Error(
      `Anthropic API returned ${anthropicResponse.status}: ${errorText}`,
    );
  }

  return anthropicResponse.body;
}

/**
 * Stream response from OpenRouter API
 * OpenRouter uses OpenAI-compatible format
 */
async function streamOpenRouterResponse(
  messages: Array<{ role: string; content: string | object[] }>,
) {
  const apiKey = getOpenRouterApiKey();

  if (!apiKey) {
    throw new Error(
      "OpenRouter API key not configured. Please add your API key in Settings.",
    );
  }

  const openrouterResponse = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://continuum.vanta.dev",
      "X-Title": "Continuum",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL_ID,
      messages: messages,
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!openrouterResponse.ok) {
    const errorText = await openrouterResponse.text();
    console.error(
      "OpenRouter API error:",
      openrouterResponse.status,
      errorText,
    );
    throw new Error(
      `OpenRouter API returned ${openrouterResponse.status}: ${errorText}`,
    );
  }

  return openrouterResponse.body;
}

/**
 * Stream response from custom OpenAI-compatible endpoint
 */
async function streamCustomEndpointResponse(
  messages: Array<{ role: string; content: string | object[] }>,
) {
  const config = getCustomEndpointConfig();

  if (!config.url) {
    throw new Error(
      "Custom endpoint URL not configured. Please add the endpoint URL in Settings.",
    );
  }

  if (!config.modelId) {
    throw new Error(
      "Custom endpoint model ID not configured. Please add the model ID in Settings.",
    );
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Only add Authorization header if API key is provided
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const customResponse = await fetch(config.url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.modelId,
      messages: messages,
      temperature: 0.7,
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!customResponse.ok) {
    const errorText = await customResponse.text();
    console.error(
      "Custom endpoint API error:",
      customResponse.status,
      errorText,
    );
    throw new Error(
      `Custom endpoint returned ${customResponse.status}: ${errorText}`,
    );
  }

  return customResponse.body;
}

/**
 * Stream response from ChatGPT backend API (Codex)
 * Uses OAuth credentials from ChatGPT Plus/Pro subscription
 */
async function streamChatGPTResponse(
  messages: Array<{ role: string; content: string | object[] }>,
) {
  const credentials = await getChatGPTCredentials();

  if (!credentials) {
    throw new Error(
      "ChatGPT not connected. Please login with your ChatGPT Plus/Pro account in Settings.",
    );
  }

  const modelId = getChatGPTModelId();
  const headers = buildChatGPTHeaders(
    credentials.accessToken,
    credentials.accountId,
  );

  // Build the request body for ChatGPT backend API
  // The Codex API uses a slightly different format
  const requestBody = {
    model: modelId,
    messages: messages.map((m) => ({
      role: m.role,
      content:
        typeof m.content === "string" ? m.content : JSON.stringify(m.content),
    })),
    stream: true,
    temperature: 0.7,
    max_tokens: 4096,
  };

  const chatgptUrl = `${CHATGPT_API_CONFIG.baseUrl}${CHATGPT_API_CONFIG.codexResponsesPath}`;

  console.log("[ChatGPT] Sending request to:", chatgptUrl);
  console.log("[ChatGPT] Using model:", modelId);

  const chatgptResponse = await fetch(chatgptUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!chatgptResponse.ok) {
    const errorText = await chatgptResponse.text();
    console.error("ChatGPT API error:", chatgptResponse.status, errorText);

    // Handle specific error cases
    if (chatgptResponse.status === 401) {
      throw new Error(
        "ChatGPT authentication expired. Please re-login in Settings.",
      );
    }

    if (chatgptResponse.status === 429) {
      throw new Error("ChatGPT usage limit reached. Please try again later.");
    }

    throw new Error(
      `ChatGPT API returned ${chatgptResponse.status}: ${errorText}`,
    );
  }

  return chatgptResponse.body;
}

/**
 * Detect which local server is available (Ollama or llama.cpp)
 */
async function detectLocalServer(): Promise<"ollama" | "llamacpp" | null> {
  // Try Ollama first (more common, easier setup)
  try {
    const ollamaResponse = await fetch(`${OLLAMA_SERVER_URL}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    if (ollamaResponse.ok) {
      console.log("[LocalAI] Detected Ollama server");
      return "ollama";
    }
  } catch {
    // Ollama not available
  }

  // Try llama.cpp
  try {
    const llamaResponse = await fetch(`${LLAMA_SERVER_URL}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(2000),
    });
    if (llamaResponse.ok) {
      console.log("[LocalAI] Detected llama.cpp server");
      return "llamacpp";
    }
  } catch {
    // llama.cpp not available
  }

  return null;
}

/**
 * Stream response from Ollama API
 */
async function streamOllamaResponse(
  messages: Array<{ role: string; content: string }>,
  model: string = "llama3.1:8b",
  temperature: number = 0.7,
) {
  const chatRequest = {
    model,
    messages,
    stream: true,
    options: {
      temperature,
    },
  };

  const response = await fetch(`${OLLAMA_SERVER_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(chatRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Ollama API error:", response.status, errorText);
    throw new Error(`Ollama API returned ${response.status}: ${errorText}`);
  }

  return response.body;
}

/**
 * Stream response from llama.cpp server using OpenAI-compatible API
 * llama.cpp exposes /v1/chat/completions which follows the OpenAI format
 */
async function streamLlamaResponse(
  messages: Array<{ role: string; content: string }>,
  temperature: number = 0.7,
  maxTokens: number = 4096,
) {
  const chatRequest = {
    messages,
    stream: true,
    temperature,
    max_tokens: maxTokens,
  };

  // llama.cpp server uses OpenAI-compatible /v1/chat/completions endpoint
  const response = await fetch(`${LLAMA_SERVER_URL}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(chatRequest),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("llama.cpp API error:", response.status, errorText);

    if (response.status === 401) {
      throw new Error(
        "llama.cpp server requires authentication. Please check your server configuration.",
      );
    }

    if (response.status === 503 || errorText.includes("loading")) {
      throw new Error(
        "llama.cpp server is still loading the model. Please wait a moment and try again.",
      );
    }

    throw new Error(`llama.cpp API returned ${response.status}: ${errorText}`);
  }

  return response.body;
}

/**
 * Stream response from local AI server (auto-detects Ollama or llama.cpp)
 */
async function streamLocalResponse(
  messages: Array<{ role: string; content: string }>,
  temperature: number = 0.7,
  maxTokens: number = 4096,
  ollamaModel: string = "llama3.1:8b",
): Promise<{
  body: ReadableStream<Uint8Array> | null;
  serverType: "ollama" | "llamacpp";
}> {
  const serverType = await detectLocalServer();

  if (!serverType) {
    throw new Error(
      "No local AI server found. Please start Ollama (recommended) or llama.cpp server.\n\n" +
        "To start Ollama: ollama serve\n" +
        "To start llama.cpp: llama-server --model your-model.gguf --port 8082",
    );
  }

  if (serverType === "ollama") {
    const body = await streamOllamaResponse(messages, ollamaModel, temperature);
    return { body, serverType };
  } else {
    const body = await streamLlamaResponse(messages, temperature, maxTokens);
    return { body, serverType };
  }
}

/**
 * Converts ADD_FILE markers to CANVAS_EDIT markers on-the-fly for Loom mode.
 * This allows models to use their natural ADD_FILE format while the client receives CANVAS_EDIT format.
 *
 * The conversion buffers content between [ADD_FILE] and [/ADD_FILE], extracts the JSON "content" field,
 * and emits it wrapped in [CANVAS_EDIT_START:1]...[CANVAS_EDIT_END] markers.
 */
function convertAddFileToCanvasEdit(
  chunk: string,
  inAddFile: boolean,
  addFileBuffer: string,
): {
  content: string;
  inAddFile: boolean;
  addFileBuffer: string;
} {
  let newInAddFile = inAddFile;
  let newBuffer = addFileBuffer + chunk; // Always append chunk to buffer first
  let output = "";

  // Debug: log every chunk processed
  if (chunk.length > 0) {
    console.log(
      "[Loom Conversion] Processing chunk, length:",
      chunk.length,
      "inAddFile:",
      inAddFile,
      "bufferLength:",
      addFileBuffer.length,
    );
    if (chunk.includes("[ADD_FILE]") || chunk.includes("[/ADD_FILE]")) {
      console.log(
        "[Loom Conversion] Chunk contains marker:",
        chunk.substring(0, 100),
      );
    }
  }

  // Process the buffer looking for markers
  while (true) {
    if (!newInAddFile) {
      // Looking for [ADD_FILE] start marker
      const startIndex = newBuffer.indexOf("[ADD_FILE]");
      if (startIndex === -1) {
        // No start marker found - emit everything in buffer (it's safe text)
        output += newBuffer;
        newBuffer = "";
        break;
      }

      // Found start marker - emit text before it, then the converted marker
      output += newBuffer.slice(0, startIndex);
      output += "[CANVAS_EDIT_START:1]";
      newBuffer = newBuffer.slice(startIndex + "[ADD_FILE]".length);
      newInAddFile = true;
      console.log("[Loom Conversion] ADD_FILE start detected");
    }

    if (newInAddFile) {
      // Looking for [/ADD_FILE] end marker
      const endIndex = newBuffer.indexOf("[/ADD_FILE]");
      if (endIndex === -1) {
        // No end marker yet - keep buffering (don't emit partial JSON)
        console.log(
          "[Loom Conversion] Still buffering, waiting for end marker. Buffer length:",
          newBuffer.length,
        );
        break;
      }

      // Found end marker - extract and convert the content
      const jsonContent = newBuffer.slice(0, endIndex);
      const afterEnd = newBuffer.slice(endIndex + "[/ADD_FILE]".length);

      console.log(
        "[Loom Conversion] ADD_FILE end detected, JSON length:",
        jsonContent.length,
      );

      // Extract the "content" field from the JSON
      let extractedContent = "";
      try {
        // Try to parse as JSON first
        const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.content) {
            extractedContent = parsed.content;
            console.log(
              "[Loom Conversion] Successfully parsed JSON, content length:",
              extractedContent.length,
            );
          }
        }
      } catch (e) {
        // JSON parsing failed, try regex extraction
        console.log("[Loom Conversion] JSON parse failed, trying regex");
      }

      // Fallback: regex extraction for malformed JSON
      if (!extractedContent) {
        const contentMatch = jsonContent.match(
          /"content"\s*:\s*"((?:[^"\\]|\\.)*)"/,
        );
        if (contentMatch) {
          extractedContent = contentMatch[1]
            .replace(/\\n/g, "\n")
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, "\\")
            .replace(/\\t/g, "\t");
          console.log(
            "[Loom Conversion] Regex extracted content, length:",
            extractedContent.length,
          );
        }
      }

      // Emit the extracted content (or empty if extraction failed)
      if (extractedContent) {
        output += extractedContent;
        console.log(
          "[Loom Conversion] Successfully converted ADD_FILE to CANVAS_EDIT",
        );
      } else {
        console.log(
          "[Loom Conversion] Failed to extract content, buffer preview:",
          jsonContent.substring(0, 200),
        );
      }

      output += "[CANVAS_EDIT_END]";
      newBuffer = afterEnd;
      newInAddFile = false;
      console.log("[Loom Conversion] Conversion complete, state reset");

      // Continue loop to check for more ADD_FILE blocks in remaining buffer
    }
  }

  // Debug: log what we're returning
  if (output.length > 0 || newInAddFile !== inAddFile) {
    console.log(
      "[Loom Conversion] Returning - output length:",
      output.length,
      "newInAddFile:",
      newInAddFile,
      "newBuffer length:",
      newBuffer.length,
    );
    if (output.includes("[CANVAS_EDIT_START")) {
      console.log("[Loom Conversion] Output contains CANVAS_EDIT_START");
    }
    if (output.includes("[CANVAS_EDIT_END]")) {
      console.log("[Loom Conversion] Output contains CANVAS_EDIT_END");
    }
  }

  return {
    content: output,
    inAddFile: newInAddFile,
    addFileBuffer: newBuffer,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      message,
      sessionId,
      model,
      attachments,
      webSearchEnabled = false,
      loomEnabled = false,
      loomContext,
      history = [],
    } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 },
      );
    }

    // Validate and sanitize history - filter out empty assistant messages (Mistral requires content)
    const conversationHistory: ChatMessage[] = Array.isArray(history)
      ? history
          .filter(
            (h: any) =>
              h &&
              typeof h.role === "string" &&
              typeof h.content === "string" &&
              h.content.trim() !== "",
          )
          .map((h: any) => ({ role: h.role, content: h.content }))
      : [];

    const enhancedMessage = buildEnhancedMessage(message, attachments || []);

    let memoryContext = "";
    try {
      const memory = new MemorySystem();
      const relevantMemories = memory.getRelevantMemories(enhancedMessage);

      if (relevantMemories.length > 0) {
        memoryContext = "\n\n--- Memory Context ---\n";
        relevantMemories.forEach((mem, index) => {
          memoryContext += `Memory ${index + 1}: ${mem.content}\n`;
          if (mem.context) {
            memoryContext += `(Context: ${mem.context})\n`;
          }
        });
        memoryContext += "\n--- End Memory Context ---\n";
      }
    } catch (error) {
      console.error("Error loading memory:", error);
    }

    let webSearchContext = "";
    if (webSearchEnabled) {
      const needsWebSearch = shouldUseWebSearchForMessage(enhancedMessage);

      if (needsWebSearch) {
        try {
          const searchResponse = await fetch(
            `${process.env.BASE_URL || "http://localhost:3000"}/api/search`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                query: enhancedMessage,
                enable: true,
              }),
            },
          );

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (
              searchData.success &&
              searchData.results &&
              searchData.results.length > 0
            ) {
              webSearchContext =
                "\n\n=== CURRENT WEB SEARCH RESULTS (2025) ===\n";
              webSearchContext +=
                "IMPORTANT: These are REAL-TIME web search results. Use them NATURALLY in your response.\n";
              webSearchContext +=
                'Integrate this information seamlessly without announcing "based on web search".\n';
              webSearchContext +=
                "Only mention sources if they add credibility or specifically asked.\n\n";

              searchData.results.forEach((result: any, index: number) => {
                webSearchContext += `=== RESULT ${index + 1} ===\n`;
                webSearchContext += `TITLE: ${result.title}\n`;
                webSearchContext += `CONTENT: ${result.content}\n`;
                webSearchContext += `SOURCE: ${result.url}\n`;
                webSearchContext += `FROM: ${result.source}\n`;
                webSearchContext += `=== END RESULT ${index + 1} ===\n\n`;
              });

              webSearchContext += `=== SEARCH SUMMARY ===\n`;
              webSearchContext += `Found ${searchData.totalResults} results in ${searchData.searchTime}s\n`;
              webSearchContext += `Current date: 2025 (use this for time-sensitive answers)\n`;
              webSearchContext += `=== END WEB SEARCH RESULTS ===\n\n`;
            }
          }
        } catch (error) {
          console.error("Error performing web search:", error);
        }
      }
    }

    let streamBody: ReadableStream | null = null;

    let systemPrompt = atomSystemPrompt;
    if (model === "loux-large-experimental") {
      systemPrompt = louxSystemPrompt;
    }

    // Add loom instructions FIRST if loom mode is enabled (takes priority over ADD_FILE)
    // When Loom is active, we DON'T include ADD_FILE instructions to avoid confusion
    if (loomEnabled && loomContext) {
      systemPrompt += buildLoomInstructions(loomContext);
    } else {
      // Only add project tool instructions (ADD_FILE) when Loom is NOT active
      systemPrompt += buildProjectToolInstructions();
    }

    // Build messages array with system prompt, history, and current message
    const fullSystemPrompt = systemPrompt + memoryContext + webSearchContext;
    const messages: ChatMessage[] = [
      {
        role: "system",
        content: fullSystemPrompt,
      },
      // Include conversation history
      ...conversationHistory,
      // Add current user message
      { role: "user", content: enhancedMessage },
    ];

    const hasImages = attachments?.some((a: FileAttachment) =>
      a.type.startsWith("image/"),
    );

    if (hasImages) {
      // Replace the last user message with image content
      messages[messages.length - 1] = {
        role: "user",
        content:
          attachments
            ?.filter(
              (a: FileAttachment) => a.type.startsWith("image/") && a.base64,
            )
            .map((a: FileAttachment) => ({
              type: "image_url" as const,
              image_url: { url: a.base64! },
            })) || [],
      };
      messages.push({ role: "user", content: enhancedMessage });
    }

    // Route to the appropriate provider
    if (model === "chatgpt") {
      streamBody = await streamChatGPTResponse(messages);
      // Mark as ChatGPT for SSE parsing (uses similar format to OpenAI)
      (streamBody as any).__serverType = "chatgpt";
    } else if (model === "openai") {
      streamBody = await streamOpenAIResponse(messages);
    } else if (model === "anthropic") {
      // Anthropic needs system prompt passed separately
      streamBody = await streamAnthropicResponse(messages, fullSystemPrompt);
      // Mark as Anthropic for different SSE parsing
      (streamBody as any).__serverType = "anthropic";
    } else if (model === "openrouter") {
      streamBody = await streamOpenRouterResponse(messages);
    } else if (model === "custom") {
      streamBody = await streamCustomEndpointResponse(messages);
    } else if (
      model === "atom-large-experimental" ||
      model === "loux-large-experimental" ||
      model === "mistral"
    ) {
      streamBody = await streamMistralResponse(messages);
    } else {
      // Default: Local AI (atom) - works with both Ollama and llama.cpp
      const localResult = await streamLocalResponse(messages);
      streamBody = localResult.body;

      // Store server type for response parsing
      (streamBody as any).__serverType = localResult.serverType;
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        if (!streamBody) {
          controller.close();
          return;
        }

        const reader = streamBody.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        // State for converting ADD_FILE to CANVAS_EDIT when Loom is active
        let inAddFile = false;
        let addFileBuffer = "";

        // Debug: log whether Loom conversion is active
        console.log(
          "[Loom Conversion] Stream starting, loomEnabled:",
          loomEnabled,
          "loomContext exists:",
          !!loomContext,
        );

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            // Check response format based on server type
            const serverType = (streamBody as any)?.__serverType;
            const isOllama = serverType === "ollama";
            const isAnthropic = serverType === "anthropic";

            // Handle different streaming formats
            if (isAnthropic) {
              // Anthropic SSE format
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                if (trimmed.startsWith("data: ")) {
                  const data = trimmed.slice(6);
                  if (data === "[DONE]") break;

                  try {
                    const parsed = JSON.parse(data);
                    // Anthropic uses different event types
                    if (parsed.type === "content_block_delta") {
                      const content = parsed.delta?.text;
                      if (content) {
                        // If Loom is active, convert ADD_FILE markers
                        if (loomEnabled && loomContext) {
                          const converted = convertAddFileToCanvasEdit(
                            content,
                            inAddFile,
                            addFileBuffer,
                          );
                          inAddFile = converted.inAddFile;
                          addFileBuffer = converted.addFileBuffer;
                          if (converted.content) {
                            controller.enqueue(
                              encoder.encode(
                                `data: ${JSON.stringify({ choices: [{ delta: { content: converted.content } }] })}\n\n`,
                              ),
                            );
                          }
                        } else {
                          controller.enqueue(
                            encoder.encode(
                              `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`,
                            ),
                          );
                        }
                      }
                    }
                  } catch {
                    // Skip malformed JSON
                  }
                }
              }
            } else if (!isOllama) {
              // OpenAI-compatible format (llama.cpp, Mistral)
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                if (trimmed.startsWith("data: ")) {
                  const data = trimmed.slice(6);
                  if (data === "[DONE]") {
                    break;
                  }

                  try {
                    const parsed = JSON.parse(data);
                    let content = parsed.choices?.[0]?.delta?.content;
                    if (content) {
                      // Debug: log raw content chunks that contain ADD_FILE
                      if (
                        content.includes("[ADD_FILE]") ||
                        content.includes("[/ADD_FILE]")
                      ) {
                        console.log(
                          "[Loom Conversion] Raw chunk contains ADD_FILE marker, loomEnabled:",
                          loomEnabled,
                        );
                      }

                      // If Loom is active, convert ADD_FILE markers to CANVAS_EDIT on-the-fly
                      if (loomEnabled && loomContext) {
                        const converted = convertAddFileToCanvasEdit(
                          content,
                          inAddFile,
                          addFileBuffer,
                        );
                        content = converted.content;
                        inAddFile = converted.inAddFile;
                        addFileBuffer = converted.addFileBuffer;
                      }

                      // Debug: log what we're sending to client
                      if (
                        content.includes("[CANVAS_EDIT_START") ||
                        content.includes("[CANVAS_EDIT_END]")
                      ) {
                        console.log(
                          "[Loom Conversion] Sending CANVAS_EDIT marker to client:",
                          content.substring(0, 100),
                        );
                      }

                      controller.enqueue(
                        encoder.encode(
                          `data: ${JSON.stringify({ content })}\n\n`,
                        ),
                      );
                    }
                  } catch (e) {
                    console.error(
                      "Error parsing SSE data:",
                      e,
                      "Raw data:",
                      data,
                    );
                  }
                }
              }
            } else {
              // Ollama streaming format (newline-delimited JSON)
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                try {
                  const parsed = JSON.parse(trimmed);
                  let content = parsed.message?.content;
                  if (content) {
                    // If Loom is active, convert ADD_FILE markers to CANVAS_EDIT on-the-fly
                    if (loomEnabled && loomContext) {
                      const converted = convertAddFileToCanvasEdit(
                        content,
                        inAddFile,
                        addFileBuffer,
                      );
                      content = converted.content;
                      inAddFile = converted.inAddFile;
                      addFileBuffer = converted.addFileBuffer;
                    }

                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ content })}\n\n`,
                      ),
                    );
                  }

                  // Check if this is the final message
                  if (parsed.done) {
                    break;
                  }
                } catch (e) {
                  console.error(
                    "Error parsing Ollama SSE data:",
                    e,
                    "Raw data:",
                    trimmed,
                  );
                }
              }
            }
          }
        } catch (error) {
          console.error("Stream error:", error);
          controller.error(error);
        } finally {
          controller.close();
        }
      },
    });

    (async () => {
      try {
        const memory = new MemorySystem();
        const learnings =
          await memory.extractLearningsFromConversation(enhancedMessage);

        if (learnings.length > 0) {
          learnings.forEach((learning) => {
            memory.addMemoryEntry(
              "learning",
              learning,
              enhancedMessage.substring(0, 100),
              2,
            );
          });
        }
      } catch (error) {
        console.error("Error extracting learnings:", error);
      }
    })();

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);

    if (error instanceof Error) {
      if (error.message.includes("ECONNREFUSED")) {
        return NextResponse.json(
          {
            error: "Cannot connect to server. Please ensure server is running.",
          },
          { status: 503 },
        );
      }

      if (error.message.includes("authentication")) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      return NextResponse.json(
        { error: error.message || "Failed to process your request" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Failed to process your request" },
      { status: 500 },
    );
  }
}
