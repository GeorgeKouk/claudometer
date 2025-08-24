/**
 * Claudometer API - Multi-platform AI sentiment analysis
 * Main worker entry point and request router
 */

// Import utility functions
import { sanitizeUserInput, validateOutput } from './utils/validation.js';
import { getCorsHeaders, getDynamicCorsHeaders } from './utils/cors.js';
import { getTimeAgo, getTruncatedText } from './utils/helpers.js';

// Import service functions
import { getCacheKey, getFromCache, setCache, clearCachePattern, addCacheHeaders } from './services/cache.service.js';
import { storeInDatabase, getTopicColor } from './services/database.service.js';
import { getRedditAccessToken, fetchRedditPosts } from './services/reddit.service.js';
import { analyzeWithOpenAI } from './services/ai.service.js';

// Import handler functions
import { getCurrentSentiment, getTimeSeriesData, getTopicData, getKeywordData, getRecentPosts, getPlatformData } from './handlers/api.handlers.js';
import { getDevPosts, reevaluateSentiments, rollbackSentiments, getEventsAdmin, getDevEvents, createEvent, updateEvent, deleteEvent, clearCache, manualCollectClaude, manualCollectChatGPT, manualCollectGemini, manualCollectAllPlatforms, manualCollectPlatform } from './handlers/dev.handlers.js';
import { collectRedditData } from './handlers/cron.handlers.js';
import { CLAUDE_PLATFORM, CHATGPT_PLATFORM, GEMINI_PLATFORM } from './config/platforms.js';


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Dynamic CORS headers based on environment
    const corsHeaders = getDynamicCorsHeaders(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }


    try {
      // Public API endpoints
      if (path === '/current-sentiment') {
        return await getCurrentSentiment(env, url);
      } else if (path === '/hourly-data') {
        return await getTimeSeriesData(env, url);
      } else if (path === '/categories') {
        return await getTopicData(env, url);
      } else if (path === '/topics') {
        return await getTopicData(env, url);
      } else if (path === '/keywords') {
        return await getKeywordData(env, url);
      } else if (path === '/recent-posts') {
        return await getRecentPosts(env, url);
      } else if (path === '/platforms') {
        return await getPlatformData(env, url);

      // Development endpoints (DEV_MODE_ENABLED required)
      } else if (path === '/dev/posts' && env.DEV_MODE_ENABLED === 'true') {
        return await getDevPosts(env, url);
      } else if (path === '/dev/reevaluate' && env.DEV_MODE_ENABLED === 'true') {
        return await reevaluateSentiments(request, env);
      } else if (path === '/dev/rollback' && env.DEV_MODE_ENABLED === 'true') {
        return await rollbackSentiments(request, env);
      } else if (path === '/dev/events-admin' && env.DEV_MODE_ENABLED === 'true') {
        return await getEventsAdmin(env);
      } else if (path === '/dev/events' && env.DEV_MODE_ENABLED === 'true') {
        if (request.method === 'GET') {
          return await getDevEvents(env);
        } else if (request.method === 'POST') {
          return await createEvent(request, env);
        }
      } else if (path.startsWith('/dev/events/') && env.DEV_MODE_ENABLED === 'true') {
        const eventId = path.split('/')[3];
        if (request.method === 'PUT') {
          return await updateEvent(request, env, eventId);
        } else if (request.method === 'DELETE') {
          return await deleteEvent(env, eventId);
        }
      } else if (path === '/dev/clear-cache' && env.DEV_MODE_ENABLED === 'true') {
        return await clearCache(env);
      
      // Manual data collection endpoints (DEV mode only)
      } else if (path === '/dev/collect/claude' && env.DEV_MODE_ENABLED === 'true') {
        return await manualCollectClaude(env);
      } else if (path === '/dev/collect/chatgpt' && env.DEV_MODE_ENABLED === 'true') {
        return await manualCollectChatGPT(env);
      } else if (path === '/dev/collect/gemini' && env.DEV_MODE_ENABLED === 'true') {
        return await manualCollectGemini(env);
      } else if (path === '/dev/collect/all' && env.DEV_MODE_ENABLED === 'true') {
        return await manualCollectAllPlatforms(env);
      } else if (path === '/dev/collect' && env.DEV_MODE_ENABLED === 'true') {
        return await manualCollectPlatform(env, url);
      } else if (path === '/') {
        return new Response('Claudometer API is running!', { headers: corsHeaders });
      }
      
      return new Response('Not found', { status: 404, headers: corsHeaders });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  },

  // Cron trigger for hourly data collection
  async scheduled(event, env, ctx) {
    try {
      const currentTime = new Date();
      const minutes = currentTime.getMinutes();
      
      // Determine which platform to collect data for based on cron schedule
      let platform = null;
      if (minutes >= 0 && minutes < 15) {
        platform = CLAUDE_PLATFORM;
      } else if (minutes >= 15 && minutes < 30) {
        platform = CHATGPT_PLATFORM;
      } else if (minutes >= 30 && minutes < 45) {
        platform = GEMINI_PLATFORM;
      }
      
      if (platform) {
        console.log(`Collecting data for ${platform.name} at ${currentTime.toISOString()}`);
        ctx.waitUntil(collectRedditData(env, platform.id));
      }
    } catch (error) {
      console.error('Scheduled job error:', error);
    }
  }
};