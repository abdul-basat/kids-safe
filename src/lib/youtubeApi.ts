// Direct YouTube Data API v3 calls
// Replaces Supabase Edge Function proxy

const API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY;
const API_BASE = 'https://www.googleapis.com/youtube/v3';

export interface VideoInfo {
    videoId: string;
    title: string;
    thumbnail: string;
    duration: string;
    channelId: string;
    channelTitle: string;
}

export interface ChannelInfo {
    channelId: string;
    title: string;
    thumbnail: string | null;
    description: string;
}

export interface PlaylistInfo {
    playlistId: string;
    title: string;
    thumbnail: string | null;
    channelTitle: string;
    itemCount: number;
}

export interface PlaylistItemInfo {
    videoId: string;
    title: string;
    thumbnail: string;
    channelId: string;
    channelTitle: string;
    position: number;
}

function formatDuration(isoDuration: string): string {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '0:00';

    const hours = parseInt(match[1] || '0', 10);
    const minutes = parseInt(match[2] || '0', 10);
    const seconds = parseInt(match[3] || '0', 10);

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export async function fetchVideoInfo(videoId: string): Promise<VideoInfo> {
    if (!API_KEY) {
        // Fallback for development without API key
        return {
            videoId,
            title: `Video ${videoId}`,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
            duration: '0:00',
            channelId: '',
            channelTitle: 'Unknown Channel',
        };
    }

    const url = `${API_BASE}/videos?part=snippet,contentDetails&id=${videoId}&key=${API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch video info');
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
        throw new Error('Video not found');
    }

    const video = data.items[0];
    return {
        videoId: video.id,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
        duration: formatDuration(video.contentDetails.duration),
        channelId: video.snippet.channelId,
        channelTitle: video.snippet.channelTitle,
    };
}

export async function fetchChannelInfo(
    identifier: string,
    identifierType: 'id' | 'handle' | 'custom' = 'id'
): Promise<ChannelInfo> {
    if (!API_KEY) {
        // Fallback for development without API key
        return {
            channelId: identifier.startsWith('UC') ? identifier : `UC${identifier}`,
            title: `Channel ${identifier}`,
            thumbnail: null,
            description: '',
        };
    }

    let url: string;
    if (identifierType === 'id') {
        url = `${API_BASE}/channels?part=snippet&id=${identifier}&key=${API_KEY}`;
    } else if (identifierType === 'handle') {
        url = `${API_BASE}/channels?part=snippet&forHandle=${identifier}&key=${API_KEY}`;
    } else {
        url = `${API_BASE}/channels?part=snippet&forUsername=${identifier}&key=${API_KEY}`;
    }

    const response = await fetch(url);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch channel info');
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
        throw new Error('Channel not found');
    }

    const channel = data.items[0];
    return {
        channelId: channel.id,
        title: channel.snippet.title,
        thumbnail: channel.snippet.thumbnails?.medium?.url || channel.snippet.thumbnails?.default?.url || null,
        description: channel.snippet.description,
    };
}

export async function fetchPlaylistInfo(playlistId: string): Promise<PlaylistInfo> {
    if (!API_KEY) {
        throw new Error('YouTube API key is required to fetch playlist info');
    }

    const url = `${API_BASE}/playlists?part=snippet,contentDetails&id=${playlistId}&key=${API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch playlist info');
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
        throw new Error('Playlist not found');
    }

    const playlist = data.items[0];
    return {
        playlistId: playlist.id,
        title: playlist.snippet.title,
        thumbnail: playlist.snippet.thumbnails?.medium?.url || playlist.snippet.thumbnails?.default?.url || null,
        channelTitle: playlist.snippet.channelTitle,
        itemCount: playlist.contentDetails.itemCount,
    };
}

export async function fetchPlaylistVideos(playlistId: string, maxResults = 50): Promise<PlaylistItemInfo[]> {
    if (!API_KEY) {
        throw new Error('YouTube API key is required to fetch playlist videos');
    }

    const videos: PlaylistItemInfo[] = [];
    let nextPageToken: string | undefined;

    // Titles that indicate private/deleted videos
    const skipTitles = ['Private video', 'Deleted video', 'Private Video', 'Deleted Video'];

    do {
        const url = `${API_BASE}/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${Math.min(maxResults - videos.length, 50)}&key=${API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const response = await fetch(url);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to fetch playlist videos');
        }

        const data = await response.json();

        for (const item of data.items || []) {
            if (item.snippet.resourceId?.kind === 'youtube#video') {
                const title = item.snippet.title || '';
                const thumbnail = item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || '';

                // Skip private/deleted videos
                if (skipTitles.includes(title)) {
                    continue;
                }

                // Skip videos with no valid thumbnail (usually private)
                if (!thumbnail || thumbnail.includes('no_thumbnail')) {
                    continue;
                }

                videos.push({
                    videoId: item.snippet.resourceId.videoId,
                    title: title,
                    thumbnail: thumbnail,
                    channelId: item.snippet.videoOwnerChannelId || '',
                    channelTitle: item.snippet.videoOwnerChannelTitle || '',
                    position: item.snippet.position,
                });
            }
        }

        nextPageToken = data.nextPageToken;
    } while (nextPageToken && videos.length < maxResults);

    return videos;
}

// Extract playlist ID from various YouTube playlist URL formats
export function extractPlaylistId(url: string): string | null {
    const patterns = [
        /[?&]list=([a-zA-Z0-9_-]+)/,
        /youtube\.com\/playlist\?list=([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }

    // Check if it's already a playlist ID
    if (/^[A-Za-z0-9_-]{10,}$/.test(url) && (url.startsWith('PL') || url.startsWith('UU') || url.startsWith('OL'))) {
        return url;
    }

    return null;
}

// Fetch all playlists from a channel
export async function fetchChannelPlaylists(channelId: string, maxResults = 50): Promise<PlaylistInfo[]> {
    if (!API_KEY) {
        throw new Error('YouTube API key is required to fetch channel playlists');
    }

    const playlists: PlaylistInfo[] = [];
    let nextPageToken: string | undefined;

    do {
        const url = `${API_BASE}/playlists?part=snippet,contentDetails&channelId=${channelId}&maxResults=${Math.min(maxResults - playlists.length, 50)}&key=${API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const response = await fetch(url);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Failed to fetch channel playlists');
        }

        const data = await response.json();

        for (const item of data.items || []) {
            playlists.push({
                playlistId: item.id,
                title: item.snippet.title,
                thumbnail: item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url || null,
                channelTitle: item.snippet.channelTitle,
                itemCount: item.contentDetails.itemCount,
            });
        }

        nextPageToken = data.nextPageToken;
    } while (nextPageToken && playlists.length < maxResults);

    return playlists;
}
