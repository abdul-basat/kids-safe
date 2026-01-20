// In-memory cache for YouTube API responses
// Reduces duplicate API calls and improves performance

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
    data: any;
    timestamp: number;
}

export class APICache {
    private cache = new Map<string, CacheEntry>();

    get(key: string): any | null {
        const entry = this.cache.get(key);
        if (!entry) {
            console.log(`[Cache] Miss: ${key}`);
            return null;
        }

        // Check if expired
        if (Date.now() - entry.timestamp > CACHE_DURATION) {
            console.log(`[Cache] Expired: ${key}`);
            this.cache.delete(key);
            return null;
        }

        console.log(`[Cache] Hit: ${key}`);
        return entry.data;
    }

    set(key: string, data: any): void {
        this.cache.set(key, { data, timestamp: Date.now() });
        console.log(`[Cache] Saved: ${key}`);
    }

    clear(): void {
        this.cache.clear();
        console.log('[Cache] Cleared all entries');
    }

    size(): number {
        return this.cache.size;
    }
}

// Singleton instance
export const apiCache = new APICache();
