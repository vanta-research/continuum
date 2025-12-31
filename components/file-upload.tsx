'use client';

import { FileAttachment, formatFileSize, getFileIcon } from '@/lib/file-utils';
import { X, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Image from 'next/image';

interface FileUploadProps {
  attachments: FileAttachment[];
  onAddFile: (file: File) => Promise<void>;
  onRemoveFile: (id: string) => void;
  disabled?: boolean;
}

export default function FileUpload({
  attachments,
  onAddFile,
  onRemoveFile,
  disabled = false,
}: FileUploadProps) {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      for (const file of Array.from(files)) {
        await onAddFile(file);
      }
    }
  };

  return (
    <div className="space-y-3">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <Card
              key={attachment.id}
              className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-border/50"
            >
              {attachment.type.startsWith('image/') && attachment.base64 ? (
                <div className="relative h-8 w-8 overflow-hidden rounded">
                  <Image
                    src={attachment.base64}
                    alt={attachment.name}
                    fill
                    className="object-cover"
                  />
                </div>
              ) : (
                <span className="text-lg">{getFileIcon(attachment.type)}</span>
              )}
              <span className="max-w-[150px] truncate text-sm">{attachment.name}</span>
              <span className="text-xs text-muted-foreground">
                ({formatFileSize(attachment.size)})
              </span>
              {!disabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => onRemoveFile(attachment.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
        <input
          type="file"
          id="file-upload"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
          accept="image/*,.pdf,.txt,.md"
          multiple
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => document.getElementById('file-upload')?.click()}
          disabled={disabled}
        >
          <Paperclip className="h-4 w-4" />
          Attach Files
        </Button>
        <span className="text-xs text-muted-foreground">
          Images, PDFs, TXT, MD (max 10MB each)
        </span>
      </div>
    </div>
  );
}
