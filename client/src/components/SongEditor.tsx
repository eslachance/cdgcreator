import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { AudioPlayer } from '@/components/AudioPlayer';
import { Timeline } from '@/components/Timeline';
import { AddLyricPopover } from '@/components/AddLyricPopover';
import { KaraokePreview } from '@/components/KaraokePreview';
import { SongSettingsDialog } from '@/components/SongSettingsDialog';
import { ZoomIn, ZoomOut, ArrowLeft, GripVertical, Pencil, Check, X } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatTime } from '@/lib/utils';
import type { LyricLine } from 'shared';

interface SongEditorProps {
  songId: string;
  onBack: () => void;
}

const MIN_SIDEBAR_WIDTH = 320;
const MAX_SIDEBAR_WIDTH = 600;
const DEFAULT_SIDEBAR_WIDTH = 380;

export function SongEditor({ songId, onBack }: SongEditorProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLyricId, setSelectedLyricId] = useState<string | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingArtist, setIsEditingArtist] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editArtist, setEditArtist] = useState('');
  const [zoom, setZoom] = useState(1);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const containerRect = sidebarRef.current?.parentElement?.getBoundingClientRect();
      if (!containerRect) return;
      
      const newWidth = containerRect.right - e.clientX;
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const { data: song, refetch: refetchSong } = trpc.songs.getById.useQuery({ id: songId });
  const { data: singers = [] } = trpc.singers.listBySong.useQuery({ songId });
  const { data: lyrics = [] } = trpc.lyrics.listBySong.useQuery({ songId });

  const utils = trpc.useUtils();

  const updateLyric = trpc.lyrics.update.useMutation({
    onSuccess: () => {
      utils.lyrics.listBySong.invalidate({ songId });
    },
  });

  const deleteLyric = trpc.lyrics.delete.useMutation({
    onSuccess: () => {
      utils.lyrics.listBySong.invalidate({ songId });
    },
  });

  const createLyric = trpc.lyrics.create.useMutation({
    onSuccess: () => {
      utils.lyrics.listBySong.invalidate({ songId });
    },
  });

  const updateSong = trpc.songs.update.useMutation({
    onSuccess: () => {
      refetchSong();
    },
  });

  const handleTimeUpdate = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleUpdateLyric = useCallback(
    (id: string, updates: Partial<LyricLine>) => {
      updateLyric.mutate({ id, ...updates });
    },
    [updateLyric]
  );

  const handleDeleteLyric = useCallback(
    (id: string) => {
      deleteLyric.mutate({ id });
      setSelectedLyricId(null);
    },
    [deleteLyric]
  );

  const handleDuplicateLyric = useCallback(
    (lyric: LyricLine) => {
      const gap = 0.5;
      const lyricDuration = lyric.appearEndTime - lyric.appearStartTime;
      const highlightOffset = lyric.highlightStartTime - lyric.appearStartTime;
      const highlightDuration = lyric.highlightEndTime - lyric.highlightStartTime;

      createLyric.mutate({
        songId,
        singerId: lyric.singerId,
        text: lyric.text,
        appearStartTime: lyric.appearEndTime + gap,
        appearEndTime: lyric.appearEndTime + gap + lyricDuration,
        highlightStartTime: lyric.appearEndTime + gap + highlightOffset,
        highlightEndTime: lyric.appearEndTime + gap + highlightOffset + highlightDuration,
      });
    },
    [songId, createLyric]
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
        
        <div className="flex-1 space-y-0.5">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-8 text-lg font-semibold max-w-xs"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateSong.mutate({ id: songId, title: editTitle });
                    setIsEditingTitle(false);
                  } else if (e.key === 'Escape') {
                    setIsEditingTitle(false);
                  }
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => {
                  updateSong.mutate({ id: songId, title: editTitle });
                  setIsEditingTitle(false);
                }}
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsEditingTitle(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="group flex items-center gap-2">
              <h1 className="text-xl font-semibold">{song.title}</h1>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  setEditTitle(song.title);
                  setIsEditingTitle(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          
          {isEditingArtist ? (
            <div className="flex items-center gap-2">
              <Input
                value={editArtist}
                onChange={(e) => setEditArtist(e.target.value)}
                className="h-7 text-sm max-w-xs"
                placeholder="Artist name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    updateSong.mutate({ id: songId, artist: editArtist || undefined });
                    setIsEditingArtist(false);
                  } else if (e.key === 'Escape') {
                    setIsEditingArtist(false);
                  }
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => {
                  updateSong.mutate({ id: songId, artist: editArtist || undefined });
                  setIsEditingArtist(false);
                }}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsEditingArtist(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <div className="group flex items-center gap-2">
              <p className="text-sm text-muted-foreground">
                {song.artist || 'No artist'}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => {
                  setEditArtist(song.artist || '');
                  setIsEditingArtist(true);
                }}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <SongSettingsDialog
          songId={songId}
          song={song}
          singers={singers}
          lyrics={lyrics}
          onSongUpdate={() => refetchSong()}
        />
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
          <AudioPlayer
            audioPath={song.audioPath}
            vocalsPath={song.vocalsPath}
            instrumentalPath={song.instrumentalPath}
            duration={song.duration}
            currentTime={currentTime}
            onTimeUpdate={handleTimeUpdate}
            isPlaying={isPlaying}
            onPlayPause={setIsPlaying}
            preBuffer={song.preBuffer}
            postBuffer={song.postBuffer}
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

            <div className="w-px h-5 bg-border mx-1" />

            <AddLyricPopover
              songId={songId}
              currentTime={currentTime}
              duration={song.duration || 0}
              singers={singers}
              linesCount={song.linesCount}
            />
            <span className="text-xs text-muted-foreground font-mono">
              @ {formatTime(currentTime)}
            </span>
          </div>

          <div className="flex-1 min-h-0">
            {song.duration ? (
              <Timeline
                duration={song.duration}
                currentTime={currentTime}
                isPlaying={isPlaying}
                linesCount={song.linesCount}
                singers={singers}
                lyrics={lyrics}
                selectedLyricId={selectedLyricId}
                onSelectLyric={setSelectedLyricId}
                onSeek={handleSeek}
                onUpdateLyric={handleUpdateLyric}
                onDeleteLyric={handleDeleteLyric}
                onDuplicateLyric={handleDuplicateLyric}
                zoom={zoom}
                preBuffer={song.preBuffer}
                postBuffer={song.postBuffer}
                titleCard={song.titleCard}
                endCard={song.endCard}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Upload audio to view the timeline
              </div>
            )}
          </div>
        </div>

        <div
          ref={sidebarRef}
          className="relative border-l border-border bg-card/30 flex shrink-0 overflow-hidden"
          style={{ width: sidebarWidth }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary z-20 flex items-center justify-center group"
            onMouseDown={() => setIsResizing(true)}
          >
            <div className="absolute -left-2 w-5 h-full" />
            <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary -ml-1.5" />
          </div>
          <div className="h-full flex-1 overflow-y-auto overflow-x-hidden">
            <div className="p-4 w-full">
              <KaraokePreview
                currentTime={currentTime}
                linesCount={song.linesCount}
                singers={singers}
                lyrics={lyrics}
                titleCard={song.titleCard}
                endCard={song.endCard}
                duration={song.duration || 0}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

