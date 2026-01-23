/**
 * Sandbox Security Module for KidSafe TV
 * =========================================
 * 
 * PURPOSE:
 * Provides defense-in-depth security layers to prevent accidental access
 * to YouTube or external content from the kids video player.
 * 
 * DISCLAIMER:
 * This module is designed to prevent ACCIDENTAL escapes for children.
 * It does NOT claim absolute iframe-level control over YouTube's embedded player.
 * YouTube IFrame API has inherent limitations that cannot be fully controlled.
 * 
 * LAYERS PROVIDED:
 * 1. Escape Detection & Recovery - Monitors for unexpected behaviors
 * 2. Navigation Locking - Prevents external navigation during playback
 * 3. Input Interception - Blocks dangerous keyboard/gesture inputs
 * 4. Window.open/target="_blank" blocking
 * 5. Context menu prevention
 */

// ============================================================================
// Types & State
// ============================================================================

type EscapeHandler = () => void;
type EscapeType = 'blur' | 'visibility' | 'focus' | 'postMessage' | 'navigation' | 'fullscreen';

interface SandboxState {
  isInitialized: boolean;
  isNavigationLocked: boolean;
  isPlaying: boolean;
  escapeHandlers: Set<EscapeHandler>;
  cleanupFunctions: (() => void)[];
  originalWindowOpen: typeof window.open | null;
  longPressTimer: number | null;
}

const state: SandboxState = {
  isInitialized: false,
  isNavigationLocked: false,
  isPlaying: false,
  escapeHandlers: new Set(),
  cleanupFunctions: [],
  originalWindowOpen: null,
  longPressTimer: null,
};

// Long press threshold in milliseconds
const LONG_PRESS_THRESHOLD = 500;

// Allowed YouTube postMessage origins
const ALLOWED_ORIGINS = [
  'https://www.youtube.com',
  'https://www.youtube-nocookie.com',
  'https://youtube.com',
];

// Allowed postMessage event types from YouTube API
const ALLOWED_YOUTUBE_EVENTS = [
  'initialDelivery',
  'onReady',
  'onStateChange',
  'onPlaybackQualityChange',
  'onPlaybackRateChange',
  'onError',
  'onApiChange',
  'infoDelivery',
  'apiInfoDelivery',
];

// ============================================================================
// Escape Detection & Recovery
// ============================================================================

/**
 * Registers an escape handler that will be called when an escape attempt is detected
 */
export function onEscapeDetected(handler: EscapeHandler): () => void {
  state.escapeHandlers.add(handler);
  return () => state.escapeHandlers.delete(handler);
}

/**
 * Triggers all registered escape handlers
 */
function triggerEscapeDetection(type: EscapeType): void {
  console.warn(`[Sandbox] Escape attempt detected: ${type}`);
  state.escapeHandlers.forEach(handler => {
    try {
      handler();
    } catch (err) {
      console.error('[Sandbox] Escape handler error:', err);
    }
  });
}

/**
 * Monitors for window blur during playback (potential escape)
 */
function setupBlurDetection(): () => void {
  const handleBlur = () => {
    if (state.isPlaying && state.isNavigationLocked) {
      // Window lost focus during playback - potential escape attempt
      triggerEscapeDetection('blur');
    }
  };

  window.addEventListener('blur', handleBlur);
  return () => window.removeEventListener('blur', handleBlur);
}

/**
 * Monitors for visibility changes during playback
 */
function setupVisibilityDetection(): () => void {
  const handleVisibility = () => {
    if (document.hidden && state.isPlaying && state.isNavigationLocked) {
      // Page became hidden during playback - potential escape
      triggerEscapeDetection('visibility');
    }
  };

  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}

/**
 * Monitors and filters postMessage events from YouTube iframe
 */
