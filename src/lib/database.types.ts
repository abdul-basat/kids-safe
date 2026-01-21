// Re-export types from IndexedDB for backwards compatibility
export type {
  DBSettings as Settings,
  DBChannel as ApprovedChannel,
  DBVideo as ApprovedVideo,
  DBPlaylist as Playlist,
  DBPlaylistVideo as PlaylistVideo,
} from './indexedDB';

// Import DBVideo directly for interface extension
import type { DBVideo } from './indexedDB';

export type {
  VideoWithDetails,
  PlaylistWithVideos,
} from './api/playlists';

// Import security utilities
export { sanitizeVideoTitle, isValidVideoId, isValidPin } from './security';

// Define content rating type
export type ContentRating = 'G' | 'PG' | 'PG-13' | 'R' | 'UNRATED';

// Extended video type with content rating
export interface VideoWithRating extends DBVideo {
  content_rating?: ContentRating;
  parental_approval?: boolean;
  category_id?: string;
  is_favorite?: boolean;
}
