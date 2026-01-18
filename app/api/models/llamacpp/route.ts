import { NextRequest, NextResponse } from "next/server";

const LLAMA_SERVER_URL =
  process.env.LLAMA_SERVER_URL || "http://localhost:8082";

interface LlamaCppModel {
  id: string;
  object: string;
  owned_by: string;
  created?: number;
}

interface LlamaCppModelsResponse {
  object: string;
  data: LlamaCppModel[];
}

/**
 * GET /api/models/llamacpp
 * Fetches the list of models currently loaded in the llama.cpp server
 */
export async function GET(request: NextRequest) {
  try {
    // Allow custom server URL via query param
    const searchParams = request.nextUrl.searchParams;
    const serverUrl = searchParams.get("serverUrl") || LLAMA_SERVER_URL;
    const baseUrl = serverUrl.replace(/\/+$/, "");

    // First check if the server is healthy
    const healthResponse = await fetch(`${baseUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (!healthResponse.ok) {
      return NextResponse.json({
        success: false,
        connected: false,
        error: "llama.cpp server is not healthy",
        models: [],
      });
    }

    // Fetch models from the OpenAI-compatible endpoint
    const modelsResponse = await fetch(`${baseUrl}/v1/models`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });

    if (!modelsResponse.ok) {
      return NextResponse.json({
        success: false,
        connected: true,
        error: "Failed to fetch models from llama.cpp server",
        models: [],
      });
    }

    const modelsData: LlamaCppModelsResponse = await modelsResponse.json();

    // Transform to a consistent format for the frontend
    const models = modelsData.data.map((model) => ({
      id: model.id,
      name: extractModelName(model.id),
      provider: "llamacpp",
      object: model.object,
      owned_by: model.owned_by,
    }));

    return NextResponse.json({
      success: true,
      connected: true,
      models,
      count: models.length,
      serverUrl: baseUrl,
    });
  } catch (error) {
    console.error("Error fetching llama.cpp models:", error);

    // Determine the specific error
    let errorMessage = "Failed to connect to llama.cpp server";
    if (error instanceof Error) {
      if (error.message.includes("ECONNREFUSED")) {
        errorMessage = "llama.cpp server is not running";
      } else if (
        error.message.includes("timeout") ||
        error.name === "TimeoutError"
      ) {
        errorMessage = "Connection to llama.cpp server timed out";
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
 * Extract a human-readable model name from the model ID
 * llama.cpp typically returns the full path or filename as the ID
 */
function extractModelName(modelId: string): string {
  // Remove file extension
  let name = modelId.replace(/\.gguf$/i, "");

  // If it's a path, get just the filename
  if (name.includes("/")) {
    name = name.split("/").pop() || name;
  }
  if (name.includes("\\")) {
    name = name.split("\\").pop() || name;
  }

  // Clean up common patterns
  // e.g., "mistral-7b-instruct-v0.2.Q4_K_M" -> "Mistral 7B Instruct v0.2 (Q4_K_M)"
  const quantMatch = name.match(/[._-](Q\d+_[A-Z0-9_]+|F16|F32|BF16)$/i);
  let quantization = "";
  if (quantMatch) {
    quantization = quantMatch[1].toUpperCase();
    name = name.slice(0, -quantMatch[0].length);
  }

  // Replace common separators with spaces and capitalize
  name = name
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  if (quantization) {
    name = `${name} (${quantization})`;
  }

  return name;
}
