import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileAudio, Loader2, Check } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';

interface AudioUploadProps {
  songId: string;
  currentAudioPath: string | null;
  onUploadComplete: () => void;
}

export function AudioUpload({ songId, currentAudioPath, onUploadComplete }: AudioUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const utils = trpc.useUtils();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav'];
    if (!validTypes.includes(file.type)) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload an MP3 or WAV file.',
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('audio', file);

      const response = await fetch(`/api/upload-audio/${songId}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      toast({
        title: 'Audio uploaded',
        description: `Duration: ${Math.floor(result.duration / 60)}:${Math.floor(result.duration % 60).toString().padStart(2, '0')}`,
      });

      utils.songs.getById.invalidate({ id: songId });
      utils.songs.list.invalidate();
      onUploadComplete();
    } catch {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'There was an error uploading your audio file.',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex items-center gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      {currentAudioPath ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary">
            <FileAudio className="h-4 w-4" />
            <span>Audio loaded</span>
            <Check className="h-3 w-3" />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              'Replace'
            )}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="gap-2"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Upload Audio
            </>
          )}
        </Button>
      )}
    </div>
  );
}

