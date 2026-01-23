import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Play,
  Tv,
  PartyPopper,
  Settings,
  Grid3X3,
  LayoutList,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { YouTubePlayer } from './YouTubePlayer';
import { QueueDrawer } from './QueueDrawer';
import { TimeRestrictionOverlay } from './TimeRestrictionOverlay';
import { getVideoThumbnail } from '../lib/youtube';
import { isTimeLimitReached, isWithinAllowedHours } from '../lib/timeTracking';
import {
  initSandboxSecurity,
  cleanupSandboxSecurity,
} from '../lib/sandboxSecurity';

const SWIPE_THRESHOLD = 50;
const PARENT_TRIGGER_TAPS = 5;
const PARENT_TRIGGER_TIMEOUT = 2000;

/** Feedback component for parent tap-to-unlock */
interface ParentTapFeedbackProps {
  tapCount: number;
  isVisible: boolean;
  onTap: () => void;
}

function ParentTapFeedback({ tapCount, isVisible, onTap }: ParentTapFeedbackProps) {
  const remainingTaps = PARENT_TRIGGER_TAPS - tapCount;
  const progress = (tapCount / PARENT_TRIGGER_TAPS) * 100;

  return (
    <div className="relative">
      {/* Gear button with progress ring */}
      <button
        onClick={onTap}
        className={`w-12 h-12 rounded-full bg-white/60 hover:bg-white/90 flex items-center justify-center transition-all shadow-sm ${isVisible ? 'scale-110' : ''
          }`}
        aria-label="Parent access"
        title="Tap 5 times for parent mode"
      >
        {/* Progress ring SVG */}
        {isVisible && (
          <svg
            className="absolute inset-0 w-12 h-12 -rotate-90"
            viewBox="0 0 48 48"
          >
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="rgba(59, 130, 246, 0.3)"
              strokeWidth="3"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="rgb(59, 130, 246)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${progress * 1.256} 125.6`}
              className="transition-all duration-200"
            />
          </svg>
        )}
        <Settings className={`w-6 h-6 text-gray-700 ${isVisible ? 'animate-pulse' : ''}`} />
      </button>

      {/* Toast notification */}
      {isVisible && (
        <div className="absolute top-14 right-0 whitespace-nowrap bg-gray-900/90 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg animate-fade-in z-50">
          <div className="flex items-center gap-2">
            <span className="bg-blue-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {tapCount}/{PARENT_TRIGGER_TAPS}
            </span>
            <span>
              {remainingTaps === 1 ? 'One more tap!' : `${remainingTaps} more taps`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function ChildViewer() {
  const {
    currentPlaylist,
    currentVideoIndex,
    currentVideo,
    hasNextVideo,
    hasPreviousVideo,
    nextVideo,
    previousVideo,
    setCurrentVideoIndex,
    setMode,
    settings,
  } = useApp();

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('grid');
  const [showStreamingControls, setShowStreamingControls] = useState(false);
  const [showTimeRestriction, setShowTimeRestriction] = useState(false);
  const [parentTapCount, setParentTapCount] = useState(0);
  const [showParentTapFeedback, setShowParentTapFeedback] = useState(false);
  const [escapeAttemptCount, setEscapeAttemptCount] = useState(0);
  const [isPlayerPlaying, setIsPlayerPlaying] = useState(false); // Track player state for layout

  // Initialize sandbox security on mount
  useEffect(() => {
    initSandboxSecurity();
    console.log('[ChildViewer] Sandbox security initialized');
    return () => {
      cleanupSandboxSecurity();
      console.log('[ChildViewer] Sandbox security cleaned up');
    };
  }, []);

  // Handle escape attempts from the player
  const handleEscapeAttempt = useCallback(() => {
    console.warn('[ChildViewer] Escape attempt detected!');
    setEscapeAttemptCount(prev => prev + 1);
    // The YouTubePlayer handles the parent gate internally
  }, []);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const parentTapCountRef = useRef(0);
  const parentTapTimeoutRef = useRef<number | null>(null);

  const handleParentTrigger = useCallback(() => {
    parentTapCountRef.current++;
    const currentCount = parentTapCountRef.current;

    // Update UI state for feedback
    setParentTapCount(currentCount);
    setShowParentTapFeedback(true);

    if (parentTapTimeoutRef.current) {
      clearTimeout(parentTapTimeoutRef.current);
    }

    if (currentCount >= PARENT_TRIGGER_TAPS) {
      parentTapCountRef.current = 0;
      setParentTapCount(0);
      setShowParentTapFeedback(false);
      setMode('pin-entry');
      return;
    }

    parentTapTimeoutRef.current = window.setTimeout(() => {
      parentTapCountRef.current = 0;
      setParentTapCount(0);
      setShowParentTapFeedback(false);
    }, PARENT_TRIGGER_TIMEOUT);
  }, [setMode]);

  const handleBackToBrowse = useCallback(() => {
    setIsWatching(false);
  }, []);

  // Handle Escape key and Browser Back Button
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isQueueOpen) {
          setIsQueueOpen(false);
          e.preventDefault();
          e.stopPropagation();
        } else if (isWatching) {
          handleBackToBrowse();
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    const handlePopState = (e: PopStateEvent) => {
      if (isWatching) {
        // Prevent default browser back and just close player
        e.preventDefault();
        handleBackToBrowse();
        // Push state back so the next back button works as expected
        window.history.pushState({ watching: false }, '');
      }
    };

    if (isWatching) {
      // Add a state to history when starting to watch
      window.history.pushState({ watching: true }, '');
      window.addEventListener('popstate', handlePopState);
    }

    // Use capture: true to intercept before iframe focus if possible
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isWatching, isQueueOpen, handleBackToBrowse]);

  useEffect(() => {
    return () => {
      if (parentTapTimeoutRef.current) {
        clearTimeout(parentTapTimeoutRef.current);
      }
    };
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    setSwipeOffset(deltaX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (swipeOffset > SWIPE_THRESHOLD && hasPreviousVideo) {
      previousVideo();
    } else if (swipeOffset < -SWIPE_THRESHOLD && hasNextVideo) {
      nextVideo();
    }
    setSwipeOffset(0);
    touchStartRef.current = null;
  }, [swipeOffset, hasNextVideo, hasPreviousVideo, nextVideo, previousVideo]);

  const handleVideoEnd = useCallback(() => {
    if (hasNextVideo) {
      nextVideo();
    } else {
      handleBackToBrowse();
      setShowComplete(true);
    }
  }, [hasNextVideo, nextVideo, handleBackToBrowse]);

  const handlePlayVideo = useCallback((index?: number) => {
    // Check time restrictions before playing
    if (settings) {
      const timeLimitReached = isTimeLimitReached(settings);
      const withinAllowedHours = isWithinAllowedHours(settings);

      if (timeLimitReached || !withinAllowedHours) {
        setShowTimeRestriction(true);
        return;
      }
    }

    if (index !== undefined) {
      setCurrentVideoIndex(index);
    }
    setIsWatching(true);
    setShowComplete(false);
  }, [setCurrentVideoIndex, settings]);

  if (!currentPlaylist || currentPlaylist.videos.length === 0) {
    return (
      <div className="h-screen bg-gradient-to-b from-sky-100 to-sky-200 flex flex-col items-center justify-center p-8 overflow-hidden">
        <div className="text-center">
          <div className="w-24 h-24 bg-sky-200 rounded-full flex items-center justify-center mx-auto mb-6">
            <Tv className="w-12 h-12 text-sky-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">No Videos Yet</h1>
          <p className="text-gray-600 text-lg mb-8">
            Ask a parent to add some videos for you to watch!
          </p>
        </div>

        <div className="absolute top-4 right-4">
          <ParentTapFeedback
            tapCount={parentTapCount}
            isVisible={showParentTapFeedback}
            onTap={handleParentTrigger}
          />
        </div>
      </div>
    );
  }

  if (showComplete) {
    return (
      <div className="h-screen bg-gradient-to-b from-amber-100 to-orange-200 flex flex-col items-center justify-center p-8 overflow-hidden">
        <div className="text-center">
          <div className="w-24 h-24 bg-amber-200 rounded-full flex items-center justify-center mx-auto mb-6 animate-bounce">
            <PartyPopper className="w-12 h-12 text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">All Done!</h1>
          <p className="text-gray-600 text-lg mb-8">
            You watched all your videos. Great job!
          </p>
          <button
            onClick={() => {
              setCurrentVideoIndex(0);
              setShowComplete(false);
            }}
            className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-semibold text-lg transition-colors shadow-lg active:scale-95"
          >
            Watch Again
          </button>
        </div>

        <div className="absolute top-4 right-4">
          <ParentTapFeedback
            tapCount={parentTapCount}
            isVisible={showParentTapFeedback}
            onTap={handleParentTrigger}
          />
        </div>
      </div>
    );
  }

  if (isWatching && currentVideo) {
    return (
      <div
        className="h-screen bg-black flex flex-col overflow-hidden relative"
      >
        {/* Player Container - shrinks when paused */}
        <div
          className={`relative transition-all duration-500 ease-out ${isPlayerPlaying
            ? 'flex-1'
            : 'h-[50vh] md:h-[55vh] lg:h-[60vh]'
            }`}
          onMouseEnter={() => setShowStreamingControls(true)}
          onMouseLeave={() => setShowStreamingControls(false)}
          onClick={(e) => {
            e.stopPropagation();
            setShowStreamingControls(!showStreamingControls);
          }}
        >
          <YouTubePlayer
            videoId={currentVideo.video_id}
            onEnded={handleVideoEnd}
            onBack={handleBackToBrowse}
            autoplay
            showControls={showStreamingControls}
            videoBlob={currentVideo.video_blob}
            onEscapeAttempt={handleEscapeAttempt}
            onPlay={() => setIsPlayerPlaying(true)}
            onPause={() => setIsPlayerPlaying(false)}
          />
        </div>

        {/* More Videos Section - appears BELOW the player when paused */}
        <div
          className={`bg-gray-900 transition-all duration-500 overflow-hidden ${isPlayerPlaying
            ? 'h-0 opacity-0'
            : 'flex-1 opacity-100'
            }`}
          onClick={(e) => e.stopPropagation()} // Prevent clicks from bubbling to player
        >
          {currentPlaylist.videos.length > 1 && (
            <div className="h-full flex flex-col p-4">
              <h3 className="text-sm font-black text-sky-400 uppercase tracking-widest flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-sky-500 rounded-full" />
                More Videos
              </h3>
              <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide">
                <div className="flex gap-3 pb-2">
                  {currentPlaylist.videos
                    .filter((_, idx) => idx !== currentVideoIndex)
                    .map((video) => {
                      const actualIndex = currentPlaylist.videos.findIndex(v => v.video_id === video.video_id);
                      return (
                        <button
                          key={video.video_id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handlePlayVideo(actualIndex);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.stopPropagation();
                              e.preventDefault();
                              handlePlayVideo(actualIndex);
                            }
                          }}
                          className="flex-shrink-0 w-32 sm:w-40 md:w-48 rounded-xl overflow-hidden bg-white/10 border border-white/10 hover:bg-white/20 hover:scale-105 hover:border-sky-400 transition-all group/card focus:outline-none focus:ring-2 focus:ring-sky-400"
                        >
                          <div className="aspect-video relative">
                            <img
                              src={video.thumbnail_url || getVideoThumbnail(video.video_id)}
                              alt={video.title}
                              className="w-full h-full object-cover opacity-80 group-hover/card:opacity-100 transition-opacity pointer-events-none"
                              loading="lazy"
                              draggable={false}
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <Play className="w-8 h-8 text-white drop-shadow-md" />
                            </div>
                          </div>
                          <div className="p-2">
                            <p className="text-[10px] font-bold text-white line-clamp-2 text-left leading-tight">
                              {video.title}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Removed the old 'Up Next' overlay - now using 'More Videos' grid above */}

        <QueueDrawer
          videos={currentPlaylist.videos}
          currentIndex={currentVideoIndex}
          isOpen={isQueueOpen}
          onClose={() => setIsQueueOpen(false)}
          onSelectVideo={(index) => {
            setCurrentVideoIndex(index);
            setIsQueueOpen(false);
          }}
        />

        <TimeRestrictionOverlay
          isVisible={showTimeRestriction}
          onDismiss={() => setShowTimeRestriction(false)}
        />
      </div>
    );
  }

  // GRID VIEW for browsing
  if (viewMode === 'grid') {
    return (
      <>
        <div className="h-screen bg-gradient-to-b from-sky-100 to-sky-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 lg:p-6 bg-white/30 backdrop-blur-sm border-b border-white/20">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 flex items-center gap-2">
              🎬 Pick a Video!
            </h1>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode('single')}
                className="p-3 rounded-xl bg-white/60 hover:bg-white/90 transition-all shadow-sm active:scale-95"
                title="Single view"
              >
                <LayoutList className="w-6 h-6 text-gray-700" />
              </button>
              <ParentTapFeedback
                tapCount={parentTapCount}
                isVisible={showParentTapFeedback}
                onTap={handleParentTrigger}
              />
            </div>
          </div>

          {/* Video Grid */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-8 scrollbar-hide">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {currentPlaylist.videos.map((video, index) => (
                <button
                  key={video.video_id}
                  onClick={() => handlePlayVideo(index)}
                  className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl hover:scale-105 transition-all group border-2 border-transparent hover:border-sky-400"
                >
                  <div className="aspect-video relative">
                    <img
                      src={video.thumbnail_url || getVideoThumbnail(video.video_id)}
                      alt={video.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                        <Play className="w-6 h-6 text-sky-600 ml-1" />
                      </div>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-bold text-gray-800 line-clamp-2 text-left leading-tight">
                      {video.title}
                    </h3>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <TimeRestrictionOverlay
          isVisible={showTimeRestriction}
          onDismiss={() => setShowTimeRestriction(false)}
        />
      </>
    );
  }

  // SINGLE VIEW
  return (
    <div
      className="h-screen bg-gradient-to-b from-sky-100 to-sky-200 flex flex-col overflow-hidden relative select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 z-10">
        <div />
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode('grid')}
            className="p-3 rounded-xl bg-white/50 hover:bg-white/80 transition-all shadow-sm active:scale-95"
            title="Grid view"
          >
            <Grid3X3 className="w-6 h-6 text-gray-700" />
          </button>
          <ParentTapFeedback
            tapCount={parentTapCount}
            isVisible={showParentTapFeedback}
            onTap={handleParentTrigger}
          />
        </div>
      </div>

      {/* Main Preview Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0">
        {currentVideo && (
          <div
            className="w-full max-w-4xl flex flex-col items-center transition-transform duration-200"
            style={{ transform: `translateX(${swipeOffset * 0.5}px)` }}
          >
            <div className="relative group w-full flex items-center justify-center">
              {/* Previous Arrow */}
              <button
                onClick={previousVideo}
                disabled={!hasPreviousVideo}
                className="absolute left-0 lg:-left-20 z-10 w-16 h-16 rounded-full bg-white shadow-xl flex items-center justify-center disabled:opacity-0 disabled:pointer-events-none hover:bg-gray-50 active:scale-90 transition-all"
              >
                <ChevronLeft className="w-8 h-8 text-sky-600" />
              </button>

              <button
                onClick={() => handlePlayVideo()}
                className="w-full aspect-video rounded-3xl overflow-hidden shadow-2xl group relative border-4 border-white"
              >
                <img
                  src={getVideoThumbnail(currentVideo.video_id, 'high')}
                  alt={currentVideo.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-white/95 flex items-center justify-center group-hover:scale-110 transition-transform shadow-2xl">
                    <Play className="w-12 h-12 text-sky-600 ml-1" />
                  </div>
                </div>
              </button>

              {/* Next Arrow */}
              <button
                onClick={nextVideo}
                disabled={!hasNextVideo}
                className="absolute right-0 lg:-right-20 z-10 w-16 h-16 rounded-full bg-white shadow-xl flex items-center justify-center disabled:opacity-0 disabled:pointer-events-none hover:bg-gray-50 active:scale-90 transition-all"
              >
                <ChevronRight className="w-8 h-8 text-sky-600" />
              </button>
            </div>

            <div className="text-center mt-6 w-full px-4">
              <h2 className="text-2xl lg:text-3xl font-black text-gray-800 line-clamp-2 leading-tight">
                {currentVideo.title}
              </h2>
              <div className="mt-3">
                <span className="bg-sky-500 text-white px-6 py-2 rounded-full text-sm font-black shadow-sm ring-4 ring-sky-200">
                  {currentVideoIndex + 1} / {currentPlaylist.videos.length}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <QueueDrawer
        videos={currentPlaylist.videos}
        currentIndex={currentVideoIndex}
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        onSelectVideo={(index) => {
          setCurrentVideoIndex(index);
          setIsQueueOpen(false);
        }}
      />

      <TimeRestrictionOverlay
        isVisible={showTimeRestriction}
        onDismiss={() => setShowTimeRestriction(false)}
      />
    </div>
  );
}
