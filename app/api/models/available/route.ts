import { NextResponse } from "next/server";
import ModelSystem from "@/lib/models";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token") || undefined;
    const showAll = searchParams.get("showAll") === "true";

    const modelSystem = new ModelSystem();
    // By default, only show the most recent GGUF model
    // Pass showAll=true to get all models
    const models = await modelSystem.fetchVantaModels(token, !showAll);

    return NextResponse.json({
      success: true,
      models,
      count: models.length,
    });
  } catch (error) {
    console.error("Error fetching available models:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch models",
      },
      { status: 500 },
    );
  }
}
