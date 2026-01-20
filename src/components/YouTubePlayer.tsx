import { useEffect, useRef, useState, useCallback } from 'react';
import { RotateCcw, Play, Pause, Volume2, VolumeX, WifiOff } from 'lucide-react';
import { isOnline } from '../lib/offline';

declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  onEnded?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  autoplay?: boolean;
  showControls?: boolean;
  videoBlob?: Blob; // Added for offline support
}

let apiLoaded = false;
let apiLoadPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (apiLoaded) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;

  apiLoadPromise = new Promise((resolve) => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      apiLoaded = true;
      resolve();
    };
  });

  return apiLoadPromise;
}

export function YouTubePlayer({
  videoId,
  onEnded,
  onPlay,
  onPause,
  autoplay = false,
  showControls: externalShowControls,
  videoBlob,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);
  const [internalShowControls, setInternalShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isOnlineStatus, setIsOnlineStatus] = useState(isOnline());
  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);

  const controlsTimeoutRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // Sync video blob to local URL
  useEffect(() => {
    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      setLocalBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setLocalBlobUrl(null);
    }
  }, [videoBlob]);

  // Use external controls if provided, otherwise fallback to internal logic
  const actualShowControls = externalShowControls !== undefined ? externalShowControls : internalShowControls;

  const checkOrientation = useCallback(() => {
    const isLand = window.innerWidth > window.innerHeight;
    setIsLandscape(isLand);
    if (!isLand && playerRef.current && isPlaying) {
      playerRef.current.pauseVideo();
    }
  }, [isPlaying]);

  useEffect(() => {
    const handleStatusChange = () => setIsOnlineStatus(isOnline());
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  const updateProgress = useCallback(() => {
    if (isOnlineStatus && playerRef.current && isPlaying && !isDragging) {
      const current = playerRef.current.getCurrentTime();
      const total = playerRef.current.getDuration();
      setCurrentTime(current);
      if (total !== duration) setDuration(total);
    }
  }, [isPlaying, isDragging, duration, isOnlineStatus]);

  useEffect(() => {
    if (isOnlineStatus && isPlaying && !isDragging) {
      progressIntervalRef.current = window.setInterval(updateProgress, 1000);
    } else if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, isDragging, updateProgress, isOnlineStatus]);

  useEffect(() => {
    checkOrientation();
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [checkOrientation]);

  useEffect(() => {
    let mounted = true;

    async function initPlayer() {
      if (!isOnlineStatus) return;

      await loadYouTubeAPI();
      if (!mounted || !containerRef.current) return;

      if (playerRef.current) {
        playerRef.current.destroy();
      }

      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        host: 'https://www.youtube-nocookie.com',
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (mounted) {
              setIsReady(true);
              if (playerRef.current) {
                setDuration(playerRef.current.getDuration());
              }
            }
          },
          onStateChange: (event: YT.OnStateChangeEvent) => {
            if (!mounted) return;
            if (event.data === window.YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              onPlay?.();
            } else if (event.data === window.YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              onPause?.();
            } else if (event.data === window.YT.PlayerState.ENDED) {
              setIsPlaying(false);
              onEnded?.();
            }
          },
        },
      });
    }

    initPlayer();

    return () => {
      mounted = false;
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId, autoplay, onEnded, onPlay, onPause, isOnlineStatus]);

  const togglePlay = useCallback(() => {
    if (!isOnlineStatus && localBlobUrl) {
      const video = document.getElementById('local-video') as HTMLVideoElement;
      if (video) {
        if (isPlaying) video.pause();
        else video.play();
        setIsPlaying(!isPlaying);
      }
      return;
    }

    if (!playerRef.current || !isReady) return;
    if (isPlaying) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [isReady, isPlaying, isOnlineStatus, localBlobUrl]);

  const toggleMute = useCallback(() => {
    if (!isOnlineStatus && localBlobUrl) {
      const video = document.getElementById('local-video') as HTMLVideoElement;
      if (video) {
        video.muted = !video.muted;
        setIsMuted(video.muted);
      }
      return;
    }

    if (!playerRef.current || !isReady) return;
    if (isMuted) {
      playerRef.current.unMute();
      setIsMuted(false);
    } else {
      playerRef.current.mute();
      setIsMuted(true);
    }
  }, [isReady, isMuted, isOnlineStatus, localBlobUrl]);

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (!isOnlineStatus && localBlobUrl) {
      const video = document.getElementById('local-video') as HTMLVideoElement;
      if (video) video.currentTime = time;
    }
  };

  const handleSeekEnd = (e: React.MouseEvent | React.TouchEvent | React.ChangeEvent<HTMLInputElement>) => {
    setIsDragging(false);
    if (isOnlineStatus && playerRef.current) {
      const time = parseFloat((e.target as HTMLInputElement).value);
      playerRef.current.seekTo(time, true);
    }
  };

  const handleContainerClick = useCallback(() => {
    if (externalShowControls !== undefined) return;

    setInternalShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying && !isDragging) setInternalShowControls(false);
    }, 4000);
  }, [isPlaying, isDragging, externalShowControls]);

  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s]
      .map(v => v < 10 ? "0" + v : v)
      .filter((v, i) => v !== "00" || i > 0)
      .join(":");
  };

  if (!isLandscape) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center text-white z-50">
        <RotateCcw className="w-20 h-20 mb-6 animate-spin-slow" />
        <h2 className="text-2xl font-bold mb-2">Rotate Your Device</h2>
        <p className="text-gray-400 text-center px-8">
          Please turn your device sideways to continue watching
        </p>
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 bg-black overflow-hidden"
      onClick={handleContainerClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      {isOnlineStatus ? (
        <div
          ref={containerRef}
          className="w-full h-full pointer-events-none"
        />
      ) : localBlobUrl ? (
        <video
          id="local-video"
          src={localBlobUrl}
          className="w-full h-full"
          onTimeUpdate={(e) => {
            if (!isDragging) {
              const video = e.currentTarget;
              setCurrentTime(video.currentTime);
              setDuration(video.duration);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            onEnded?.();
          }}
          playsInline
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900 px-8 text-center">
          <WifiOff className="w-20 h-20 text-gray-600 mb-6" />
          <h2 className="text-2xl font-bold mb-2">Offline</h2>
          <p className="text-gray-400">
            This video is not available offline. Connect to Wi-Fi to watch more.
          </p>
        </div>
      )}

      {actualShowControls && (isOnlineStatus ? isReady : !!localBlobUrl) && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 flex flex-col justify-between p-8 pointer-events-none">
          <div />

          <div className="flex flex-col gap-6 pointer-events-auto">
            <div className="flex items-center gap-4 group">
              <span className="text-white text-sm font-medium w-12">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration}
                value={currentTime}
                onMouseDown={() => setIsDragging(true)}
                onTouchStart={() => setIsDragging(true)}
                onChange={handleSeekChange}
                onMouseUp={handleSeekEnd}
                onTouchEnd={handleSeekEnd}
                className="flex-1 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:h-3 transition-all"
              />
              <span className="text-white text-sm font-medium w-12">{formatTime(duration)}</span>
            </div>

            <div className="flex items-center justify-center relative">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  togglePlay();
                }}
                className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-all transform hover:scale-110 active:scale-95 shadow-xl"
              >
                {isPlaying ? (
                  <Pause className="w-12 h-12 text-white" />
                ) : (
                  <Play className="w-12 h-12 text-white ml-2" />
                )}
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                className="absolute right-0 w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-all border border-white/10"
              >
                {isMuted ? (
                  <VolumeX className="w-8 h-8 text-white" />
                ) : (
                  <Volume2 className="w-8 h-8 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOnlineStatus && !isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white font-medium">Loading safe video...</span>
          </div>
        </div>
      )}
    </div>
  );
}
