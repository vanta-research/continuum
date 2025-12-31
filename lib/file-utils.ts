export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  content?: string;
  base64?: string;
}

export async function processFile(file: File): Promise<FileAttachment> {
  const attachment: FileAttachment = {
    id: Date.now().toString() + Math.random().toString(36).substring(7),
    name: file.name,
    type: file.type,
    size: file.size,
  };

  if (file.type.startsWith('image/')) {
    attachment.base64 = await fileToBase64(file);
  } else if (file.type === 'application/pdf') {
    attachment.content = await extractPdfText(file);
  } else if (file.type === 'text/plain') {
    attachment.content = await fileToText(file);
  } else if (file.name.endsWith('.md')) {
    attachment.content = await fileToText(file);
  }

  return attachment;
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = (error) => reject(error);
  });
}

export function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (error) => reject(error);
  });
}

export async function extractPdfText(file: File): Promise<string> {
  try {
    const pdfParse = await import('pdf-parse');
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const data = await (pdfParse as any)(buffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    return '[Error: Could not extract text from PDF]';
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

export function getFileIcon(type: string): string {
  if (type.startsWith('image/')) return '🖼️';
  if (type === 'application/pdf') return '📄';
  if (type === 'text/plain') return '📝';
  if (type.includes('markdown') || type.endsWith('.md')) return '📝';
  return '📎';
}
