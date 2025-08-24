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
    
    // Try to analyze with OpenAI, but save data regardless
    console.log(`Analyzing ALL ${posts.length} posts and ${comments.length} comments`);
    
    let analyzedPosts = [];
    let analyzedComments = [];
    
    try {
      // Analyze posts with platform-specific configuration
      analyzedPosts = await analyzeWithOpenAI(posts, env.OPENAI_API_KEY, env, platformConfig);
      
      // Analyze comments with platform-specific configuration  
      analyzedComments = await analyzeWithOpenAI(comments, env.OPENAI_API_KEY, env, platformConfig);
      
      console.log(`OpenAI analysis completed: ${analyzedPosts.length} posts, ${analyzedComments.length} comments`);
    } catch (aiError) {
      console.error('OpenAI analysis failed, storing posts with default sentiment:', aiError.message);
      
      // Store posts with default sentiment (50%) for later reevaluation
      analyzedPosts = posts.map(post => ({
        ...post,
        sentiment: 0.5,
        category: 'Unprocessed',
        keywords: JSON.stringify([])
      }));
      
      // Store comments with default sentiment (50%) for later reevaluation
      analyzedComments = comments.map(comment => ({
        ...comment,
        sentiment: 0.5,
        category: 'Unprocessed', 
        keywords: JSON.stringify([])
      }));
      
      console.log(`Stored ${analyzedPosts.length} posts and ${analyzedComments.length} comments with default values for later processing`);
    }
    
    // Store both in database with platform_id (this will always execute now)
    await storeInDatabase(analyzedPosts, analyzedComments, env, platformConfig.id);
    
    // Immediately refresh cache after data collection to ensure users always get cached responses
    console.log('Refreshing API cache after data collection...');
    await refreshAllEndpointCaches(env);
    console.log('Cache refresh completed - users will get instant responses');
    
    return new Response(`Collection completed: ${analyzedPosts.length} posts, ${analyzedComments.length} comments stored (some may need reevaluation)`);
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
 * Refresh all endpoint caches immediately after data collection
 * Ensures users always get cached responses without triggering DB queries
 */
export async function refreshAllEndpointCaches(env) {
  try {
    console.log('Refreshing all endpoint caches...');
    
    // List of all API endpoints to refresh
    const endpoints = [
      'current-sentiment',
      'hourly-data', 
      'topics',
      'keywords',
      'recent-posts',
      'platforms'
    ];
    
    const periods = ['24h']; // Main period used by frontend
    
    // Refresh cache for each endpoint
    const promises = [];
    for (const endpoint of endpoints) {
      if (endpoint === 'platforms') {
        // Platforms doesn't use period parameter
        promises.push(refreshEndpointCache(env, endpoint, ''));
      } else {
        // Refresh with default period
        promises.push(refreshEndpointCache(env, endpoint, `period=${periods[0]}`));
      }
    }
    
    await Promise.all(promises);
    console.log('All endpoint caches refreshed successfully');
  } catch (error) {
    console.error('Cache refresh error:', error);
    throw error;
  }
}

/**
 * Helper function to refresh cache for a specific endpoint
 */
async function refreshEndpointCache(env, endpoint, queryParams) {
  try {
    const url = queryParams ? `/${endpoint}?${queryParams}` : `/${endpoint}`;
    console.log(`Refreshing cache for: ${url}`);
    
    // Import the specific handler functions
    const { 
      getCurrentSentiment, 
      getTimeSeriesData, 
      getTopicData, 
      getKeywordData, 
      getRecentPosts, 
      getPlatformData 
    } = await import('./api.handlers.js');
    
    // Create a real URL object with the full URL
    const fullUrl = new URL(`https://api.claudometer.app${url}`);
    
    // Call the appropriate handler function
    let response;
    switch (endpoint) {
      case 'current-sentiment':
        response = await getCurrentSentiment(env, fullUrl);
        break;
      case 'hourly-data':
        response = await getTimeSeriesData(env, fullUrl);
        break;
      case 'topics':
        response = await getTopicData(env, fullUrl);
        break;
      case 'keywords':
        response = await getKeywordData(env, fullUrl);
        break;
      case 'recent-posts':
        response = await getRecentPosts(env, fullUrl);
        break;
      case 'platforms':
        response = await getPlatformData(env, fullUrl);
        break;
      default:
        console.warn(`Unknown endpoint for cache warming: ${endpoint}`);
        return;
    }
    
    // Consume the response to ensure cache is populated
    if (response && typeof response.text === 'function') {
      await response.text();
    }
    
  } catch (error) {
    console.error(`Error warming cache for ${endpoint}:`, error);
    // Don't throw - continue warming other endpoints
  }
}