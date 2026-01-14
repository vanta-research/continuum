import { NextResponse } from "next/server";
import ProjectSystem from "@/lib/projects";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * GET /api/projects/[projectId]/files
 * List all files and folders in a project, with tree structure
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const projectSystem = new ProjectSystem();
    const files = projectSystem.listFiles(projectId);
    const folders = projectSystem.listFolders(projectId);
    const tree = projectSystem.buildFileTree(projectId);

    return NextResponse.json({
      success: true,
      files,
      folders,
      tree,
    });
  } catch (error) {
    console.error("Files API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list files" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/projects/[projectId]/files
 * Upload a file to a project (optionally in a folder)
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const extractedContent = formData.get("content") as string | null;
    const folderPath = formData.get("folderPath") as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 },
      );
    }

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const projectSystem = new ProjectSystem();
    const projectFile = projectSystem.saveFile(
      projectId,
      buffer,
      file.name,
      file.type,
      extractedContent || undefined,
      folderPath || undefined,
    );

    if (!projectFile) {
      return NextResponse.json(
        { success: false, error: "Project not found" },
        { status: 404 },
      );
    }

    // Return updated tree along with the new file
    const tree = projectSystem.buildFileTree(projectId);

    return NextResponse.json({
      success: true,
      file: projectFile,
      tree,
    });
  } catch (error) {
    console.error("Files API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload file" },
      { status: 500 },
    );
  }
}
