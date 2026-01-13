import fs from "fs";
import path from "path";

// Types for HuggingFace API responses
export interface HFModel {
  id: string;
  modelId: string;
  likes: number;
  downloads: number;
  tags: string[];
  pipeline_tag?: string;
  library_name?: string;
  createdAt: string;
}

export interface HFFile {
  type: "file" | "directory";
  path: string;
  size: number;
  lfs?: {
    oid: string;
    size: number;
    pointerSize: number;
  };
}

export interface GGUFFile {
  name: string;
  path: string;
  size: number;
  downloadUrl: string;
  quantization: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  displayName: string;
  description: string;
  size: string;
  tags: string[];
  downloads: number;
  likes: number;
  ggufFiles: GGUFFile[];
  hasGGUF: boolean;
}

export interface LocalModel {
  id: string;
  modelId: string;
  fileName: string;
  filePath: string;
  size: number;
  downloadedAt: number;
  quantization: string;
}

export interface ModelsIndex {
  models: LocalModel[];
  lastUpdated: number;
}

export interface HFTokenValidation {
  valid: boolean;
  username?: string;
  error?: string;
}

// Constants
const VANTA_RESEARCH_ORG = "vanta-research";
const HF_API_BASE = "https://huggingface.co/api";
const HF_DOWNLOAD_BASE = "https://huggingface.co";

/**
 * ModelSystem - Manages model downloads and local storage
 */
class ModelSystem {
  private modelsDir: string;
  private indexFile: string;

  constructor() {
    this.modelsDir = path.join(process.cwd(), "data", "models");
    this.indexFile = path.join(this.modelsDir, "index.json");
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
  }

  // ============================================================
  // Index Operations
  // ============================================================

  loadIndex(): ModelsIndex {
    try {
      if (fs.existsSync(this.indexFile)) {
        const data = fs.readFileSync(this.indexFile, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading models index:", error);
    }
    return { models: [], lastUpdated: Date.now() };
  }

  private saveIndex(index: ModelsIndex): void {
    try {
      index.lastUpdated = Date.now();
      const data = JSON.stringify(index, null, 2);
      fs.writeFileSync(this.indexFile, data, "utf-8");
    } catch (error) {
      console.error("Error saving models index:", error);
    }
  }

  // ============================================================
  // HuggingFace API Operations
  // ============================================================

  /**
   * Validate a HuggingFace token
   */
  async validateHFToken(token: string): Promise<HFTokenValidation> {
    try {
      const response = await fetch("https://huggingface.co/api/whoami-v2", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return {
          valid: true,
          username: data.name || data.fullname || "User",
        };
      } else if (response.status === 401) {
        return {
          valid: false,
          error: "Invalid token",
        };
      } else {
        return {
          valid: false,
          error: `API error: ${response.status}`,
        };
      }
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  }

  /**
   * Fetch all VANTA Research models from HuggingFace
   */
  async fetchVantaModels(token?: string): Promise<ModelInfo[]> {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${HF_API_BASE}/models?author=${VANTA_RESEARCH_ORG}`,
        { headers },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.status}`);
      }

      const models: HFModel[] = await response.json();

      // Fetch file info for each model to check for GGUF files
      const modelInfoPromises = models.map(async (model) => {
        const ggufFiles = await this.fetchModelGGUFFiles(model.id, token);
        return this.transformToModelInfo(model, ggufFiles);
      });

      const modelInfos = await Promise.all(modelInfoPromises);

      // Sort by downloads, prioritize models with GGUF files
      return modelInfos.sort((a, b) => {
        if (a.hasGGUF && !b.hasGGUF) return -1;
        if (!a.hasGGUF && b.hasGGUF) return 1;
        return b.downloads - a.downloads;
      });
    } catch (error) {
      console.error("Error fetching VANTA models:", error);
      throw error;
    }
  }

  /**
   * Fetch GGUF files for a specific model
   */
  async fetchModelGGUFFiles(
    modelId: string,
    token?: string,
  ): Promise<GGUFFile[]> {
    try {
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(
        `${HF_API_BASE}/models/${modelId}/tree/main`,
        { headers },
      );

      if (!response.ok) {
        return [];
      }

      const files: HFFile[] = await response.json();

      // Filter for GGUF files
      const ggufFiles = files
        .filter((file) => file.type === "file" && file.path.endsWith(".gguf"))
        .map((file) => ({
          name: path.basename(file.path),
          path: file.path,
          size: file.lfs?.size || file.size,
          downloadUrl: `${HF_DOWNLOAD_BASE}/${modelId}/resolve/main/${file.path}`,
          quantization: this.extractQuantization(file.path),
        }));

      return ggufFiles;
    } catch (error) {
      console.error(`Error fetching files for ${modelId}:`, error);
      return [];
    }
  }

