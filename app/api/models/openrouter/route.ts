import { NextResponse } from "next/server";

interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  architecture?: {
    modality: string;
    tokenizer: string;
    instructed: boolean;
  };
}

export async function GET(request: Request) {
  try {
    // Get API key from request header (client passes it from localStorage)
    const apiKey =
      request.headers.get("x-api-key") || process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "OpenRouter API key not configured",
        },
        { status: 401 },
      );
    }

    const response = await fetch("https://openrouter.ai/api/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `OpenRouter API error: ${response.status}`,
      );
    }

    const responseData = await response.json();

    // OpenRouter API returns { data: [...models] }
    const models: OpenRouterModel[] = Array.isArray(responseData)
      ? responseData
      : responseData.data || [];

    // Filter and transform models for our use case
    const filteredModels = models
      .filter((model) => {
        // Filter for text-capable models with pricing info
        // OpenRouter uses modalities like "text->text", "text+image->text", etc.
        const modality = model.architecture?.modality || "";
        const isTextCapable =
          modality.includes("text") || modality.includes("chat");
        return isTextCapable && model.pricing && model.context_length > 0;
      })
      .map((model) => ({
        id: model.id,
        name: model.name,
        description: model.description || "OpenRouter model",
        pricing: model.pricing,
        contextLength: model.context_length,
        // Use 'openrouter' as the provider so routing works correctly
        // The original provider (e.g., 'moonshotai') is kept in originalProvider for display
        provider: "openrouter",
        originalProvider: model.id.split("/")[0],
        modelName: model.id.split("/")[1],
      }));

    return NextResponse.json({
      success: true,
      models: filteredModels,
      count: filteredModels.length,
    });
  } catch (error) {
    console.error("Error fetching OpenRouter models:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch OpenRouter models",
      },
      { status: 500 },
    );
  }
}
