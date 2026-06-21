import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface NewSongDialogProps {
  onSongCreated?: (songId: string) => void;
}

export function NewSongDialog({ onSongCreated }: NewSongDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');

  const utils = trpc.useUtils();
  const createSong = trpc.songs.create.useMutation({
    onSuccess: (song) => {
      utils.songs.list.invalidate();
      setOpen(false);
      setTitle('');
      setArtist('');
      onSongCreated?.(song.id);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createSong.mutate({ title: title.trim(), artist: artist.trim() || undefined });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          New Song
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Song</DialogTitle>
            <DialogDescription>
              Add a new song to your karaoke library. You can upload audio after creation.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Song Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter song title..."
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="artist">Artist (optional)</Label>
              <Input
                id="artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Enter artist name..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || createSong.isPending}>
              {createSong.isPending ? 'Creating...' : 'Create Song'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

