/**
 * Cache Service - Cloudflare KV cache management
 * Handles cache key generation, reading, writing, and invalidation
 */

/**
 * Generates a cache key for the given endpoint and parameters
 * @param {string} endpoint - API endpoint name
 * @param {Object} params - Query parameters to include in cache key
 * @returns {string} Formatted cache key
 */
export function getCacheKey(endpoint, params = {}) {
  const paramString = Object.keys(params).length > 0 ? 
    ':' + Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&') : '';
  return `claudometer:${endpoint}${paramString}`;
}

/**
 * Retrieves data from cache with TTL validation
 * @param {string} key - Cache key to retrieve
 * @param {Object} env - Cloudflare Workers environment
 * @returns {Object|null} Cached data or null if expired/missing
 */
export async function getFromCache(key, env) {
  try {
    const cached = await env.CLAUDOMETER_CACHE.get(key);
    if (!cached) return null;
    
    const data = JSON.parse(cached);
    const now = Date.now();
    
    // Dynamic cache TTL based on period
    let cacheTTL = 3300000; // Default 55 minutes for 24h
    if (key.includes('period=30d')) {
      cacheTTL = 14400000; // 4 hours for 30d
    } else if (key.includes('period=all')) {
      cacheTTL = 14400000; // 4 hours for all
    } else if (key.includes('period=7d')) {
      cacheTTL = 7200000; // 2 hours for 7d
    }
    
    // Check if cache is expired
    if (now - data.timestamp > cacheTTL) {
      // Cache expired, delete it
      await env.CLAUDOMETER_CACHE.delete(key);
      return null;
    }
    
    return data.content;
  } catch (error) {
    console.error('Cache read error:', error);
    return null;
  }
}

/**
 * Stores data in cache with timestamp
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 * @param {Object} env - Cloudflare Workers environment
 */
export async function setCache(key, data, env) {
  try {
    const cacheData = {
      content: data,
      timestamp: Date.now()
    };
    await env.CLAUDOMETER_CACHE.put(key, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Cache write error:', error);
  }
}

/**
 * Clears cache entries matching a pattern
 * @param {string} pattern - Pattern to match (prefix after 'claudometer:')
 * @param {Object} env - Cloudflare Workers environment
 */
export async function clearCachePattern(pattern, env) {
  try {
    // Get all keys that match pattern
    const list = await env.CLAUDOMETER_CACHE.list({ prefix: `claudometer:${pattern}` });
    
    // Delete all matching keys
    const deletePromises = list.keys.map(key => env.CLAUDOMETER_CACHE.delete(key.name));
    await Promise.all(deletePromises);
    
    console.log(`Cleared ${list.keys.length} cache entries for pattern: ${pattern}`);
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}

/**
 * Adds browser cache headers to HTTP response headers
 * @param {Object} headers - Existing headers object
 * @returns {Object} Headers with cache control directives
 */
export function addCacheHeaders(headers = {}) {
  return {
    ...headers,
    'Cache-Control': 'public, max-age=300, s-maxage=300', // 5 minutes browser cache
    'Vary': 'Accept-Encoding'
  };
}