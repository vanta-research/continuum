import { NextResponse } from "next/server";
import path from "path";
import fs from "fs";

interface Settings {
  mistralApiKey?: string;
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

function getMistralApiKey(): string | undefined {
  const settings = loadSettings();
  return settings.mistralApiKey || process.env.MISTRAL_API_KEY;
}

export async function GET() {
  try {
    const apiKey = getMistralApiKey();

    if (!apiKey) {
      return NextResponse.json({
        success: true,
        models: [],
        error: "Mistral API key not configured",
      });
    }

    const response = await fetch("https://api.mistral.ai/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `Mistral API error: ${response.status}`,
      );
    }

    const data = await response.json();
    const models = data.data || [];

    // Transform models and deduplicate by ID
    const seenIds = new Set<string>();
    const transformedModels = models
      .filter((model: any) => {
        // Filter for chat-capable models
        const capabilities = model.capabilities || {};
        if (capabilities.completion_chat === false) return false;
        // Deduplicate
        if (seenIds.has(model.id)) return false;
        seenIds.add(model.id);
        return true;
      })
      .map((model: any) => ({
        id: model.id,
        name: model.id
          .replace(/-/g, " ")
          .replace(/\b\w/g, (c: string) => c.toUpperCase()),
        provider: "mistral",
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({
      success: true,
      models: transformedModels,
      count: transformedModels.length,
    });
  } catch (error) {
    console.error("Error fetching Mistral models:", error);
    return NextResponse.json({
      success: false,
      models: [],
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch Mistral models",
    });
  }
}
