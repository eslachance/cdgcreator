import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, Trash2, Copy, X } from 'lucide-react';
import { formatTime, parseTime } from '@/lib/utils';
import type { Singer, LyricLine } from 'shared';

interface LyricEditPopoverProps {
  lyric: LyricLine;
  singer: Singer;
  linesCount: number;
  singers: Singer[];
  position: { left: number; top: number; width: number };
  onSave: (updates: Partial<LyricLine>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}

export function LyricEditPopover({
  lyric,
  singer,
  linesCount,
  singers,
  position,
  onSave,
  onDelete,
  onDuplicate,
  onClose,
}: LyricEditPopoverProps) {
  const [text, setText] = useState(lyric.text);
  const [lineNumber, setLineNumber] = useState(lyric.lineNumber);
  const [appearStart, setAppearStart] = useState(formatTime(lyric.appearStartTime));
  const [appearEnd, setAppearEnd] = useState(formatTime(lyric.appearEndTime));
  const [highlightStart, setHighlightStart] = useState(formatTime(lyric.highlightStartTime));
  const [highlightEnd, setHighlightEnd] = useState(formatTime(lyric.highlightEndTime));
  const [hasChanges, setHasChanges] = useState(false);

  const getSingerForLine = (line: number): Singer | undefined => {
    return singers.find(
      (s) => line >= s.startLine && line < s.startLine + s.lineCount
    );
  };
  
  const popoverRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setText(lyric.text);
    setLineNumber(lyric.lineNumber);
    setAppearStart(formatTime(lyric.appearStartTime));
    setAppearEnd(formatTime(lyric.appearEndTime));
    setHighlightStart(formatTime(lyric.highlightStartTime));
    setHighlightEnd(formatTime(lyric.highlightEndTime));
    setHasChanges(false);
  }, [lyric]);

  useEffect(() => {
    textInputRef.current?.focus();
    textInputRef.current?.select();
  }, []);

  const saveAndClose = () => {
    const updates: Partial<LyricLine> = {};
    
    if (text !== lyric.text) {
      updates.text = text;
    }
    if (lineNumber !== lyric.lineNumber) {
      updates.lineNumber = lineNumber;
    }
    
    const newAppearStart = parseTime(appearStart);
    const newAppearEnd = parseTime(appearEnd);
    const newHighlightStart = parseTime(highlightStart);
    const newHighlightEnd = parseTime(highlightEnd);
    
    if (newAppearStart !== lyric.appearStartTime) {
      updates.appearStartTime = newAppearStart;
    }
    if (newAppearEnd !== lyric.appearEndTime) {
      updates.appearEndTime = newAppearEnd;
    }
    if (newHighlightStart !== lyric.highlightStartTime) {
      updates.highlightStartTime = newHighlightStart;
    }
    if (newHighlightEnd !== lyric.highlightEndTime) {
      updates.highlightEndTime = newHighlightEnd;
    }
    
    if (Object.keys(updates).length > 0) {
      onSave(updates);
    }
    onClose();
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      if (popoverRef.current && !popoverRef.current.contains(target)) {
        const isInsideRadixPortal = target.closest('[data-radix-popper-content-wrapper]') ||
                                    target.closest('[data-radix-select-viewport]') ||
                                    target.closest('[role="listbox"]');
        if (!isInsideRadixPortal) {
          saveAndClose();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        saveAndClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [lyric, text, lineNumber, appearStart, appearEnd, highlightStart, highlightEnd, onSave, onClose]);

  const handleSave = () => {
    if (!hasChanges) return;
    
    const updates: Partial<LyricLine> = {};
    
    if (text !== lyric.text) {
      updates.text = text;
    }
    if (lineNumber !== lyric.lineNumber) {
      updates.lineNumber = lineNumber;
    }
    
    const newAppearStart = parseTime(appearStart);
    const newAppearEnd = parseTime(appearEnd);
    const newHighlightStart = parseTime(highlightStart);
    const newHighlightEnd = parseTime(highlightEnd);
    
    if (newAppearStart !== lyric.appearStartTime) {
      updates.appearStartTime = newAppearStart;
    }
    if (newAppearEnd !== lyric.appearEndTime) {
      updates.appearEndTime = newAppearEnd;
    }
    if (newHighlightStart !== lyric.highlightStartTime) {
      updates.highlightStartTime = newHighlightStart;
    }
    if (newHighlightEnd !== lyric.highlightEndTime) {
      updates.highlightEndTime = newHighlightEnd;
    }
    
    if (Object.keys(updates).length > 0) {
      onSave(updates);
    }
    setHasChanges(false);
  };

  const handleChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setHasChanges(true);
  };

  const handleDelete = () => {
    if (confirm('Delete this lyric?')) {
      onDelete();
    }
  };

  const popoverLeft = Math.max(8, position.left);
  const arrowOffset = Math.min(Math.max(20, position.left + position.width / 2 - popoverLeft), 320);

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 animate-in fade-in-0 zoom-in-95 duration-150"
      style={{
        left: popoverLeft,
        top: position.top + 8,
      }}
    >
      <div
        className="absolute -top-2 w-4 h-4 rotate-45 bg-popover border-l border-t border-border"
        style={{ left: arrowOffset }}
      />
      
      <div
        className="relative bg-popover border border-border rounded-lg shadow-xl min-w-[340px] max-w-[400px]"
        style={{
          borderLeft: `3px solid ${singer.baseColor}`,
        }}
      >
        <div className="p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: singer.highlightColor }}
            />
            <Input
              ref={textInputRef}
              value={text}
              onChange={handleChange(setText)}
              onBlur={handleSave}
              className="flex-1 font-medium"
              placeholder="Enter lyrics..."
            />
            <Select
              value={lineNumber.toString()}
              onValueChange={(v) => {
                setLineNumber(parseInt(v));
                setHasChanges(true);
              }}
            >
              <SelectTrigger className="w-20 h-8">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: singer.baseColor }} />
                Appear
              </Label>
              <div className="flex gap-1.5">
                <Input
                  value={appearStart}
                  onChange={handleChange(setAppearStart)}
                  onBlur={handleSave}
                  className="font-mono text-xs h-7 px-2"
                  placeholder="0:00.00"
                />
                <span className="text-muted-foreground self-center text-xs">→</span>
                <Input
                  value={appearEnd}
                  onChange={handleChange(setAppearEnd)}
                  onBlur={handleSave}
                  className="font-mono text-xs h-7 px-2"
                  placeholder="0:00.00"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: singer.highlightColor }} />
                Highlight
              </Label>
              <div className="flex gap-1.5">
                <Input
                  value={highlightStart}
                  onChange={handleChange(setHighlightStart)}
                  onBlur={handleSave}
                  className="font-mono text-xs h-7 px-2"
                  placeholder="0:00.00"
                />
                <span className="text-muted-foreground self-center text-xs">→</span>
                <Input
                  value={highlightEnd}
                  onChange={handleChange(setHighlightEnd)}
                  onBlur={handleSave}
                  className="font-mono text-xs h-7 px-2"
                  placeholder="0:00.00"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 border-t border-border/50">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={onDuplicate}
              >
                <Copy className="h-3 w-3" />
                Duplicate
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </Button>
            </div>
            
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={saveAndClose}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm"
                className="h-7 px-3 text-xs gap-1"
                onClick={saveAndClose}
                disabled={!hasChanges}
              >
                <Check className="h-3 w-3" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

