import { useState, useCallback } from 'react';
import { X, Link, Youtube, Loader2, CheckCircle2 } from 'lucide-react';
import { extractVideoId, extractChannelId, getVideoThumbnail } from '../../lib/youtube';
import {
  fetchVideoInfo,
  fetchChannelInfo,
  extractPlaylistId,
  fetchPlaylistVideos,
  fetchChannelPlaylists,
} from '../../lib/youtubeApi';
import { addVideo, addVideos, getVideo } from '../../lib/api/videos';
import { addChannel, getChannel } from '../../lib/api/channels';
import { getDefaultPlaylist, createPlaylist, addVideoToPlaylist } from '../../lib/api/playlists';

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

      // Check for channel - imports all playlists and adds videos to default playlist
      const channelInfo = extractChannelId(url);
      if (channelInfo) {
        setProgress('Fetching channel info...');
        const data = await fetchChannelInfo(channelInfo.value, channelInfo.type);

        const existingChannel = await getChannel(data.channelId);
        if (existingChannel) {
          setError('This channel is already added');
          setIsLoading(false);
          return;
        }

        // Save the channel
        await addChannel({
          channel_id: data.channelId,
          channel_title: data.title || 'Unknown Channel',
          thumbnail_url: data.thumbnail || undefined,
          auto_approve: true,
        });

        // Fetch all playlists from the channel
        setProgress('Fetching channel playlists...');
        const channelPlaylists = await fetchChannelPlaylists(data.channelId);

        if (channelPlaylists.length === 0) {
          setSuccess(`Channel "${data.title}" added, but no public playlists found.`);
          setUrl('');
          onSuccess();
          setTimeout(() => {
            setSuccess('');
            setProgress('');
            onClose();
          }, 2000);
          return;
        }

        let totalVideos = 0;

        // Import videos from each channel playlist to the DEFAULT playlist
        for (let i = 0; i < channelPlaylists.length; i++) {
          const ytPlaylist = channelPlaylists[i];
          setProgress(`Importing ${i + 1}/${channelPlaylists.length}: ${ytPlaylist.title}...`);

          // Fetch videos from this YouTube playlist
          const videos = await fetchPlaylistVideos(ytPlaylist.playlistId);
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
          setSuccess(`Imported ${totalVideos} videos from "${data.title}"! Ready for kids to watch.`);
        } else {
          setSuccess(`Channel "${data.title}" added but no videos found.`);
        }

        setUrl('');
        onSuccess();
        setTimeout(() => {
          setSuccess('');
          setProgress('');
          onClose();
        }, 3000);
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

  if (!isOpen) return null;

  return (
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
  );
}
