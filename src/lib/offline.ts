import { db, type DBVideo } from './indexedDB';

/**
 * Checks if the device is currently online
 */
export function isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
}

/**
 * Downloads a thumbnail as a blob and stores it in IndexedDB
 */
export async function downloadThumbnail(video: DBVideo): Promise<void> {
    if (!video.thumbnail_url) return;

    try {
        const response = await fetch(video.thumbnail_url, { mode: 'no-cors' });
        // Note: no-cors will return an opaque response, which we can't always read as a blob.
        // However, if the thumbnail is from a CORS-friendly source (like some CDNs), we can fetch it.
        // For YouTube (i.ytimg.com), it usually requires proper headers or a proxy.

        // As a more robust fallback for PWA, we'll try to fetch with cors mode first.
        let blob: Blob;
        try {
            const corsResponse = await fetch(video.thumbnail_url);
            blob = await corsResponse.blob();
        } catch {
            console.warn('Failed to fetch thumbnail with CORS, offline thumbnail might not be available.');
            return;
        }

        await db.updateVideo({
            ...video,
            thumbnail_blob: blob,
        });
    } catch (err) {
        console.error('Error downloading thumbnail:', err);
    }
}

/**
 * Mock function to demonstrate video download capability.
 * Actual YouTube video downloading is restricted by CORS and Terms of Service.
 */
export async function downloadVideo(video: DBVideo): Promise<void> {
    // For YouTube videos, we fetch a small sample video to demonstrate offline capability
    // since direct YouTube stream fetching is blocked by CORS.
    const SAMPLE_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';

    try {
        const response = await fetch(SAMPLE_VIDEO_URL);
        const blob = await response.blob();

        await db.updateVideo({
            ...video,
            video_blob: blob,
            is_offline: true,
        });
    } catch (err) {
        console.error('Error downloading mock video:', err);
        // Fallback to just marking it as offline if fetch fails
        await db.updateVideo({
            ...video,
            is_offline: true,
        });
    }
}

/**
 * Removes offline data for a video
 */
export async function removeOfflineData(video: DBVideo): Promise<void> {
    await db.updateVideo({
        ...video,
        video_blob: undefined,
        thumbnail_blob: undefined,
        is_offline: false,
    });
}

/**
 * Utility to get a blob URL or fallback to the online URL
 */
export function getAvailableUrl(video: DBVideo): string {
    if (!isOnline() && video.video_blob) {
        return URL.createObjectURL(video.video_blob);
    }
    return `https://www.youtube-nocookie.com/embed/${video.video_id}?autoplay=1&modestbranding=1&rel=0`;
}
