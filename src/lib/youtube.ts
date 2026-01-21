import { isValidVideoId } from './security';

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      const videoId = match[1];
      // Additional validation to prevent injection
      if (isValidVideoId(videoId)) {
        return videoId;
      }
    }
  }

  return null;
}

export function extractChannelId(url: string): { type: 'id' | 'handle' | 'custom'; value: string } | null {
  // Trim and clean up input
  const input = url.trim();

  // Full URL patterns
  const patterns: Array<{ regex: RegExp; type: 'id' | 'handle' | 'custom' }> = [
    { regex: /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/, type: 'id' },
    { regex: /youtube\.com\/@([a-zA-Z0-9_.-]+)/, type: 'handle' },
    { regex: /youtube\.com\/c\/([a-zA-Z0-9_.-]+)/, type: 'custom' },
    { regex: /youtube\.com\/user\/([a-zA-Z0-9_.-]+)/, type: 'custom' },
  ];

  for (const { regex, type } of patterns) {
    const match = input.match(regex);
    if (match) return { type, value: match[1] };
  }

  // Direct channel ID (starts with UC and is 24 chars)
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(input)) {
    return { type: 'id', value: input };
  }

  // Handle shorthand formats: @google, /google, google
  // Remove leading @ or / if present
  let cleanName = input;
  if (cleanName.startsWith('@') || cleanName.startsWith('/')) {
    cleanName = cleanName.slice(1);
  }

  // Validate it looks like a channel name (alphanumeric with some special chars)
  if (/^[a-zA-Z0-9_.-]+$/.test(cleanName) && cleanName.length >= 2) {
    return { type: 'handle', value: cleanName };
  }

  return null;
}

export function getVideoThumbnail(videoId: string, quality: 'default' | 'medium' | 'high' | 'maxres' = 'medium'): string {
  // Validate video ID to prevent injection attacks
  if (!isValidVideoId(videoId)) {
    throw new Error('Invalid video ID format');
  }
  
  const qualityMap = {
    default: 'default',
    medium: 'mqdefault',
    high: 'hqdefault',
    maxres: 'maxresdefault',
  };
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/${qualityMap[quality]}.jpg`;
}

export function getEmbedUrl(videoId: string): string {
  // Validate video ID to prevent injection attacks
  if (!isValidVideoId(videoId)) {
    throw new Error('Invalid video ID format');
  }
  
  const params = new URLSearchParams({
    enablejsapi: '1',
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    fs: '0',
    iv_load_policy: '3',
    disablekb: '0',
    origin: window.location.origin,
  });
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
}

export function formatDuration(isoDuration: string): string {
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

export function isValidYouTubeUrl(url: string): boolean {
  return extractVideoId(url) !== null || extractChannelId(url) !== null;
}

export function getYouTubeUrlType(url: string): 'video' | 'channel' | 'unknown' {
  if (extractVideoId(url)) return 'video';
  if (extractChannelId(url)) return 'channel';
  return 'unknown';
}
