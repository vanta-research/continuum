import { NextRequest } from 'next/server';
import ModelSystem from '@/lib/models';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const { modelId, fileName, downloadUrl, size, quantization, token } =
      await request.json();

    if (!modelId || !fileName || !downloadUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'modelId, fileName, and downloadUrl are required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const modelSystem = new ModelSystem();

    // Check if already downloaded
    if (modelSystem.isModelDownloaded(modelId, fileName)) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Model already downloaded',
          alreadyExists: true,
          model: modelSystem
            .getLocalModels()
            .find((m) => m.modelId === modelId && m.fileName === fileName),
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: string, data: object) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        };

        try {
          // Set up headers for the download
          const headers: Record<string, string> = {};
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          sendEvent('progress', {
            status: 'starting',
            progress: 0,
            total: size || 0,
            message: 'Starting download...',
          });

          // Start the download
          const response = await fetch(downloadUrl, { headers });

          if (!response.ok) {
            throw new Error(
              `Download failed: ${response.status} ${response.statusText}`
            );
          }

          // Get content length from response if available
          const contentLength =
            parseInt(response.headers.get('content-length') || '0', 10) ||
            size ||
            0;

          // Get the file path
          const filePath = modelSystem.getModelPath(fileName);

          // Ensure directory exists
          const dir = path.dirname(filePath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }

          // Use a temporary file for download
          const tempFilePath = `${filePath}.part`;

          // Stream the response to disk with progress tracking
          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }

          const writeStream = fs.createWriteStream(tempFilePath);
          let downloadedBytes = 0;
          let lastProgressUpdate = Date.now();

          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            // Write chunk to file
            writeStream.write(Buffer.from(value));
            downloadedBytes += value.length;

            // Send progress updates at most every 100ms to avoid flooding
            const now = Date.now();
            if (now - lastProgressUpdate >= 100 || downloadedBytes === contentLength) {
              const progressPercent = contentLength > 0
                ? Math.round((downloadedBytes / contentLength) * 100)
                : 0;

              sendEvent('progress', {
                status: 'downloading',
                progress: downloadedBytes,
                total: contentLength,
                percent: progressPercent,
                message: `Downloading... ${progressPercent}%`,
              });

              lastProgressUpdate = now;
            }
          }

          // Close the write stream
          await new Promise<void>((resolve, reject) => {
            writeStream.end((err: Error | null) => {
              if (err) reject(err);
              else resolve();
            });
          });

          // Rename temp file to final file
          fs.renameSync(tempFilePath, filePath);

          // Register the model in the index
          const localModel = modelSystem.registerDownloadedModel(
            modelId,
            fileName,
            downloadedBytes || size,
            quantization || 'Unknown'
          );

          sendEvent('complete', {
            status: 'complete',
            progress: downloadedBytes,
            total: contentLength,
            percent: 100,
            message: 'Download complete!',
            model: localModel,
          });
        } catch (error) {
          console.error('Download stream error:', error);
          sendEvent('error', {
            status: 'error',
            message:
              error instanceof Error ? error.message : 'Download failed',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Error initializing download:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to start download',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
