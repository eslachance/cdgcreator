import { useMemo } from 'react';
import type { Singer, LyricLine, Card } from 'shared';

interface KaraokePreviewProps {
  currentTime: number;
  linesCount: number;
  singers: Singer[];
  lyrics: LyricLine[];
  titleCard?: Card;
  endCard?: Card;
}

export function KaraokePreview({
  currentTime,
  linesCount,
  singers,
  lyrics,
  titleCard,
  endCard,
}: KaraokePreviewProps) {
  // Check if we should show a card
  const showTitleCard = titleCard?.enabled && 
    currentTime >= titleCard.startTime && 
    currentTime <= titleCard.endTime;
  
  const showEndCard = endCard?.enabled && 
    currentTime >= endCard.startTime && 
    currentTime <= endCard.endTime;

  const visibleLyrics = useMemo(() => {
    // Don't compute lyrics if showing a card
    if (showTitleCard || showEndCard) return new Map();
    
    const lineMap = new Map<number, LyricLine & { singer: Singer; highlightProgress: number; opacity: number }>();
    
    // Fade duration in seconds (quick fade in/out)
    const FADE_DURATION = 0.2;
    
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

        // Calculate opacity for fade in/out
        let opacity = 1;
        const timeSinceAppear = currentTime - lyric.appearStartTime;
        const timeUntilDisappear = lyric.appearEndTime - currentTime;
        
        if (timeSinceAppear < FADE_DURATION) {
          // Fade in
          opacity = timeSinceAppear / FADE_DURATION;
        } else if (timeUntilDisappear < FADE_DURATION) {
          // Fade out
          opacity = timeUntilDisappear / FADE_DURATION;
        }

        const existing = lineMap.get(lyric.lineNumber);
        if (!existing || lyric.appearStartTime > existing.appearStartTime) {
          lineMap.set(lyric.lineNumber, { ...lyric, singer, highlightProgress, opacity });
        }
      }
    }

    return lineMap;
  }, [currentTime, lyrics, singers, showTitleCard, showEndCard]);

  const renderCard = (card: Card, type: 'title' | 'end') => {
    const lines = card.text.split('\n');
    const isPurple = type === 'title';
    
    // Calculate fade for cards too
    const FADE_DURATION = 0.3;
    const timeSinceStart = currentTime - card.startTime;
    const timeUntilEnd = card.endTime - currentTime;
    let cardOpacity = 1;
    if (timeSinceStart < FADE_DURATION) {
      cardOpacity = timeSinceStart / FADE_DURATION;
    } else if (timeUntilEnd < FADE_DURATION) {
      cardOpacity = timeUntilEnd / FADE_DURATION;
    }
    
    return (
      <div 
        className="absolute inset-0 flex flex-col items-center justify-center px-8"
        style={{ opacity: cardOpacity }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            className="text-center font-bold leading-relaxed"
            style={{
              fontSize: i === 0 
                ? `clamp(16px, ${4 / lines.length}vw, 32px)` 
                : `clamp(12px, ${2.5 / lines.length}vw, 24px)`,
              color: isPurple ? '#c084fc' : '#fbbf24',
              textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
              opacity: i === 0 ? 1 : 0.8,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    );
  };

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
        {showTitleCard && titleCard ? (
          renderCard(titleCard, 'title')
        ) : showEndCard && endCard ? (
          renderCard(endCard, 'end')
        ) : (
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
                      className="relative text-center font-bold leading-tight w-full px-2 transition-opacity duration-200"
                      style={{ 
                        fontSize: `clamp(10px, ${2.5 / linesCount}vw, ${24 / (linesCount / 6)}px)`,
                        textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                        opacity: lyricData.opacity,
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
        )}

        <div className="absolute bottom-1 right-2 text-[10px] text-white/30 font-mono">
          {showTitleCard ? 'TITLE' : showEndCard ? 'END' : `${linesCount} lines`}
        </div>
      </div>
    </div>
  );
}

