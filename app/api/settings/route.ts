import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface Settings {
  serverUrl: string;
  temperature: number;
  maxTokens: number;
  streamResponse: boolean;
  selectedModel: string;
  hfToken: string;
  mistralApiKey: string;
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

  // Also update environment variable for server URL
  if (updated.serverUrl) {
    process.env.LLAMA_SERVER_URL = updated.serverUrl;
  }

  // Update Mistral API key in environment if provided
  if (updated.mistralApiKey) {
    process.env.MISTRAL_API_KEY = updated.mistralApiKey;
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
    } = body;

    const settings = saveSettings({
      serverUrl,
      temperature,
      maxTokens,
      streamResponse,
      selectedModel,
      hfToken,
      mistralApiKey,
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
