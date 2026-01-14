import { NextRequest, NextResponse } from "next/server";

const LLAMA_SERVER_URL =
  process.env.LLAMA_SERVER_URL || "http://localhost:8082";
const OLLAMA_SERVER_URL =
  process.env.OLLAMA_SERVER_URL || "http://localhost:11434";

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
}

interface OllamaTagsResponse {
  models: OllamaModel[];
}

interface LlamaCppHealth {
  status: string;
  slots_idle?: number;
  slots_processing?: number;
}

interface LlamaCppModel {
  id: string;
  object: string;
  owned_by: string;
}

interface LlamaCppModelsResponse {
  object: string;
  data: LlamaCppModel[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { serverUrl } = body;

    // Results object to track what we find
    const results = {
      ollama: {
        connected: false,
        models: [] as string[],
        error: null as string | null,
      },
      llamacpp: {
        connected: false,
        modelLoaded: false,
        modelName: null as string | null,
        slotsAvailable: 0,
        error: null as string | null,
      },
    };

    // 1. Check Ollama (always check default port)
    try {
      const ollamaResponse = await fetch(`${OLLAMA_SERVER_URL}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (ollamaResponse.ok) {
        results.ollama.connected = true;
        try {
          const data: OllamaTagsResponse = await ollamaResponse.json();
          results.ollama.models = data.models?.map((m) => m.name) || [];
        } catch {
          // Connected but couldn't parse models
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("ECONNREFUSED")) {
          results.ollama.error = "Ollama not running";
        } else if (
          error.message.includes("timeout") ||
          error.name === "TimeoutError"
        ) {
          results.ollama.error = "Ollama connection timed out";
        }
      }
    }

    // 2. Check llama.cpp (use provided serverUrl or default)
    const llamaUrl = serverUrl || LLAMA_SERVER_URL;
    const baseUrl = llamaUrl.replace(/\/+$/, "");

    // Try /health endpoint
    try {
      const healthResponse = await fetch(`${baseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (healthResponse.ok) {
        results.llamacpp.connected = true;
        try {
          const healthData: LlamaCppHealth = await healthResponse.json();
          if (healthData.slots_idle !== undefined) {
            results.llamacpp.slotsAvailable = healthData.slots_idle;
          }
          if (
            healthData.status === "ok" ||
            healthData.status === "no slot available"
          ) {
            results.llamacpp.modelLoaded = true;
          }
        } catch {
          // Health endpoint returned OK but not JSON - still healthy
          results.llamacpp.modelLoaded = true;
        }
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes("ECONNREFUSED")) {
          results.llamacpp.error = "llama.cpp server not running";
        } else if (
          error.message.includes("timeout") ||
          error.name === "TimeoutError"
        ) {
          results.llamacpp.error = "llama.cpp connection timed out";
        }
      }
    }

    // Try /v1/models endpoint for model info
    if (results.llamacpp.connected) {
      try {
        const modelsResponse = await fetch(`${baseUrl}/v1/models`, {
          method: "GET",
          signal: AbortSignal.timeout(5000),
        });

        if (modelsResponse.ok) {
          const modelsData: LlamaCppModelsResponse =
            await modelsResponse.json();
          if (modelsData.data && modelsData.data.length > 0) {
            results.llamacpp.modelLoaded = true;
            results.llamacpp.modelName = modelsData.data[0].id;
          }
        }
      } catch {
        // Models endpoint not available, that's fine
      }
    }

    // Determine overall status and response
    const ollamaAvailable =
      results.ollama.connected && results.ollama.models.length > 0;
    const llamacppAvailable =
      results.llamacpp.connected && results.llamacpp.modelLoaded;

    if (ollamaAvailable || llamacppAvailable) {
      // At least one server is available
      let message = "";
      const details: Record<string, unknown> = {};

      if (ollamaAvailable) {
        message = `Ollama connected with ${results.ollama.models.length} model(s)`;
        details.ollama = {
          models: results.ollama.models.slice(0, 5), // First 5 models
          totalModels: results.ollama.models.length,
        };
        details.serverType = "ollama";
        details.recommended = results.ollama.models[0];
      }

      if (llamacppAvailable) {
        if (message) {
          message += ". ";
        }
        message += results.llamacpp.modelName
          ? `llama.cpp connected with model: ${results.llamacpp.modelName}`
          : "llama.cpp connected and ready";
        details.llamacpp = {
          modelName: results.llamacpp.modelName,
          slotsAvailable: results.llamacpp.slotsAvailable,
        };
        if (!ollamaAvailable) {
          details.serverType = "llamacpp";
        }
      }

      return NextResponse.json({
        connected: true,
        message,
        modelLoaded: true,
        details,
      });
    }

    // Check if servers are running but no models
    if (results.ollama.connected && results.ollama.models.length === 0) {
      return NextResponse.json({
        connected: true,
        message:
          'Ollama is running but no models installed. Run "ollama pull llama3.1:8b" to download a model.',
        modelLoaded: false,
        details: { serverType: "ollama" },
      });
    }

    if (results.llamacpp.connected && !results.llamacpp.modelLoaded) {
      return NextResponse.json({
        connected: true,
        message:
          "llama.cpp server is running but no model is loaded. Start the server with a model file.",
        modelLoaded: false,
        details: { serverType: "llamacpp" },
      });
    }

    // Nothing connected
    let errorMessage =
      "No local AI server found.\n\n" +
      "Option 1 (Recommended): Start Ollama\n" +
      "  $ ollama serve\n" +
      "  $ ollama pull llama3.1:8b\n\n" +
      "Option 2: Start llama.cpp\n" +
      "  $ llama-server --model your-model.gguf --port 8082";

    return NextResponse.json({
      connected: false,
      error: errorMessage,
      details: {
        ollamaError: results.ollama.error,
        llamacppError: results.llamacpp.error,
      },
    });
  } catch (error) {
    console.error("Test connection error:", error);

    return NextResponse.json(
      {
        connected: false,
        error: "Failed to test connection",
      },
      { status: 503 },
    );
  }
}
