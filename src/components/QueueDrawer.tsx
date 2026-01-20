import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import type { ApprovedVideo } from '../lib/database.types';
import { getVideoThumbnail } from '../lib/youtube';

interface QueueDrawerProps {
  videos: ApprovedVideo[];
  currentIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (index: number) => void;
}

export function QueueDrawer({
  videos,
  currentIndex,
  isOpen,
  onClose,
  onSelectVideo,
}: QueueDrawerProps) {
  const activeItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [isOpen, currentIndex]);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 transition-transform duration-300 ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '70vh' }}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Up Next</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 64px)' }}>
          <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {videos.map((video, index) => (
              <button
                key={video.video_id}
                ref={index === currentIndex ? activeItemRef : null}
                onClick={() => {
                  onSelectVideo(index);
                  onClose();
                }}
                className={`relative rounded-xl overflow-hidden transition-all ${
                  index === currentIndex
                    ? 'ring-4 ring-sky-500 scale-105'
                    : 'hover:scale-102'
                }`}
              >
                <div className="aspect-video bg-gray-200">
                  <img
                    src={getVideoThumbnail(video.video_id, 'medium')}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                {index === currentIndex && (
                  <div className="absolute inset-0 bg-sky-500/20 flex items-center justify-center">
                    <span className="bg-sky-500 text-white px-3 py-1 rounded-full text-sm font-semibold">
                      Playing
                    </span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-white text-xs font-medium line-clamp-2">
                    {video.title}
                  </p>
                </div>
                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                  {index + 1}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