function setupPostMessageFilter(): () => void {
  const handleMessage = (event: MessageEvent) => {
    // Only process messages from YouTube
    const origin = event.origin;
    if (!ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed.replace('https://', 'https://').replace('http://', '')))) {
      // Message from unknown origin
      if (state.isNavigationLocked) {
        console.warn('[Sandbox] Blocked postMessage from unknown origin:', origin);
        return;
      }
    }

    // Check if it's a navigation-related message
    try {
      const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

      // Block navigation-related events
      if (data && typeof data === 'object') {
        const eventType = data.event || data.info?.event;

        // Check for suspicious events that might indicate navigation
        if (eventType && !ALLOWED_YOUTUBE_EVENTS.includes(eventType)) {
          if (eventType.includes('navigate') || eventType.includes('redirect') || eventType.includes('click')) {
            console.warn('[Sandbox] Blocked suspicious postMessage event:', eventType);
            triggerEscapeDetection('postMessage');
            event.stopImmediatePropagation();
            return;
          }
        }
      }
    } catch {
      // Not JSON, likely safe
    }
  };

  window.addEventListener('message', handleMessage, true);
  return () => window.removeEventListener('message', handleMessage, true);
}

// ============================================================================
// Navigation Locking
// ============================================================================

/**
 * Locks navigation - prevents external navigation during video playback
 */
export function lockNavigation(): void {
  state.isNavigationLocked = true;
  state.isPlaying = true;

  // Push buffer states to history to catch back button
  window.history.pushState({ kidSafe: true, depth: 1 }, '');
  window.history.pushState({ kidSafe: true, depth: 2 }, '');
}

/**
 * Unlocks navigation - allows normal navigation when not playing
 */
export function unlockNavigation(): void {
  state.isNavigationLocked = false;
  state.isPlaying = false;
}

/**
 * Checks if navigation is currently locked
 */
export function isNavigationLocked(): boolean {
  return state.isNavigationLocked;
}

/**
 * Sets the playing state for escape detection
 */
export function setPlayingState(playing: boolean): void {
  state.isPlaying = playing;
}

/**
 * Handles popstate (back button) events
 */
function setupPopstateInterception(): () => void {
  const handlePopstate = (event: PopStateEvent) => {
    if (state.isNavigationLocked) {
      // Prevent navigation, push state back
      event.preventDefault();
      window.history.pushState({ kidSafe: true, depth: 1 }, '');
      triggerEscapeDetection('navigation');
    }
  };

  window.addEventListener('popstate', handlePopstate);
  return () => window.removeEventListener('popstate', handlePopstate);
}

/**
 * Blocks window.open calls
 */
function setupWindowOpenBlock(): () => void {
  state.originalWindowOpen = window.open;

  window.open = function (...args: Parameters<typeof window.open>): Window | null {
    if (state.isNavigationLocked) {
      console.warn('[Sandbox] Blocked window.open:', args[0]);
      triggerEscapeDetection('navigation');
      return null;
    }
    return state.originalWindowOpen?.apply(window, args) ?? null;
  };

  return () => {
    if (state.originalWindowOpen) {
      window.open = state.originalWindowOpen;
    }
  };
}

/**
 * Blocks target="_blank" links using MutationObserver
 */
function setupTargetBlankBlock(): () => void {
  const processAnchors = (root: Element | Document = document) => {
    const anchors = root.querySelectorAll('a[target="_blank"]');
    anchors.forEach(anchor => {
      anchor.removeAttribute('target');
      anchor.setAttribute('data-sandbox-modified', 'true');
    });
  };

  // Process existing anchors
  processAnchors();

  // Watch for new anchors
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node instanceof Element) {
          if (node.matches?.('a[target="_blank"]')) {
            node.removeAttribute('target');
          }
          processAnchors(node);
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });

  return () => observer.disconnect();
}

/**
 * Intercepts anchor clicks to prevent external navigation
 */
