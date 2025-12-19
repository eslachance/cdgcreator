import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ColorPicker } from '@/components/ColorPicker';
import {
  Settings,
  Upload,
  FileAudio,
  Loader2,
  Check,
  Clock,
  Film,
  Users,
  UserPlus,
  Trash2,
  Pencil,
  ListPlus,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Singer, LyricLine, Card } from 'shared';

interface SongSettingsDialogProps {
  songId: string;
  song: {
    title: string;
    artist: string | null;
    audioPath: string | null;
    duration: number | null;
    linesCount: number;
    preBuffer: number | null;
    postBuffer: number | null;
    titleCard: Card | null;
    endCard: Card | null;
  };
  singers: Singer[];
  lyrics: LyricLine[];
  onSongUpdate: () => void;
}

export function SongSettingsDialog({
  songId,
  song,
  singers,
  lyrics,
  onSongUpdate,
}: SongSettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [addSingerDialogOpen, setAddSingerDialogOpen] = useState(false);
  const [editSingerDialogOpen, setEditSingerDialogOpen] = useState(false);
  const [editingSinger, setEditingSinger] = useState<Singer | null>(null);
  const [newSingerName, setNewSingerName] = useState('');
  const [editName, setEditName] = useState('');
  const [editBaseColor, setEditBaseColor] = useState('#FFFFFF');
  const [editHighlightColor, setEditHighlightColor] = useState('#FFFF00');
  const [editStartLine, setEditStartLine] = useState(0);
  const [editLineCount, setEditLineCount] = useState(3);

  const [lyricsText, setLyricsText] = useState('');
  const [selectedSingerId, setSelectedSingerId] = useState<string>('');
  const [replaceExisting, setReplaceExisting] = useState(false);
  const lyricsInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const updateSong = trpc.songs.update.useMutation({
    onSuccess: () => {
      onSongUpdate();
    },
  });

  const createSinger = trpc.singers.create.useMutation({
    onSuccess: () => {
      utils.singers.listBySong.invalidate({ songId });
      setAddSingerDialogOpen(false);
      setNewSingerName('');
    },
  });

  const updateSinger = trpc.singers.update.useMutation({
    onSuccess: () => {
      utils.singers.listBySong.invalidate({ songId });
      setEditSingerDialogOpen(false);
      setEditingSinger(null);
    },
  });

  const deleteSinger = trpc.singers.delete.useMutation({
    onSuccess: () => {
      utils.singers.listBySong.invalidate({ songId });
      utils.lyrics.listBySong.invalidate({ songId });
    },
  });

  const bulkCreate = trpc.lyrics.bulkCreate.useMutation({
    onSuccess: (result) => {
      utils.lyrics.listBySong.invalidate({ songId });
      toast({
        title: 'Lyrics imported',
        description: `Added ${result.count} lyric lines to the timeline.`,
      });
      setLyricsText('');
      setSelectedSingerId('');
      setReplaceExisting(false);
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

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      onSongUpdate();
    } catch {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'There was an error uploading your audio file.',
      });
    } finally {
      setIsUploading(false);
      if (audioInputRef.current) {
        audioInputRef.current.value = '';
      }
    }
  };

  const SINGER_COLORS = [
    { base: '#FFFFFF', highlight: '#FFFF00' },
    { base: '#00FFFF', highlight: '#FF00FF' },
    { base: '#FF69B4', highlight: '#00FF00' },
    { base: '#FFA500', highlight: '#1E90FF' },
  ];

  const handleAddSinger = () => {
    if (!newSingerName.trim()) return;
    const colorIndex = singers.length % SINGER_COLORS.length;
    const colors = SINGER_COLORS[colorIndex];

    const existingMaxLine = singers.reduce((max, s) => Math.max(max, s.startLine + s.lineCount), 0);
    const remainingLines = song.linesCount - existingMaxLine;
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
    setEditSingerDialogOpen(true);
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
    if (singers.length <= 1) return;
    if (confirm('Delete this singer and all their lyrics?')) {
      deleteSinger.mutate({ id: singerId });
    }
  };

  const handleLyricsFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    if (lyricsInputRef.current) {
      lyricsInputRef.current.value = '';
    }
  };

  const handleLyricsImport = async () => {
    if (!lyricsText.trim() || !selectedSingerId || !song.duration) return;

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

    if (replaceExisting && lyrics.length > 0) {
      await clearLyrics.mutateAsync({ songId });
    }

    const padding = 0.5;
    const availableDuration = song.duration - padding * 2;
    const lineDisplayDuration = Math.max(2, availableDuration / lines.length);
    const highlightPadding = 0.3;

    const lyricsData = lines.map((text, index) => {
      const appearStart = padding + (index * availableDuration) / lines.length;
      const appearEnd = Math.min(appearStart + lineDisplayDuration, song.duration! - padding);
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

  const isLyricsLoading = bulkCreate.isPending || clearLyrics.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Song Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Song Settings
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="singers">Singers</TabsTrigger>
            <TabsTrigger value="cards">Cards</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <TabsContent value="general" className="space-y-6 m-0">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FileAudio className="h-4 w-4" />
                  Audio File
                </div>
                <div className="p-3 rounded-md bg-secondary/50">
                  <input
                    ref={audioInputRef}
                    type="file"
                    accept=".mp3,.wav"
                    onChange={handleAudioUpload}
                    className="hidden"
                  />
                  {song.audioPath ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <FileAudio className="h-4 w-4" />
                        <span>Audio loaded</span>
                        <Check className="h-3 w-3" />
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => audioInputRef.current?.click()}
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
                      onClick={() => audioInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full gap-2"
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
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Settings className="h-4 w-4" />
                  Display Settings
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-secondary/50">
                  <Label className="text-sm text-muted-foreground whitespace-nowrap">Lines on screen:</Label>
                  <Input
                    type="number"
                    min={1}
                    max={12}
                    value={song.linesCount}
                    onChange={(e) => {
                      const value = Math.max(1, Math.min(12, parseInt(e.target.value) || 6));
                      updateSong.mutate({ id: songId, linesCount: value });
                    }}
                    className="h-8 w-20 text-center"
                  />
                  <span className="text-xs text-muted-foreground">(1–12)</span>
                </div>
              </div>

              {song.duration && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <ListPlus className="h-4 w-4" />
                    Import Lyrics
                  </div>
                  <div className="p-3 rounded-md bg-secondary/50 space-y-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Assign to Singer</Label>
                      <select
                        value={selectedSingerId}
                        onChange={(e) => setSelectedSingerId(e.target.value)}
                        className="mt-1.5 w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Select a singer</option>
                        {singers.map((singer) => (
                          <option key={singer.id} value={singer.id}>
                            {singer.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-xs text-muted-foreground">Lyrics</Label>
                        <input
                          ref={lyricsInputRef}
                          type="file"
                          accept=".txt"
                          onChange={handleLyricsFileUpload}
                          className="hidden"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 h-6 text-xs"
                          onClick={() => lyricsInputRef.current?.click()}
                        >
                          <Upload className="h-3 w-3" />
                          Upload .txt
                        </Button>
                      </div>
                      <textarea
                        value={lyricsText}
                        onChange={(e) => setLyricsText(e.target.value)}
                        placeholder="Paste your lyrics here...&#10;&#10;Each line will become a separate lyric entry."
                        className="w-full h-32 px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                      />
                      <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                        <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'} detected</span>
                        {lineCount > 0 && song.duration && (
                          <span>~{(song.duration / lineCount).toFixed(1)}s per line</span>
                        )}
                      </div>
                    </div>

                    {lyrics.length > 0 && (
                      <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/20">
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1.5">
                          <p className="text-xs text-destructive font-medium">This song already has lyrics</p>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={replaceExisting}
                              onChange={(e) => setReplaceExisting(e.target.checked)}
                              className="rounded border-destructive/50"
                            />
                            <span className="text-xs text-muted-foreground">Replace all existing lyrics</span>
                          </label>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleLyricsImport}
                      disabled={!lyricsText.trim() || !selectedSingerId || isLyricsLoading}
                      className="w-full"
                    >
                      {isLyricsLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Importing...
                        </>
                      ) : (
                        <>Import {lineCount} {lineCount === 1 ? 'Line' : 'Lines'}</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="singers" className="space-y-4 m-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Singers ({singers.length})
                </div>
                <Dialog open={addSingerDialogOpen} onOpenChange={setAddSingerDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <UserPlus className="h-3.5 w-3.5" />
                      Add Singer
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Singer</DialogTitle>
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
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newSingerName.trim()) {
                            handleAddSinger();
                          }
                        }}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setAddSingerDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddSinger} disabled={!newSingerName.trim()}>
                        Add Singer
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="space-y-2">
                {singers.map((singer) => (
                  <div
                    key={singer.id}
                    className="flex items-center gap-2 p-3 rounded-md bg-secondary/50"
                  >
                    <div
                      className="w-1 h-10 rounded-full shrink-0"
                      style={{
                        background: `linear-gradient(180deg, ${singer.baseColor} 0%, ${singer.highlightColor} 100%)`,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{singer.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <div className="flex items-center gap-1">
                          <div
                            className="w-3 h-3 rounded-sm border border-border"
                            style={{ backgroundColor: singer.baseColor }}
                          />
                          <div
                            className="w-3 h-3 rounded-sm border border-border"
                            style={{ backgroundColor: singer.highlightColor }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          L{singer.startLine + 1}–{singer.startLine + singer.lineCount}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditSinger(singer)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          'h-8 w-8',
                          singers.length <= 1 && 'opacity-30 cursor-not-allowed'
                        )}
                        onClick={() => handleDeleteSinger(singer.id)}
                        disabled={singers.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <Dialog open={editSingerDialogOpen} onOpenChange={setEditSingerDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Singer</DialogTitle>
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
                          <ColorPicker color={editBaseColor} onChange={setEditBaseColor} />
                        </div>
                      </div>
                      <div>
                        <Label>Highlight Color</Label>
                        <div className="mt-2">
                          <ColorPicker color={editHighlightColor} onChange={setEditHighlightColor} />
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
                            max={song.linesCount - 1}
                            value={editStartLine}
                            onChange={(e) => setEditStartLine(Math.max(0, Math.min(song.linesCount - 1, parseInt(e.target.value) || 0)))}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Line Count</Label>
                          <Input
                            type="number"
                            min={1}
                            max={song.linesCount - editStartLine}
                            value={editLineCount}
                            onChange={(e) => setEditLineCount(Math.max(1, Math.min(song.linesCount - editStartLine, parseInt(e.target.value) || 1)))}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        This singer will use lines L{editStartLine + 1} to L{editStartLine + editLineCount} on the timeline.
                      </p>
                    </div>
                    <div className="flex items-center justify-center p-4 rounded-md bg-timeline-bg">
                      <span style={{ color: editBaseColor }} className="text-lg font-medium">
                        Sample <span style={{ color: editHighlightColor }}>Lyrics</span> Text
                      </span>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setEditSingerDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveEdit} disabled={!editName.trim()}>
                      Save Changes
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </TabsContent>

            <TabsContent value="cards" className="space-y-6 m-0">
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Time Buffers
                </div>
                <div className="space-y-3 p-3 rounded-md bg-secondary/50">
                  <div className="flex items-center gap-3">
                    <Label className="text-sm text-muted-foreground w-24">Pre-buffer:</Label>
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      step={0.5}
                      value={song.preBuffer || 0}
                      onChange={(e) => {
                        const value = Math.max(0, Math.min(30, parseFloat(e.target.value) || 0));
                        updateSong.mutate({ id: songId, preBuffer: value });
                      }}
                      className="h-8 w-24 text-center"
                    />
                    <span className="text-xs text-muted-foreground">sec</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Label className="text-sm text-muted-foreground w-24">Post-buffer:</Label>
                    <Input
                      type="number"
                      min={0}
                      max={30}
                      step={0.5}
                      value={song.postBuffer || 0}
                      onChange={(e) => {
                        const value = Math.max(0, Math.min(30, parseFloat(e.target.value) || 0));
                        updateSong.mutate({ id: songId, postBuffer: value });
                      }}
                      className="h-8 w-24 text-center"
                    />
                    <span className="text-xs text-muted-foreground">sec</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Film className="h-4 w-4" />
                  Title Card (Intro)
                </div>
                <div className="space-y-3 p-3 rounded-md bg-secondary/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Enabled</Label>
                    <Switch
                      checked={song.titleCard?.enabled || false}
                      onCheckedChange={(checked) => {
                        updateSong.mutate({
                          id: songId,
                          titleCard: {
                            ...song.titleCard,
                            enabled: checked,
                            text: song.titleCard?.text || `${song.title}\n${song.artist || ''}`,
                            startTime: song.titleCard?.startTime ?? -(song.preBuffer || 0),
                            endTime: song.titleCard?.endTime ?? 0,
                          },
                        });
                      }}
                    />
                  </div>
                  {song.titleCard?.enabled && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Text</Label>
                        <Textarea
                          value={song.titleCard?.text || ''}
                          onChange={(e) => {
                            updateSong.mutate({
                              id: songId,
                              titleCard: { ...song.titleCard!, text: e.target.value },
                            });
                          }}
                          placeholder="Title text..."
                          className="h-20 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Start</Label>
                          <Input
                            type="number"
                            step={0.1}
                            value={song.titleCard?.startTime ?? 0}
                            onChange={(e) => {
                              updateSong.mutate({
                                id: songId,
                                titleCard: { ...song.titleCard!, startTime: parseFloat(e.target.value) || 0 },
                              });
                            }}
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">End</Label>
                          <Input
                            type="number"
                            step={0.1}
                            value={song.titleCard?.endTime ?? 0}
                            onChange={(e) => {
                              updateSong.mutate({
                                id: songId,
                                titleCard: { ...song.titleCard!, endTime: parseFloat(e.target.value) || 0 },
                              });
                            }}
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Film className="h-4 w-4" />
                  End Card (Outro)
                </div>
                <div className="space-y-3 p-3 rounded-md bg-secondary/50">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Enabled</Label>
                    <Switch
                      checked={song.endCard?.enabled || false}
                      onCheckedChange={(checked) => {
                        const audioDuration = song.duration || 0;
                        updateSong.mutate({
                          id: songId,
                          endCard: {
                            ...song.endCard,
                            enabled: checked,
                            text: song.endCard?.text || 'Thank you for singing!',
                            startTime: song.endCard?.startTime ?? audioDuration,
                            endTime: song.endCard?.endTime ?? (audioDuration + (song.postBuffer || 0)),
                          },
                        });
                      }}
                    />
                  </div>
                  {song.endCard?.enabled && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Text</Label>
                        <Textarea
                          value={song.endCard?.text || ''}
                          onChange={(e) => {
                            updateSong.mutate({
                              id: songId,
                              endCard: { ...song.endCard!, text: e.target.value },
                            });
                          }}
                          placeholder="End card text..."
                          className="h-20 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Start</Label>
                          <Input
                            type="number"
                            step={0.1}
                            value={song.endCard?.startTime ?? 0}
                            onChange={(e) => {
                              updateSong.mutate({
                                id: songId,
                                endCard: { ...song.endCard!, startTime: parseFloat(e.target.value) || 0 },
                              });
                            }}
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">End</Label>
                          <Input
                            type="number"
                            step={0.1}
                            value={song.endCard?.endTime ?? 0}
                            onChange={(e) => {
                              updateSong.mutate({
                                id: songId,
                                endCard: { ...song.endCard!, endTime: parseFloat(e.target.value) || 0 },
                              });
                            }}
                            className="h-8 text-sm mt-1"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

