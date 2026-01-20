import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getSettings, createSettings, hashPin, verifyPin, updatePinHash } from '../lib/api/settings';
import { getDefaultPlaylistWithVideos } from '../lib/api/playlists';
import type { Settings, PlaylistWithVideos, ApprovedVideo } from '../lib/database.types';

type AppMode = 'loading' | 'setup' | 'child' | 'parent' | 'pin-entry';

interface AppState {
  mode: AppMode;
  settings: Settings | null;
  isParentMode: boolean;
  currentPlaylist: PlaylistWithVideos | null;
  currentVideoIndex: number;
  isPlaying: boolean;
}

interface AppContextValue extends AppState {
  setMode: (mode: AppMode) => void;
  enterParentMode: (pin: string) => Promise<boolean>;
  exitParentMode: () => void;
  setupPin: (pin: string) => Promise<void>;
  changePin: (currentPin: string, newPin: string) => Promise<boolean>;
  setCurrentPlaylist: (playlist: PlaylistWithVideos | null) => void;
  setCurrentVideoIndex: (index: number) => void;
  nextVideo: () => void;
  previousVideo: () => void;
  setIsPlaying: (playing: boolean) => void;
  currentVideo: ApprovedVideo | null;
  hasNextVideo: boolean;
  hasPreviousVideo: boolean;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const PARENT_SESSION_TIMEOUT = 5 * 60 * 1000;

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    mode: 'loading',
    settings: null,
    isParentMode: false,
    currentPlaylist: null,
    currentVideoIndex: 0,
    isPlaying: false,
  });
  const [sessionTimer, setSessionTimer] = useState<number | null>(null);

  const loadInitialData = useCallback(async () => {
    try {
      const settings = await getSettings();
      if (!settings || !settings.pin_hash) {
        setState((prev) => ({ ...prev, mode: 'setup', settings }));
        return;
      }

      const playlist = await getDefaultPlaylistWithVideos();
      setState((prev) => ({
        ...prev,
        mode: 'child',
        settings,
        currentPlaylist: playlist,
        currentVideoIndex: 0,
      }));
    } catch {
      setState((prev) => ({ ...prev, mode: 'setup' }));
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    return () => {
      if (sessionTimer) clearTimeout(sessionTimer);
    };
  }, [sessionTimer]);

  const resetSessionTimer = useCallback(() => {
    if (sessionTimer) clearTimeout(sessionTimer);
    const timer = window.setTimeout(() => {
      setState((prev) => ({ ...prev, mode: 'child', isParentMode: false }));
    }, PARENT_SESSION_TIMEOUT);
    setSessionTimer(timer);
  }, [sessionTimer]);

  const setMode = useCallback((mode: AppMode) => {
    setState((prev) => ({ ...prev, mode }));
  }, []);

  const enterParentMode = useCallback(async (pin: string): Promise<boolean> => {
    if (!state.settings?.pin_hash) return false;
    const isValid = await verifyPin(pin, state.settings.pin_hash);
    if (isValid) {
      setState((prev) => ({ ...prev, mode: 'parent', isParentMode: true }));
      resetSessionTimer();
    }
    return isValid;
  }, [state.settings, resetSessionTimer]);

  const exitParentMode = useCallback(() => {
    if (sessionTimer) clearTimeout(sessionTimer);
    setState((prev) => ({ ...prev, mode: 'child', isParentMode: false }));
  }, [sessionTimer]);

  const setupPin = useCallback(async (pin: string) => {
    const pinHash = await hashPin(pin);
    if (state.settings) {
      await updatePinHash(state.settings.id, pinHash);
      setState((prev) => ({
        ...prev,
        settings: prev.settings ? { ...prev.settings, pin_hash: pinHash } : null,
        mode: 'parent',
        isParentMode: true,
      }));
    } else {
      const newSettings = await createSettings(pinHash);
      setState((prev) => ({
        ...prev,
        settings: newSettings,
        mode: 'parent',
        isParentMode: true,
      }));
    }
    resetSessionTimer();
  }, [state.settings, resetSessionTimer]);

  const changePin = useCallback(async (currentPin: string, newPin: string): Promise<boolean> => {
    if (!state.settings?.pin_hash) return false;
    const isValid = await verifyPin(currentPin, state.settings.pin_hash);
    if (!isValid) return false;

    const newPinHash = await hashPin(newPin);
    await updatePinHash(state.settings.id, newPinHash);
    setState((prev) => ({
      ...prev,
      settings: prev.settings ? { ...prev.settings, pin_hash: newPinHash } : null,
    }));
    return true;
  }, [state.settings]);

  const setCurrentPlaylist = useCallback((playlist: PlaylistWithVideos | null) => {
    setState((prev) => ({ ...prev, currentPlaylist: playlist, currentVideoIndex: 0 }));
  }, []);

  const setCurrentVideoIndex = useCallback((index: number) => {
    setState((prev) => ({ ...prev, currentVideoIndex: index }));
  }, []);

  const nextVideo = useCallback(() => {
    setState((prev) => {
      if (!prev.currentPlaylist) return prev;
      const maxIndex = prev.currentPlaylist.videos.length - 1;
      if (prev.currentVideoIndex >= maxIndex) return prev;
      return { ...prev, currentVideoIndex: prev.currentVideoIndex + 1 };
    });
  }, []);

  const previousVideo = useCallback(() => {
    setState((prev) => {
      if (prev.currentVideoIndex <= 0) return prev;
      return { ...prev, currentVideoIndex: prev.currentVideoIndex - 1 };
    });
  }, []);

  const setIsPlaying = useCallback((playing: boolean) => {
    setState((prev) => ({ ...prev, isPlaying: playing }));
  }, []);

  const refreshData = useCallback(async () => {
    const settings = await getSettings();
    const playlist = await getDefaultPlaylistWithVideos();
    setState((prev) => ({
      ...prev,
      settings,
      currentPlaylist: playlist,
    }));
  }, []);

  const currentVideo = state.currentPlaylist?.videos[state.currentVideoIndex] ?? null;
  const hasNextVideo = state.currentPlaylist
    ? state.currentVideoIndex < state.currentPlaylist.videos.length - 1
    : false;
  const hasPreviousVideo = state.currentVideoIndex > 0;

  const value: AppContextValue = {
    ...state,
    setMode,
    enterParentMode,
    exitParentMode,
    setupPin,
    changePin,
    setCurrentPlaylist,
    setCurrentVideoIndex,
    nextVideo,
    previousVideo,
    setIsPlaying,
    currentVideo,
    hasNextVideo,
    hasPreviousVideo,
    refreshData,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