function setupAnchorInterception(): () => void {
  const handleClick = (event: MouseEvent) => {
    if (!state.isNavigationLocked) return;

    const target = event.target as HTMLElement;
    const anchor = target.closest('a');

    if (anchor) {
      const href = anchor.getAttribute('href');

      // Block external links
      if (href && (href.startsWith('http') || href.startsWith('//'))) {
        const url = new URL(href, window.location.origin);

        // Allow same-origin navigation within app
        if (url.origin !== window.location.origin) {
          console.warn('[Sandbox] Blocked external navigation:', href);
          event.preventDefault();
          event.stopPropagation();
          triggerEscapeDetection('navigation');
        }
      }
    }
  };

  document.addEventListener('click', handleClick, true);
  return () => document.removeEventListener('click', handleClick, true);
}

// ============================================================================
// Input & Gesture Interception
// ============================================================================

/**
 * Blocked keyboard keys during playback
 */
const BLOCKED_KEYS = new Set([
  'f', 'F',           // Fullscreen
  'Escape',           // Exit
  ' ',                // Space (play/pause - we handle manually)
  'ArrowUp',          // Volume up
  'ArrowDown',        // Volume down
  'ArrowLeft',        // Seek back
  'ArrowRight',       // Seek forward
  'm', 'M',           // Mute
  'c', 'C',           // Captions
  'k', 'K',           // Play/pause
  'j', 'J',           // Seek back 10s
  'l', 'L',           // Seek forward 10s
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', // Seek to %
]);

/**
 * Sets up keyboard interception
 */
function setupKeyboardInterception(): () => void {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (!state.isNavigationLocked) return;

    if (BLOCKED_KEYS.has(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      // Special handling for Escape - trigger escape detection
      if (event.key === 'Escape') {
        triggerEscapeDetection('fullscreen');
      }
    }
  };

  // Use capture phase to intercept before iframe
  window.addEventListener('keydown', handleKeyDown, { capture: true });
  return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
}

/**
 * Sets up context menu (right-click) blocking
 */
