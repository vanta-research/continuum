import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    // Get API key from request header (client passes it from localStorage)
    const apiKey =
      request.headers.get("x-api-key") || process.env.OPENAI_API_KEY;

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
        errorData.error?.message || `OpenAI API error: ${response.status}`,
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
      error:
        error instanceof Error
          ? error.message
          : "Failed to fetch OpenAI models",
    });
  }
}
