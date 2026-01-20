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
  onBack?: () => void;
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
  onBack,
  autoplay = false,
  showControls: externalShowControls,
  videoBlob,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
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
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  const controlsTimeoutRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const loadTimeoutRef = useRef<number | null>(null);

  // Detect mobile devices
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const lockOrientation = useCallback(async () => {
    try {
      if (screen.orientation && 'lock' in screen.orientation) {
        // @ts-ignore
        await screen.orientation.lock('landscape').catch(() => {
          console.log('[Orientation] Lock failed - requires user interaction or fullscreen');
        });
      }
    } catch (err) {
      console.log('[Orientation] API not supported:', err);
    }
  }, []);

  const enterFullscreen = useCallback(async () => {
    if (!wrapperRef.current) return;
    try {
      if (wrapperRef.current.requestFullscreen) {
        await wrapperRef.current.requestFullscreen();
      } else if ((wrapperRef.current as any).webkitRequestFullscreen) {
        await (wrapperRef.current as any).webkitRequestFullscreen();
      } else if ((wrapperRef.current as any).msRequestFullscreen) {
        await (wrapperRef.current as any).msRequestFullscreen();
      }
      // Lock orientation after entering fullscreen for better compatibility
      await lockOrientation();
    } catch (err) {
      console.warn('Fullscreen entry failed:', err);
    }
  }, [lockOrientation]);

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
  }, []);

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

    // Initial lock attempt
    lockOrientation();

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, [checkOrientation, lockOrientation]);

  useEffect(() => {
    let mounted = true;

    async function initPlayer() {
      if (!isOnlineStatus) return;

      console.log(`[YouTube] Initializing player for ${videoId}, mobile: ${isMobile}, autoplay: ${autoplay}`);

      setLoadError(false);
      setIsReady(false);

      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);

      // Longer timeout for mobile
      const timeout = isMobile ? 45000 : 30000;
      loadTimeoutRef.current = window.setTimeout(() => {
        if (mounted && !isReady) {
          console.error(`[YouTube] Player timed out after ${timeout}ms`);
          setLoadError(true);
        }
      }, timeout);

      try {
        console.log('[YouTube] Loading YouTube API...');
        await loadYouTubeAPI();

        if (!mounted || !containerRef.current) {
          console.log('[YouTube] Mount check failed');
          return;
        }

        if (playerRef.current) {
          try {
            playerRef.current.destroy();
          } catch (e) { }
        }

        console.log('[YouTube] Creating player instance...');

        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId,
          // Use regular youtube.com for better mobile compatibility
          host: 'https://www.youtube.com',
          playerVars: {
            // CRITICAL: Disable autoplay on mobile to prevent timeout
            autoplay: (isMobile ? 0 : (autoplay ? 1 : 0)),
            controls: 0,
            disablekb: 1,
            fs: 0,
            iv_load_policy: 3,
            modestbranding: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location.origin,
            enablejsapi: 1,
          },
          events: {
            onReady: () => {
              if (mounted) {
                console.log('[YouTube] Player ready!');
                if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
                setIsReady(true);
                setLoadError(false);
                if (playerRef.current) {
                  setDuration(playerRef.current.getDuration());
                  // Auto-play on both desktop and mobile
                  // On mobile, the user already tapped to open the player, so this is allowed
                  if (autoplay) {
                    try {
                      console.log('[YouTube] Attempting auto-play...');
                      playerRef.current.playVideo();
                    } catch (e) {
                      console.log('[YouTube] Autoplay blocked:', e);
                    }
                  }
                }
              }
            },
            onStateChange: (event: YT.OnStateChangeEvent) => {
              if (!mounted) return;
              console.log('[YouTube] State change:', event.data);

              if (event.data === window.YT.PlayerState.PLAYING) {
                setIsPlaying(true);
                onPlay?.();
                // On mobile, force fullscreen + landscape when video plays
                if (isMobile && !hasUserInteracted) {
                  console.log('[YouTube] Video started - forcing fullscreen + landscape');
                  setHasUserInteracted(true);
                  enterFullscreen().then(() => lockOrientation());
                }
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
                onPause?.();
              } else if (event.data === window.YT.PlayerState.ENDED) {
                setIsPlaying(false);
                onEnded?.();
              }
            },
            onError: (event: any) => {
              console.error('[YouTube] Player error:', event.data);
              if (mounted) {
                setLoadError(true);
                if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
              }
            }
          },
        });
      } catch (err) {
        console.error('[YouTube] Failed to init player:', err);
        if (mounted) setLoadError(true);
      }
    }

    initPlayer();

    return () => {
      mounted = false;
      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch (e) { }
        playerRef.current = null;
      }
    };
  }, [videoId, autoplay, onEnded, onPlay, onPause, isOnlineStatus, retryCount, isMobile, lockOrientation, hasUserInteracted]);

  const togglePlay = useCallback(async () => {
    // On FIRST play on mobile, try fullscreen to enable orientation lock
    if (!isPlaying && isMobile && !hasUserInteracted) {
      console.log('[Player] First play on mobile, attempting fullscreen...');
      await enterFullscreen();
      setHasUserInteracted(true);
    }

    if (!isOnlineStatus && localBlobUrl) {
      const video = document.getElementById('local-video') as HTMLVideoElement;
      if (video) {
        if (isPlaying) video.pause();
        else video.play();
        setIsPlaying(!isPlaying);
      }
      return;
    }

    if (!playerRef.current || !isReady) {
      console.log('[Player] Cannot play - player not ready');
      return;
    }

    if (isPlaying) {
      console.log('[Player] Pausing...');
      playerRef.current.pauseVideo();
    } else {
      console.log('[Player] Playing...');
      playerRef.current.playVideo();
    }
  }, [isReady, isPlaying, isOnlineStatus, localBlobUrl, enterFullscreen, isMobile, hasUserInteracted]);

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
    if (isNaN(seconds)) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s]
      .map(v => v < 10 ? "0" + v : v)
      .filter((v, i) => v !== "00" || i > 0)
      .join(":");
  };

  const BackButton = ({ className = "" }: { className?: string }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onBack?.();
      }}
      className={`px-6 py-3 rounded-full bg-white/10 backdrop-blur-md text-white font-bold hover:bg-white/20 transition-all shadow-lg border border-white/10 flex items-center gap-2 group/btn active:scale-95 pointer-events-auto ${className}`}
    >
      <RotateCcw className="w-5 h-5 -scale-x-100 group-hover/btn:-translate-x-1 transition-transform" />
      Back to Browse
    </button>
  );

  if (!isLandscape && !isReady && !loadError) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex flex-col items-center justify-center text-white z-50">
        <div className="absolute top-8 left-8">
          <BackButton />
        </div>
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
      ref={wrapperRef}
      className="absolute inset-0 bg-black overflow-hidden"
      onClick={handleContainerClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Stable container for YouTube to prevent removeChild errors during unmounting/re-rendering */}
      <div
        className={`w-full h-full pointer-events-none ${(isOnlineStatus && !loadError) ? 'block' : 'hidden'}`}
      >
        <div
          ref={containerRef}
          className="w-full h-full"
        />
      </div>

      {!isOnlineStatus && !localBlobUrl && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-gray-900 px-8 text-center">
          <div className="absolute top-8 left-8">
            <BackButton />
          </div>
          <WifiOff className="w-20 h-20 text-gray-600 mb-6" />
          <h2 className="text-2xl font-bold mb-2">Offline</h2>
          <p className="text-gray-400">
            This video is not available offline. Connect to Wi-Fi to watch more.
          </p>
        </div>
      )}

      {!isOnlineStatus && localBlobUrl && (
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
      )}

      {actualShowControls && (isOnlineStatus ? isReady : !!localBlobUrl) && (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 flex flex-col justify-between p-8 pointer-events-none">
          <div className="pointer-events-auto">
            <BackButton />
          </div>

          <div className="flex flex-col gap-6 pointer-events-auto">
            <div className="flex items-center gap-4 group">
              <span className="text-white text-sm font-medium w-12">{formatTime(currentTime)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
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

      {isOnlineStatus && !isReady && !loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="absolute top-8 left-8">
            <BackButton />
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-white font-medium">Loading safe video...</span>
          </div>
        </div>
      )}

      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-40">
          <div className="absolute top-8 left-8">
            <BackButton />
          </div>
          <div className="flex flex-col items-center gap-6 px-8 text-center max-w-md">
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
              <RotateCcw className="w-10 h-10 text-red-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Playback Error</h2>
              <p className="text-gray-400">
                We're having trouble loading this video. This can happen with slow connections or restricted content.
              </p>
            </div>
            <button
              onClick={() => setRetryCount(prev => prev + 1)}
              className="px-8 py-3 bg-white text-gray-900 font-bold rounded-2xl hover:bg-gray-100 transition-colors active:scale-95"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
