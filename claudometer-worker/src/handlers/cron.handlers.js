/**
 * Cron Handlers - Scheduled job handlers for data collection
 * Handles Reddit data collection and sentiment analysis
 */

// Import service functions
import { fetchRedditPosts } from '../services/reddit.service.js';
import { analyzeWithOpenAI } from '../services/ai.service.js';
import { storeInDatabase } from '../services/database.service.js';
import { clearCachePattern } from '../services/cache.service.js';
// Import platform configurations
import { getPlatformConfig, DEFAULT_PLATFORM } from '../config/platforms.js';

/**
 * Main Reddit data collection function for cron jobs
 * @param {Object} env - Cloudflare Workers environment
 * @param {string} platformId - Platform ID (optional, defaults to DEFAULT_PLATFORM)
 * @param {Array} subreddits - Optional array of subreddits to collect from (overrides platform config)
 * @returns {Response} Response with collection results
 */
export async function collectRedditData(env, platformId = DEFAULT_PLATFORM, subreddits = null) {
  try {
    // Get platform configuration
    const platformConfig = getPlatformConfig(platformId);
    console.log(`Starting Reddit data collection for platform: ${platformConfig.name}...`);
    console.log('Environment check:', {
      hasRedditClientId: !!env.REDDIT_CLIENT_ID,
      hasRedditClientSecret: !!env.REDDIT_CLIENT_SECRET,
      hasOpenAiKey: !!env.OPENAI_API_KEY,
      platform: platformConfig.name,
      subreddits: subreddits || platformConfig.subreddits
    });
    
    // Fetch posts using platform configuration
    const { posts, comments } = await fetchRedditPosts(env, platformConfig, subreddits);
    console.log(`Fetched ${posts.length} posts, ${comments.length} comments`);
    
    if (posts.length === 0) {
      console.error('ERROR: No posts fetched from Reddit - check API credentials');
      return new Response('No posts fetched from Reddit');
    }
    
    // Analyze ALL collected posts and comments to ensure data consistency
    console.log(`Analyzing ALL ${posts.length} posts and ${comments.length} comments`);
    
    // Analyze posts with platform-specific configuration
    const analyzedPosts = await analyzeWithOpenAI(posts, env.OPENAI_API_KEY, env, platformConfig);
    
    // Analyze comments with platform-specific configuration
    const analyzedComments = await analyzeWithOpenAI(comments, env.OPENAI_API_KEY, env, platformConfig);
    
    // Store both in database with platform_id
    await storeInDatabase(analyzedPosts, analyzedComments, env, platformConfig.id);
    
    // Cache will be refreshed at 0:00 every hour - no manual clearing needed
    console.log('Data collection completed - cache refresh scheduled for next hour');
    
    return new Response(`Collection completed: ${analyzedPosts.length} posts, ${analyzedComments.length} comments processed`);
  } catch (error) {
    console.error('Data collection error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

/**
 * Platform-specific data collection handlers
 */

/**
 * Claude AI data collection (current default)
 * @param {Object} env - Cloudflare Workers environment
 * @returns {Response} Response with collection results
 */
export async function collectClaudeData(env) {
  return await collectRedditData(env, 'claude');
}

/**
 * ChatGPT data collection
 * @param {Object} env - Cloudflare Workers environment
 * @returns {Response} Response with collection results
 */
export async function collectChatGPTData(env) {
  return await collectRedditData(env, 'chatgpt');
}

/**
 * Gemini data collection
 * @param {Object} env - Cloudflare Workers environment
 * @returns {Response} Response with collection results
 */
export async function collectGeminiData(env) {
  return await collectRedditData(env, 'gemini');
}

/**
 * Collects data for all platforms (for comprehensive monitoring)
 * @param {Object} env - Cloudflare Workers environment
 * @returns {Response} Response with collection results for all platforms
 */
export async function collectAllPlatformsData(env) {
  const results = [];
  const platforms = ['claude', 'chatgpt', 'gemini'];
  
  for (const platform of platforms) {
    try {
      console.log(`Collecting data for platform: ${platform}`);
      const result = await collectRedditData(env, platform);
      results.push(`${platform}: ${await result.text()}`);
    } catch (error) {
      console.error(`Error collecting data for ${platform}:`, error.message);
      results.push(`${platform}: Error - ${error.message}`);
    }
  }
  
  return new Response(`Multi-platform collection completed:\n${results.join('\n')}`);
}

/**
 * Warm all cache keys by making internal API calls
 * Runs at :45 minutes to refresh cache before next hour's data collection
 */
export async function warmCache(env) {
  try {
    console.log('Starting cache warming...');
    
    // List of all API endpoints to warm
    const endpoints = [
      'current-sentiment',
      'hourly-data', 
      'topics',
      'keywords',
      'recent-posts',
      'platforms'
    ];
    
    const periods = ['24h']; // Main period used by frontend
    
    // Warm cache for each endpoint
    const promises = [];
    for (const endpoint of endpoints) {
      if (endpoint === 'platforms') {
        // Platforms doesn't use period parameter
        promises.push(warmEndpoint(env, endpoint, ''));
      } else {
        // Warm with default period
        promises.push(warmEndpoint(env, endpoint, `period=${periods[0]}`));
      }
    }
    
    await Promise.all(promises);
    console.log('Cache warming completed successfully');
    
    return new Response('Cache warmed successfully');
  } catch (error) {
    console.error('Cache warming error:', error);
    return new Response(`Cache warming error: ${error.message}`, { status: 500 });
  }
}

/**
 * Helper function to warm a specific endpoint
 */
async function warmEndpoint(env, endpoint, queryParams) {
  try {
    const url = queryParams ? `/${endpoint}?${queryParams}` : `/${endpoint}`;
    console.log(`Warming cache for: ${url}`);
    
    // Import the handler dynamically to avoid circular imports
    const { handleApiRequest } = await import('./api.handlers.js');
    
    // Create a mock request to warm the cache
    const mockRequest = new Request(`https://api.claudometer.app${url}`, {
      method: 'GET'
    });
    
    // Call the API handler to populate cache
    await handleApiRequest(mockRequest, env, endpoint, queryParams);
    
  } catch (error) {
    console.error(`Error warming cache for ${endpoint}:`, error);
    // Don't throw - continue warming other endpoints
  }
}