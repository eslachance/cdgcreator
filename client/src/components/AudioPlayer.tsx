import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipBack, Volume2, VolumeX } from 'lucide-react';
import { formatTime } from '@/lib/utils';

interface AudioPlayerProps {
  audioPath: string | null;
  duration: number | null;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  isPlaying: boolean;
  onPlayPause: (playing: boolean) => void;
}

export function AudioPlayer({
  audioPath,
  duration,
  currentTime,
  onTimeUpdate,
  isPlaying,
  onPlayPause,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const animationRef = useRef<number>();

  const updateTime = useCallback(() => {
    if (audioRef.current) {
      onTimeUpdate(audioRef.current.currentTime);
    }
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(updateTime);
    }
  }, [isPlaying, onTimeUpdate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => {
        onPlayPause(false);
      });
      animationRef.current = requestAnimationFrame(updateTime);
    } else {
      audio.pause();
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, updateTime, onPlayPause]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      onPlayPause(false);
      onTimeUpdate(0);
    };

    audio.addEventListener('ended', handleEnded);
    return () => audio.removeEventListener('ended', handleEnded);
  }, [onPlayPause, onTimeUpdate]);

  const handleSeek = (value: number[]) => {
    const newTime = value[0];
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    onTimeUpdate(newTime);
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
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
    onTimeUpdate(0);
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
        <span className="text-sm font-mono text-muted-foreground w-16 text-right">
          {formatTime(currentTime)}
        </span>
        
        <Slider
          value={[currentTime]}
          max={duration || 100}
          step={0.01}
          onValueChange={handleSeek}
          className="flex-1"
        />
        
        <span className="text-sm font-mono text-muted-foreground w-16">
          {formatTime(duration || 0)}
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

