// ============================================================================
// High-Performance In-Memory Cache & In-Flight Request Deduplication
// Eliminates redundant upstream queries and serves trending media in 0-1ms.
// ============================================================================
const crypto = require('crypto');

class MemoryCache {
  constructor(options = {}) {
    this.maxItems = options.maxItems || 1000;
    this.ttlMs = options.ttlMs || 10 * 60 * 1000; // 10 minutes default
    this.cache = new Map();
    this.inFlight = new Map();
    this.hits = 0;
    this.misses = 0;

    // Periodic cleanup every 60 seconds
    setInterval(() => this.prune(), 60000).unref();
  }

  hashKey(key) {
    if (typeof key !== 'string') return String(key);
    return crypto.createHash('md5').update(key.trim()).digest('hex');
  }

  get(key) {
    const k = this.hashKey(key);
    const entry = this.cache.get(k);
    if (!entry) {
      this.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(k);
      this.misses++;
      return null;
    }

    // Move to end for LRU refresh
    this.cache.delete(k);
    this.cache.set(k, entry);
    this.hits++;
    return entry.value;
  }

  set(key, value, customTtlMs) {
    const k = this.hashKey(key);
    const ttl = customTtlMs || this.ttlMs;

    // Evict oldest if exceeding capacity
    if (this.cache.size >= this.maxItems) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(k, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
  }

  /**
   * Single-Flight / In-Flight Request Deduplication
   * If 50 concurrent requests arrive for the exact same viral URL,
   * only 1 upstream request is dispatched. All 50 await the same Promise.
   */
  async dedupe(key, fn) {
    const k = this.hashKey(key);

    // 1. Check cache first
    const cached = this.get(key);
    if (cached) return cached;

    // 2. Check if a request is already in-flight for this key
    if (this.inFlight.has(k)) {
      return await this.inFlight.get(k);
    }

    // 3. Initiate request and register in inFlight map
    const promise = (async () => {
      try {
        const result = await fn();
        this.set(key, result);
        return result;
      } finally {
        this.inFlight.delete(k);
      }
    })();

    this.inFlight.set(k, promise);
    return await promise;
  }

  prune() {
    const now = Date.now();
    for (const [k, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(k);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxItems: this.maxItems,
      inFlightCount: this.inFlight.size,
      hits: this.hits,
      misses: this.misses,
      hitRatio: this.hits + this.misses > 0
        ? ((this.hits / (this.hits + this.misses)) * 100).toFixed(1) + '%'
        : '0%'
    };
  }
}

// Global Singleton Caches
const extractCache = new MemoryCache({ maxItems: 2000, ttlMs: 10 * 60 * 1000 }); // 10 min
const upscaleCache = new MemoryCache({ maxItems: 100, ttlMs: 30 * 60 * 1000 });  // 30 min

module.exports = {
  extractCache,
  upscaleCache,
  MemoryCache
};
