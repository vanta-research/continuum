import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

// Structure for an enabled model
interface EnabledModel {
  id: string;
  name: string;
  provider: string;
}

// Note: API keys are stored client-side only (in localStorage) for security
// They are never sent to or stored on the server
interface Settings {
  // Server configuration
  serverUrl: string;
  temperature: number;
  maxTokens: number;
  streamResponse: boolean;
  selectedModel: string;

  // Custom OpenAI-compatible endpoint (non-sensitive config)
  customEndpointUrl: string;
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

  // Default settings (API keys are stored client-side only)
  return {
    serverUrl: process.env.LLAMA_SERVER_URL || "http://localhost:8082",
    temperature: 0.7,
    maxTokens: 2048,
    streamResponse: true,
    selectedModel: "atom",
    customEndpointUrl: "",
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

  // Update environment variables for runtime access (non-sensitive settings only)
  if (updated.serverUrl) {
    process.env.LLAMA_SERVER_URL = updated.serverUrl;
  }
  if (updated.customEndpointUrl) {
    process.env.CUSTOM_ENDPOINT_URL = updated.customEndpointUrl;
  }
  if (updated.customEndpointModelId) {
    process.env.CUSTOM_ENDPOINT_MODEL_ID = updated.customEndpointModelId;
  }

  return updated;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Note: API keys are NOT accepted here - they are stored client-side only
    const {
      serverUrl,
      temperature,
      maxTokens,
      streamResponse,
      selectedModel,
      customEndpointUrl,
      customEndpointModelId,
      enabledModels,
    } = body;

    const settings = saveSettings({
      serverUrl,
      temperature,
      maxTokens,
      streamResponse,
      selectedModel,
      customEndpointUrl,
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
