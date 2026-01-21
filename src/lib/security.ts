// Security utilities for input validation and sanitization

/**
 * Validates that a video ID conforms to YouTube's expected format
 * @param videoId - The video ID to validate
 * @returns boolean indicating if the video ID is valid
 */
export function isValidVideoId(videoId: string): boolean {
  if (!videoId) return false;
  // YouTube video IDs are exactly 11 characters and contain only alphanumeric, dash, or underscore
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

/**
 * Sanitizes video titles to prevent XSS attacks
 * @param title - The title to sanitize
 * @returns sanitized title string
 */
export function sanitizeVideoTitle(title: string): string {
  if (!title) return '';
  
  // Remove potentially harmful HTML characters
  return title
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

/**
 * Validates and sanitizes YouTube URLs
 * @param url - The URL to validate
 * @returns validated and cleaned URL or null if invalid
 */
export function validateYouTubeUrl(url: string): string | null {
  if (!url) return null;
  
  try {
    // Basic URL validation
    const cleanedUrl = url.trim();
    if (!/^https?:\/\/(?:www\.)?youtube\.com\/|^https?:\/\/youtu\.be\//.test(cleanedUrl)) {
      return null;
    }
    
    return cleanedUrl;
  } catch {
    return null;
  }
}

/**
 * Creates a secure random salt for cryptographic operations
 * @returns Promise resolving to hex-encoded salt
 */
export async function generateSecureSalt(): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Securely hashes data with a salt
 * @param data - Data to hash
 * @param salt - Salt to use (hex encoded)
 * @returns Promise resolving to hex-encoded hash
 */
export async function secureHash(data: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const saltBytes = new Uint8Array(salt.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  const dataBytes = encoder.encode(data);
  
  // Combine data and salt
  const combined = new Uint8Array(dataBytes.length + saltBytes.length);
  combined.set(dataBytes, 0);
  combined.set(saltBytes, dataBytes.length);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', combined);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Validates PIN format (numeric, reasonable length)
 * @param pin - PIN to validate
 * @returns boolean indicating if PIN is valid
 */
export function isValidPin(pin: string): boolean {
  if (!pin) return false;
  // PIN should be numeric and between 4-12 digits
  return /^\d{4,12}$/.test(pin);
}