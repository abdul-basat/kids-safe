// Re-export types from IndexedDB for backwards compatibility
export type {
  DBSettings as Settings,
  DBChannel as ApprovedChannel,
  DBVideo as ApprovedVideo,
  DBPlaylist as Playlist,
  DBPlaylistVideo as PlaylistVideo,
} from './indexedDB';

export type {
  VideoWithDetails,
  PlaylistWithVideos,
} from './api/playlists';