  /**
   * Extract quantization type from filename
   */
  private extractQuantization(filename: string): string {
    const quantPatterns = [
      /Q8_0/i,
      /Q6_K/i,
      /Q5_K_M/i,
      /Q5_K_S/i,
      /Q5_0/i,
      /Q4_K_M/i,
      /Q4_K_S/i,
      /Q4_0/i,
      /Q3_K_M/i,
      /Q3_K_S/i,
      /Q2_K/i,
      /IQ4_XS/i,
      /IQ3_M/i,
      /IQ2_M/i,
      /F16/i,
      /F32/i,
    ];

    for (const pattern of quantPatterns) {
      const match = filename.match(pattern);
      if (match) {
        return match[0].toUpperCase();
      }
    }

    return "Unknown";
  }

  /**
   * Transform HF model data to our ModelInfo format
   */
  private transformToModelInfo(
    model: HFModel,
    ggufFiles: GGUFFile[],
  ): ModelInfo {
    // Extract model name from ID (e.g., "vanta-research/atom-27b" -> "Atom 27B")
    const shortName = model.id.split("/")[1] || model.id;
    const displayName = shortName
      .split("-")
      .map((part) => {
        // Handle size suffixes like "27b", "8b", etc.
        if (/^\d+b$/i.test(part)) {
          return part.toUpperCase();
        }
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");

    // Generate description from tags
    const relevantTags = model.tags.filter(
      (tag) =>
        !tag.startsWith("base_model:") &&
        !tag.startsWith("license:") &&
        !tag.startsWith("dataset:") &&
        !tag.startsWith("doi:") &&
        ![
          "en",
          "region:us",
          "endpoints_compatible",
          "safetensors",
          "gguf",
          "transformers",
          "peft",
        ].includes(tag),
    );

    const description =
      relevantTags.slice(0, 5).join(", ") || "VANTA Research language model";

    // Calculate total size of largest GGUF file
    const largestFile = ggufFiles.reduce(
      (max, file) => (file.size > max.size ? file : max),
      { size: 0 } as GGUFFile,
    );

    return {
      id: model.id,
      name: shortName,
      displayName,
      description,
      size: largestFile.size ? this.formatSize(largestFile.size) : "N/A",
      tags: relevantTags.slice(0, 8),
      downloads: model.downloads,
      likes: model.likes,
      ggufFiles,
      hasGGUF: ggufFiles.length > 0,
    };
  }

  // ============================================================
  // Local Model Operations
  // ============================================================

  /**
   * Get list of locally downloaded models
   */
  getLocalModels(): LocalModel[] {
    return this.loadIndex().models;
  }

  /**
   * Check if a model file is already downloaded
   */
  isModelDownloaded(modelId: string, fileName: string): boolean {
    const index = this.loadIndex();
    return index.models.some(
      (m) => m.modelId === modelId && m.fileName === fileName,
    );
  }

  /**
   * Get the local path for a model file
   */
  getModelPath(fileName: string): string {
    return path.join(this.modelsDir, fileName);
  }

  /**
   * Register a downloaded model in the index
   */
  registerDownloadedModel(
    modelId: string,
    fileName: string,
    size: number,
    quantization: string,
  ): LocalModel {
    const index = this.loadIndex();

    const localModel: LocalModel = {
      id: `local_${Date.now()}`,
      modelId,
      fileName,
      filePath: this.getModelPath(fileName),
      size,
      downloadedAt: Date.now(),
      quantization,
    };

    // Remove existing entry if re-downloading
    index.models = index.models.filter(
      (m) => !(m.modelId === modelId && m.fileName === fileName),
    );

    index.models.push(localModel);
    this.saveIndex(index);

    return localModel;
  }

  /**
   * Delete a local model
   */
  deleteLocalModel(modelId: string, fileName: string): boolean {
    try {
      const index = this.loadIndex();
      const model = index.models.find(
        (m) => m.modelId === modelId && m.fileName === fileName,
      );

      if (!model) return false;

      // Delete the file
      if (fs.existsSync(model.filePath)) {
        fs.unlinkSync(model.filePath);
      }

      // Update index
      index.models = index.models.filter(
        (m) => !(m.modelId === modelId && m.fileName === fileName),
      );
      this.saveIndex(index);

      return true;
    } catch (error) {
      console.error("Error deleting model:", error);
      return false;
    }
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  /**
   * Format file size to human readable string
   */
  formatSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * Get the download URL for a model file
   */
  getDownloadUrl(modelId: string, filePath: string): string {
    const baseUrl = `${HF_DOWNLOAD_BASE}/${modelId}/resolve/main/${filePath}`;
    // Token is passed via header, not URL
    return baseUrl;
  }

  /**
   * Get models directory path
   */
  getModelsDirectory(): string {
    return this.modelsDir;
  }
}

export default ModelSystem;
