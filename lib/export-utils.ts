/**
 * Export utilities for Loom documents
 * Supports exporting as Markdown, Plain Text, and PDF
 */

// Check if File System Access API is available
export function isFileSystemAccessSupported(): boolean {
  return "showDirectoryPicker" in window;
}

// Store directory handle in memory (will be lost on page refresh)
let savedDirectoryHandle: FileSystemDirectoryHandle | null = null;

/**
 * Get the saved directory handle
 */
export function getSavedDirectoryHandle(): FileSystemDirectoryHandle | null {
  return savedDirectoryHandle;
}

/**
 * Prompt user to select an export directory
 */
export async function selectExportDirectory(): Promise<FileSystemDirectoryHandle | null> {
  if (!isFileSystemAccessSupported()) {
    return null;
  }

  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: "readwrite",
      startIn: "documents",
    });
    savedDirectoryHandle = handle;
    return handle;
  } catch (error) {
    // User cancelled or error occurred
    console.error("Failed to select directory:", error);
    return null;
  }
}

/**
 * Clear the saved directory handle
 */
export function clearSavedDirectory(): void {
  savedDirectoryHandle = null;
}

// Extended FileSystemDirectoryHandle with permission methods (not yet in standard TS types)
interface ExtendedFileSystemDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission(descriptor: {
    mode: "read" | "readwrite";
  }): Promise<PermissionState>;
  requestPermission(descriptor: {
    mode: "read" | "readwrite";
  }): Promise<PermissionState>;
}

/**
 * Write a file to the saved directory, or fall back to download
 */
