import { NextRequest, NextResponse } from "next/server";

const OLLAMA_SERVER_URL =
  process.env.OLLAMA_SERVER_URL || "http://localhost:11434";

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details?: {
    parent_model?: string;
    format?: string;
    family?: string;
    families?: string[];
    parameter_size?: string;
    quantization_level?: string;
  };
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

/**
 * GET /api/models/ollama
 * Fetches the list of models available in Ollama
 */
export async function GET(request: NextRequest) {
  try {
    // Allow custom server URL via query param
    const searchParams = request.nextUrl.searchParams;
    const serverUrl = searchParams.get("serverUrl") || OLLAMA_SERVER_URL;
    const baseUrl = serverUrl.replace(/\/+$/, "");

    // Fetch models from Ollama's API
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        connected: false,
        error: "Failed to fetch models from Ollama",
        models: [],
      });
    }

    const data: OllamaTagsResponse = await response.json();

    // Transform to a consistent format for the frontend
    const models = (data.models || []).map((model) => ({
      id: model.name,
      name: formatModelName(model.name, model.details),
      provider: "ollama",
      size: model.size,
      details: model.details,
    }));

    return NextResponse.json({
      success: true,
      connected: true,
      models,
      count: models.length,
      serverUrl: baseUrl,
    });
  } catch (error) {
    console.error("Error fetching Ollama models:", error);

    // Determine the specific error
    let errorMessage = "Failed to connect to Ollama";
    if (error instanceof Error) {
      if (error.message.includes("ECONNREFUSED")) {
        errorMessage = "Ollama is not running";
      } else if (
        error.message.includes("timeout") ||
        error.name === "TimeoutError"
      ) {
        errorMessage = "Connection to Ollama timed out";
      }
    }

    return NextResponse.json({
      success: false,
      connected: false,
      error: errorMessage,
      models: [],
    });
  }
}

/**
 * Format model name for display
 * e.g., "llama3.1:8b" -> "Llama 3.1 (8B)"
 */
function formatModelName(
  modelId: string,
  details?: OllamaModel["details"]
): string {
  // Split name and tag
  const [baseName, tag] = modelId.split(":");

  // Format base name: replace common patterns
  let name = baseName
    .replace(/(\d+)\.(\d+)/g, " $1.$2") // "llama3.1" -> "llama 3.1"
    .replace(/(\d+)b$/i, " $1B") // "8b" -> " 8B"
    .replace(/[-_]/g, " ")
    .trim();

  // Capitalize first letter of each word
  name = name.replace(/\b\w/g, (c) => c.toUpperCase());

  // Add tag info if present and not "latest"
  if (tag && tag !== "latest") {
    // Format common tags
    const formattedTag = tag
      .replace(/(\d+)b$/i, "$1B")
      .toUpperCase();
    name = `${name} (${formattedTag})`;
  } else if (details?.parameter_size) {
    // Use parameter size from details if available
    name = `${name} (${details.parameter_size})`;
  }

  return name;
}
