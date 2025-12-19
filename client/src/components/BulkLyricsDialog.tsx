import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Upload, Loader2, ListPlus, AlertTriangle } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import type { Singer } from 'shared';

interface BulkLyricsDialogProps {
  songId: string;
  duration: number;
  singers: Singer[];
  hasExistingLyrics: boolean;
}

export function BulkLyricsDialog({
  songId,
  duration,
  singers,
  hasExistingLyrics,
}: BulkLyricsDialogProps) {
  const [open, setOpen] = useState(false);
  const [lyricsText, setLyricsText] = useState('');
  const [selectedSingerId, setSelectedSingerId] = useState<string>('');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const bulkCreate = trpc.lyrics.bulkCreate.useMutation({
    onSuccess: (result) => {
      utils.lyrics.listBySong.invalidate({ songId });
      toast({
        title: 'Lyrics imported',
        description: `Added ${result.count} lyric lines to the timeline.`,
      });
      setOpen(false);
      setLyricsText('');
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Import failed',
        description: 'Failed to import lyrics. Please try again.',
      });
    },
  });

  const clearLyrics = trpc.lyrics.clearBySong.useMutation({
    onSuccess: () => {
      utils.lyrics.listBySong.invalidate({ songId });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.txt')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file',
        description: 'Please upload a .txt file.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setLyricsText(text);
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!lyricsText.trim() || !selectedSingerId) return;

    const lines = lyricsText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No lyrics',
        description: 'Please enter at least one line of lyrics.',
      });
      return;
    }

    if (replaceExisting && hasExistingLyrics) {
      await clearLyrics.mutateAsync({ songId });
    }

    const padding = 0.5;
    const availableDuration = duration - padding * 2;
    const lineDisplayDuration = Math.max(2, availableDuration / lines.length);
    const highlightPadding = 0.3;

    const lyricsData = lines.map((text, index) => {
      const appearStart = padding + (index * availableDuration) / lines.length;
      const appearEnd = Math.min(appearStart + lineDisplayDuration, duration - padding);
      const highlightStart = appearStart + highlightPadding;
      const highlightEnd = appearEnd - highlightPadding;

      return {
        text,
        appearStartTime: appearStart,
        appearEndTime: appearEnd,
        highlightStartTime: Math.max(highlightStart, appearStart + 0.1),
        highlightEndTime: Math.max(highlightEnd, highlightStart + 0.1),
      };
    });

    bulkCreate.mutate({
      songId,
      singerId: selectedSingerId,
      lines: lyricsData,
    });
  };

  const lineCount = lyricsText
    .split('\n')
    .filter((line) => line.trim().length > 0).length;

  const isLoading = bulkCreate.isPending || clearLyrics.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2 w-full">
          <ListPlus className="h-4 w-4" />
          Import Lyrics
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Lyrics
          </DialogTitle>
          <DialogDescription>
            Paste your lyrics below or upload a text file. Each line will be added
            to the timeline spread evenly across the song duration.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Assign to Singer</Label>
            <Select value={selectedSingerId} onValueChange={setSelectedSingerId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="Select a singer" />
              </SelectTrigger>
              <SelectContent>
                {singers.map((singer) => (
                  <SelectItem key={singer.id} value={singer.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
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
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Lyrics</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-7"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload .txt
              </Button>
            </div>
            <textarea
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              placeholder="Paste your lyrics here...&#10;&#10;Each line will become a separate lyric entry.&#10;Empty lines will be ignored."
              className="w-full h-64 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-mono"
            />
            <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
              <span>
                {lineCount} {lineCount === 1 ? 'line' : 'lines'} detected
              </span>
              {lineCount > 0 && (
                <span>
                  ~{(duration / lineCount).toFixed(1)}s per line
                </span>
              )}
            </div>
          </div>

          {hasExistingLyrics && (
            <div className="flex items-start gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-2 flex-1">
                <p className="text-sm text-destructive font-medium">
                  This song already has lyrics
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="rounded border-destructive/50"
                  />
                  <span className="text-sm text-muted-foreground">
                    Replace all existing lyrics
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!lyricsText.trim() || !selectedSingerId || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Importing...
              </>
            ) : (
              <>
                Import {lineCount} {lineCount === 1 ? 'Line' : 'Lines'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


