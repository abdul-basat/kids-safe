import { db, type DBPlaylist, type DBPlaylistVideo, type DBVideo } from '../indexedDB';

export type Playlist = DBPlaylist;
export type PlaylistVideo = DBPlaylistVideo;

export interface VideoWithDetails extends DBVideo {
  sort_order?: number;
}

export interface PlaylistWithVideos extends Playlist {
  videos: VideoWithDetails[];
}

export async function getPlaylists(): Promise<Playlist[]> {
  const playlists = await db.getPlaylists();
  return playlists.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getPlaylist(id: string): Promise<Playlist | null> {
  return db.getPlaylistById(id);
}

export async function getDefaultPlaylist(): Promise<Playlist | null> {
  const playlists = await db.getPlaylists();
  return playlists.find(p => p.is_default) || null;
}

export async function getPlaylistWithVideos(playlistId: string): Promise<PlaylistWithVideos | null> {
  const playlist = await db.getPlaylistById(playlistId);
  if (!playlist) return null;

  const playlistVideos = await db.getPlaylistVideos(playlistId);
  playlistVideos.sort((a, b) => a.sort_order - b.sort_order);

  const videos: VideoWithDetails[] = [];
  for (const pv of playlistVideos) {
    const video = await db.getVideoByVideoId(pv.video_id);
    if (video) {
      videos.push({ ...video, sort_order: pv.sort_order });
    }
  }

  return { ...playlist, videos };
}

export async function getDefaultPlaylistWithVideos(): Promise<PlaylistWithVideos | null> {
  // Get ALL videos from database
  const allVideos = await db.getVideos();

  // Filter out private/deleted videos
  const validVideos = allVideos.filter(v => {
    const title = v.title?.toLowerCase() || '';
    if (title === 'private video' || title === 'deleted video') return false;
    return true;
  });

  if (validVideos.length === 0) return null;

  // Shuffle the videos randomly
  const shuffled = [...validVideos];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const videos: VideoWithDetails[] = shuffled.map((v, index) => ({
    ...v,
    sort_order: index,
  }));

  return {
    id: 'all-videos',
    name: 'All Videos',
    is_default: true,
    autoplay: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    videos,
  };
}

export async function createPlaylist(name: string, isDefault = false): Promise<Playlist> {
  if (isDefault) {
    // Unset other defaults
    const playlists = await db.getPlaylists();
    for (const p of playlists) {
      if (p.is_default) {
        p.is_default = false;
        await db.updatePlaylist(p);
      }
    }
  }

  const playlist: Playlist = {
    id: db.generateId(),
    name,
    is_default: isDefault,
    autoplay: true,
    created_at: db.getTimestamp(),
    updated_at: db.getTimestamp(),
  };

  return db.addPlaylist(playlist);
}

export async function updatePlaylist(
  id: string,
  updates: Partial<Pick<Playlist, 'name' | 'autoplay'>>
): Promise<void> {
  const playlist = await db.getPlaylistById(id);
  if (playlist) {
    if (updates.name !== undefined) playlist.name = updates.name;
    if (updates.autoplay !== undefined) playlist.autoplay = updates.autoplay;
    playlist.updated_at = db.getTimestamp();
    await db.updatePlaylist(playlist);
  }
}

export async function setDefaultPlaylist(id: string): Promise<void> {
  const playlists = await db.getPlaylists();

  for (const p of playlists) {
    const shouldBeDefault = p.id === id;
    if (p.is_default !== shouldBeDefault) {
      p.is_default = shouldBeDefault;
      p.updated_at = db.getTimestamp();
      await db.updatePlaylist(p);
    }
  }
}

export async function deletePlaylist(id: string): Promise<void> {
  await db.deletePlaylistVideosByPlaylistId(id);
  await db.deletePlaylist(id);
}

export async function addVideoToPlaylist(playlistId: string, videoId: string): Promise<void> {
  const existingPVs = await db.getPlaylistVideos(playlistId);

  // Check if video is already in this playlist
  const alreadyExists = existingPVs.some(pv => pv.video_id === videoId);
  if (alreadyExists) {
    return; // Skip - video already in playlist
  }

  const maxOrder = existingPVs.reduce((max, pv) => Math.max(max, pv.sort_order), -1);

  const pv: PlaylistVideo = {
    id: db.generateId(),
    playlist_id: playlistId,
    video_id: videoId,
    sort_order: maxOrder + 1,
    created_at: db.getTimestamp(),
  };

  await db.addPlaylistVideo(pv);
}

export async function removeVideoFromPlaylist(playlistId: string, videoId: string): Promise<void> {
  const pvs = await db.getPlaylistVideos(playlistId);
  const pv = pvs.find(p => p.video_id === videoId);
  if (pv) {
    await db.deletePlaylistVideo(pv.id);
  }
}

export async function reorderPlaylistVideos(
  playlistId: string,
  videoIds: string[]
): Promise<void> {
  // Delete all existing
  await db.clearPlaylistVideos(playlistId);

  // Re-add in new order
  for (let i = 0; i < videoIds.length; i++) {
    const pv: PlaylistVideo = {
      id: db.generateId(),
      playlist_id: playlistId,
      video_id: videoIds[i],
      sort_order: i,
      created_at: db.getTimestamp(),
    };
    await db.addPlaylistVideo(pv);
  }
}

export async function getPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
  const pvs = await db.getPlaylistVideos(playlistId);
  return pvs.sort((a, b) => a.sort_order - b.sort_order);
}
