import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { cn, formatTime } from '@/lib/utils';
import { LyricEditPopover } from '@/components/LyricEditPopover';
import type { Singer, LyricLine } from 'shared';

interface TimelineProps {
  duration: number;
  currentTime: number;
  linesCount: number;
  singers: Singer[];
  lyrics: LyricLine[];
  selectedLyricId: string | null;
  onSelectLyric: (id: string | null) => void;
  onSeek: (time: number) => void;
  onUpdateLyric: (id: string, updates: Partial<LyricLine>) => void;
  onDeleteLyric: (id: string) => void;
  onDuplicateLyric: (lyric: LyricLine) => void;
  zoom: number;
}

const TRACK_HEIGHT = 56;
const RULER_HEIGHT = 24;
const PIXELS_PER_SECOND_BASE = 50;

type DragType = 'appearStart' | 'appearEnd' | 'highlightStart' | 'highlightEnd' | 'move';

export function Timeline({
  duration,
  currentTime,
  linesCount,
  singers,
  lyrics,
  selectedLyricId,
  onSelectLyric,
  onSeek,
  onUpdateLyric,
  onDeleteLyric,
  onDuplicateLyric,
  zoom,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);
  const [dragging, setDragging] = useState<{
    lyricId: string;
    type: DragType;
    startX: number;
    startY: number;
    originalValue: number;
    originalLineNumber: number;
    originalAppearStart?: number;
    originalAppearEnd?: number;
    originalHighlightStart?: number;
    originalHighlightEnd?: number;
  } | null>(null);
  const [popoverPosition, setPopoverPosition] = useState<{ left: number; top: number; width: number } | null>(null);

  const pixelsPerSecond = PIXELS_PER_SECOND_BASE * zoom;
  const totalWidth = Math.max(duration * pixelsPerSecond, 800);

  const getSingerForLine = useCallback((lineNumber: number): Singer | undefined => {
    return singers.find(
      (s) => lineNumber >= s.startLine && lineNumber < s.startLine + s.lineCount
    );
  }, [singers]);

  const lineOwnership = useMemo(() => {
    const ownership: (Singer | undefined)[] = [];
    for (let i = 0; i < linesCount; i++) {
      ownership.push(getSingerForLine(i));
    }
    return ownership;
  }, [linesCount, getSingerForLine]);

  const timeToPixel = useCallback(
    (time: number) => time * pixelsPerSecond,
    [pixelsPerSecond]
  );

  const pixelToTime = useCallback(
    (pixel: number) => Math.max(0, Math.min(pixel / pixelsPerSecond, duration)),
    [pixelsPerSecond, duration]
  );

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = pixelToTime(x);
    onSeek(time);
  };

  const handleDragStart = (
    e: React.MouseEvent,
    lyricId: string,
    type: DragType,
    lyric: LyricLine
  ) => {
    e.stopPropagation();
    didDragRef.current = false;
    setDragging({
      lyricId,
      type,
      startX: e.clientX,
      startY: e.clientY,
      originalValue:
        type === 'appearStart'
          ? lyric.appearStartTime
          : type === 'appearEnd'
          ? lyric.appearEndTime
          : type === 'highlightStart'
          ? lyric.highlightStartTime
          : type === 'highlightEnd'
          ? lyric.highlightEndTime
          : lyric.appearStartTime,
      originalLineNumber: lyric.lineNumber,
      originalAppearStart: lyric.appearStartTime,
      originalAppearEnd: lyric.appearEndTime,
      originalHighlightStart: lyric.highlightStartTime,
      originalHighlightEnd: lyric.highlightEndTime,
    });
    onSelectLyric(lyricId);
  };

  useEffect(() => {
    if (!dragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragging.startX;
      const deltaY = e.clientY - dragging.startY;
      const deltaTime = deltaX / pixelsPerSecond;

      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        didDragRef.current = true;
      }

      if (dragging.type === 'move') {
        const blockDuration = dragging.originalAppearEnd! - dragging.originalAppearStart!;
        const highlightOffset = dragging.originalHighlightStart! - dragging.originalAppearStart!;
        const highlightDuration = dragging.originalHighlightEnd! - dragging.originalHighlightStart!;
        
        let newStart = Math.max(0, dragging.originalAppearStart! + deltaTime);
        if (newStart + blockDuration > duration) {
          newStart = duration - blockDuration;
        }

        const lineDelta = Math.round(deltaY / TRACK_HEIGHT);
        const newLineNumber = Math.max(0, Math.min(linesCount - 1, dragging.originalLineNumber + lineDelta));

        onUpdateLyric(dragging.lyricId, {
          appearStartTime: newStart,
          appearEndTime: newStart + blockDuration,
          highlightStartTime: newStart + highlightOffset,
          highlightEndTime: newStart + highlightOffset + highlightDuration,
          lineNumber: newLineNumber,
        });
      } else {
        let newValue = Math.max(0, Math.min(dragging.originalValue + deltaTime, duration));

        if (dragging.type === 'appearStart') {
          newValue = Math.min(newValue, dragging.originalHighlightStart! - 0.1);
          onUpdateLyric(dragging.lyricId, { appearStartTime: newValue });
        } else if (dragging.type === 'appearEnd') {
          newValue = Math.max(newValue, dragging.originalHighlightEnd! + 0.1);
          onUpdateLyric(dragging.lyricId, { appearEndTime: newValue });
        } else if (dragging.type === 'highlightStart') {
          newValue = Math.max(newValue, dragging.originalAppearStart! + 0.1);
          newValue = Math.min(newValue, dragging.originalHighlightEnd! - 0.1);
          onUpdateLyric(dragging.lyricId, { highlightStartTime: newValue });
        } else if (dragging.type === 'highlightEnd') {
          newValue = Math.max(newValue, dragging.originalHighlightStart! + 0.1);
          newValue = Math.min(newValue, dragging.originalAppearEnd! - 0.1);
          onUpdateLyric(dragging.lyricId, { highlightEndTime: newValue });
        }
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging, pixelsPerSecond, duration, linesCount, onUpdateLyric]);

  const renderRuler = () => {
    const marks: React.ReactNode[] = [];
    const interval = zoom < 0.5 ? 10 : zoom < 1 ? 5 : zoom < 2 ? 2 : 1;
    const subInterval = interval / 5;

    for (let t = 0; t <= duration; t += subInterval) {
      const x = timeToPixel(t);
      const isMajor = t % interval < 0.01;

      marks.push(
        <div
          key={t}
          className="absolute top-0"
          style={{ left: x }}
        >
          <div
            className={cn(
              'w-px',
              isMajor ? 'h-4 bg-muted-foreground/50' : 'h-2 bg-muted-foreground/20'
            )}
          />
          {isMajor && (
            <span className="absolute top-4 -translate-x-1/2 text-[10px] text-muted-foreground">
              {formatTime(t)}
            </span>
          )}
        </div>
      );
    }

    return marks;
  };

  const handleLyricClick = (e: React.MouseEvent, lyric: LyricLine) => {
    e.stopPropagation();
    
    if (didDragRef.current) {
      didDragRef.current = false;
      return;
    }
    
    const scrollLeft = containerRef.current?.scrollLeft || 0;
    const lyricLeft = timeToPixel(lyric.appearStartTime) - scrollLeft;
    const lyricWidth = timeToPixel(lyric.appearEndTime - lyric.appearStartTime);
    const lyricTop = RULER_HEIGHT + (lyric.lineNumber + 1) * TRACK_HEIGHT;
    
    setPopoverPosition({
      left: lyricLeft,
      top: lyricTop,
      width: lyricWidth,
    });
    onSelectLyric(lyric.id);
  };

  const handleClosePopover = () => {
    setPopoverPosition(null);
    onSelectLyric(null);
  };

  const renderLyricBlock = (lyric: LyricLine, singer: Singer) => {
    const isSelected = selectedLyricId === lyric.id;
    const appearWidth = timeToPixel(lyric.appearEndTime - lyric.appearStartTime);
    const highlightLeft = timeToPixel(lyric.highlightStartTime - lyric.appearStartTime);
    const highlightWidth = timeToPixel(lyric.highlightEndTime - lyric.highlightStartTime);

    return (
      <div
        key={lyric.id}
        className={cn(
          'absolute rounded-md transition-shadow cursor-move group',
          isSelected
            ? 'ring-2 ring-primary shadow-lg z-10'
            : 'hover:ring-1 hover:ring-primary/50 hover:z-[5]'
        )}
        style={{
          left: timeToPixel(lyric.appearStartTime),
          width: appearWidth,
          top: 4,
          height: TRACK_HEIGHT - 8,
          backgroundColor: singer.baseColor + '20',
          borderLeft: `3px solid ${singer.baseColor}`,
        }}
        onClick={(e) => handleLyricClick(e, lyric)}
        onMouseDown={(e) => handleDragStart(e, lyric.id, 'move', lyric)}
      >
        <div
          className="absolute inset-y-0 opacity-40"
          style={{
            left: highlightLeft,
            width: highlightWidth,
            backgroundColor: singer.highlightColor,
          }}
        />

        <div className="relative h-full flex items-center px-2 z-10">
          <span
            className="text-xs font-medium truncate drop-shadow-sm"
            style={{ color: singer.baseColor }}
          >
            {lyric.text}
          </span>
        </div>

        <div
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:!opacity-100 z-20"
          onMouseDown={(e) => handleDragStart(e, lyric.id, 'appearStart', lyric)}
        >
          <div className="absolute inset-y-1 left-0 w-1 rounded-full bg-primary/60 group-hover:bg-primary" />
        </div>
        <div
          className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:!opacity-100 z-20"
          onMouseDown={(e) => handleDragStart(e, lyric.id, 'appearEnd', lyric)}
        >
          <div className="absolute inset-y-1 right-0 w-1 rounded-full bg-primary/60 group-hover:bg-primary" />
        </div>

        <div
          className="absolute top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:!opacity-100 z-20"
          style={{ left: highlightLeft - 4 }}
          onMouseDown={(e) => handleDragStart(e, lyric.id, 'highlightStart', lyric)}
        >
          <div 
            className="absolute inset-y-2 left-0.5 w-1 rounded-full opacity-70 hover:opacity-100"
            style={{ backgroundColor: singer.highlightColor }}
          />
        </div>
        <div
          className="absolute top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100 hover:!opacity-100 z-20"
          style={{ left: highlightLeft + highlightWidth - 4 }}
          onMouseDown={(e) => handleDragStart(e, lyric.id, 'highlightEnd', lyric)}
        >
          <div 
            className="absolute inset-y-2 right-0.5 w-1 rounded-full opacity-70 hover:opacity-100"
            style={{ backgroundColor: singer.highlightColor }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex bg-timeline-bg rounded-lg border border-border overflow-hidden">
      <div className="flex flex-col shrink-0 border-r border-border bg-card/40">
        <div 
          className="border-b border-border"
          style={{ height: RULER_HEIGHT }}
        />
        {Array.from({ length: linesCount }, (_, lineIndex) => {
          const owner = lineOwnership[lineIndex];
          return (
            <div
              key={lineIndex}
              className="flex items-center justify-center border-b border-border/30 w-10"
              style={{ 
                height: TRACK_HEIGHT,
                backgroundColor: owner ? owner.baseColor + '15' : undefined,
              }}
            >
              {owner && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{ backgroundColor: owner.baseColor + '60' }}
                />
              )}
              <span className="text-[10px] text-muted-foreground font-mono">
                L{lineIndex + 1}
              </span>
            </div>
          );
        })}
      </div>

      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-auto"
        style={{ maxHeight: RULER_HEIGHT + linesCount * TRACK_HEIGHT + 16 }}
      >
        <div style={{ width: totalWidth, position: 'relative' }}>
          <div
            className="sticky top-0 z-20 bg-timeline-bg border-b border-border"
            style={{ height: RULER_HEIGHT }}
            onClick={handleTimelineClick}
          >
            {renderRuler()}
          </div>

          <div onClick={handleTimelineClick}>
            {Array.from({ length: linesCount }, (_, lineIndex) => {
              const owner = lineOwnership[lineIndex];
              const lineLyrics = lyrics.filter((l) => l.lineNumber === lineIndex);
              
              return (
                <div
                  key={lineIndex}
                  className="relative border-b border-border/30"
                  style={{
                    height: TRACK_HEIGHT,
                    backgroundColor: owner ? owner.baseColor + '08' : undefined,
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage: `repeating-linear-gradient(
                        90deg,
                        transparent,
                        transparent ${pixelsPerSecond - 1}px,
                        var(--color-border) ${pixelsPerSecond - 1}px,
                        var(--color-border) ${pixelsPerSecond}px
                      )`,
                      opacity: 0.2,
                    }}
                  />
                  <div style={{ position: 'relative', height: '100%' }}>
                    {lineLyrics.map((lyric) => {
                      const singer = singers.find((s) => s.id === lyric.singerId);
                      if (!singer) return null;
                      return renderLyricBlock(lyric, singer);
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="absolute top-0 bottom-0 w-0.5 bg-timeline-playhead z-30 pointer-events-none"
            style={{ left: timeToPixel(currentTime) }}
          >
            <div className="absolute -top-1 -translate-x-1/2 w-3 h-3 bg-timeline-playhead rotate-45" />
          </div>
        </div>
      </div>

      {selectedLyricId && popoverPosition && (() => {
        const selectedLyric = lyrics.find((l) => l.id === selectedLyricId);
        const singer = selectedLyric ? singers.find((s) => s.id === selectedLyric.singerId) : null;
        
        if (!selectedLyric || !singer) return null;
        
        return (
          <LyricEditPopover
            lyric={selectedLyric}
            singer={singer}
            linesCount={linesCount}
            singers={singers}
            position={popoverPosition}
            onSave={(updates) => onUpdateLyric(selectedLyricId, updates)}
            onDelete={() => {
              onDeleteLyric(selectedLyricId);
              handleClosePopover();
            }}
            onDuplicate={() => {
              onDuplicateLyric(selectedLyric);
            }}
            onClose={handleClosePopover}
          />
        );
      })()}
    </div>
  );
}
