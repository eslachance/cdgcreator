import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipBack, Volume2, VolumeX } from 'lucide-react';
import { formatTime, formatTimeWithSign } from '@/lib/utils';

interface AudioPlayerProps {
  audioPath: string | null;
  duration: number | null;
  currentTime: number; // Virtual time (can be negative for pre-buffer)
  onTimeUpdate: (time: number) => void;
  isPlaying: boolean;
  onPlayPause: (playing: boolean) => void;
  preBuffer?: number;
  postBuffer?: number;
}

const VOLUME_STORAGE_KEY = 'last_volume';
const DEFAULT_VOLUME = 0.5; // Safe default to protect eardrums

function getStoredVolume(): number {
  try {
    const stored = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        return parsed;
      }
    }
  } catch {
    // localStorage might not be available
  }
  return DEFAULT_VOLUME;
}

function storeVolume(volume: number): void {
  try {
    localStorage.setItem(VOLUME_STORAGE_KEY, volume.toString());
  } catch {
    // localStorage might not be available
  }
}

export function AudioPlayer({
  audioPath,
  duration,
  currentTime,
  onTimeUpdate,
  isPlaying,
  onPlayPause,
  preBuffer = 0,
  postBuffer = 0,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(getStoredVolume);
  const [isMuted, setIsMuted] = useState(false);
  const animationRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);

  // Calculate total virtual duration
  const audioDuration = duration || 0;
  const totalDuration = preBuffer + audioDuration + postBuffer;
  const minTime = -preBuffer;
  const maxTime = audioDuration + postBuffer;

  // Set initial volume on audio element when it's available
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Convert virtual time to audio time
  const virtualToAudioTime = useCallback((virtualTime: number) => {
    return Math.max(0, Math.min(virtualTime, audioDuration));
  }, [audioDuration]);

  // Check if we're in the audio playback range
  const isInAudioRange = useCallback((virtualTime: number) => {
    return virtualTime >= 0 && virtualTime < audioDuration;
  }, [audioDuration]);

  const updateTime = useCallback(() => {
    const now = performance.now();
    const deltaMs = lastFrameTimeRef.current ? now - lastFrameTimeRef.current : 16;
    lastFrameTimeRef.current = now;

    if (isPlaying) {
      const deltaSeconds = deltaMs / 1000;
      const newVirtualTime = currentTime + deltaSeconds;

      // Check if we should be playing audio
      if (isInAudioRange(newVirtualTime)) {
        const audio = audioRef.current;
        if (audio) {
          // If audio was paused (e.g., coming from pre-buffer), start it
          if (audio.paused) {
            audio.currentTime = virtualToAudioTime(newVirtualTime);
            audio.play().catch(() => {});
          }
          // Update virtual time based on audio time
          onTimeUpdate(audio.currentTime);
        }
      } else {
        // We're in pre-buffer or post-buffer, just advance virtual time
        const audio = audioRef.current;
        if (audio && !audio.paused) {
          audio.pause();
        }
        
        if (newVirtualTime >= maxTime) {
          // Reached the end
          onTimeUpdate(maxTime);
          onPlayPause(false);
          return;
        }
        
        onTimeUpdate(newVirtualTime);
      }

      animationRef.current = requestAnimationFrame(updateTime);
    }
  }, [isPlaying, currentTime, onTimeUpdate, onPlayPause, isInAudioRange, virtualToAudioTime, maxTime]);

  useEffect(() => {
    if (isPlaying) {
      lastFrameTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(updateTime);
    } else {
      const audio = audioRef.current;
      if (audio && !audio.paused) {
        audio.pause();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, updateTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      // Audio ended, but we might have post-buffer to continue
      if (postBuffer > 0) {
        // Continue playing (virtual time) into post-buffer
        // The updateTime loop will handle this
      } else {
        onPlayPause(false);
        onTimeUpdate(minTime);
      }
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [onPlayPause, onTimeUpdate, postBuffer, minTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isPlaying) return;
    
    // Sync audio position when seeking while paused
    if (isInAudioRange(currentTime)) {
      const audioTime = virtualToAudioTime(currentTime);
      if (Math.abs(audio.currentTime - audioTime) > 0.1) {
        audio.currentTime = audioTime;
      }
    }
  }, [currentTime, isPlaying, isInAudioRange, virtualToAudioTime]);

  const handleSeek = (value: number[]) => {
    const newVirtualTime = value[0];
    const audio = audioRef.current;
    
    if (audio && isInAudioRange(newVirtualTime)) {
      audio.currentTime = virtualToAudioTime(newVirtualTime);
    }
    
    onTimeUpdate(newVirtualTime);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    storeVolume(newVolume); // Persist to localStorage
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const handleRestart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
    onTimeUpdate(minTime);
  };

  if (!audioPath) {
    return (
      <div className="flex items-center justify-center h-14 text-muted-foreground text-sm">
        Upload audio to enable playback
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-card border border-border">
      <audio ref={audioRef} src={audioPath} preload="metadata" />
      
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleRestart}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button
          variant="default"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={() => onPlayPause(!isPlaying)}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>
      </div>

      <div className="flex-1 flex items-center gap-3">
        <span className="text-sm font-mono text-muted-foreground w-20 text-right">
          {formatTimeWithSign(currentTime)}
        </span>
        
        <Slider
          value={[currentTime]}
          min={minTime}
          max={maxTime}
          step={0.01}
          onValueChange={handleSeek}
          className="flex-1"
        />
        
        <span className="text-sm font-mono text-muted-foreground w-20">
          {formatTimeWithSign(maxTime)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleMute}
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
        <Slider
          value={[isMuted ? 0 : volume]}
          max={1}
          step={0.01}
          onValueChange={handleVolumeChange}
          className="w-24"
        />
      </div>
    </div>
  );
}

