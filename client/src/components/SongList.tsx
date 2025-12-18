import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Music2, Trash2, Clock } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatTime, cn } from '@/lib/utils';
import type { Song } from 'shared';

interface SongListProps {
  selectedSongId: string | null;
  onSelectSong: (songId: string) => void;
}

export function SongList({ selectedSongId, onSelectSong }: SongListProps) {
  const { data: songs, isLoading } = trpc.songs.list.useQuery();
  const utils = trpc.useUtils();
  const deleteSong = trpc.songs.delete.useMutation({
    onSuccess: () => {
      utils.songs.list.invalidate();
    },
  });

  const handleDelete = (e: React.MouseEvent, songId: string) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this song?')) {
      deleteSong.mutate({ id: songId });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="text-muted-foreground">Loading songs...</div>
      </div>
    );
  }

  if (!songs || songs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
        <Music2 className="h-8 w-8" />
        <p>No songs yet. Create your first song!</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-12rem)]">
      <div className="space-y-1 pr-4">
        {songs.map((song: Song) => (
          <div
            key={song.id}
            onClick={() => onSelectSong(song.id)}
            className={cn(
              'group flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all',
              'hover:bg-secondary/80',
              selectedSongId === song.id
                ? 'bg-primary/20 border border-primary/40'
                : 'border border-transparent'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-center w-10 h-10 rounded-md',
                selectedSongId === song.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              )}
            >
              <Music2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{song.title}</p>
              {song.artist && (
                <p className="text-sm text-muted-foreground truncate">
                  {song.artist}
                </p>
              )}
              {song.duration && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(song.duration)}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
              onClick={(e) => handleDelete(e, song.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

