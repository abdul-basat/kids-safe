import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Play, Pause, Volume2, VolumeX, WifiOff, Maximize2, Minimize2, AlertTriangle, RotateCcw } from 'lucide-react';
import { isOnline } from '../lib/offline';
import {
  onEscapeDetected,
  lockNavigation,
  unlockNavigation,
  setPlayingState,
} from '../lib/sandboxSecurity';

/**
 * SANDBOX SECURITY DOCUMENTATION
 * ==============================
 * 
 * This component is designed to prevent ACCIDENTAL access to YouTube or external
 * content from the kids video player. It uses defense-in-depth with multiple layers:
 * 
 * 1. Click shields over YouTube UI elements (logo, title, watermark)
 * 2. End-screen blocker during final 10-15 seconds
 * 3. CSS-based pseudo-fullscreen (no browser fullscreen)
 * 4. Keyboard and gesture interception
 * 5. Escape detection and recovery
 * 6. Parent gate on detected escape attempts
 * 
 * DISCLAIMER: This does NOT claim absolute iframe-level control over YouTube's
 * embedded player. YouTube IFrame API has inherent limitations.
 */

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
  videoBlob?: Blob;
  onEscapeAttempt?: () => void; // Called when escape attempt is detected
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

// End screen blocker threshold (seconds before end)
const END_SCREEN_THRESHOLD = 12;

