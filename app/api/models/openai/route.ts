import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

interface Settings {
  openaiApiKey?: string;
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

function getOpenAIApiKey(): string | undefined {
  const settings = loadSettings();
  return settings.openaiApiKey || process.env.OPENAI_API_KEY;
}

export async function GET() {
  try {
    const apiKey = getOpenAIApiKey();

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        models: [],
        error: "OpenAI API key not configured",
      });
    }

    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `OpenAI API error: ${response.status}`
      );
    }

    const data = await response.json();
    const models = data.data || [];

    // Filter for chat models and transform
    const chatModels = models
      .filter((model: any) => {
        const id = model.id.toLowerCase();
        // Include GPT models that support chat
        return (
          id.includes("gpt-4") ||
          id.includes("gpt-3.5") ||
          id.includes("o1") ||
          id.includes("o3")
        );
      })
      .map((model: any) => ({
        id: model.id,
        name: model.id,
        provider: "openai",
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      models: chatModels,
      count: chatModels.length,
    });
  } catch (error) {
    console.error("Error fetching OpenAI models:", error);
    return NextResponse.json({
      success: false,
      models: [],
      error: error instanceof Error ? error.message : "Failed to fetch OpenAI models",
    });
  }
}
