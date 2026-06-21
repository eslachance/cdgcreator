import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { AudioUpload } from '@/components/AudioUpload';
import { AudioPlayer } from '@/components/AudioPlayer';
import { Timeline } from '@/components/Timeline';
import { LyricEditor } from '@/components/LyricEditor';
import { SingerManager } from '@/components/SingerManager';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ZoomIn, ZoomOut, ArrowLeft } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import type { LyricLine } from 'shared';

interface SongEditorProps {
  songId: string;
  onBack: () => void;
}

export function SongEditor({ songId, onBack }: SongEditorProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLyricId, setSelectedLyricId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const { data: song, refetch: refetchSong } = trpc.songs.getById.useQuery({ id: songId });
  const { data: singers = [] } = trpc.singers.listBySong.useQuery({ songId });
  const { data: lyrics = [] } = trpc.lyrics.listBySong.useQuery({ songId });

  const utils = trpc.useUtils();

  const updateLyric = trpc.lyrics.update.useMutation({
    onSuccess: () => {
      utils.lyrics.listBySong.invalidate({ songId });
    },
  });

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleUpdateLyricTiming = useCallback(
    (id: string, updates: Partial<LyricLine>) => {
      updateLyric.mutate({ id, ...updates });
    },
    [updateLyric]
  );

  const handleZoomIn = () => {
    setZoom((z) => Math.min(z * 1.5, 4));
  };

  const handleZoomOut = () => {
    setZoom((z) => Math.max(z / 1.5, 0.25));
  };

  if (!song) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading song...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 p-4 border-b border-border bg-card/50">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex-1">
          <h1 className="text-xl font-semibold">{song.title}</h1>
          {song.artist && (
            <p className="text-sm text-muted-foreground">{song.artist}</p>
          )}
        </div>

        <AudioUpload
          songId={songId}
          currentAudioPath={song.audioPath}
          onUploadComplete={() => refetchSong()}
        />
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          <AudioPlayer
            audioPath={song.audioPath}
            duration={song.duration}
            currentTime={currentTime}
            onTimeUpdate={handleTimeUpdate}
            isPlaying={isPlaying}
            onPlayPause={setIsPlaying}
          />

          <div className="flex items-center gap-3 px-2">
            <span className="text-xs text-muted-foreground">Zoom</span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={handleZoomOut}
              disabled={zoom <= 0.25}
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <Slider
              value={[zoom]}
              min={0.25}
              max={4}
              step={0.25}
              onValueChange={([v]) => setZoom(v)}
              className="w-32"
            />
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={handleZoomIn}
              disabled={zoom >= 4}
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground w-12">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <div className="flex-1 min-h-0">
            {song.duration ? (
              <Timeline
                duration={song.duration}
                currentTime={currentTime}
                singers={singers}
                lyrics={lyrics}
                selectedLyricId={selectedLyricId}
                onSelectLyric={setSelectedLyricId}
                onSeek={handleSeek}
                onUpdateLyricTiming={handleUpdateLyricTiming}
                zoom={zoom}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Upload audio to view the timeline
              </div>
            )}
          </div>
        </div>

        <div className="w-80 border-l border-border bg-card/30">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              <SingerManager songId={songId} singers={singers} />

              {song.duration && (
                <LyricEditor
                  songId={songId}
                  singers={singers}
                  lyrics={lyrics}
                  selectedLyricId={selectedLyricId}
                  onSelectLyric={setSelectedLyricId}
                  currentTime={currentTime}
                  duration={song.duration}
                />
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

