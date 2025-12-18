import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import { cn, formatTimeWithSign } from '@/lib/utils';
import { LyricEditPopover } from '@/components/LyricEditPopover';
import type { Singer, LyricLine, Card } from 'shared';

interface TimelineProps {
  duration: number;
  currentTime: number;
  isPlaying: boolean;
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
  preBuffer?: number;
  postBuffer?: number;
  titleCard?: Card;
  endCard?: Card;
}

const TRACK_HEIGHT = 56;
const RULER_HEIGHT = 24;
const PIXELS_PER_SECOND_BASE = 50;

type DragType = 'appearStart' | 'appearEnd' | 'highlightStart' | 'highlightEnd' | 'move';

export function Timeline({
  duration,
  currentTime,
  isPlaying,
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
  preBuffer = 0,
  postBuffer = 0,
  titleCard,
  endCard,
}: TimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const didDragRef = useRef(false);
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<number | null>(null);
  const scrollAnimationRef = useRef<number | null>(null);
  const targetScrollRef = useRef<number | null>(null);
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
  const minTime = -preBuffer;
  const maxTime = duration + postBuffer;
  const totalDuration = preBuffer + duration + postBuffer;
  const totalWidth = Math.max(totalDuration * pixelsPerSecond, 800);

  // Detect instrumental gaps (> 5 seconds between lyrics)
  const instrumentalGaps = useMemo(() => {
    const MIN_GAP = 5; // seconds
    const gaps: { start: number; end: number }[] = [];
    
    if (lyrics.length === 0) return gaps;
    
    // Get all lyric time events to find gaps where NO lyrics are showing
    const events: { time: number; type: 'start' | 'end' }[] = [];
    for (const lyric of lyrics) {
      events.push({ time: lyric.appearStartTime, type: 'start' });
      events.push({ time: lyric.appearEndTime, type: 'end' });
    }
    events.sort((a, b) => a.time - b.time);
    
    // Track when all lyrics have ended
    let activeCount = 0;
    let gapStart: number | null = null;
    
    for (const event of events) {
      if (event.type === 'start') {
        if (activeCount === 0 && gapStart !== null) {
          // Gap ends here
          const gapDuration = event.time - gapStart;
          if (gapDuration >= MIN_GAP) {
            gaps.push({ start: gapStart, end: event.time });
          }
          gapStart = null;
        }
        activeCount++;
      } else {
        activeCount--;
        if (activeCount === 0) {
          // All lyrics ended, gap might start
          gapStart = event.time;
        }
      }
    }
    
    // Check for gap at the end (before duration)
    if (gapStart !== null && duration - gapStart >= MIN_GAP) {
      gaps.push({ start: gapStart, end: duration });
    }
    
    // Check for gap at the beginning
    if (lyrics.length > 0) {
      const sortedByStart = [...lyrics].sort((a, b) => a.appearStartTime - b.appearStartTime);
      const firstLyricStart = sortedByStart[0].appearStartTime;
      if (firstLyricStart >= MIN_GAP) {
        gaps.unshift({ start: 0, end: firstLyricStart });
      }
    }
    
    return gaps;
  }, [lyrics, duration]);

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

  // Convert time to pixel position (time can be negative for pre-buffer)
  // Pixel 0 is at minTime (start of pre-buffer)
  const timeToPixel = useCallback(
    (time: number) => (time - minTime) * pixelsPerSecond,
    [pixelsPerSecond, minTime]
  );

  const pixelToTime = useCallback(
    (pixel: number) => Math.max(minTime, Math.min(pixel / pixelsPerSecond + minTime, maxTime)),
    [pixelsPerSecond, minTime, maxTime]
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

  const getSnapPoints = useCallback((excludeLyricId: string, targetLineNumber: number) => {
    const snapPoints: number[] = [];
    
    snapPoints.push(currentTime);
    
    for (const lyric of lyrics) {
      if (lyric.id === excludeLyricId) continue;
      
      if (lyric.lineNumber === targetLineNumber) {
        snapPoints.push(lyric.appearStartTime);
        snapPoints.push(lyric.appearEndTime);
      } else {
        snapPoints.push(lyric.appearStartTime);
        snapPoints.push(lyric.appearEndTime);
      }
    }
    
    return snapPoints;
  }, [currentTime, lyrics]);

  const snapToNearest = useCallback((value: number, snapPoints: number[], thresholdPixels: number = 10) => {
    const thresholdTime = thresholdPixels / pixelsPerSecond;
    
    let closest = value;
    let closestDistance = thresholdTime;
    
    for (const point of snapPoints) {
      const distance = Math.abs(value - point);
      if (distance < closestDistance) {
        closest = point;
        closestDistance = distance;
      }
    }
    
    return closest;
  }, [pixelsPerSecond]);

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
        
        const lineDelta = Math.round(deltaY / TRACK_HEIGHT);
        const newLineNumber = Math.max(0, Math.min(linesCount - 1, dragging.originalLineNumber + lineDelta));
        
        let newStart = Math.max(0, dragging.originalAppearStart! + deltaTime);
        if (newStart + blockDuration > duration) {
          newStart = duration - blockDuration;
        }
        
        const snapPoints = getSnapPoints(dragging.lyricId, newLineNumber);
        const startSnapPoints = snapPoints;
        const endSnapPoints = snapPoints;
        
        const snappedStart = snapToNearest(newStart, startSnapPoints);
        const snappedEnd = snapToNearest(newStart + blockDuration, endSnapPoints);
        
        if (snappedStart !== newStart) {
          newStart = snappedStart;
        } else if (snappedEnd !== newStart + blockDuration) {
          newStart = snappedEnd - blockDuration;
        }

        onUpdateLyric(dragging.lyricId, {
          appearStartTime: newStart,
          appearEndTime: newStart + blockDuration,
          highlightStartTime: newStart + highlightOffset,
          highlightEndTime: newStart + highlightOffset + highlightDuration,
          lineNumber: newLineNumber,
        });
      } else {
        let newValue = Math.max(0, Math.min(dragging.originalValue + deltaTime, duration));
        
        const currentLyric = lyrics.find(l => l.id === dragging.lyricId);
        const snapPoints = getSnapPoints(dragging.lyricId, currentLyric?.lineNumber ?? 0);

        if (dragging.type === 'appearStart') {
          newValue = snapToNearest(newValue, snapPoints);
          newValue = Math.min(newValue, dragging.originalHighlightStart! - 0.1);
          onUpdateLyric(dragging.lyricId, { appearStartTime: newValue });
        } else if (dragging.type === 'appearEnd') {
          newValue = snapToNearest(newValue, snapPoints);
          newValue = Math.max(newValue, dragging.originalHighlightEnd! + 0.1);
          onUpdateLyric(dragging.lyricId, { appearEndTime: newValue });
        } else if (dragging.type === 'highlightStart') {
          newValue = snapToNearest(newValue, snapPoints);
          newValue = Math.max(newValue, dragging.originalAppearStart! + 0.1);
          newValue = Math.min(newValue, dragging.originalHighlightEnd! - 0.1);
          onUpdateLyric(dragging.lyricId, { highlightStartTime: newValue });
        } else if (dragging.type === 'highlightEnd') {
          newValue = snapToNearest(newValue, snapPoints);
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
  }, [dragging, pixelsPerSecond, duration, linesCount, lyrics, onUpdateLyric, getSnapPoints, snapToNearest]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = () => {
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
        scrollAnimationRef.current = null;
        targetScrollRef.current = null;
      }
      
      isUserScrollingRef.current = true;
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
      userScrollTimeoutRef.current = window.setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 1000);
    };

    container.addEventListener('wheel', handleWheel, { passive: true });
    return () => {
      container.removeEventListener('wheel', handleWheel);
      if (userScrollTimeoutRef.current) {
        clearTimeout(userScrollTimeoutRef.current);
      }
      if (scrollAnimationRef.current) {
        cancelAnimationFrame(scrollAnimationRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isPlaying || isUserScrollingRef.current || dragging) return;
    
    const container = containerRef.current;
    if (!container) return;

    const playheadPosition = timeToPixel(currentTime);
    const containerWidth = container.clientWidth;
    
    const newTarget = Math.max(0, playheadPosition - containerWidth / 2);
    targetScrollRef.current = newTarget;
    
    if (!scrollAnimationRef.current) {
      const animate = () => {
        const cont = containerRef.current;
        if (!cont || targetScrollRef.current === null) {
          scrollAnimationRef.current = null;
          return;
        }
        
        const current = cont.scrollLeft;
        const target = targetScrollRef.current;
        const diff = target - current;
        
        if (Math.abs(diff) < 1) {
          cont.scrollLeft = target;
          scrollAnimationRef.current = null;
          targetScrollRef.current = null;
          return;
        }
        
        cont.scrollLeft = current + diff * 0.08;
        scrollAnimationRef.current = requestAnimationFrame(animate);
      };
      
      scrollAnimationRef.current = requestAnimationFrame(animate);
    }
  }, [currentTime, isPlaying, dragging, timeToPixel]);

  useEffect(() => {
    if (isPlaying) return;
    
    if (scrollAnimationRef.current) {
      cancelAnimationFrame(scrollAnimationRef.current);
      scrollAnimationRef.current = null;
      targetScrollRef.current = null;
    }
  }, [isPlaying]);

  const renderRuler = () => {
    const marks: React.ReactNode[] = [];
    const interval = zoom < 0.5 ? 10 : zoom < 1 ? 5 : zoom < 2 ? 2 : 1;
    const subInterval = interval / 5;

    // Start from minTime (negative for pre-buffer)
    for (let t = Math.floor(minTime / subInterval) * subInterval; t <= maxTime; t += subInterval) {
      const x = timeToPixel(t);
      // Round to avoid floating point issues
      const roundedT = Math.round(t * 1000) / 1000;
      const isMajor = Math.abs(roundedT % interval) < 0.01 || Math.abs(roundedT) < 0.01;
      const isZero = Math.abs(roundedT) < 0.01;
      const isInPreBuffer = roundedT < 0;
      const isInPostBuffer = roundedT > duration;

      marks.push(
        <div
          key={roundedT}
          className="absolute top-0"
          style={{ left: x }}
        >
          <div
            className={cn(
              'w-px',
              isZero 
                ? 'h-5 bg-green-500' 
                : isMajor 
                  ? `h-4 ${isInPreBuffer || isInPostBuffer ? 'bg-muted-foreground/30' : 'bg-muted-foreground/50'}`
                  : `h-2 ${isInPreBuffer || isInPostBuffer ? 'bg-muted-foreground/10' : 'bg-muted-foreground/20'}`
            )}
          />
          {isMajor && (
            <span className={cn(
              "absolute top-4 -translate-x-1/2 text-[10px]",
              isZero ? 'text-green-500 font-bold' : isInPreBuffer || isInPostBuffer ? 'text-muted-foreground/50' : 'text-muted-foreground'
            )}>
              {formatTimeWithSign(roundedT)}
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
    const lyricWidth = (lyric.appearEndTime - lyric.appearStartTime) * pixelsPerSecond;
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
    // Use raw pixelsPerSecond for widths and internal offsets (not timeToPixel which includes minTime offset)
    const appearWidth = (lyric.appearEndTime - lyric.appearStartTime) * pixelsPerSecond;
    const highlightLeft = (lyric.highlightStartTime - lyric.appearStartTime) * pixelsPerSecond;
    const highlightWidth = (lyric.highlightEndTime - lyric.highlightStartTime) * pixelsPerSecond;

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

        {/* Text centered on highlight position but can overflow into appear box */}
        <div className="absolute inset-0 overflow-hidden z-10">
          <div 
            className="absolute inset-y-0 flex items-center justify-center"
            style={{
              left: highlightLeft,
              width: highlightWidth,
            }}
          >
            <span
              className="text-xs font-medium whitespace-nowrap drop-shadow-sm text-center px-1"
              style={{ color: singer.baseColor }}
            >
              {lyric.text}
            </span>
          </div>
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
                  {/* Pre-buffer zone */}
                  {preBuffer > 0 && (
                    <div
                      className="absolute top-0 bottom-0 bg-blue-500/5 pointer-events-none"
                      style={{
                        left: 0,
                        width: timeToPixel(0),
                      }}
                    />
                  )}
                  {/* Post-buffer zone */}
                  {postBuffer > 0 && (
                    <div
                      className="absolute top-0 bottom-0 bg-orange-500/5 pointer-events-none"
                      style={{
                        left: timeToPixel(duration),
                        width: postBuffer * pixelsPerSecond,
                      }}
                    />
                  )}
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

          {/* Title Card visualization */}
          {titleCard?.enabled && (
            <div
              className="absolute rounded-md bg-purple-500/30 border-2 border-purple-500 flex items-center justify-center z-5 pointer-events-none"
              style={{
                left: timeToPixel(titleCard.startTime),
                width: (titleCard.endTime - titleCard.startTime) * pixelsPerSecond,
                top: RULER_HEIGHT + 4,
                height: linesCount * TRACK_HEIGHT - 8,
              }}
            >
              <span className="text-purple-400 font-bold text-sm">TITLE CARD</span>
            </div>
          )}

          {/* End Card visualization */}
          {endCard?.enabled && (
            <div
              className="absolute rounded-md bg-amber-500/30 border-2 border-amber-500 flex items-center justify-center z-5 pointer-events-none"
              style={{
                left: timeToPixel(endCard.startTime),
                width: (endCard.endTime - endCard.startTime) * pixelsPerSecond,
                top: RULER_HEIGHT + 4,
                height: linesCount * TRACK_HEIGHT - 8,
              }}
            >
              <span className="text-amber-400 font-bold text-sm">END CARD</span>
            </div>
          )}

          {/* Instrumental gaps visualization */}
          {instrumentalGaps.map((gap, index) => (
            <div
              key={`instrumental-${index}`}
              className="absolute rounded-md bg-emerald-500/15 border border-dashed border-emerald-500/40 flex items-center justify-center z-4 pointer-events-none"
              style={{
                left: timeToPixel(gap.start),
                width: (gap.end - gap.start) * pixelsPerSecond,
                top: RULER_HEIGHT + 4,
                height: linesCount * TRACK_HEIGHT - 8,
              }}
            >
              <div className="flex items-center gap-2 text-emerald-400/70">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <span className="text-xs font-medium">Instrumental</span>
              </div>
            </div>
          ))}

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