export function YouTubePlayer({
  videoId,
  onEnded,
  onPlay,
  onPause,
  onBack,
  autoplay = false,
  showControls: externalShowControls,
  videoBlob,
  onEscapeAttempt,
}: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [internalShowControls, setInternalShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isOnlineStatus, setIsOnlineStatus] = useState(isOnline());
  const [localBlobUrl, setLocalBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Pseudo-fullscreen state (CSS-based, not browser fullscreen)
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(true);

  // End screen blocker - activates in final seconds
  const [isNearEnd, setIsNearEnd] = useState(false);

  // Parent gate - shown on escape attempt
  const [showParentGate, setShowParentGate] = useState(false);
  const [escapeAttemptCount, setEscapeAttemptCount] = useState(0);

  const controlsTimeoutRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<number | null>(null);
  const loadTimeoutRef = useRef<number | null>(null);

  // Detect mobile devices
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // ============================================================================
  // ESCAPE DETECTION & RECOVERY
  // ============================================================================

  const handleEscapeAttempt = useCallback(() => {
    console.warn('[Player] Escape attempt detected!');

    // Pause playback immediately
    try {
      playerRef.current?.pauseVideo();
    } catch (e) {
      console.error('[Player] Failed to pause on escape:', e);
    }

    setIsPlaying(false);
    setEscapeAttemptCount(prev => prev + 1);
    setShowParentGate(true);

    // Notify parent component
    onEscapeAttempt?.();
  }, [onEscapeAttempt]);

  // Register escape handler with sandbox security
  useEffect(() => {
    const unsubscribe = onEscapeDetected(handleEscapeAttempt);
    return unsubscribe;
  }, [handleEscapeAttempt]);

  // ============================================================================
  // ORIENTATION LOCK (Preserved from original)
  // ============================================================================

  const lockOrientation = useCallback(async () => {
    try {
      if (screen.orientation && 'lock' in screen.orientation) {
        // @ts-ignore
        await screen.orientation.lock('landscape').catch(() => {
          console.log('[Orientation] Lock failed - requires user interaction');
        });
      }
    } catch (err) {
      console.log('[Orientation] API not supported:', err);
    }
  }, []);

  // ============================================================================
  // PSEUDO-FULLSCREEN (CSS-based, replaces browser fullscreen)
  // ============================================================================

  const enterPseudoFullscreen = useCallback(() => {
    setIsPseudoFullscreen(true);
    lockOrientation();
    // Prevent scroll on body
    document.body.style.overflow = 'hidden';
  }, [lockOrientation]);

  const exitPseudoFullscreen = useCallback(() => {
    setIsPseudoFullscreen(false);
    document.body.style.overflow = '';
  }, []);

  const togglePseudoFullscreen = useCallback(() => {
    if (isPseudoFullscreen) {
      exitPseudoFullscreen();
    } else {
      enterPseudoFullscreen();
    }
  }, [isPseudoFullscreen, enterPseudoFullscreen, exitPseudoFullscreen]);

  // Always start in pseudo-fullscreen
  useEffect(() => {
    enterPseudoFullscreen();
    return () => {
      document.body.style.overflow = '';
    };
  }, [enterPseudoFullscreen]);

  // ============================================================================
  // NAVIGATION LOCKING
  // ============================================================================

  useEffect(() => {
    if (isPlaying) {
      lockNavigation();
      setPlayingState(true);
    } else {
      // Don't unlock immediately - keep locked while in player
      setPlayingState(false);
    }
  }, [isPlaying]);

  // Lock navigation while player is mounted
  useEffect(() => {
    lockNavigation();
    return () => {
      unlockNavigation();
    };
  }, []);

  // ============================================================================
  // VIDEO BLOB HANDLING (Offline support)
  // ============================================================================

  useEffect(() => {
    if (videoBlob) {
      const url = URL.createObjectURL(videoBlob);
      setLocalBlobUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setLocalBlobUrl(null);
    }
  }, [videoBlob]);

  // Use external controls if provided
  const actualShowControls = externalShowControls !== undefined ? externalShowControls : internalShowControls;

  // ============================================================================
  // ONLINE/OFFLINE STATUS
  // ============================================================================

  useEffect(() => {
    const handleStatusChange = () => setIsOnlineStatus(isOnline());
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  // ============================================================================
  // PROGRESS TRACKING & END SCREEN DETECTION
  // ============================================================================

  const updateProgress = useCallback(() => {
    try {
      if (isOnlineStatus && playerRef.current && isPlaying && !isDragging) {
        const iframe = playerRef.current.getIframe?.();
        if (!iframe || !iframe.isConnected) return;

        const current = playerRef.current.getCurrentTime();
        const total = playerRef.current.getDuration();
        setCurrentTime(current);
        if (total !== duration) setDuration(total);

        // Detect when video is near end to block YouTube end screen
        // Increased threshold to 12 seconds for better protection
        if (total > 0 && total - current <= END_SCREEN_THRESHOLD) {
          setIsNearEnd(true);
        } else {
          setIsNearEnd(false);
        }
      }
    } catch (err) {
      console.debug('[YouTube] Progress update skipped:', err);
    }
  }, [isPlaying, isDragging, duration, isOnlineStatus]);

  useEffect(() => {
    if (isOnlineStatus && isPlaying && !isDragging) {
      progressIntervalRef.current = window.setInterval(updateProgress, 500); // More frequent updates
    } else if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, isDragging, updateProgress, isOnlineStatus]);

  // ============================================================================
  // YOUTUBE PLAYER INITIALIZATION
  // ============================================================================

  useEffect(() => {
    let mounted = true;

    async function initPlayer() {
      if (!isOnlineStatus) return;

      console.log(`[YouTube] Initializing player for ${videoId}, mobile: ${isMobile}`);

      setLoadError(false);
      setIsReady(false);
      setIsNearEnd(false);

      if (loadTimeoutRef.current) clearTimeout(loadTimeoutRef.current);

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

        console.log('[YouTube] Creating player instance with hardened config...');

        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId,
          // Use youtube-nocookie.com for enhanced privacy
          host: 'https://www.youtube-nocookie.com',
          playerVars: {
            // HARDENED CONFIGURATION
            autoplay: isMobile ? 0 : (autoplay ? 1 : 0),
            controls: 0,           // Disable YouTube controls (we use our own)
            disablekb: 1,          // Disable keyboard
            fs: 0,                 // Disable fullscreen button
            iv_load_policy: 3,     // Disable annotations
            modestbranding: 1,     // Minimal YouTube branding
            playsinline: 1,        // Play inline on mobile
            rel: 0,                // Disable related videos
            showinfo: 0,           // Hide video info (deprecated but helps)
            origin: window.location.origin,
            enablejsapi: 1,        // Enable JS API
            cc_load_policy: 0,     // Don't auto-show captions
            hl: 'en',              // Force English to reduce UI variations
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
                if (!hasUserInteracted) {
                  console.log('[YouTube] Video started - activating sandbox');
                  setHasUserInteracted(true);
                  enterPseudoFullscreen();
                }
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setIsPlaying(false);
                onPause?.();
              } else if (event.data === window.YT.PlayerState.ENDED) {
                setIsPlaying(false);
                setIsNearEnd(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, autoplay, onEnded, onPlay, onPause, isOnlineStatus, retryCount, isMobile]);

  // ============================================================================
  // PLAYBACK CONTROLS
  // ============================================================================

  const togglePlay = useCallback(async () => {
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

  // ============================================================================
  // CONTROLS VISIBILITY
  // ============================================================================

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

  // ============================================================================
  // PARENT GATE HANDLERS
  // ============================================================================

  const handleParentGateDismiss = useCallback(() => {
    setShowParentGate(false);
    // Resume playback after parent dismisses
    try {
      playerRef.current?.playVideo();
    } catch (e) {
      console.error('[Player] Failed to resume after parent gate:', e);
    }
  }, []);

  const handleParentGateBack = useCallback(() => {
    setShowParentGate(false);
    onBack?.();
  }, [onBack]);

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

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
      className={`w-12 h-12 rounded-full bg-white/10 backdrop-blur-md text-white hover:bg-white/20 transition-all shadow-lg border border-white/10 flex items-center justify-center active:scale-95 pointer-events-auto ${className}`}
      title="Back to Browse"
    >
      <ArrowLeft className="w-6 h-6" />
    </button>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div
      ref={wrapperRef}
      className="absolute inset-0 bg-black overflow-hidden"
      onClick={handleContainerClick}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* ================================================================
          PARENT GATE OVERLAY - Shown on escape attempt
          ================================================================ */}
      {showParentGate && (
        <div className="parent-gate-overlay">
          <div className="bg-white rounded-3xl p-8 max-w-md mx-4 text-center shadow-2xl">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Parent Check</h2>
            <p className="text-gray-600 mb-6">
              An action was blocked to keep your child safe. Would you like to continue watching or go back?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleParentGateDismiss}
                className="w-full py-3 px-6 bg-sky-500 hover:bg-sky-600 text-white font-semibold rounded-xl transition-colors"
              >
                Continue Watching
              </button>
              <button
                onClick={handleParentGateBack}
                className="w-full py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors"
              >
                Back to Browse
              </button>
            </div>
            {escapeAttemptCount > 1 && (
              <p className="text-xs text-gray-400 mt-4">
                Blocked {escapeAttemptCount} escape attempts this session
              </p>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
          YOUTUBE PLAYER CONTAINER
          ================================================================ */}
      <div
        className={`w-full h-full pointer-events-none ${(isOnlineStatus && !loadError) ? 'block' : 'hidden'}`}
      >
        {/* YouTube iframe container */}
        <div
          ref={containerRef}
          className="w-full h-full"
        />

        {/* ================================================================
            CLICK SHIELDS - Block YouTube UI elements
            ================================================================ */}

        {/* Top shield - blocks YouTube logo, title bar, info button */}
        <div
          className="youtube-blocker youtube-blocker-top"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        />

        {/* Bottom-right shield - blocks YouTube watermark */}
        <div
          className="youtube-blocker youtube-blocker-bottom-right"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        />

        {/* Bottom-left shield - blocks video title tooltip */}
        <div
          className="youtube-blocker youtube-blocker-bottom-left"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        />

        {/* ================================================================
            END SCREEN BLOCKER - Full screen during final seconds
            ================================================================ */}
        {isNearEnd && (
          <div
            className="youtube-blocker-endscreen"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/80 font-medium">Loading next video...</p>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================
          OFFLINE - No video available
          ================================================================ */}
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

      {/* ================================================================
          OFFLINE - Local video playback
          ================================================================ */}
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

      {/* ================================================================
          CUSTOM CONTROLS OVERLAY
          ================================================================ */}
      {actualShowControls && (isOnlineStatus ? isReady : !!localBlobUrl) && !showParentGate && (
        <div className="absolute inset-0 flex flex-col pointer-events-none z-30">
          {/* Top bar with back button */}
          <div className="p-4 md:p-6 pointer-events-auto bg-gradient-to-b from-black/60 to-transparent">
            <BackButton />
          </div>

          {/* Center - Play/Pause Button */}
          <div className="flex-1 flex items-center justify-center pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-all transform hover:scale-110 active:scale-95 shadow-2xl border border-white/20"
            >
              {isPlaying ? (
                <Pause className="w-10 h-10 md:w-12 md:h-12 text-white" />
              ) : (
                <Play className="w-10 h-10 md:w-12 md:h-12 text-white ml-1" />
              )}
            </button>
          </div>

          {/* Bottom controls */}
          <div className="p-4 md:p-6 pointer-events-auto bg-gradient-to-t from-black/70 to-transparent">
            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-white text-xs md:text-sm font-medium w-10 md:w-12 text-right">{formatTime(currentTime)}</span>
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
                className="flex-1 h-1 md:h-2 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:h-2 md:hover:h-3 transition-all"
              />
              <span className="text-white text-xs md:text-sm font-medium w-10 md:w-12">{formatTime(duration)}</span>
            </div>

            {/* Mute button */}
            <div className="flex justify-end">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-all border border-white/10"
              >
                {isMuted ? (
                  <VolumeX className="w-6 h-6 text-white" />
                ) : (
                  <Volume2 className="w-6 h-6 text-white" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================
          LOADING STATE
          ================================================================ */}
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

      {/* ================================================================
          ERROR STATE
          ================================================================ */}
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
