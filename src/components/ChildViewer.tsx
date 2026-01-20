import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  List,
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
import { getVideoThumbnail } from '../lib/youtube';

const SWIPE_THRESHOLD = 50;
const PARENT_TRIGGER_TAPS = 5;
const PARENT_TRIGGER_TIMEOUT = 2000;

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
  } = useApp();

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isWatching, setIsWatching] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [viewMode, setViewMode] = useState<'single' | 'grid'>('grid');
  const [showStreamingControls, setShowStreamingControls] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const parentTapCountRef = useRef(0);
  const parentTapTimeoutRef = useRef<number | null>(null);

  const handleParentTrigger = useCallback(() => {
    parentTapCountRef.current++;
    if (parentTapTimeoutRef.current) {
      clearTimeout(parentTapTimeoutRef.current);
    }

    if (parentTapCountRef.current >= PARENT_TRIGGER_TAPS) {
      parentTapCountRef.current = 0;
      setMode('pin-entry');
      return;
    }

    parentTapTimeoutRef.current = window.setTimeout(() => {
      parentTapCountRef.current = 0;
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
    if (index !== undefined) {
      setCurrentVideoIndex(index);
    }
    setIsWatching(true);
    setShowComplete(false);
  }, [setCurrentVideoIndex]);

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

        <button
          onClick={handleParentTrigger}
          className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/50 hover:bg-white/80 flex items-center justify-center transition-colors shadow-sm"
          aria-label="Parent access"
          title="Tap 5 times for parent mode"
        >
          <Settings className="w-6 h-6 text-gray-600" />
        </button>
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

        <button
          onClick={handleParentTrigger}
          className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/50 hover:bg-white/80 flex items-center justify-center transition-colors shadow-sm"
          aria-label="Parent access"
          title="Tap 5 times for parent mode"
        >
          <Settings className="w-6 h-6 text-gray-600" />
        </button>
      </div>
    );
  }

  if (isWatching && currentVideo) {
    return (
      <div
        className="h-screen bg-black flex flex-col overflow-hidden relative group"
        onMouseEnter={() => setShowStreamingControls(true)}
        onMouseLeave={() => setShowStreamingControls(false)}
        onClick={() => setShowStreamingControls(!showStreamingControls)}
      >
        <YouTubePlayer
          videoId={currentVideo.video_id}
          onEnded={handleVideoEnd}
          onBack={handleBackToBrowse}
          autoplay
          showControls={showStreamingControls}
          videoBlob={currentVideo.video_blob}
        />

        <div className={`fixed inset-0 pointer-events-none transition-all duration-500 z-50 ${showStreamingControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute bottom-8 left-8 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsQueueOpen(true);
              }}
              className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center hover:bg-white/20 transition-all shadow-lg border border-white/10 active:scale-95"
            >
              <List className="w-7 h-7 text-white" />
            </button>
          </div>
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
      </div>
    );
  }

  // GRID VIEW for browsing
  if (viewMode === 'grid') {
    return (
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
            <button
              onClick={handleParentTrigger}
              className="w-12 h-12 rounded-full bg-white/60 hover:bg-white/90 flex items-center justify-center transition-all shadow-sm active:scale-95"
              aria-label="Parent access"
              title="Tap 5 times for parent mode"
            >
              <Settings className="w-6 h-6 text-gray-700" />
            </button>
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
          <button
            onClick={handleParentTrigger}
            className="w-12 h-12 rounded-full bg-white/50 hover:bg-white/80 flex items-center justify-center transition-all shadow-sm active:scale-95"
            aria-label="Parent access"
            title="Tap 5 times for parent mode"
          >
            <Settings className="w-6 h-6 text-gray-700" />
          </button>
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

      {/* Bottom Up Next Section - No scroll required! */}
      {currentPlaylist.videos.length > 1 && (
        <div className="bg-white/40 backdrop-blur-sm border-t border-white/30 p-4 lg:p-6 z-10">
          <div className="max-w-7xl mx-auto">
            <h3 className="text-sm font-black text-sky-800 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-sky-500 rounded-full animate-pulse" />
              Up Next
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide scroll-smooth">
              {currentPlaylist.videos
                .slice(currentVideoIndex + 1, currentVideoIndex + 11)
                .map((video, idx) => {
                  const actualIndex = currentVideoIndex + 1 + idx;
                  return (
                    <button
                      key={video.video_id}
                      onClick={() => handlePlayVideo(actualIndex)}
                      className="flex-shrink-0 w-44 md:w-64 rounded-2xl overflow-hidden bg-white shadow-lg hover:shadow-2xl hover:scale-105 transition-all group border-2 border-transparent hover:border-sky-400"
                    >
                      <div className="aspect-video relative">
                        <img
                          src={video.thumbnail_url || getVideoThumbnail(video.video_id)}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Play className="w-10 h-10 text-white drop-shadow-lg" />
                        </div>
                      </div>
                      <div className="p-3 bg-white">
                        <p className="text-xs md:text-sm font-bold text-gray-800 line-clamp-2 text-left leading-snug">
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
    </div>
  );
}
