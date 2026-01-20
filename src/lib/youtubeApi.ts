// YouTube API Client - Now proxied through backend
// API key is securely stored server-side in Vercel

import { apiCache } from './apiCache';

// Check if we're in development or production
const IS_DEV = import.meta.env.DEV;
const API_BASE = IS_DEV
    ? 'http://localhost:3000/api/youtube'  // Local dev
    : '/api/youtube';  // Production (Vercel)

const MAX_RETRIES = 3;
const MAX_PAGES = 10; // Safety limit for pagination

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

// Retry fetch with exponential backoff for rate limits
async function fetchWithRetry(url: string, maxRetries = MAX_RETRIES): Promise<Response> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url);

            // If rate limited (429), wait and retry
            if (response.status === 429) {
                const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
                console.log(`[API] Rate limited, retrying in ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }

            return response;
        } catch (err) {
            if (attempt === maxRetries - 1) throw err;
            const waitTime = Math.pow(2, attempt) * 500;
            console.log(`[API] Error, retrying in ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
    }
    throw new Error('Max retries exceeded');
}

export async function fetchVideoInfo(videoId: string): Promise<VideoInfo> {
    // Check cache first
    const cacheKey = `video:${videoId}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return cached;

    const url = `${API_BASE}?endpoint=videos&part=snippet,contentDetails&id=${videoId}`;
    const response = await fetchWithRetry(url);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch video info');
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
        throw new Error('Video not found');
    }

    const video = data.items[0];
    const result = {
        videoId: video.id,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails?.medium?.url || video.snippet.thumbnails?.default?.url,
        duration: formatDuration(video.contentDetails.duration),
        channelId: video.snippet.channelId,
        channelTitle: video.snippet.channelTitle,
    };

    // Cache the result
    apiCache.set(cacheKey, result);
    return result;
}

export async function fetchChannelInfo(
    identifier: string,
    identifierType: 'id' | 'handle' | 'custom' = 'id'
): Promise<ChannelInfo> {
    // Check cache first
    const cacheKey = `channel:${identifierType}:${identifier}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return cached;

    let url: string;
    if (identifierType === 'id') {
        url = `${API_BASE}?endpoint=channels&part=snippet&id=${identifier}`;
    } else if (identifierType === 'handle') {
        url = `${API_BASE}?endpoint=channels&part=snippet&forHandle=${identifier}`;
    } else {
        url = `${API_BASE}?endpoint=channels&part=snippet&forUsername=${identifier}`;
    }

    const response = await fetchWithRetry(url);

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to fetch channel info');
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
        throw new Error('Channel not found');
    }

    const channel = data.items[0];
    const result = {
        channelId: channel.id,
        title: channel.snippet.title,
        thumbnail: channel.snippet.thumbnails?.medium?.url || channel.snippet.thumbnails?.default?.url || null,
        description: channel.snippet.description,
    };

    // Cache the result
    apiCache.set(cacheKey, result);
    return result;
}

export async function fetchPlaylistInfo(playlistId: string): Promise<PlaylistInfo> {
    const url = `${API_BASE}?endpoint=playlists&part=snippet,contentDetails&id=${playlistId}`;
    const response = await fetchWithRetry(url);

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
    const videos: PlaylistItemInfo[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;

    // Titles that indicate private/deleted videos
    const skipTitles = ['Private video', 'Deleted video', 'Private Video', 'Deleted Video'];

    do {
        // Safety limit: max 10 pages
        if (pageCount >= MAX_PAGES) {
            console.warn(`[API] Reached max pages (${MAX_PAGES}) for playlist ${playlistId}`);
            break;
        }

        const maxItems = Math.min(maxResults - videos.length, 50);
        const url = `${API_BASE}?endpoint=playlistItems&part=snippet&playlistId=${playlistId}&maxResults=${maxItems}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const response = await fetchWithRetry(url);

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
        pageCount++;
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
    const playlists: PlaylistInfo[] = [];
    let nextPageToken: string | undefined;
    let pageCount = 0;

    do {
        // Safety limit: max 10 pages
        if (pageCount >= MAX_PAGES) {
            console.warn(`[API] Reached max pages (${MAX_PAGES}) for channel ${channelId}`);
            break;
        }

        const maxItems = Math.min(maxResults - playlists.length, 50);
        const url = `${API_BASE}?endpoint=playlists&part=snippet,contentDetails&channelId=${channelId}&maxResults=${maxItems}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;
        const response = await fetchWithRetry(url);

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
        pageCount++;
    } while (nextPageToken && playlists.length < maxResults);

    return playlists;
}
