import { useState, useCallback } from 'react';
import { X, Link, Youtube, Loader2, CheckCircle2 } from 'lucide-react';
import { extractVideoId, extractChannelId, getVideoThumbnail } from '../../lib/youtube';
import {
  fetchVideoInfo,
  fetchChannelInfo,
  extractPlaylistId,
  fetchPlaylistVideos,
  fetchChannelPlaylists,
  type ChannelInfo,
  type PlaylistInfo,
} from '../../lib/youtubeApi';
import { addVideo, addVideos, getVideo } from '../../lib/api/videos';
import { addChannel, getChannel } from '../../lib/api/channels';
import { getDefaultPlaylist, createPlaylist, addVideoToPlaylist } from '../../lib/api/playlists';
import { ChannelImportModal } from './ChannelImportModal';

interface AddContentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

async function ensureDefaultPlaylist(): Promise<string> {
  let defaultPlaylist = await getDefaultPlaylist();
  if (!defaultPlaylist) {
    defaultPlaylist = await createPlaylist('Kids Videos', true);
  }
  return defaultPlaylist.id;
}

export function AddContentModal({ isOpen, onClose, onSuccess }: AddContentModalProps) {
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [progress, setProgress] = useState('');

  // Channel import state
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [channelPlaylists, setChannelPlaylists] = useState<PlaylistInfo[]>([]);

  const handleChannelImport = useCallback(async (selectedPlaylists: PlaylistInfo[]) => {
    if (!channelInfo || selectedPlaylists.length === 0) {
      setShowChannelModal(false);
      return;
    }

    setShowChannelModal(false);
    setIsLoading(true);
    setProgress('Saving channel...');

    try {
      const defaultPlaylistId = await ensureDefaultPlaylist();

      // Save the channel
      await addChannel({
        channel_id: channelInfo.channelId,
        channel_title: channelInfo.title || 'Unknown Channel',
        thumbnail_url: channelInfo.thumbnail || undefined,
        auto_approve: true,
      });

      let totalVideos = 0;

      // Import videos from selected playlists
      for (let i = 0; i < selectedPlaylists.length; i++) {
        const ytPlaylist = selectedPlaylists[i];
        setProgress(`Importing ${i + 1}/${selectedPlaylists.length}: ${ytPlaylist.title}...`);

        // Add delay between requests to avoid rate limiting (except first)
        if (i > 0) {
          console.log('[Import] Waiting 1s to avoid rate limit...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Fetch videos from this YouTube playlist
        let videos = await fetchPlaylistVideos(ytPlaylist.playlistId);
        if (videos.length === 0) continue;

        // FILTER: Only include videos that belong to THIS channel
        const originalCount = videos.length;
        videos = videos.filter(v => v.channelId === channelInfo.channelId);

        if (videos.length < originalCount) {
          console.log(`[Import] Filtered out ${originalCount - videos.length} unrelated videos from playlist: ${ytPlaylist.title}`);
        }

        if (videos.length === 0) continue;

        // Add videos to the database
        const videoData = videos.map(v => ({
          video_id: v.videoId,
          title: v.title,
          thumbnail_url: v.thumbnail,
          channel_id: v.channelId,
        }));

        await addVideos(videoData);

        // Add all videos to the DEFAULT playlist so kids can see them
        for (const v of videoData) {
          await addVideoToPlaylist(defaultPlaylistId, v.video_id);
        }

        totalVideos += videos.length;
      }

      if (totalVideos > 0) {
        setSuccess(`Imported ${totalVideos} videos from "${channelInfo.title}"! Ready for kids to watch.`);
      } else {
        setSuccess(`Channel "${channelInfo.title}" added but no videos found.`);
      }

      setUrl('');
      setChannelInfo(null);
      setChannelPlaylists([]);
      onSuccess();
      setTimeout(() => {
        setSuccess('');
        setProgress('');
        onClose();
      }, 3000);
    } catch (err) {
      console.error('Error importing channel:', err);
      setError(err instanceof Error ? err.message : 'Failed to import channel. Please try again.');
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  }, [channelInfo, onSuccess, onClose]);

  const handleSubmit = useCallback(async () => {
    if (!url.trim()) {
      setError('Please enter a URL');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');
    setProgress('');

    try {
      // Ensure we have a default playlist
      const defaultPlaylistId = await ensureDefaultPlaylist();

      // Check for YouTube playlist URL first
      const playlistId = extractPlaylistId(url);
      if (playlistId) {
        setProgress('Fetching playlist videos...');
        const videos = await fetchPlaylistVideos(playlistId);
        if (videos.length === 0) {
          setError('No videos found in this playlist');
          setIsLoading(false);
          return;
        }

        const videoData = videos.map(v => ({
          video_id: v.videoId,
          title: v.title,
          thumbnail_url: v.thumbnail,
          channel_id: v.channelId,
        }));

        await addVideos(videoData);

        setProgress('Adding videos to playlist...');
        for (const v of videoData) {
          await addVideoToPlaylist(defaultPlaylistId, v.video_id);
        }

        setSuccess(`Added ${videos.length} videos! They're ready for kids to watch.`);
        setUrl('');
        onSuccess();
        setTimeout(() => {
          setSuccess('');
          setProgress('');
          onClose();
        }, 2000);
        return;
      }

      // Check for single video
      const videoId = extractVideoId(url);
      if (videoId) {
        setProgress('Fetching video info...');
        const existing = await getVideo(videoId);
        if (existing) {
          // Video exists, just make sure it's in the default playlist
          await addVideoToPlaylist(defaultPlaylistId, videoId);
          setSuccess('Video is already added and ready for kids!');
          setUrl('');
          onSuccess();
          setTimeout(() => {
            setSuccess('');
            setProgress('');
            onClose();
          }, 2000);
          return;
        }

        const data = await fetchVideoInfo(videoId);

        await addVideo({
          video_id: videoId,
          title: data.title || 'Untitled Video',
          thumbnail_url: data.thumbnail || getVideoThumbnail(videoId),
          duration: data.duration,
          channel_id: data.channelId,
        });

        await addVideoToPlaylist(defaultPlaylistId, videoId);

        setSuccess('Video added! It\'s ready for kids to watch.');
        setUrl('');
        onSuccess();
        setTimeout(() => {
          setSuccess('');
          setProgress('');
          onClose();
        }, 2000);
        return;
      }

      // Check for channel - show confirmation modal instead of auto-importing
      const channelIdInfo = extractChannelId(url);
      if (channelIdInfo) {
        setProgress('Fetching channel info...');
        const data = await fetchChannelInfo(channelIdInfo.value, channelIdInfo.type);

        const existingChannel = await getChannel(data.channelId);
        if (existingChannel) {
          setError('This channel is already added');
          setIsLoading(false);
          return;
        }

        // Fetch playlists for the confirmation modal
        setProgress('Fetching channel playlists...');
        const playlists = await fetchChannelPlaylists(data.channelId);

        // Store data and show the confirmation modal
        setChannelInfo(data);
        setChannelPlaylists(playlists);
        setShowChannelModal(true);
        setIsLoading(false);
        setProgress('');
        return;
      }

      setError('Invalid YouTube URL. Please enter a valid video, playlist, or channel URL.');
    } catch (err) {
      console.error('Error adding content:', err);
      setError(err instanceof Error ? err.message : 'Failed to add content. Please try again.');
    } finally {
      setIsLoading(false);
      setProgress('');
    }
  }, [url, onSuccess, onClose]);

  const handleCloseChannelModal = useCallback(() => {
    setShowChannelModal(false);
    setChannelInfo(null);
    setChannelPlaylists([]);
  }, []);

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b">
            <h2 className="text-xl font-bold text-gray-800">Add Content</h2>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          <div className="p-4">
            <div className="flex items-center gap-3 mb-4 text-sm text-gray-600">
              <Youtube className="w-5 h-5 text-red-500" />
              <span>Paste a YouTube video, playlist, or channel URL</span>
            </div>

            <div className="relative">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                disabled={isLoading}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:bg-gray-50"
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSubmit()}
              />
            </div>

            {error && (
              <p className="mt-3 text-red-500 text-sm">{error}</p>
            )}

            {progress && (
              <div className="mt-3 flex items-center gap-2 text-sky-600 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{progress}</span>
              </div>
            )}

            {success && (
              <div className="mt-3 flex items-center gap-2 text-green-600 text-sm">
                <CheckCircle2 className="w-5 h-5" />
                <span>{success}</span>
              </div>
            )}

            <div className="mt-4 p-3 bg-sky-50 rounded-xl text-sm text-sky-800">
              <p className="font-medium mb-1">✨ Smart Import</p>
              <p className="text-xs text-sky-600">
                All videos are added to kids' playlist automatically!
              </p>
            </div>

            <div className="mt-3 p-3 bg-gray-50 rounded-xl text-sm text-gray-600">
              <p className="font-medium mb-2">Supported formats:</p>
              <ul className="space-y-1 text-xs">
                <li>• <strong>Video:</strong> youtube.com/watch?v=...</li>
                <li>• <strong>Playlist:</strong> youtube.com/playlist?list=...</li>
                <li>• <strong>Channel:</strong> youtube.com/@ChannelName</li>
              </ul>
            </div>
          </div>

          <div className="p-4 border-t bg-gray-50">
            <button
              onClick={handleSubmit}
              disabled={isLoading || !url.trim()}
              className="w-full py-3 bg-sky-500 hover:bg-sky-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Importing...
                </>
              ) : (
                'Add Content'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Channel Import Confirmation Modal */}
      <ChannelImportModal
        isOpen={showChannelModal}
        onClose={handleCloseChannelModal}
        onConfirm={handleChannelImport}
        channelInfo={channelInfo}
        playlists={channelPlaylists}
        isLoading={false}
      />
    </>
  );
}

