import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Structure for an enabled model
interface EnabledModel {
  id: string;
  name: string;
  provider: string;
}

interface Settings {
  // Server configuration
  serverUrl: string;
  temperature: number;
  maxTokens: number;
  streamResponse: boolean;
  selectedModel: string;

  // HuggingFace token for model downloads
  hfToken: string;

  // Provider API Keys
  mistralApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  openrouterApiKey: string;

  // Custom OpenAI-compatible endpoint
  customEndpointUrl: string;
  customEndpointApiKey: string;
  customEndpointModelId: string;

  // User-selected models to show in dropdown
  enabledModels: EnabledModel[];
}

const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json");

function ensureDataDir() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function loadSettings(): Settings {
  try {
    ensureDataDir();
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }

  // Default settings
  return {
    serverUrl: process.env.LLAMA_SERVER_URL || "http://localhost:8082",
    temperature: 0.7,
    maxTokens: 2048,
    streamResponse: true,
    selectedModel: "atom",
    hfToken: "",
    mistralApiKey: "",
    openaiApiKey: "",
    anthropicApiKey: "",
    openrouterApiKey: "",
    customEndpointUrl: "",
    customEndpointApiKey: "",
    customEndpointModelId: "",
    enabledModels: [],
  };
}

function saveSettings(settings: Partial<Settings>): Settings {
  ensureDataDir();
  const current = loadSettings();
  const updated = { ...current, ...settings };

  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), "utf-8");
  } catch (error) {
    console.error("Error saving settings:", error);
    throw error;
  }

  // Update environment variables for runtime access
  if (updated.serverUrl) {
    process.env.LLAMA_SERVER_URL = updated.serverUrl;
  }
  if (updated.mistralApiKey) {
    process.env.MISTRAL_API_KEY = updated.mistralApiKey;
  }
  if (updated.openaiApiKey) {
    process.env.OPENAI_API_KEY = updated.openaiApiKey;
  }
  if (updated.anthropicApiKey) {
    process.env.ANTHROPIC_API_KEY = updated.anthropicApiKey;
  }
  if (updated.openrouterApiKey) {
    process.env.OPENROUTER_API_KEY = updated.openrouterApiKey;
  }
  if (updated.customEndpointUrl) {
    process.env.CUSTOM_ENDPOINT_URL = updated.customEndpointUrl;
  }
  if (updated.customEndpointApiKey) {
    process.env.CUSTOM_ENDPOINT_API_KEY = updated.customEndpointApiKey;
  }
  if (updated.customEndpointModelId) {
    process.env.CUSTOM_ENDPOINT_MODEL_ID = updated.customEndpointModelId;
  }

  return updated;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      serverUrl,
      temperature,
      maxTokens,
      streamResponse,
      selectedModel,
      hfToken,
      mistralApiKey,
      openaiApiKey,
      anthropicApiKey,
      openrouterApiKey,
      customEndpointUrl,
      customEndpointApiKey,
      customEndpointModelId,
      enabledModels,
    } = body;

    const settings = saveSettings({
      serverUrl,
      temperature,
      maxTokens,
      streamResponse,
      selectedModel,
      hfToken,
      mistralApiKey,
      openaiApiKey,
      anthropicApiKey,
      openrouterApiKey,
      customEndpointUrl,
      customEndpointApiKey,
      customEndpointModelId,
      enabledModels,
    });

    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Settings API error:", error);
    return NextResponse.json(
      { error: "Failed to save settings" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const settings = loadSettings();
    return NextResponse.json({
      success: true,
      settings,
    });
  } catch (error) {
    console.error("Settings API error:", error);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 },
    );
  }
}
