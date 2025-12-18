import { BulkLyricsDialog } from '@/components/BulkLyricsDialog';
import type { Singer, LyricLine } from 'shared';

interface LyricEditorProps {
  songId: string;
  singers: Singer[];
  lyrics: LyricLine[];
  duration: number;
}

export function LyricEditor({
  songId,
  singers,
  lyrics,
  duration,
}: LyricEditorProps) {
  return (
    <BulkLyricsDialog
      songId={songId}
      duration={duration}
      singers={singers}
      hasExistingLyrics={lyrics.length > 0}
    />
  );
}

