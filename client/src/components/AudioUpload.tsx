import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, FileAudio, Loader2, Check, Wand2, AlertCircle, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import type { SeparationStatus } from 'shared';

interface AudioUploadProps {
  songId: string;
  currentAudioPath: string | null;
  separationStatus?: SeparationStatus;
  onUploadComplete: () => void;
}

export function AudioUpload({ 
  songId, 
  currentAudioPath, 
  separationStatus = 'pending',
  onUploadComplete 
}: AudioUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const utils = trpc.useUtils();

  const { data: demucsStatus } = trpc.songs.checkDemucsAvailable.useQuery();
  const { data: separationInfo, refetch: refetchSeparation } = trpc.songs.getSeparationStatus.useQuery(
    { id: songId },
    { 
      enabled: !!currentAudioPath,
      refetchInterval: separationStatus === 'processing' ? 2000 : false,
    }
  );

  const startSeparation = trpc.songs.startSeparation.useMutation({
    onSuccess: (result) => {
      if (result.status === 'started') {
        toast({
          title: 'Audio separation started',
          description: 'This may take a few minutes...',
        });
        refetchSeparation();
        utils.songs.getById.invalidate({ id: songId });
      } else if (result.status === 'unavailable') {
        toast({
          variant: 'destructive',
          title: 'Demucs not available',
          description: 'Install Demucs to enable audio separation: pip install demucs',
        });
      }
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: 'Separation failed',
        description: error.message,
      });
    },
  });

  useEffect(() => {
    if (separationInfo?.status === 'complete' && separationStatus === 'processing') {
      utils.songs.getById.invalidate({ id: songId });
      toast({
        title: 'Audio separation complete!',
        description: 'Vocals and instrumental tracks are now available.',
      });
    }
  }, [separationInfo?.status, separationStatus, songId, utils.songs.getById]);

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

  const handleStartSeparation = () => {
    startSeparation.mutate({ id: songId });
  };

  const renderSeparationStatus = () => {
    const status = separationInfo?.status || separationStatus;
    
    if (!currentAudioPath) return null;
    
    switch (status) {
      case 'complete':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 text-green-500 text-xs">
            <Check className="h-3 w-3" />
            <span>Separated</span>
          </div>
        );
      case 'processing':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-xs">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Separating... {separationInfo?.progress || 0}%</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-500/10 text-red-500 text-xs">
              <X className="h-3 w-3" />
              <span>Failed</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={handleStartSeparation}
              disabled={startSeparation.isPending}
            >
              Retry
            </Button>
          </div>
        );
      case 'unavailable':
        return (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-yellow-500/10 text-yellow-600 text-xs" title="Install Demucs to enable audio separation">
            <AlertCircle className="h-3 w-3" />
            <span>Demucs not installed</span>
          </div>
        );
      case 'pending':
      default:
        if (!demucsStatus?.available) {
          return (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs" title="Install Demucs to enable audio separation">
              <AlertCircle className="h-3 w-3" />
              <span>Separation unavailable</span>
            </div>
          );
        }
        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={handleStartSeparation}
            disabled={startSeparation.isPending}
          >
            {startSeparation.isPending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Wand2 className="h-3 w-3" />
            )}
            Separate Audio
          </Button>
        );
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
          {renderSeparationStatus()}
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