async function writeFileToDirectory(
  content: string,
  filename: string,
  mimeType: string,
): Promise<boolean> {
  if (savedDirectoryHandle) {
    try {
      const handle = savedDirectoryHandle as ExtendedFileSystemDirectoryHandle;

      // Verify we still have permission
      const permission = await handle.queryPermission({
        mode: "readwrite",
      });
      if (permission !== "granted") {
        const requestResult = await handle.requestPermission({
          mode: "readwrite",
        });
        if (requestResult !== "granted") {
          savedDirectoryHandle = null;
          return false;
        }
      }

      // Write the file
      const fileHandle = await savedDirectoryHandle.getFileHandle(filename, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (error) {
      console.error("Failed to write to directory:", error);
      savedDirectoryHandle = null;
      return false;
    }
  }
  return false;
}

/**
 * Strip markdown formatting from text to get plain text
 */
export function stripMarkdown(markdown: string): string {
  let text = markdown;

  // Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, (match) => {
    // Extract just the code content without the backticks and language identifier
    const lines = match.split("\n");
    return lines.slice(1, -1).join("\n");
  });

  // Remove inline code
  text = text.replace(/`([^`]+)`/g, "$1");

  // Remove headers (keep the text)
  text = text.replace(/^#{1,6}\s+(.*)$/gm, "$1");

  // Remove bold/italic markers
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "$1"); // Bold italic
  text = text.replace(/\*\*([^*]+)\*\*/g, "$1"); // Bold
  text = text.replace(/\*([^*]+)\*/g, "$1"); // Italic
  text = text.replace(/___([^_]+)___/g, "$1"); // Bold italic
  text = text.replace(/__([^_]+)__/g, "$1"); // Bold
  text = text.replace(/_([^_]+)_/g, "$1"); // Italic

  // Remove strikethrough
  text = text.replace(/~~([^~]+)~~/g, "$1");

  // Remove links but keep text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  // Remove images
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");

  // Remove blockquotes marker
  text = text.replace(/^>\s?/gm, "");

  // Remove horizontal rules
  text = text.replace(/^[-*_]{3,}$/gm, "");

  // Remove list markers but keep content
  text = text.replace(/^[\s]*[-*+]\s+/gm, "");
  text = text.replace(/^[\s]*\d+\.\s+/gm, "");

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Clean up extra whitespace
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

/**
 * Download a file with the given content
 */
export function downloadFile(
  content: string,
  filename: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export document as Markdown file
 */
export async function exportAsMarkdown(
  content: string,
  title: string,
): Promise<void> {
  const filename = sanitizeFilename(title) + ".md";
  const savedToDir = await writeFileToDirectory(
    content,
    filename,
    "text/markdown",
  );
  if (!savedToDir) {
    downloadFile(content, filename, "text/markdown");
  }
}

/**
 * Export document as plain text file
 */
export async function exportAsPlainText(
  content: string,
  title: string,
): Promise<void> {
  const plainText = stripMarkdown(content);
  const filename = sanitizeFilename(title) + ".txt";
  const savedToDir = await writeFileToDirectory(
    plainText,
    filename,
    "text/plain",
  );
  if (!savedToDir) {
    downloadFile(plainText, filename, "text/plain");
  }
}

/**
 * Sanitize a filename by removing/replacing invalid characters
 */
function sanitizeFilename(name: string): string {
  return (
    name
      .replace(/[<>:"/\\|?*]/g, "") // Remove invalid chars
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .replace(/_{2,}/g, "_") // Replace multiple underscores with single
      .replace(/^_|_$/g, "") // Remove leading/trailing underscores
      .slice(0, 100) || // Limit length
    "document"
  ); // Fallback
}

/**
 * PDF export options
 */
export interface PdfExportOptions {
  showPageNumbers: boolean;
  showDate: boolean;
}

/**
 * Generate HTML from markdown for PDF export
 */
export function markdownToHtml(
  markdown: string,
  title: string,
  options?: PdfExportOptions,
): string {
  // Simple markdown to HTML conversion for PDF
  let html = markdown;

  // Escape HTML entities first
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks (must be before other transformations)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
  });

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headers
  html = html.replace(/^######\s+(.*)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.*)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.*)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.*)$/gm, "<h1>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/___([^_]+)___/g, "<strong><em>$1</em></strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");

  // Strikethrough
  html = html.replace(/~~([^~]+)~~/g, "<del>$1</del>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Blockquotes
  html = html.replace(/^&gt;\s?(.*)$/gm, "<blockquote>$1</blockquote>");

  // Horizontal rules
  html = html.replace(/^[-*_]{3,}$/gm, "<hr>");

  // Unordered lists
  html = html.replace(/^[-*+]\s+(.*)$/gm, "<li>$1</li>");

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.*)$/gm, "<li>$1</li>");

  // Wrap consecutive <li> elements in <ul> or <ol>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    return `<ul>${match}</ul>`;
  });

  // Paragraphs - wrap remaining text blocks
  const lines = html.split("\n");
  const processedLines: string[] = [];
  let inParagraph = false;
  let paragraphContent: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const isBlockElement =
      /^<(h[1-6]|pre|ul|ol|li|blockquote|hr)/.test(trimmed) ||
      /<\/(h[1-6]|pre|ul|ol|blockquote)>$/.test(trimmed);

    if (isBlockElement || trimmed === "") {
      if (inParagraph && paragraphContent.length > 0) {
        processedLines.push(`<p>${paragraphContent.join(" ")}</p>`);
        paragraphContent = [];
        inParagraph = false;
      }
      if (trimmed !== "") {
        processedLines.push(line);
      }
    } else {
      inParagraph = true;
      paragraphContent.push(trimmed);
    }
  }

  if (paragraphContent.length > 0) {
    processedLines.push(`<p>${paragraphContent.join(" ")}</p>`);
  }

  html = processedLines.join("\n");

  // Build custom footer content based on options
  const showPageNumbers = options?.showPageNumbers ?? false;
  const showDate = options?.showDate ?? false;

  // Build footer parts
  const footerParts: string[] = [];
  if (showDate) {
    const now = new Date();
    const dateStr = now.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    footerParts.push(dateStr);
  }

  // For page numbers, we use CSS counters in @page
  const pageNumberFooter = showPageNumbers
    ? `content: "Page " counter(page) " of " counter(pages);`
    : `content: "";`;

  const dateFooter =
    footerParts.length > 0
      ? `content: "${footerParts.join(" | ")}";`
      : `content: "";`;

  // Wrap in full HTML document
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      margin: 0.75in 1in;
      @bottom-right {
        ${pageNumberFooter}
        font-size: 10px;
        color: #666;
      }
      @bottom-left {
        ${dateFooter}
        font-size: 10px;
        color: #666;
      }
    }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 100%;
      margin: 0;
      padding: 0;
      line-height: 1.6;
      color: #333;
    }
    h1, h2, h3, h4, h5, h6 {
      margin-top: 1.5em;
      margin-bottom: 0.5em;
      font-weight: 600;
    }
    h1:first-child, h2:first-child, h3:first-child {
      margin-top: 0;
    }
    h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
    h3 { font-size: 1.25em; }
    p { margin: 1em 0; }
    code {
      background: #f4f4f4;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'SF Mono', Consolas, monospace;
      font-size: 0.9em;
    }
    pre {
      background: #f4f4f4;
      padding: 1em;
      border-radius: 5px;
      overflow-x: auto;
    }
    pre code {
      background: none;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #ddd;
      margin: 1em 0;
      padding-left: 1em;
      color: #666;
    }
    ul, ol {
      margin: 1em 0;
      padding-left: 2em;
    }
    li { margin: 0.25em 0; }
    hr {
      border: none;
      border-top: 1px solid #eee;
      margin: 2em 0;
    }
    a { color: #0066cc; }
    strong { font-weight: 600; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
}

/**
 * Export document as PDF
 * Uses the browser's print functionality to generate a PDF
 */
export async function exportAsPdf(
  content: string,
  title: string,
  options?: PdfExportOptions,
): Promise<void> {
  const html = markdownToHtml(content, title, options);

  // Create a new window for printing
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    throw new Error(
      "Could not open print window. Please allow popups for this site.",
    );
  }

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to load, then print
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
      // Close after a delay to allow print dialog to complete
      setTimeout(() => {
        printWindow.close();
      }, 1000);
    }, 250);
  };
}
