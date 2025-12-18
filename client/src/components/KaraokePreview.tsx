import { useMemo } from 'react';
import type { Singer, LyricLine } from 'shared';

interface KaraokePreviewProps {
  currentTime: number;
  linesCount: number;
  singers: Singer[];
  lyrics: LyricLine[];
}

export function KaraokePreview({
  currentTime,
  linesCount,
  singers,
  lyrics,
}: KaraokePreviewProps) {
  const visibleLyrics = useMemo(() => {
    const lineMap = new Map<number, LyricLine & { singer: Singer; highlightProgress: number }>();
    
    for (const lyric of lyrics) {
      if (currentTime >= lyric.appearStartTime && currentTime <= lyric.appearEndTime) {
        const singer = singers.find((s) => s.id === lyric.singerId);
        if (!singer) continue;

        let highlightProgress = 0;
        if (currentTime >= lyric.highlightStartTime && currentTime <= lyric.highlightEndTime) {
          const highlightDuration = lyric.highlightEndTime - lyric.highlightStartTime;
          highlightProgress = (currentTime - lyric.highlightStartTime) / highlightDuration;
        } else if (currentTime > lyric.highlightEndTime) {
          highlightProgress = 1;
        }

        const existing = lineMap.get(lyric.lineNumber);
        if (!existing || lyric.appearStartTime > existing.appearStartTime) {
          lineMap.set(lyric.lineNumber, { ...lyric, singer, highlightProgress });
        }
      }
    }

    return lineMap;
  }, [currentTime, lyrics, singers]);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
        <div className="w-4 h-4 rounded bg-black flex items-center justify-center">
          <div className="w-2 h-2 rounded-sm bg-white/80" />
        </div>
        Preview
      </div>
      
      <div 
        className="relative bg-black rounded-lg overflow-hidden border border-border"
        style={{ aspectRatio: '16/9' }}
      >
        <div className="absolute inset-0 flex flex-col justify-center px-4 py-2">
          {Array.from({ length: linesCount }, (_, lineIndex) => {
            const lyricData = visibleLyrics.get(lineIndex);
            
            return (
              <div
                key={lineIndex}
                className="flex-1 flex items-center justify-center min-h-0"
                style={{ maxHeight: `${100 / linesCount}%` }}
              >
                {lyricData && (
                  <div 
                    className="relative text-center font-bold leading-tight w-full px-2"
                    style={{ 
                      fontSize: `clamp(10px, ${2.5 / linesCount}vw, ${24 / (linesCount / 6)}px)`,
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                    }}
                  >
                    <span 
                      className="relative inline-block"
                    >
                      <span style={{ color: lyricData.singer.baseColor }}>
                        {lyricData.text}
                      </span>
                      <span
                        className="absolute left-0 top-0 overflow-hidden whitespace-nowrap"
                        style={{ 
                          width: `${lyricData.highlightProgress * 100}%`,
                        }}
                      >
                        <span style={{ color: lyricData.singer.highlightColor }}>
                          {lyricData.text}
                        </span>
                      </span>
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="absolute bottom-1 right-2 text-[10px] text-white/30 font-mono">
          {linesCount} lines
        </div>
      </div>
    </div>
  );
}

