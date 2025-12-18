import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { formatTime } from '@/lib/utils';
import type { Singer } from 'shared';

interface AddLyricPopoverProps {
  songId: string;
  currentTime: number;
  duration: number;
  singers: Singer[];
  linesCount: number;
}

export function AddLyricPopover({
  songId,
  currentTime,
  duration,
  singers,
  linesCount,
}: AddLyricPopoverProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [selectedSingerId, setSelectedSingerId] = useState<string>('');
  const [lineNumber, setLineNumber] = useState<number>(0);

  const utils = trpc.useUtils();

  const createLyric = trpc.lyrics.create.useMutation({
    onSuccess: () => {
      utils.lyrics.listBySong.invalidate({ songId });
      setText('');
      setOpen(false);
    },
  });

  useEffect(() => {
    if (singers.length > 0 && !selectedSingerId) {
      setSelectedSingerId(singers[0].id);
      setLineNumber(singers[0].startLine);
    }
  }, [singers, selectedSingerId]);

  const handleSingerChange = (singerId: string) => {
    setSelectedSingerId(singerId);
    const singer = singers.find((s) => s.id === singerId);
    if (singer) {
      setLineNumber(singer.startLine);
    }
  };

  const getSingerForLine = (line: number): Singer | undefined => {
    return singers.find(
      (s) => line >= s.startLine && line < s.startLine + s.lineCount
    );
  };

  useEffect(() => {
    if (open) {
      setText('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !selectedSingerId) return;

    const appearStart = currentTime;
    const appearEnd = Math.min(currentTime + 5, duration);
    const highlightStart = appearStart + 0.3;
    const highlightEnd = appearEnd - 0.3;

    createLyric.mutate({
      songId,
      singerId: selectedSingerId,
      text: text.trim(),
      lineNumber,
      appearStartTime: appearStart,
      appearEndTime: appearEnd,
      highlightStartTime: Math.max(highlightStart, appearStart + 0.1),
      highlightEndTime: Math.max(highlightEnd, highlightStart + 0.1),
    });
  };

  const selectedSinger = singers.find((s) => s.id === selectedSingerId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 shrink-0"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Add Lyric</span>
            <span className="text-xs text-muted-foreground font-mono">
              @ {formatTime(currentTime)}
            </span>
          </div>
          
          <div className="flex gap-2">
            <Select value={selectedSingerId} onValueChange={handleSingerChange}>
              <SelectTrigger className="h-8 flex-1">
                <SelectValue placeholder="Select singer" />
              </SelectTrigger>
              <SelectContent>
                {singers.map((singer) => (
                  <SelectItem key={singer.id} value={singer.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{
                          background: `linear-gradient(135deg, ${singer.baseColor}, ${singer.highlightColor})`,
                        }}
                      />
                      {singer.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={lineNumber.toString()} onValueChange={(v) => setLineNumber(parseInt(v))}>
              <SelectTrigger className="h-8 w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: linesCount }, (_, i) => {
                  const lineOwner = getSingerForLine(i);
                  return (
                    <SelectItem key={i} value={i.toString()}>
                      <div className="flex items-center gap-1.5">
                        {lineOwner && (
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: lineOwner.baseColor }}
                          />
                        )}
                        <span>L{i + 1}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter lyrics..."
            className="h-8"
            autoFocus
          />

          {text.trim() && selectedSinger && (
            <div className="p-2 rounded bg-timeline-bg text-sm">
              <span style={{ color: selectedSinger.baseColor }}>{text}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!text.trim() || !selectedSingerId || createLyric.isPending}
            >
              {createLyric.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Add'
              )}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

