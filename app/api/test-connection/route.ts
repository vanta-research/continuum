import { NextRequest, NextResponse } from "next/server";

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

    if (!serverUrl) {
      return NextResponse.json(
        { error: "Server URL is required" },
        { status: 400 },
      );
    }

    // Clean up the URL (remove trailing slash)
    const baseUrl = serverUrl.replace(/\/+$/, "");

    // Try multiple endpoints to determine server status
    const results = {
      health: false,
      models: false,
      modelLoaded: false,
      modelName: null as string | null,
      slotsAvailable: 0,
      error: null as string | null,
    };

    // 1. Check /health endpoint (llama.cpp native)
    try {
      const healthResponse = await fetch(`${baseUrl}/health`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (healthResponse.ok) {
        results.health = true;
        try {
          const healthData: LlamaCppHealth = await healthResponse.json();
          if (healthData.slots_idle !== undefined) {
            results.slotsAvailable = healthData.slots_idle;
          }
          // Check if model is loaded based on status
          if (
            healthData.status === "ok" ||
            healthData.status === "no slot available"
          ) {
            results.modelLoaded = true;
          }
        } catch {
          // Health endpoint returned OK but not JSON - still healthy
          results.modelLoaded = true;
        }
      }
    } catch (error) {
      // Health check failed, try other endpoints
      console.log("Health endpoint not available:", error);
    }

    // 2. Check /v1/models endpoint (OpenAI-compatible)
    try {
      const modelsResponse = await fetch(`${baseUrl}/v1/models`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (modelsResponse.ok) {
        results.models = true;
        try {
          const modelsData: LlamaCppModelsResponse =
            await modelsResponse.json();
          if (modelsData.data && modelsData.data.length > 0) {
            results.modelLoaded = true;
            results.modelName = modelsData.data[0].id;
          }
        } catch {
          // Models endpoint returned OK but couldn't parse
        }
      }
    } catch (error) {
      console.log("Models endpoint not available:", error);
    }

    // 3. If basic checks passed but no model info, try a minimal completion
    if (results.health && !results.modelLoaded) {
      try {
        const testResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: "hi" }],
            max_tokens: 1,
            stream: false,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (testResponse.ok) {
          results.modelLoaded = true;
        } else {
          const errorText = await testResponse.text();
          if (errorText.includes("loading") || errorText.includes("Loading")) {
            results.error = "Model is still loading. Please wait...";
          }
        }
      } catch (error) {
        console.log("Test completion failed:", error);
      }
    }

    // Determine overall connection status
    if (results.health || results.models) {
      if (results.modelLoaded) {
        return NextResponse.json({
          connected: true,
          message: results.modelName
            ? `Connected to llama.cpp server. Model: ${results.modelName}`
            : "Connected to llama.cpp server. Model loaded.",
          details: {
            modelName: results.modelName,
            slotsAvailable: results.slotsAvailable,
          },
        });
      } else {
        return NextResponse.json({
          connected: true,
          message:
            results.error ||
            "Connected to llama.cpp server, but no model is loaded. Start the server with a model file.",
          modelLoaded: false,
          details: {
            slotsAvailable: results.slotsAvailable,
          },
        });
      }
    }

    // All checks failed
    return NextResponse.json({
      connected: false,
      error:
        "Could not connect to llama.cpp server. Make sure the server is running.",
    });
  } catch (error) {
    console.error("Test connection error:", error);

    let errorMessage = "Failed to connect to llama.cpp server";
    if (error instanceof Error) {
      if (error.message.includes("ECONNREFUSED")) {
        errorMessage =
          "Connection refused. Make sure llama.cpp server is running on the specified URL.";
      } else if (
        error.message.includes("timeout") ||
        error.name === "TimeoutError"
      ) {
        errorMessage =
          "Connection timed out. The server may be starting up or unreachable.";
      } else if (error.message.includes("ENOTFOUND")) {
        errorMessage = "Server not found. Check the URL is correct.";
      }
    }

    return NextResponse.json(
      {
        connected: false,
        error: errorMessage,
      },
      { status: 503 },
    );
  }
}