function setupContextMenuBlock(): () => void {
  const handleContextMenu = (event: MouseEvent) => {
    if (state.isNavigationLocked) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  document.addEventListener('contextmenu', handleContextMenu, true);
  return () => document.removeEventListener('contextmenu', handleContextMenu, true);
}

/**
 * Sets up long-press blocking for touch devices
 */
function setupLongPressBlock(): () => void {
  const handleTouchStart = (event: TouchEvent) => {
    if (!state.isNavigationLocked) return;

    state.longPressTimer = window.setTimeout(() => {
      // Long press detected - prevent default context menu
      event.preventDefault();
    }, LONG_PRESS_THRESHOLD);
  };

  const handleTouchEnd = () => {
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
  };

  const handleTouchMove = () => {
    if (state.longPressTimer) {
      clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
  };

  document.addEventListener('touchstart', handleTouchStart, { passive: false, capture: true });
  document.addEventListener('touchend', handleTouchEnd, { capture: true });
  document.addEventListener('touchmove', handleTouchMove, { capture: true });

  return () => {
    document.removeEventListener('touchstart', handleTouchStart, { capture: true } as EventListenerOptions);
    document.removeEventListener('touchend', handleTouchEnd, { capture: true });
    document.removeEventListener('touchmove', handleTouchMove, { capture: true });
  };
}

/**
 * Blocks double-click (potential fullscreen trigger)
 */
function setupDoubleClickBlock(): () => void {
  const handleDoubleClick = (event: MouseEvent) => {
    if (state.isNavigationLocked) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  document.addEventListener('dblclick', handleDoubleClick, true);
  return () => document.removeEventListener('dblclick', handleDoubleClick, true);
}

/**
 * Blocks drag and drop outside player
 */
function setupDragBlock(): () => void {
  const handleDragStart = (event: DragEvent) => {
    if (state.isNavigationLocked) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  document.addEventListener('dragstart', handleDragStart, true);
  return () => document.removeEventListener('dragstart', handleDragStart, true);
}

// ============================================================================
// Fullscreen Containment
// ============================================================================

/**
 * Intercepts fullscreen requests to use pseudo-fullscreen instead
 */
function setupFullscreenInterception(): () => void {
  const originalRequestFullscreen = Element.prototype.requestFullscreen;

  Element.prototype.requestFullscreen = function (...args) {
    if (state.isNavigationLocked) {
      console.warn('[Sandbox] Blocked requestFullscreen - use pseudo-fullscreen instead');
      triggerEscapeDetection('fullscreen');
      return Promise.reject(new Error('Fullscreen blocked by sandbox'));
    }
    return originalRequestFullscreen.apply(this, args);
  };

  // Also block vendor-prefixed versions
  const prefixedMethods = [
    'webkitRequestFullscreen',
    'mozRequestFullScreen',
    'msRequestFullscreen',
  ];

  const originalMethods: Record<string, Function> = {};

  prefixedMethods.forEach(method => {
    if ((Element.prototype as any)[method]) {
      originalMethods[method] = (Element.prototype as any)[method];
      (Element.prototype as any)[method] = function (...args: any[]) {
        if (state.isNavigationLocked) {
          console.warn(`[Sandbox] Blocked ${method}`);
          return Promise.reject(new Error('Fullscreen blocked by sandbox'));
        }
        return originalMethods[method].apply(this, args);
      };
    }
  });

  // Listen for fullscreenchange and exit if in locked mode
  const handleFullscreenChange = () => {
    if (document.fullscreenElement && state.isNavigationLocked) {
      console.warn('[Sandbox] Exiting unexpected fullscreen');
      document.exitFullscreen?.().catch(() => { });
      triggerEscapeDetection('fullscreen');
    }
  };

  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

  return () => {
    Element.prototype.requestFullscreen = originalRequestFullscreen;
    prefixedMethods.forEach(method => {
      if (originalMethods[method]) {
        (Element.prototype as any)[method] = originalMethods[method];
      }
    });
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
  };
}

// ============================================================================
// Initialization & Cleanup
// ============================================================================

/**
 * Initializes all sandbox security measures
 */
export function initSandboxSecurity(): void {
  if (state.isInitialized) {
    console.warn('[Sandbox] Already initialized');
    return;
  }

  console.log('[Sandbox] Initializing security layers...');

  // Escape Detection - Only postMessage filtering (not blur/visibility which are too sensitive)
  state.cleanupFunctions.push(setupPostMessageFilter());

  // Navigation Locking
  state.cleanupFunctions.push(setupPopstateInterception());
  state.cleanupFunctions.push(setupWindowOpenBlock());
  state.cleanupFunctions.push(setupTargetBlankBlock());
  state.cleanupFunctions.push(setupAnchorInterception());

  // Input Interception
  state.cleanupFunctions.push(setupKeyboardInterception());
  state.cleanupFunctions.push(setupContextMenuBlock());
  state.cleanupFunctions.push(setupLongPressBlock());
  state.cleanupFunctions.push(setupDoubleClickBlock());
  state.cleanupFunctions.push(setupDragBlock());

  // Fullscreen Containment
  state.cleanupFunctions.push(setupFullscreenInterception());

  state.isInitialized = true;
  console.log('[Sandbox] Security layers active');
}

/**
 * Cleans up all sandbox security measures
 */
export function cleanupSandboxSecurity(): void {
  if (!state.isInitialized) return;

  console.log('[Sandbox] Cleaning up security layers...');

  state.cleanupFunctions.forEach(cleanup => {
    try {
      cleanup();
    } catch (err) {
      console.error('[Sandbox] Cleanup error:', err);
    }
  });

  state.cleanupFunctions = [];
  state.escapeHandlers.clear();
  state.isInitialized = false;
  state.isNavigationLocked = false;
  state.isPlaying = false;

  console.log('[Sandbox] Cleanup complete');
}

/**
 * Gets the current sandbox state (for debugging)
 */
export function getSandboxState(): Readonly<Pick<SandboxState, 'isInitialized' | 'isNavigationLocked' | 'isPlaying'>> {
  return {
    isInitialized: state.isInitialized,
    isNavigationLocked: state.isNavigationLocked,
    isPlaying: state.isPlaying,
  };
}
