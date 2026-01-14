import { NextResponse } from "next/server";
import ProjectSystem from "@/lib/projects";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

/**
 * POST /api/projects/[projectId]/folders
 * Create a new folder in a project
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { name, parentPath = "" } = body;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Folder name is required" },
        { status: 400 },
      );
    }

    // Validate folder name (no special characters that could cause path issues)
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(name)) {
      return NextResponse.json(
        { success: false, error: "Folder name contains invalid characters" },
        { status: 400 },
      );
    }

    const projectSystem = new ProjectSystem();
    const folder = projectSystem.createFolder(projectId, parentPath, name);

    if (!folder) {
      return NextResponse.json(
        { success: false, error: "Failed to create folder" },
        { status: 500 },
      );
    }

    // Return updated tree
    const tree = projectSystem.buildFileTree(projectId);

    return NextResponse.json({
      success: true,
      folder,
      tree,
    });
  } catch (error) {
    console.error("Folders API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create folder" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/projects/[projectId]/folders
 * Delete a folder and all its contents
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const folderPath = searchParams.get("path");

    if (!folderPath) {
      return NextResponse.json(
        { success: false, error: "Folder path is required" },
        { status: 400 },
      );
    }

    const projectSystem = new ProjectSystem();
    const success = projectSystem.deleteFolder(projectId, folderPath);

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Failed to delete folder" },
        { status: 500 },
      );
    }

    // Return updated tree
    const tree = projectSystem.buildFileTree(projectId);

    return NextResponse.json({
      success: true,
      tree,
    });
  } catch (error) {
    console.error("Folders API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete folder" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/projects/[projectId]/folders
 * Rename a folder or toggle expanded state
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { path: folderPath, action, newName } = body;

    if (!folderPath) {
      return NextResponse.json(
        { success: false, error: "Folder path is required" },
        { status: 400 },
      );
    }

    const projectSystem = new ProjectSystem();

    if (action === "toggle") {
      // Toggle expanded state
      const isExpanded = projectSystem.toggleFolderExpanded(
        projectId,
        folderPath,
      );
      const tree = projectSystem.buildFileTree(projectId);

      return NextResponse.json({
        success: true,
        isExpanded,
        tree,
      });
    } else if (action === "rename" && newName) {
      // Validate folder name
      const invalidChars = /[<>:"/\\|?*]/;
      if (invalidChars.test(newName)) {
        return NextResponse.json(
          { success: false, error: "Folder name contains invalid characters" },
          { status: 400 },
        );
      }

      const folder = projectSystem.renameFolder(projectId, folderPath, newName);

      if (!folder) {
        return NextResponse.json(
          { success: false, error: "Failed to rename folder" },
          { status: 500 },
        );
      }

      const tree = projectSystem.buildFileTree(projectId);

      return NextResponse.json({
        success: true,
        folder,
        tree,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 },
      );
    }
  } catch (error) {
    console.error("Folders API error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update folder" },
      { status: 500 },
    );
  }
}
