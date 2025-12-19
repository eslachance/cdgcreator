import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, SkipBack, Volume2, VolumeX, Mic, Music } from 'lucide-react';
import { formatTimeWithSign } from '@/lib/utils';

interface AudioPlayerProps {
  audioPath: string | null;
  vocalsPath?: string | null;
  instrumentalPath?: string | null;
  duration: number | null;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  isPlaying: boolean;
  onPlayPause: (playing: boolean) => void;
  preBuffer?: number;
  postBuffer?: number;
}

const MUSIC_VOLUME_STORAGE_KEY = 'music_volume';
const VOCALS_VOLUME_STORAGE_KEY = 'vocals_volume';
const DEFAULT_VOLUME = 0.5;

function getStoredVolume(key: string): number {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        return parsed;
      }
    }
  } catch {}
  return DEFAULT_VOLUME;
}

function storeVolume(key: string, volume: number): void {
  try {
    localStorage.setItem(key, volume.toString());
  } catch {}
}

export function AudioPlayer({
  audioPath,
  vocalsPath,
  instrumentalPath,
  duration,
  currentTime,
  onTimeUpdate,
  isPlaying,
  onPlayPause,
  preBuffer = 0,
  postBuffer = 0,
}: AudioPlayerProps) {
  const musicAudioRef = useRef<HTMLAudioElement>(null);
  const vocalsAudioRef = useRef<HTMLAudioElement>(null);
  const [musicVolume, setMusicVolume] = useState(() => getStoredVolume(MUSIC_VOLUME_STORAGE_KEY));
  const [vocalsVolume, setVocalsVolume] = useState(() => getStoredVolume(VOCALS_VOLUME_STORAGE_KEY));
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [isVocalsMuted, setIsVocalsMuted] = useState(false);
  const animationRef = useRef<number>();
  const lastFrameTimeRef = useRef<number>(0);

  const hasSeparatedAudio = Boolean(instrumentalPath && vocalsPath);
  const effectiveMusicPath = hasSeparatedAudio ? instrumentalPath : audioPath;

  const audioDuration = duration || 0;
  const minTime = -preBuffer;
  const maxTime = audioDuration + postBuffer;

  useEffect(() => {
    if (musicAudioRef.current) {
      musicAudioRef.current.volume = isMusicMuted ? 0 : musicVolume;
    }
  }, [musicVolume, isMusicMuted]);

  useEffect(() => {
    if (vocalsAudioRef.current) {
      vocalsAudioRef.current.volume = isVocalsMuted ? 0 : vocalsVolume;
    }
  }, [vocalsVolume, isVocalsMuted]);

  const virtualToAudioTime = useCallback((virtualTime: number) => {
    return Math.max(0, Math.min(virtualTime, audioDuration));
  }, [audioDuration]);

  const isInAudioRange = useCallback((virtualTime: number) => {
    return virtualTime >= 0 && virtualTime < audioDuration;
  }, [audioDuration]);

  const syncAudioElements = useCallback((time: number) => {
    const musicAudio = musicAudioRef.current;
    const vocalsAudio = vocalsAudioRef.current;
    
    if (musicAudio && Math.abs(musicAudio.currentTime - time) > 0.1) {
      musicAudio.currentTime = time;
    }
    if (vocalsAudio && hasSeparatedAudio && Math.abs(vocalsAudio.currentTime - time) > 0.1) {
      vocalsAudio.currentTime = time;
    }
  }, [hasSeparatedAudio]);

  const updateTime = useCallback(() => {
    const now = performance.now();
    const deltaMs = lastFrameTimeRef.current ? now - lastFrameTimeRef.current : 16;
    lastFrameTimeRef.current = now;

    if (isPlaying) {
      const deltaSeconds = deltaMs / 1000;
      const newVirtualTime = currentTime + deltaSeconds;

      if (isInAudioRange(newVirtualTime)) {
        const musicAudio = musicAudioRef.current;
        const vocalsAudio = vocalsAudioRef.current;
        
        if (musicAudio) {
          if (musicAudio.paused) {
            musicAudio.currentTime = virtualToAudioTime(newVirtualTime);
            musicAudio.play().catch(() => {});
          }
          if (vocalsAudio && hasSeparatedAudio && vocalsAudio.paused) {
            vocalsAudio.currentTime = virtualToAudioTime(newVirtualTime);
            vocalsAudio.play().catch(() => {});
          }
          onTimeUpdate(musicAudio.currentTime);
        }
      } else {
        const musicAudio = musicAudioRef.current;
        const vocalsAudio = vocalsAudioRef.current;
        
        if (musicAudio && !musicAudio.paused) {
          musicAudio.pause();
        }
        if (vocalsAudio && !vocalsAudio.paused) {
          vocalsAudio.pause();
        }
        
        if (newVirtualTime >= maxTime) {
          onTimeUpdate(maxTime);
          onPlayPause(false);
          return;
        }
        
        onTimeUpdate(newVirtualTime);
      }

      animationRef.current = requestAnimationFrame(updateTime);
    }
  }, [isPlaying, currentTime, onTimeUpdate, onPlayPause, isInAudioRange, virtualToAudioTime, maxTime, hasSeparatedAudio]);

  useEffect(() => {
    if (isPlaying) {
      lastFrameTimeRef.current = performance.now();
      animationRef.current = requestAnimationFrame(updateTime);
    } else {
      const musicAudio = musicAudioRef.current;
      const vocalsAudio = vocalsAudioRef.current;
      
      if (musicAudio && !musicAudio.paused) {
        musicAudio.pause();
      }
      if (vocalsAudio && !vocalsAudio.paused) {
        vocalsAudio.pause();
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
    const musicAudio = musicAudioRef.current;
    if (!musicAudio) return;

    const handleEnded = () => {
      if (postBuffer > 0) {
      } else {
        onPlayPause(false);
        onTimeUpdate(minTime);
      }
    };

    musicAudio.addEventListener('ended', handleEnded);
    return () => musicAudio.removeEventListener('ended', handleEnded);
  }, [onPlayPause, onTimeUpdate, postBuffer, minTime]);

  useEffect(() => {
    if (isPlaying) return;
    
    if (isInAudioRange(currentTime)) {
      const audioTime = virtualToAudioTime(currentTime);
      syncAudioElements(audioTime);
    }
  }, [currentTime, isPlaying, isInAudioRange, virtualToAudioTime, syncAudioElements]);

  const handleSeek = (value: number[]) => {
    const newVirtualTime = value[0];
    
    if (isInAudioRange(newVirtualTime)) {
      syncAudioElements(virtualToAudioTime(newVirtualTime));
    }
    
    onTimeUpdate(newVirtualTime);
  };

  const handleMusicVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setMusicVolume(newVolume);
    storeVolume(MUSIC_VOLUME_STORAGE_KEY, newVolume);
    if (musicAudioRef.current) {
      musicAudioRef.current.volume = newVolume;
    }
    if (newVolume > 0 && isMusicMuted) {
      setIsMusicMuted(false);
    }
  };

  const handleVocalsVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVocalsVolume(newVolume);
    storeVolume(VOCALS_VOLUME_STORAGE_KEY, newVolume);
    if (vocalsAudioRef.current) {
      vocalsAudioRef.current.volume = newVolume;
    }
    if (newVolume > 0 && isVocalsMuted) {
      setIsVocalsMuted(false);
    }
  };

  const toggleMusicMute = () => {
    if (musicAudioRef.current) {
      if (isMusicMuted) {
        musicAudioRef.current.volume = musicVolume;
        setIsMusicMuted(false);
      } else {
        musicAudioRef.current.volume = 0;
        setIsMusicMuted(true);
      }
    }
  };

  const toggleVocalsMute = () => {
    if (vocalsAudioRef.current) {
      if (isVocalsMuted) {
        vocalsAudioRef.current.volume = vocalsVolume;
        setIsVocalsMuted(false);
      } else {
        vocalsAudioRef.current.volume = 0;
        setIsVocalsMuted(true);
      }
    }
  };

  const handleRestart = () => {
    syncAudioElements(0);
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
    <div className="flex flex-col gap-3 px-4 py-3 rounded-lg bg-card border border-border">
      <audio ref={musicAudioRef} src={effectiveMusicPath || undefined} preload="metadata" />
      {hasSeparatedAudio && (
        <audio ref={vocalsAudioRef} src={vocalsPath || undefined} preload="metadata" />
      )}
      
      <div className="flex items-center gap-4">
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
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 flex-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={toggleMusicMute}
          >
            {isMusicMuted || musicVolume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Music className="h-4 w-4" />
            )}
          </Button>
          <span className="text-xs text-muted-foreground w-12">Music</span>
          <Slider
            value={[isMusicMuted ? 0 : musicVolume]}
            max={1}
            step={0.01}
            onValueChange={handleMusicVolumeChange}
            className="w-24"
          />
        </div>

        {hasSeparatedAudio && (
          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={toggleVocalsMute}
            >
              {isVocalsMuted || vocalsVolume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <span className="text-xs text-muted-foreground w-12">Vocals</span>
            <Slider
              value={[isVocalsMuted ? 0 : vocalsVolume]}
              max={1}
              step={0.01}
              onValueChange={handleVocalsVolumeChange}
              className="w-24"
            />
          </div>
        )}

        {!hasSeparatedAudio && (
          <div className="flex items-center gap-2 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={toggleMusicMute}
            >
              {isMusicMuted || musicVolume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </Button>
            <span className="text-xs text-muted-foreground w-12">Volume</span>
            <Slider
              value={[isMusicMuted ? 0 : musicVolume]}
              max={1}
              step={0.01}
              onValueChange={handleMusicVolumeChange}
              className="w-24"
            />
          </div>
        )}
      </div>
    </div>
  );
}
