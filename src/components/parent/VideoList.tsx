import { useState, useEffect, useCallback } from 'react';
import { Trash2, Loader2, Video, Play, X, Sparkles, CheckSquare, Square, Download, DownloadCloud, CheckCircle2 } from 'lucide-react';
import { getVideos, deleteVideo } from '../../lib/api/videos';
import { getPlaylists, addVideoToPlaylist } from '../../lib/api/playlists';
import type { ApprovedVideo, Playlist } from '../../lib/database.types';
import { getVideoThumbnail } from '../../lib/youtube';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { downloadThumbnail, downloadVideo, removeOfflineData } from '../../lib/offline';
import { YouTubePlayer } from '../YouTubePlayer';

interface VideoListProps {
  onRefresh?: () => void;
}

// Check if a video appears to be private/deleted
function isPrivateVideo(video: ApprovedVideo): boolean {
  const title = video.title?.toLowerCase() || '';
  if (title === 'private video' || title === 'deleted video') return true;
  if (!video.thumbnail_url) return true;
  return false;
}

export function VideoList({ onRefresh }: VideoListProps) {
  const [videos, setVideos] = useState<ApprovedVideo[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [addingToPlaylist, setAddingToPlaylist] = useState<string | null>(null);
  const [downloadingVideo, setDownloadingVideo] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ApprovedVideo | null>(null);
  const [playingVideo, setPlayingVideo] = useState<ApprovedVideo | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showStreamingControls, setShowStreamingControls] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [videosData, playlistsData] = await Promise.all([
        getVideos(),
        getPlaylists(),
      ]);
      setVideos(videosData);
      setPlaylists(playlistsData);
    } catch (err) {
      console.error('Error loading videos:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await deleteVideo(deleteTarget.id);
      setVideos((prev) => prev.filter((v) => v.id !== deleteTarget.id));
      setDeleteTarget(null);
      onRefresh?.();
    } catch (err) {
      console.error('Error deleting video:', err);
      alert('Failed to delete video. Please try again.');
    }
  }, [deleteTarget, onRefresh]);

  const handleDownload = useCallback(async (video: ApprovedVideo) => {
    setDownloadingVideo(video.id);
    try {
      await downloadThumbnail(video);
      await downloadVideo(video);
      await loadData();
    } catch (err) {
      console.error('Error downloading video:', err);
    } finally {
      setDownloadingVideo(null);
    }
  }, [loadData]);

  const handleRemoveOffline = useCallback(async (video: ApprovedVideo) => {
    try {
      await removeOfflineData(video);
      await loadData();
    } catch (err) {
      console.error('Error removing offline data:', err);
    }
  }, [loadData]);

  const handleCleanup = useCallback(async () => {
    const privateVideos = videos.filter(isPrivateVideo);
    if (privateVideos.length === 0) {
      alert('No private/deleted videos found!');
      return;
    }
    setSelectedIds(new Set(privateVideos.map(v => v.id)));
    setIsSelectMode(true);
    setShowBulkDeleteModal(true);
  }, [videos]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    setIsDeleting(true);
    setShowBulkDeleteModal(false);
    try {
      const idsToDelete = Array.from(selectedIds);
      for (const id of idsToDelete) {
        await deleteVideo(id);
      }
      setVideos((prev) => prev.filter((v) => !selectedIds.has(v.id)));
      setSelectedIds(new Set());
      setIsSelectMode(false);
      onRefresh?.();
      alert(`✅ Successfully deleted ${count} video${count > 1 ? 's' : ''}!`);
    } catch (err) {
      console.error('Error deleting videos:', err);
      alert('❌ Failed to delete some videos. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedIds, onRefresh]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const selectAllPrivate = useCallback(() => {
    const privateIds = videos.filter(isPrivateVideo).map(v => v.id);
    setSelectedIds(new Set(privateIds));
    setIsSelectMode(true);
  }, [videos]);

  const handleAddToPlaylist = useCallback(async (videoId: string, playlistId: string) => {
    setAddingToPlaylist(videoId);
    try {
      await addVideoToPlaylist(playlistId, videoId);
      onRefresh?.();
    } catch (err) {
      console.error('Error adding to playlist:', err);
    } finally {
      setAddingToPlaylist(null);
    }
  }, [onRefresh]);

  const privateCount = videos.filter(isPrivateVideo).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Video className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">No Videos Yet</h3>
        <p className="text-gray-500">Add some videos for your child to watch.</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => {
            setIsSelectMode(!isSelectMode);
            if (isSelectMode) setSelectedIds(new Set());
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isSelectMode
            ? 'bg-sky-500 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
        >
          {isSelectMode ? 'Cancel Selection' : 'Select Videos'}
        </button>

        {isSelectMode && selectedIds.size > 0 && (
          <button
            onClick={() => setShowBulkDeleteModal(true)}
            disabled={isDeleting}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Delete {selectedIds.size} Selected
              </>
            )}
          </button>
        )}

        {privateCount > 0 && (
          <button
            onClick={selectAllPrivate}
            className="px-4 py-2 bg-amber-100 text-amber-700 hover:bg-amber-200 text-sm rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            Select {privateCount} Private
          </button>
        )}
      </div>

      {privateCount > 0 && !isSelectMode && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-800">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium">
              {privateCount} private/deleted video{privateCount > 1 ? 's' : ''} found
            </span>
          </div>
          <button
            onClick={handleCleanup}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            Clean Up All
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {videos.map((video) => {
          const isPrivate = isPrivateVideo(video);
          const isSelected = selectedIds.has(video.id);

          return (
            <div
              key={video.id}
              className={`bg-white rounded-xl overflow-hidden shadow-sm border relative ${isPrivate ? 'border-amber-300 bg-amber-50' :
                isSelected ? 'border-sky-500 ring-2 ring-sky-200' : 'border-gray-100'
                }`}
            >
              {isSelectMode && (
                <button
                  onClick={() => toggleSelect(video.id)}
                  className="absolute top-2 left-2 z-10 w-8 h-8 rounded-lg bg-white/90 shadow flex items-center justify-center"
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-sky-500" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              )}

              <div
                className="aspect-video relative group cursor-pointer"
                onClick={() => {
                  if (isSelectMode) {
                    toggleSelect(video.id);
                  } else if (!isPrivate) {
                    setPlayingVideo(video);
                  }
                }}
              >
                <img
                  src={video.thumbnail_blob ? URL.createObjectURL(video.thumbnail_blob) : (video.thumbnail_url || getVideoThumbnail(video.video_id))}
                  alt={video.title}
                  className={`w-full h-full object-cover ${isPrivate ? 'opacity-50' : ''}`}
                />

                {video.is_offline && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                    <CheckCircle2 className="w-3 h-3" />
                    <span className="text-[10px] font-bold">OFFLINE</span>
                  </div>
                )}

                {video.duration && (
                  <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-1 rounded">
                    {video.duration}
                  </span>
                )}
                {isPrivate && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded font-medium">
                      Private/Deleted
                    </span>
                  </div>
                )}
                {!isPrivate && !isSelectMode && (
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="w-7 h-7 text-sky-600 ml-1" />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3">
                <h4 className={`font-medium text-sm line-clamp-2 mb-3 ${isPrivate ? 'text-amber-700' : 'text-gray-800'}`}>
                  {video.title}
                </h4>

                {!isSelectMode && (
                  <div className="flex items-center gap-2">
                    {playlists.length > 0 && !isPrivate && (
                      <div className="relative flex-1">
                        <select
                          value=""
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddToPlaylist(video.video_id, e.target.value);
                            }
                          }}
                          disabled={addingToPlaylist === video.video_id}
                          className="w-full text-sm py-2 px-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                        >
                          <option value="">Playlist...</option>
                          {playlists.map((playlist) => (
                            <option key={playlist.id} value={playlist.id}>
                              {playlist.name}
                            </option>
                          ))}
                        </select>
                        {addingToPlaylist === video.video_id && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-sky-500" />
                        )}
                      </div>
                    )}

                    {!isPrivate && (
                      <button
                        onClick={() => video.is_offline ? handleRemoveOffline(video) : handleDownload(video)}
                        disabled={downloadingVideo === video.id}
                        className={`p-2 rounded-lg transition-colors ${video.is_offline
                          ? 'text-green-600 bg-green-50 hover:bg-green-100'
                          : 'text-sky-600 bg-sky-50 hover:bg-sky-100'}`}
                      >
                        {downloadingVideo === video.id ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : video.is_offline ? (
                          <DownloadCloud className="w-5 h-5" />
                        ) : (
                          <Download className="w-5 h-5" />
                        )}
                      </button>
                    )}

                    <button
                      onClick={() => setDeleteTarget(video)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {playingVideo && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col group"
          onMouseEnter={() => setShowStreamingControls(true)}
          onMouseLeave={() => setShowStreamingControls(false)}
          onClick={() => setShowStreamingControls(!showStreamingControls)}
        >
          {/* Top Gradient for visibility */}
          <div className={`absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showStreamingControls ? 'opacity-100' : 'opacity-0'}`} />

          <button
            onClick={() => setPlayingVideo(null)}
            className={`absolute top-6 left-6 p-4 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all z-[60] border border-white/10 flex items-center gap-2 group/back ${showStreamingControls ? 'opacity-100' : 'opacity-0'}`}
          >
            <X className="w-6 h-6 text-white" />
            <span className="text-white font-bold pr-2">Close Player</span>
          </button>

          <div className="flex-1 bg-black">
            <YouTubePlayer
              videoId={playingVideo.video_id}
              autoplay={true}
              showControls={showStreamingControls}
              onBack={() => setPlayingVideo(null)}
            />
          </div>

          <div className={`absolute bottom-8 left-0 right-0 text-center pointer-events-none transition-opacity duration-300 ${showStreamingControls ? 'opacity-100' : 'opacity-0'}`}>
            <h3 className="text-white text-xl font-bold px-4 drop-shadow-lg">
              {playingVideo.title}
            </h3>
          </div>
        </div>
      )}

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Video"
        itemName={deleteTarget?.title || ''}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <DeleteConfirmModal
        isOpen={showBulkDeleteModal}
        title="Delete Selected Videos"
        itemName={`${selectedIds.size} video${selectedIds.size > 1 ? 's' : ''}`}
        onConfirm={handleDeleteSelected}
        onCancel={() => setShowBulkDeleteModal(false)}
      />
    </>
  );
}
