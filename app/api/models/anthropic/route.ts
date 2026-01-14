import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

interface Settings {
  anthropicApiKey?: string;
}

function loadSettings(): Settings {
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

function getAnthropicApiKey(): string | undefined {
  const settings = loadSettings();
  return settings.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
}

export async function GET() {
  try {
    const apiKey = getAnthropicApiKey();

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        models: [],
        error: "Anthropic API key not configured",
      });
    }

    // Anthropic doesn't have a models list endpoint, so we provide known models
    // These are the currently available Claude models
    const knownModels = [
      { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet (Latest)" },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku (Latest)" },
      { id: "claude-3-opus-20240229", name: "Claude 3 Opus" },
      { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet" },
      { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku" },
    ];

    const models = knownModels.map((model) => ({
      id: model.id,
      name: model.name,
      provider: "anthropic",
    }));

    return NextResponse.json({
      success: true,
      models,
      count: models.length,
      configured: true,
    });
  } catch (error) {
    console.error("Error fetching Anthropic models:", error);
    return NextResponse.json({
      success: false,
      models: [],
      error: error instanceof Error ? error.message : "Failed to fetch Anthropic models",
    });
  }
}
