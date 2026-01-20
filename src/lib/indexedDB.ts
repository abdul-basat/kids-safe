// IndexedDB Storage Layer for KidSafe TV
// Replaces Supabase with local browser storage

const DB_NAME = 'kidsafe-tv';
const DB_VERSION = 1;

export interface DBSettings {
  id: string;
  pin_hash: string | null;
  daily_limit_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface DBChannel {
  id: string;
  channel_id: string;
  channel_title: string;
  thumbnail_url: string | null;
  auto_approve: boolean;
  created_at: string;
}

export interface DBVideo {
  id: string;
  video_id: string;
  channel_id: string | null;
  title: string;
  thumbnail_url: string | null;
  duration: string | null;
  created_at: string;
  video_blob?: Blob;
  thumbnail_blob?: Blob;
  is_offline?: boolean;
}

export interface DBPlaylist {
  id: string;
  name: string;
  is_default: boolean;
  autoplay: boolean;
  created_at: string;
  updated_at: string;
}

export interface DBPlaylistVideo {
  id: string;
  playlist_id: string;
  video_id: string;
  sort_order: number;
  created_at: string;
}

type StoreName = 'settings' | 'channels' | 'videos' | 'playlists' | 'playlistVideos';

let dbInstance: IDBDatabase | null = null;

function generateId(): string {
  return crypto.randomUUID();
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function openDB(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      // Channels store
      if (!db.objectStoreNames.contains('channels')) {
        const channelStore = db.createObjectStore('channels', { keyPath: 'id' });
        channelStore.createIndex('channel_id', 'channel_id', { unique: true });
      }

      // Videos store
      if (!db.objectStoreNames.contains('videos')) {
        const videoStore = db.createObjectStore('videos', { keyPath: 'id' });
        videoStore.createIndex('video_id', 'video_id', { unique: true });
        videoStore.createIndex('channel_id', 'channel_id', { unique: false });
      }

      // Playlists store
      if (!db.objectStoreNames.contains('playlists')) {
        const playlistStore = db.createObjectStore('playlists', { keyPath: 'id' });
        playlistStore.createIndex('is_default', 'is_default', { unique: false });
      }

      // Playlist Videos store (junction table)
      if (!db.objectStoreNames.contains('playlistVideos')) {
        const pvStore = db.createObjectStore('playlistVideos', { keyPath: 'id' });
        pvStore.createIndex('playlist_id', 'playlist_id', { unique: false });
        pvStore.createIndex('video_id', 'video_id', { unique: false });
        pvStore.createIndex('playlist_video', ['playlist_id', 'video_id'], { unique: true });
      }
    };
  });
}

// Generic CRUD operations
async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getById<T>(storeName: StoreName, id: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function getByIndex<T>(storeName: StoreName, indexName: string, value: IDBValidKey): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.get(value);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function getAllByIndex<T>(storeName: StoreName, indexName: string, value: IDBValidKey): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function add<T extends { id: string }>(storeName: StoreName, item: T): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.add(item);
    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(request.error);
  });
}

async function put<T extends { id: string }>(storeName: StoreName, item: T): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);
    request.onsuccess = () => resolve(item);
    request.onerror = () => reject(request.error);
  });
}

async function deleteById(storeName: StoreName, id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function deleteByIndex(storeName: StoreName, indexName: string, value: IDBValidKey): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.openCursor(value);

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Export the database operations
export const db = {
  generateId,
  getTimestamp,

  // Settings
  getSettings: () => getAll<DBSettings>('settings').then(items => items[0] || null),
  saveSettings: (settings: DBSettings) => put<DBSettings>('settings', settings),

  // Channels
  getChannels: () => getAll<DBChannel>('channels'),
  getChannelById: (id: string) => getById<DBChannel>('channels', id),
  getChannelByChannelId: (channelId: string) => getByIndex<DBChannel>('channels', 'channel_id', channelId),
  addChannel: (channel: DBChannel) => add<DBChannel>('channels', channel),
  updateChannel: (channel: DBChannel) => put<DBChannel>('channels', channel),
  deleteChannel: (id: string) => deleteById('channels', id),

  // Videos
  getVideos: () => getAll<DBVideo>('videos'),
  getVideoById: (id: string) => getById<DBVideo>('videos', id),
  getVideoByVideoId: (videoId: string) => getByIndex<DBVideo>('videos', 'video_id', videoId),
  getVideosByChannelId: (channelId: string) => getAllByIndex<DBVideo>('videos', 'channel_id', channelId),
  addVideo: (video: DBVideo) => add<DBVideo>('videos', video),
  updateVideo: (video: DBVideo) => put<DBVideo>('videos', video),
  deleteVideo: (id: string) => deleteById('videos', id),
  deleteVideoByVideoId: (videoId: string) => deleteByIndex('videos', 'video_id', videoId),

  // Playlists
  getPlaylists: () => getAll<DBPlaylist>('playlists'),
  getPlaylistById: (id: string) => getById<DBPlaylist>('playlists', id),
  getDefaultPlaylist: () => getAllByIndex<DBPlaylist>('playlists', 'is_default', 1).then(items => items[0] || null),
  addPlaylist: (playlist: DBPlaylist) => add<DBPlaylist>('playlists', playlist),
  updatePlaylist: (playlist: DBPlaylist) => put<DBPlaylist>('playlists', playlist),
  deletePlaylist: (id: string) => deleteById('playlists', id),

  // Playlist Videos
  getPlaylistVideos: (playlistId: string) => getAllByIndex<DBPlaylistVideo>('playlistVideos', 'playlist_id', playlistId),
  addPlaylistVideo: (pv: DBPlaylistVideo) => put<DBPlaylistVideo>('playlistVideos', pv), // Use put for upsert
  deletePlaylistVideo: (id: string) => deleteById('playlistVideos', id),
  deletePlaylistVideosByPlaylistId: (playlistId: string) => deleteByIndex('playlistVideos', 'playlist_id', playlistId),
  clearPlaylistVideos: (playlistId: string) => deleteByIndex('playlistVideos', 'playlist_id', playlistId),

  // Utility
  clearAll: async () => {
    await clearStore('settings');
    await clearStore('channels');
    await clearStore('videos');
    await clearStore('playlists');
    await clearStore('playlistVideos');
  }
};
