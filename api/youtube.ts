import type { VercelRequest, VercelResponse } from '@vercel/node';

// YouTube Data API v3 Proxy
// Securely handles API calls from the client with server-side API key

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

// Load multiple API keys for rotation
const API_KEYS = [
    process.env.YOUTUBE_API_KEY,
    process.env.YOUTUBE_API_KEY_2,
    process.env.YOUTUBE_API_KEY_3,
    process.env.YOUTUBE_API_KEY_4,
    process.env.YOUTUBE_API_KEY_5,
].filter(Boolean) as string[];

// Simple in-memory rate limiting (per IP)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per hour
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in ms

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    // Clean up expired entries
    if (entry && now > entry.resetTime) {
        rateLimitMap.delete(ip);
    }

    const current = rateLimitMap.get(ip) || { count: 0, resetTime: now + RATE_WINDOW };

    if (current.count >= RATE_LIMIT) {
        return { allowed: false, remaining: 0 };
    }

    current.count++;
    rateLimitMap.set(ip, current);

    return { allowed: true, remaining: RATE_LIMIT - current.count };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Check at least one API key is configured
    if (API_KEYS.length === 0) {
        console.error('[API Proxy] No YOUTUBE_API_KEY configured');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    // Get client IP for rate limiting
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        (req.headers['x-real-ip'] as string) ||
        'unknown';

    // Check rate limit
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
        return res.status(429).json({
            error: 'Rate limit exceeded',
            message: 'Too many requests. Please try again later.'
        });
    }

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());

    try {
        const { endpoint, ...params } = req.query;

        // Validate endpoint parameter
        if (!endpoint || typeof endpoint !== 'string') {
            return res.status(400).json({ error: 'Missing or invalid endpoint parameter' });
        }

        // Whitelist allowed endpoints for security
        const allowedEndpoints = ['videos', 'channels', 'playlists', 'playlistItems'];
        if (!allowedEndpoints.includes(endpoint)) {
            return res.status(400).json({ error: 'Invalid endpoint' });
        }

        // Try rotating through available API keys
        let lastError = null;
        let lastStatus = 500;

        for (let i = 0; i < API_KEYS.length; i++) {
            const currentKey = API_KEYS[i];

            // Build YouTube API URL
            const queryParams = new URLSearchParams();
            for (const [key, value] of Object.entries(params)) {
                if (typeof value === 'string') {
                    queryParams.append(key, value);
                }
            }
            queryParams.append('key', currentKey);

            const youtubeUrl = `${YOUTUBE_API_BASE}/${endpoint}?${queryParams.toString()}`;

            console.log(`[API Proxy] ${endpoint} request from ${ip} using key ${i + 1}`);

            // Fetch from YouTube API with Referer header for API key restrictions
            const response = await fetch(youtubeUrl, {
                headers: {
                    'Referer': 'https://kids.sprinthon.com/',
                },
            });

            const data = await response.json();

            // If quota exceeded (403 with specific reason), try next key
            if (response.status === 403 && data.error?.errors?.some((e: any) => e.reason === 'quotaExceeded')) {
                console.warn(`[API Proxy] Key ${i + 1} quota exceeded, trying next key...`);
                continue;
            }

            // Otherwise return the response (success or non-quota error)
            return res.status(response.status).json(data);
        }

        // If we get here, all keys failed (likely quota)
        res.status(403).json({
            error: 'Quota Exceeded',
            message: 'All API keys have exhausted their daily quota.'
        });

    } catch (error) {
        console.error('[API Proxy] Error:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
