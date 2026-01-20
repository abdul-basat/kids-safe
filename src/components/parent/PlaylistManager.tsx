import { useState, useEffect, useCallback } from 'react';
import {
  Trash2,
  Loader2,
  ListVideo,
  Plus,
  Star,
  X,
  GripVertical,
  Play,
  Pause,
} from 'lucide-react';
import {
  getPlaylists,
  getPlaylistWithVideos,
  createPlaylist,
  deletePlaylist,
  setDefaultPlaylist,
  updatePlaylist,
  removeVideoFromPlaylist,
  reorderPlaylistVideos,
} from '../../lib/api/playlists';
import type { Playlist, PlaylistWithVideos } from '../../lib/database.types';
import { getVideoThumbnail } from '../../lib/youtube';
import { DeleteConfirmModal } from './DeleteConfirmModal';

interface PlaylistManagerProps {
  onRefresh?: () => void;
}

export function PlaylistManager({ onRefresh }: PlaylistManagerProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<PlaylistWithVideos | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [settingDefault, setSettingDefault] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Playlist | null>(null);

  const loadPlaylists = useCallback(async () => {
    try {
      const data = await getPlaylists();
      setPlaylists(data);
    } catch (err) {
      console.error('Error loading playlists:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const handleSelectPlaylist = useCallback(async (id: string) => {
    try {
      const playlist = await getPlaylistWithVideos(id);
      setSelectedPlaylist(playlist);
    } catch (err) {
      console.error('Error loading playlist:', err);
    }
  }, []);

  const handleCreatePlaylist = useCallback(async () => {
    if (!newPlaylistName.trim()) return;

    setIsCreating(true);
    try {
      const isFirst = playlists.length === 0;
      await createPlaylist(newPlaylistName.trim(), isFirst);
      setNewPlaylistName('');
      await loadPlaylists();
      onRefresh?.();
    } catch (err) {
      console.error('Error creating playlist:', err);
    } finally {
      setIsCreating(false);
    }
  }, [newPlaylistName, playlists.length, loadPlaylists, onRefresh]);

  const handleDeletePlaylist = useCallback(async () => {
    if (!deleteTarget) return;

    await deletePlaylist(deleteTarget.id);
    if (selectedPlaylist?.id === deleteTarget.id) {
      setSelectedPlaylist(null);
    }
    setDeleteTarget(null);
    await loadPlaylists();
    onRefresh?.();
  }, [deleteTarget, selectedPlaylist, loadPlaylists, onRefresh]);

  const handleSetDefault = useCallback(async (id: string) => {
    setSettingDefault(id);
    try {
      await setDefaultPlaylist(id);
      await loadPlaylists();
      onRefresh?.();
    } catch (err) {
      console.error('Error setting default:', err);
    } finally {
      setSettingDefault(null);
    }
  }, [loadPlaylists, onRefresh]);

  const handleToggleAutoplay = useCallback(async (playlist: Playlist) => {
    try {
      await updatePlaylist(playlist.id, { autoplay: !playlist.autoplay });
      await loadPlaylists();
      if (selectedPlaylist?.id === playlist.id) {
        setSelectedPlaylist((prev) =>
          prev ? { ...prev, autoplay: !prev.autoplay } : null
        );
      }
    } catch (err) {
      console.error('Error toggling autoplay:', err);
    }
  }, [selectedPlaylist, loadPlaylists]);

  const handleRemoveVideo = useCallback(async (videoId: string) => {
    if (!selectedPlaylist) return;

    try {
      await removeVideoFromPlaylist(selectedPlaylist.id, videoId);
      setSelectedPlaylist((prev) =>
        prev
          ? { ...prev, videos: prev.videos.filter((v) => v.video_id !== videoId) }
          : null
      );
      onRefresh?.();
    } catch (err) {
      console.error('Error removing video:', err);
    }
  }, [selectedPlaylist, onRefresh]);

  const handleMoveVideo = useCallback(async (fromIndex: number, toIndex: number) => {
    if (!selectedPlaylist) return;

    const newVideos = [...selectedPlaylist.videos];
    const [moved] = newVideos.splice(fromIndex, 1);
    newVideos.splice(toIndex, 0, moved);

    setSelectedPlaylist((prev) => (prev ? { ...prev, videos: newVideos } : null));

    try {
      await reorderPlaylistVideos(
        selectedPlaylist.id,
        newVideos.map((v) => v.video_id)
      );
      onRefresh?.();
    } catch (err) {
      console.error('Error reordering:', err);
      handleSelectPlaylist(selectedPlaylist.id);
    }
  }, [selectedPlaylist, handleSelectPlaylist, onRefresh]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-sky-500" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={newPlaylistName}
            onChange={(e) => setNewPlaylistName(e.target.value)}
            placeholder="New playlist name..."
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
          />
          <button
            onClick={handleCreatePlaylist}
            disabled={isCreating || !newPlaylistName.trim()}
            className="px-6 py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 text-white rounded-xl font-semibold transition-colors flex items-center gap-2"
          >
            {isCreating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Plus className="w-5 h-5" />
            )}
            Create
          </button>
        </div>

        {playlists.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ListVideo className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Playlists Yet</h3>
            <p className="text-gray-500">Create a playlist to organize videos for your child.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-700">Your Playlists</h3>
              {playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className={`bg-white rounded-xl p-4 shadow-sm border transition-colors cursor-pointer ${selectedPlaylist?.id === playlist.id
                      ? 'border-sky-500 ring-2 ring-sky-200'
                      : 'border-gray-100 hover:border-gray-200'
                    }`}
                  onClick={() => handleSelectPlaylist(playlist.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-sky-100 rounded-lg flex items-center justify-center">
                      <ListVideo className="w-5 h-5 text-sky-600" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-800 truncate">
                          {playlist.name}
                        </h4>
                        {playlist.is_default && (
                          <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {playlist.autoplay ? 'Autoplay on' : 'Autoplay off'}
                      </p>
                    </div>

                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleAutoplay(playlist)}
                        className={`p-2 rounded-lg transition-colors ${playlist.autoplay
                            ? 'bg-green-100 text-green-600'
                            : 'bg-gray-100 text-gray-500'
                          }`}
                        title={playlist.autoplay ? 'Autoplay enabled' : 'Autoplay disabled'}
                      >
                        {playlist.autoplay ? (
                          <Play className="w-4 h-4" />
                        ) : (
                          <Pause className="w-4 h-4" />
                        )}
                      </button>

                      {!playlist.is_default && (
                        <button
                          onClick={() => handleSetDefault(playlist.id)}
                          disabled={settingDefault === playlist.id}
                          className="p-2 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Set as default"
                        >
                          {settingDefault === playlist.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Star className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => setDeleteTarget(playlist)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete playlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              {selectedPlaylist ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-4 border-b bg-gray-50">
                    <h3 className="font-semibold text-gray-800">
                      {selectedPlaylist.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedPlaylist.videos.length} video{selectedPlaylist.videos.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {selectedPlaylist.videos.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <p>No videos in this playlist yet.</p>
                      <p className="text-sm mt-1">Add videos from the Videos tab.</p>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      {selectedPlaylist.videos.map((video, index) => (
                        <div
                          key={video.video_id}
                          className="flex items-center gap-3 p-3 border-b last:border-b-0 hover:bg-gray-50"
                        >
                          <button
                            className="text-gray-400 cursor-grab active:cursor-grabbing"
                            onMouseDown={(e) => {
                              const startY = e.clientY;
                              const onMouseMove = (moveEvent: MouseEvent) => {
                                const deltaY = moveEvent.clientY - startY;
                                const itemHeight = 64;
                                const moves = Math.round(deltaY / itemHeight);
                                if (moves !== 0) {
                                  const newIndex = Math.max(0, Math.min(selectedPlaylist.videos.length - 1, index + moves));
                                  if (newIndex !== index) {
                                    handleMoveVideo(index, newIndex);
                                  }
                                }
                              };
                              const onMouseUp = () => {
                                document.removeEventListener('mousemove', onMouseMove);
                                document.removeEventListener('mouseup', onMouseUp);
                              };
                              document.addEventListener('mousemove', onMouseMove);
                              document.addEventListener('mouseup', onMouseUp);
                            }}
                          >
                            <GripVertical className="w-5 h-5" />
                          </button>

                          <span className="text-sm text-gray-400 w-6 text-center">
                            {index + 1}
                          </span>

                          <div className="w-16 h-10 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                            <img
                              src={video.thumbnail_url || getVideoThumbnail(video.video_id)}
                              alt={video.title}
                              className="w-full h-full object-cover"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {video.title}
                            </p>
                          </div>

                          <button
                            onClick={() => handleRemoveVideo(video.video_id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            title="Remove from playlist"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
                  <p>Select a playlist to view its contents</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={!!deleteTarget}
        title="Delete Playlist"
        itemName={deleteTarget?.name || ''}
        onConfirm={handleDeletePlaylist}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
