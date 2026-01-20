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
      setIsWatching(false);
      setShowComplete(true);
    }
  }, [hasNextVideo, nextVideo]);

  const handlePlayVideo = useCallback((index?: number) => {
    if (index !== undefined) {
      setCurrentVideoIndex(index);
    }
    setIsWatching(true);
    setShowComplete(false);
  }, [setCurrentVideoIndex]);

  if (!currentPlaylist || currentPlaylist.videos.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 to-sky-200 flex flex-col items-center justify-center p-8">
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
          className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/50 hover:bg-white/80 flex items-center justify-center transition-colors"
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
      <div className="min-h-screen bg-gradient-to-b from-amber-100 to-orange-200 flex flex-col items-center justify-center p-8">
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
            className="px-8 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-semibold text-lg transition-colors"
          >
            Watch Again
          </button>
        </div>

        <button
          onClick={handleParentTrigger}
          className="absolute top-4 right-4 w-12 h-12 rounded-full bg-white/50 hover:bg-white/80 flex items-center justify-center transition-colors"
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
      <>
        <YouTubePlayer
          videoId={currentVideo.video_id}
          onEnded={handleVideoEnd}
          autoplay
        />

        <button
          onClick={() => setIsQueueOpen(true)}
          className="fixed bottom-8 left-8 z-50 w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition-colors"
        >
          <List className="w-7 h-7 text-white" />
        </button>

        <button
          onClick={() => setIsWatching(false)}
          className="fixed bottom-8 right-8 z-50 px-6 py-3 rounded-full bg-white/20 backdrop-blur-sm text-white font-medium hover:bg-white/30 transition-colors"
        >
          Back to Browse
        </button>

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
      </>
    );
  }

  // GRID VIEW for browsing
  if (viewMode === 'grid') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sky-100 to-sky-200 p-4 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-800">
            🎬 Pick a Video!
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('single')}
              className="p-2 rounded-lg bg-white/50 hover:bg-white/80 transition-colors"
              title="Single view"
            >
              <LayoutList className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={handleParentTrigger}
              className="w-10 h-10 rounded-full bg-white/50 hover:bg-white/80 flex items-center justify-center transition-colors"
              aria-label="Parent access"
              title="Tap 5 times for parent mode"
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Video Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {currentPlaylist.videos.map((video, index) => (
            <button
              key={video.video_id}
              onClick={() => handlePlayVideo(index)}
              className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl hover:scale-105 transition-all group"
            >
              <div className="aspect-video relative">
                <img
                  src={video.thumbnail_url || getVideoThumbnail(video.video_id)}
                  alt={video.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="w-6 h-6 text-sky-600 ml-1" />
                  </div>
                </div>
              </div>
              <div className="p-3">
                <h3 className="text-sm font-medium text-gray-800 line-clamp-2 text-left">
                  {video.title}
                </h3>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // SINGLE VIEW (original)
  return (
    <div
      className="min-h-screen bg-gradient-to-b from-sky-100 to-sky-200 flex flex-col relative select-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="flex items-center justify-between p-4">
        <div />
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className="p-2 rounded-lg bg-white/50 hover:bg-white/80 transition-colors"
            title="Grid view"
          >
            <Grid3X3 className="w-5 h-5 text-gray-600" />
          </button>
          <button
            onClick={handleParentTrigger}
            className="w-10 h-10 rounded-full bg-white/50 hover:bg-white/80 flex items-center justify-center transition-colors"
            aria-label="Parent access"
            title="Tap 5 times for parent mode"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {currentVideo && (
          <div
            className="w-full max-w-2xl transition-transform duration-200"
            style={{ transform: `translateX(${swipeOffset * 0.5}px)` }}
          >
            <button
              onClick={() => handlePlayVideo()}
              className="w-full aspect-video rounded-3xl overflow-hidden shadow-2xl group relative"
            >
              <img
                src={getVideoThumbnail(currentVideo.video_id, 'high')}
                alt={currentVideo.title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Play className="w-10 h-10 text-sky-600 ml-1" />
                </div>
              </div>
            </button>

            <h2 className="text-2xl font-bold text-gray-800 text-center mt-6 px-4">
              {currentVideo.title}
            </h2>

            <div className="flex items-center justify-center gap-2 mt-4 text-gray-600">
              <span className="bg-sky-200 text-sky-800 px-3 py-1 rounded-full text-sm font-medium">
                {currentVideoIndex + 1} of {currentPlaylist.videos.length}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 flex items-center justify-between">
        <button
          onClick={previousVideo}
          disabled={!hasPreviousVideo}
          className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-8 h-8 text-gray-700" />
        </button>

        <button
          onClick={() => setIsQueueOpen(true)}
          className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <List className="w-8 h-8 text-gray-700" />
        </button>

        <button
          onClick={nextVideo}
          disabled={!hasNextVideo}
          className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <ChevronRight className="w-8 h-8 text-gray-700" />
        </button>
      </div>

      {/* Up Next Section */}
      {currentPlaylist.videos.length > 1 && (
        <div className="px-4 pb-4">
          <h3 className="text-sm font-semibold text-gray-600 mb-2">Up Next</h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {currentPlaylist.videos
              .slice(currentVideoIndex + 1, currentVideoIndex + 6)
              .map((video, idx) => {
                const actualIndex = currentVideoIndex + 1 + idx;
                return (
                  <button
                    key={video.video_id}
                    onClick={() => handlePlayVideo(actualIndex)}
                    className="flex-shrink-0 w-32 rounded-lg overflow-hidden bg-white shadow-md hover:shadow-lg transition-shadow"
                  >
                    <div className="aspect-video relative">
                      <img
                        src={video.thumbnail_url || getVideoThumbnail(video.video_id)}
                        alt={video.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                        <Play className="w-8 h-8 text-white drop-shadow-lg" />
                      </div>
                    </div>
                    <p className="text-xs p-2 text-gray-700 line-clamp-2 text-left">
                      {video.title}
                    </p>
                  </button>
                );
              })}
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
