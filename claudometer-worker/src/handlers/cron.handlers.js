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
    
    // Store both in database
    await storeInDatabase(analyzedPosts, analyzedComments, env);
    
    // Clear all caches after new data collection
    await clearCachePattern('', env); // Clear all claudometer cache entries
    console.log('Cache cleared after data collection');
    
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