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
import { ColorPicker } from '@/components/ColorPicker';
import { UserPlus, Users, Trash2, Pencil } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { cn } from '@/lib/utils';
import type { Singer } from 'shared';

interface SingerManagerProps {
  songId: string;
  singers: Singer[];
  linesCount: number;
}

const SINGER_COLORS = [
  { base: '#FFFFFF', highlight: '#FFFF00' },
  { base: '#00FFFF', highlight: '#FF00FF' },
  { base: '#FF69B4', highlight: '#00FF00' },
  { base: '#FFA500', highlight: '#1E90FF' },
];

export function SingerManager({ songId, singers, linesCount }: SingerManagerProps) {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingSinger, setEditingSinger] = useState<Singer | null>(null);
  const [newSingerName, setNewSingerName] = useState('');
  const [editName, setEditName] = useState('');
  const [editBaseColor, setEditBaseColor] = useState('#FFFFFF');
  const [editHighlightColor, setEditHighlightColor] = useState('#FFFF00');
  const [editStartLine, setEditStartLine] = useState(0);
  const [editLineCount, setEditLineCount] = useState(3);

  const utils = trpc.useUtils();

  const createSinger = trpc.singers.create.useMutation({
    onSuccess: () => {
      utils.singers.listBySong.invalidate({ songId });
      setAddDialogOpen(false);
      setNewSingerName('');
    },
  });

  const updateSinger = trpc.singers.update.useMutation({
    onSuccess: () => {
      utils.singers.listBySong.invalidate({ songId });
      setEditDialogOpen(false);
      setEditingSinger(null);
    },
  });

  const deleteSinger = trpc.singers.delete.useMutation({
    onSuccess: () => {
      utils.singers.listBySong.invalidate({ songId });
      utils.lyrics.listBySong.invalidate({ songId });
    },
  });

  const handleAddSinger = () => {
    if (!newSingerName.trim()) return;
    const colorIndex = singers.length % SINGER_COLORS.length;
    const colors = SINGER_COLORS[colorIndex];
    
    const existingMaxLine = singers.reduce((max, s) => Math.max(max, s.startLine + s.lineCount), 0);
    const remainingLines = linesCount - existingMaxLine;
    const newStartLine = existingMaxLine;
    const newLineCount = Math.max(1, remainingLines > 0 ? Math.min(3, remainingLines) : 1);
    
    createSinger.mutate({
      songId,
      name: newSingerName.trim(),
      baseColor: colors.base,
      highlightColor: colors.highlight,
      startLine: newStartLine,
      lineCount: newLineCount,
    });
  };

  const handleEditSinger = (singer: Singer) => {
    setEditingSinger(singer);
    setEditName(singer.name);
    setEditBaseColor(singer.baseColor);
    setEditHighlightColor(singer.highlightColor);
    setEditStartLine(singer.startLine);
    setEditLineCount(singer.lineCount);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingSinger || !editName.trim()) return;
    updateSinger.mutate({
      id: editingSinger.id,
      name: editName.trim(),
      baseColor: editBaseColor,
      highlightColor: editHighlightColor,
      startLine: editStartLine,
      lineCount: editLineCount,
    });
  };

  const handleDeleteSinger = (singerId: string) => {
    if (singers.length <= 1) {
      return;
    }
    if (confirm('Delete this singer and all their lyrics?')) {
      deleteSinger.mutate({ id: singerId });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Users className="h-4 w-4" />
          Singers ({singers.length})
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              Add Singer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Singer</DialogTitle>
              <DialogDescription>
                Add another singer for duets or group performances.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="singer-name">Singer Name</Label>
              <Input
                id="singer-name"
                value={newSingerName}
                onChange={(e) => setNewSingerName(e.target.value)}
                placeholder="e.g., Backing Vocals, Singer 2"
                className="mt-2"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddSinger} disabled={!newSingerName.trim()}>
                Add Singer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {singers.map((singer) => (
          <div
            key={singer.id}
            className="flex items-center gap-2 p-2 rounded-md bg-secondary/50 overflow-hidden"
          >
            <div
              className="w-1 h-8 rounded-full shrink-0"
              style={{
                background: `linear-gradient(180deg, ${singer.baseColor} 0%, ${singer.highlightColor} 100%)`,
              }}
            />
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-sm font-medium truncate">{singer.name}</p>
              <div className="flex items-center gap-3 mt-0.5">
                <div className="flex items-center gap-1">
                  <div
                    className="w-2.5 h-2.5 rounded-sm border border-border shrink-0"
                    style={{ backgroundColor: singer.baseColor }}
                  />
                  <div
                    className="w-2.5 h-2.5 rounded-sm border border-border shrink-0"
                    style={{ backgroundColor: singer.highlightColor }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  L{singer.startLine + 1}–{singer.startLine + singer.lineCount}
                </span>
              </div>
            </div>
            <div className="flex items-center shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => handleEditSinger(singer)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-7 w-7',
                  singers.length <= 1 && 'opacity-30 cursor-not-allowed'
                )}
                onClick={() => handleDeleteSinger(singer.id)}
                disabled={singers.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Singer</DialogTitle>
            <DialogDescription>
              Update singer name, colors, and line assignment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Base Color</Label>
                <div className="mt-2">
                  <ColorPicker
                    color={editBaseColor}
                    onChange={setEditBaseColor}
                  />
                </div>
              </div>
              <div>
                <Label>Highlight Color</Label>
                <div className="mt-2">
                  <ColorPicker
                    color={editHighlightColor}
                    onChange={setEditHighlightColor}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Line Assignment</Label>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Start Line</Label>
                  <Input
                    type="number"
                    min={0}
                    max={linesCount - 1}
                    value={editStartLine}
                    onChange={(e) => setEditStartLine(Math.max(0, Math.min(linesCount - 1, parseInt(e.target.value) || 0)))}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Line Count</Label>
                  <Input
                    type="number"
                    min={1}
                    max={linesCount - editStartLine}
                    value={editLineCount}
                    onChange={(e) => setEditLineCount(Math.max(1, Math.min(linesCount - editStartLine, parseInt(e.target.value) || 1)))}
                    className="mt-1"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                This singer will use lines L{editStartLine + 1} to L{editStartLine + editLineCount} on the timeline.
              </p>
            </div>
            <div className="flex items-center justify-center p-4 rounded-md bg-timeline-bg">
              <span
                style={{ color: editBaseColor }}
                className="text-lg font-medium"
              >
                Sample{' '}
                <span style={{ color: editHighlightColor }}>Lyrics</span>{' '}
                Text
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={!editName.trim()}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

