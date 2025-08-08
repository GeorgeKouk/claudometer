/**
 * API Handlers - Main public API endpoint handlers
 * Handles sentiment data, time series, topics, keywords, and recent posts
 */

// Import service functions
import { getCacheKey, getFromCache, setCache, addCacheHeaders } from '../services/cache.service.js';
import { getTopicColor } from '../services/database.service.js';
import { getCorsHeaders } from '../utils/cors.js';
import { getTimeAgo } from '../utils/helpers.js';

/**
 * Gets current sentiment data for specified time period across all platforms
 * @param {Object} env - Cloudflare Workers environment
 * @param {URL} url - Request URL with query parameters
 * @returns {Response} JSON response with multi-platform current sentiment metrics
 */
export async function getCurrentSentiment(env, url) {
  try {
    const period = url?.searchParams?.get('period') || '24h';
    const validPeriods = ['24h', '7d', '30d', 'all'];
    
    if (!validPeriods.includes(period)) {
      return new Response(JSON.stringify({ error: 'Invalid period. Use: 24h, 7d, 30d, all' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }
    
    // Check cache first (now platform-aware)
    const cacheKey = getCacheKey('current-sentiment', { period });
    const cached = await getFromCache(cacheKey, env);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
      });
    }
    
    // Get available platforms
    const platformsResult = await env.DB.prepare('SELECT id, display_name, color FROM platforms WHERE active = 1 ORDER BY id').all();
    const platforms = platformsResult.results;
    
    const data = {};
    
    // Get sentiment data for each platform
    for (const platform of platforms) {
      const platformId = platform.id;
      
      // Get latest sentiment (most recent data point for this platform)
      const latestStmt = env.DB.prepare(`
        SELECT weighted_sentiment, post_count, comment_count 
        FROM sentiment_hourly 
        WHERE platform_id = ? 
        ORDER BY hour DESC 
        LIMIT 1
      `);
      const latestResult = await latestStmt.bind(platformId).first();
      
      // Get average sentiment for the selected period
      const daysBack = period === '24h' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 365;
      const avgStmt = env.DB.prepare(`
        SELECT AVG(weighted_sentiment) as avg_sentiment, SUM(post_count) as total_posts, SUM(comment_count) as total_comments
        FROM sentiment_hourly 
        WHERE platform_id = ? AND hour >= datetime('now', '-${daysBack} days')
      `);
      const avgResult = await avgStmt.bind(platformId).first();
      
      data[platformId] = {
        display_name: platform.display_name,
        color: platform.color,
        latest_sentiment: latestResult ? latestResult.weighted_sentiment : 0.5,
        avg_sentiment: avgResult ? avgResult.avg_sentiment || 0.5 : 0.5,
        latest_post_count: latestResult ? latestResult.post_count || 0 : 0,
        latest_comment_count: latestResult ? latestResult.comment_count || 0 : 0,
        avg_post_count: avgResult ? avgResult.total_posts || 0 : 0,
        avg_comment_count: avgResult ? avgResult.total_comments || 0 : 0
      };
    }
    
    // Cache the result
    await setCache(cacheKey, data, env);
    
    return new Response(JSON.stringify(data), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  } catch (error) {
    console.error('getCurrentSentiment error:', error);
    // Return fallback data for all platforms
    const fallbackData = {
      claude: { 
        display_name: 'Claude AI',
        color: '#8B4513',
        latest_sentiment: 0.5, 
        avg_sentiment: 0.5, 
        latest_post_count: 0,
        latest_comment_count: 0,
        avg_post_count: 0, 
        avg_comment_count: 0 
      },
      chatgpt: {
        display_name: 'ChatGPT',
        color: '#10A37F',
        latest_sentiment: 0.5, 
        avg_sentiment: 0.5, 
        latest_post_count: 0,
        latest_comment_count: 0,
        avg_post_count: 0, 
        avg_comment_count: 0 
      },
      gemini: {
        display_name: 'Google Gemini',
        color: '#4285F4',
        latest_sentiment: 0.5, 
        avg_sentiment: 0.5, 
        latest_post_count: 0,
        latest_comment_count: 0,
        avg_post_count: 0, 
        avg_comment_count: 0 
      }
    };
    return new Response(JSON.stringify(fallbackData), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  }
}

/**
 * Gets time series sentiment data with events across all platforms
 * @param {Object} env - Cloudflare Workers environment  
 * @param {URL} url - Request URL with query parameters
 * @returns {Response} JSON response with multi-platform hourly or daily sentiment data
 */
export async function getTimeSeriesData(env, url) {
  try {
    const period = url.searchParams.get('period') || '24h';
    const validPeriods = ['24h', '7d', '30d', 'all'];
    
    if (!validPeriods.includes(period)) {
      return new Response(JSON.stringify({ error: 'Invalid period. Use: 24h, 7d, 30d, all' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }
    
    // Check cache first
    const cacheKey = getCacheKey('hourly-data', { period });
    const cached = await getFromCache(cacheKey, env);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
      });
    }
    
    let data;
    if (period === '24h') {
      data = await getMultiPlatformHourlyDataUncached(env);
    } else {
      data = await getMultiPlatformDailyAggregatedDataUncached(env, period);
    }
    
    // Cache the result
    await setCache(cacheKey, data, env);
    
    return new Response(JSON.stringify(data), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  } catch (error) {
    console.error('getTimeSeriesData error:', error);
    return new Response(JSON.stringify({ 
      data: [], 
      events: [], 
      platforms: [] 
    }), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  }
}

/**
 * Gets topic distribution data - grouped by platform by default, single platform if specified
 * @param {Object} env - Cloudflare Workers environment
 * @param {URL} url - Request URL with query parameters
 * @returns {Response} JSON response with topic breakdown by platform or single platform array
 */
export async function getTopicData(env, url) {
  try {
    const period = url?.searchParams?.get('period') || '24h';
    const platform = url?.searchParams?.get('platform'); // Optional platform filter
    const validPeriods = ['24h', '7d', '30d', 'all'];
    
    if (!validPeriods.includes(period)) {
      return new Response(JSON.stringify({ error: 'Invalid period. Use: 24h, 7d, 30d, all' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }
    
    // Check cache first (include platform in cache key if specified)
    const cacheKey = getCacheKey('topics', { period, platform });
    const cached = await getFromCache(cacheKey, env);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
      });
    }
    
    // Calculate date filter based on period
    const daysBack = period === '24h' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 365;
    const dateFilter = period === 'all' ? '' : `AND processed_at > datetime("now", "-${daysBack} days")`;
    
    // Single platform request - return array format (existing logic)
    if (platform) {
      // Get topics from category field with post/comment counts and weighted sentiment
      const postsQuery = `SELECT category, COUNT(*) as count, AVG(sentiment) as avg_sentiment FROM posts WHERE category IS NOT NULL ${dateFilter} AND platform_id = ? GROUP BY category`;
      const commentsQuery = `SELECT category, COUNT(*) as count, AVG(sentiment) as avg_sentiment FROM comments WHERE category IS NOT NULL ${dateFilter} AND platform_id = ? GROUP BY category`;
      
      const postsStmt = env.DB.prepare(postsQuery);
      const commentsStmt = env.DB.prepare(commentsQuery);
      
      const [postsResults, commentsResults] = await Promise.all([
        postsStmt.bind(platform).all(),
        commentsStmt.bind(platform).all()
      ]);
      
      // Combine and weight the data (posts = 3x weight, comments = 1x weight)
      const categoryMap = {};
      
      postsResults.results.forEach(row => {
        categoryMap[row.category] = {
          name: row.category,
          totalSentiment: (row.avg_sentiment || 0.5) * row.count * 3,
          totalWeight: row.count * 3,
          count: row.count * 3,
          actualCount: row.count
        };
      });
      
      commentsResults.results.forEach(row => {
        if (categoryMap[row.category]) {
          categoryMap[row.category].totalSentiment += (row.avg_sentiment || 0.5) * row.count;
          categoryMap[row.category].totalWeight += row.count;
          categoryMap[row.category].count += row.count;
          categoryMap[row.category].actualCount += row.count;
        } else {
          categoryMap[row.category] = {
            name: row.category,
            totalSentiment: (row.avg_sentiment || 0.5) * row.count,
            totalWeight: row.count,
            count: row.count,
            actualCount: row.count
          };
        }
      });
      
      const total = Object.values(categoryMap).reduce((sum, cat) => sum + cat.count, 0);
      
      const topicData = await Promise.all(
        Object.values(categoryMap).map(async cat => ({
          name: cat.name,
          value: total > 0 ? Math.round((cat.count / total) * 100) : 0,
          sentiment: cat.totalWeight > 0 ? cat.totalSentiment / cat.totalWeight : 0.5,
          color: await getTopicColor(cat.name, env),
          referenceCount: cat.actualCount
        }))
      );
      
      await setCache(cacheKey, topicData, env);
      
      return new Response(JSON.stringify(topicData), {
        headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
      });
    }
    
    // Multi-platform request - return platform-grouped object
    // Get available platforms
    const platformsResult = await env.DB.prepare('SELECT id FROM platforms WHERE active = 1 ORDER BY id').all();
    const platforms = platformsResult.results.map(p => p.id);
    
    const platformData = {};
    
    // Get data for each platform
    for (const platformId of platforms) {
      const postsQuery = `SELECT category, COUNT(*) as count, AVG(sentiment) as avg_sentiment FROM posts WHERE category IS NOT NULL ${dateFilter} AND platform_id = ? GROUP BY category`;
      const commentsQuery = `SELECT category, COUNT(*) as count, AVG(sentiment) as avg_sentiment FROM comments WHERE category IS NOT NULL ${dateFilter} AND platform_id = ? GROUP BY category`;
      
      const postsStmt = env.DB.prepare(postsQuery);
      const commentsStmt = env.DB.prepare(commentsQuery);
      
      const [postsResults, commentsResults] = await Promise.all([
        postsStmt.bind(platformId).all(),
        commentsStmt.bind(platformId).all()
      ]);
      
      // Combine and weight the data for this platform
      const categoryMap = {};
      
      postsResults.results.forEach(row => {
        categoryMap[row.category] = {
          name: row.category,
          totalSentiment: (row.avg_sentiment || 0.5) * row.count * 3,
          totalWeight: row.count * 3,
          count: row.count * 3,
          actualCount: row.count
        };
      });
      
      commentsResults.results.forEach(row => {
        if (categoryMap[row.category]) {
          categoryMap[row.category].totalSentiment += (row.avg_sentiment || 0.5) * row.count;
          categoryMap[row.category].totalWeight += row.count;
          categoryMap[row.category].count += row.count;
          categoryMap[row.category].actualCount += row.count;
        } else {
          categoryMap[row.category] = {
            name: row.category,
            totalSentiment: (row.avg_sentiment || 0.5) * row.count,
            totalWeight: row.count,
            count: row.count,
            actualCount: row.count
          };
        }
      });
      
      const total = Object.values(categoryMap).reduce((sum, cat) => sum + cat.count, 0);
      
      // Get top 10 topics for this platform
      platformData[platformId] = await Promise.all(
        Object.values(categoryMap)
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
          .map(async cat => ({
            name: cat.name,
            value: total > 0 ? Math.round((cat.count / total) * 100) : 0,
            sentiment: cat.totalWeight > 0 ? cat.totalSentiment / cat.totalWeight : 0.5,
            color: await getTopicColor(cat.name, env),
            referenceCount: cat.actualCount
          }))
      );
    }
    
    // Cache the result
    await setCache(cacheKey, platformData, env);
    
    return new Response(JSON.stringify(platformData), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  } catch (error) {
    console.error('Error in getTopicData:', error);
    // Return empty platform structure for fallback
    const fallback = platform ? [] : { claude: [], chatgpt: [], gemini: [] };
    return new Response(JSON.stringify(fallback), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  }
}

/**
 * Gets trending keywords data - grouped by platform by default, single platform if specified
 * @param {Object} env - Cloudflare Workers environment
 * @param {URL} url - Request URL with query parameters
 * @returns {Response} JSON response with keyword analysis by platform or single platform array
 */
export async function getKeywordData(env, url) {
  try {
    const period = url?.searchParams?.get('period') || '24h';
    const platform = url?.searchParams?.get('platform'); // Optional platform filter
    const validPeriods = ['24h', '7d', '30d', 'all'];
    
    if (!validPeriods.includes(period)) {
      return new Response(JSON.stringify({ error: 'Invalid period. Use: 24h, 7d, 30d, all' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }
    
    // Check cache first (include platform in cache key if specified)
    const cacheKey = getCacheKey('keywords', { period, platform });
    const cached = await getFromCache(cacheKey, env);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
      });
    }
    
    // Calculate date filter based on period
    const daysBack = period === '24h' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 365;
    const dateFilter = period === 'all' ? '' : `AND processed_at > datetime("now", "-${daysBack} days")`;
    
    // Single platform request - return array format (existing logic)
    if (platform) {
      // Get keywords from both posts and comments
      const postsQuery = `SELECT keywords, sentiment FROM posts WHERE keywords IS NOT NULL ${dateFilter} AND platform_id = ?`;
      const commentsQuery = `SELECT keywords, sentiment FROM comments WHERE keywords IS NOT NULL ${dateFilter} AND platform_id = ?`;
      
      const postsStmt = env.DB.prepare(postsQuery);
      const commentsStmt = env.DB.prepare(commentsQuery);
      
      const [postsResults, commentsResults] = await Promise.all([
        postsStmt.bind(platform).all(),
        commentsStmt.bind(platform).all()
      ]);
      
      const keywordCounts = {};
      const keywordSentiments = {};
      
      // Process posts (weighted sentiment)
      postsResults.results.forEach(row => {
        if (row.keywords) {
          try {
            const keywords = JSON.parse(row.keywords);
            keywords.forEach(keyword => {
              keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
              keywordSentiments[keyword] = keywordSentiments[keyword] || [];
              keywordSentiments[keyword].push(row.sentiment, row.sentiment, row.sentiment);
            });
          } catch (e) {
            const keywords = row.keywords.split(',');
            keywords.forEach(keyword => {
              keyword = keyword.trim();
              if (keyword) {
                keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
                keywordSentiments[keyword] = keywordSentiments[keyword] || [];
                keywordSentiments[keyword].push(row.sentiment, row.sentiment, row.sentiment);
              }
            });
          }
        }
      });
      
      // Process comments (1x sentiment weight)
      commentsResults.results.forEach(row => {
        if (row.keywords) {
          try {
            const keywords = JSON.parse(row.keywords);
            keywords.forEach(keyword => {
              keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
              keywordSentiments[keyword] = keywordSentiments[keyword] || [];
              keywordSentiments[keyword].push(row.sentiment);
            });
          } catch (e) {
            const keywords = row.keywords.split(',');
            keywords.forEach(keyword => {
              keyword = keyword.trim();
              if (keyword) {
                keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
                keywordSentiments[keyword] = keywordSentiments[keyword] || [];
                keywordSentiments[keyword].push(row.sentiment);
              }
            });
          }
        }
      });
      
      const keywordData = Object.entries(keywordCounts)
        .map(([keyword, count]) => ({
          keyword,
          count,
          sentiment: keywordSentiments[keyword].reduce((sum, s) => sum + s, 0) / keywordSentiments[keyword].length
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      
      await setCache(cacheKey, keywordData, env);
      
      return new Response(JSON.stringify(keywordData), {
        headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
      });
    }
    
    // Multi-platform request - return platform-grouped object
    // Get available platforms
    const platformsResult = await env.DB.prepare('SELECT id FROM platforms WHERE active = 1 ORDER BY id').all();
    const platforms = platformsResult.results.map(p => p.id);
    
    const platformData = {};
    
    // Get data for each platform
    for (const platformId of platforms) {
      const postsQuery = `SELECT keywords, sentiment FROM posts WHERE keywords IS NOT NULL ${dateFilter} AND platform_id = ?`;
      const commentsQuery = `SELECT keywords, sentiment FROM comments WHERE keywords IS NOT NULL ${dateFilter} AND platform_id = ?`;
      
      const postsStmt = env.DB.prepare(postsQuery);
      const commentsStmt = env.DB.prepare(commentsQuery);
      
      const [postsResults, commentsResults] = await Promise.all([
        postsStmt.bind(platformId).all(),
        commentsStmt.bind(platformId).all()
      ]);
      
      const keywordCounts = {};
      const keywordSentiments = {};
      
      // Process posts for this platform (weighted sentiment)
      postsResults.results.forEach(row => {
        if (row.keywords) {
          try {
            const keywords = JSON.parse(row.keywords);
            keywords.forEach(keyword => {
              keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
              keywordSentiments[keyword] = keywordSentiments[keyword] || [];
              keywordSentiments[keyword].push(row.sentiment, row.sentiment, row.sentiment);
            });
          } catch (e) {
            const keywords = row.keywords.split(',');
            keywords.forEach(keyword => {
              keyword = keyword.trim();
              if (keyword) {
                keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
                keywordSentiments[keyword] = keywordSentiments[keyword] || [];
                keywordSentiments[keyword].push(row.sentiment, row.sentiment, row.sentiment);
              }
            });
          }
        }
      });
      
      // Process comments for this platform (1x sentiment weight)  
      commentsResults.results.forEach(row => {
        if (row.keywords) {
          try {
            const keywords = JSON.parse(row.keywords);
            keywords.forEach(keyword => {
              keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
              keywordSentiments[keyword] = keywordSentiments[keyword] || [];
              keywordSentiments[keyword].push(row.sentiment);
            });
          } catch (e) {
            const keywords = row.keywords.split(',');
            keywords.forEach(keyword => {
              keyword = keyword.trim();
              if (keyword) {
                keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
                keywordSentiments[keyword] = keywordSentiments[keyword] || [];
                keywordSentiments[keyword].push(row.sentiment);
              }
            });
          }
        }
      });
      
      // Get top 15 keywords for this platform
      platformData[platformId] = Object.entries(keywordCounts)
        .map(([keyword, count]) => ({
          keyword,
          count,
          sentiment: keywordSentiments[keyword].reduce((sum, s) => sum + s, 0) / keywordSentiments[keyword].length
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);
    }
    
    // Cache the result
    await setCache(cacheKey, platformData, env);
    
    return new Response(JSON.stringify(platformData), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  } catch (error) {
    console.error('Error in getKeywordData:', error);
    // Return empty platform structure for fallback
    const fallback = platform ? [] : { claude: [], chatgpt: [], gemini: [] };
    return new Response(JSON.stringify(fallback), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  }
}

/**
 * Gets recent posts feed with platform information
 * @param {Object} env - Cloudflare Workers environment
 * @param {URL} url - Request URL with query parameters  
 * @returns {Response} JSON response with recent posts including platform info
 */
export async function getRecentPosts(env, url) {
  try {
    const period = url?.searchParams?.get('period') || '24h';
    const platform = url?.searchParams?.get('platform'); // Optional platform filter
    const validPeriods = ['24h', '7d', '30d', 'all'];
    
    if (!validPeriods.includes(period)) {
      return new Response(JSON.stringify({ error: 'Invalid period. Use: 24h, 7d, 30d, all' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }
    
    // Check cache first (include platform in cache key if specified)
    const cacheKey = getCacheKey('recent-posts', { period, platform });
    const cached = await getFromCache(cacheKey, env);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
      });
    }
    
    // Calculate date filter based on period
    const daysBack = period === '24h' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 365;
    const dateFilter = period === 'all' ? '' : `processed_at > datetime("now", "-${daysBack} days")`;
    
    // Build WHERE clause dynamically
    let whereClause = '';
    let bindings = [];
    
    if (dateFilter && platform) {
      whereClause = `WHERE ${dateFilter} AND platform_id = ?`;
      bindings = [platform];
    } else if (dateFilter) {
      whereClause = `WHERE ${dateFilter}`;
    } else if (platform) {
      whereClause = `WHERE platform_id = ?`;
      bindings = [platform];
    }
    
    const stmt = env.DB.prepare(`
      SELECT posts.id, posts.title, posts.subreddit, posts.sentiment, posts.created_at, posts.category, posts.platform_id,
             platforms.display_name as platform_name, platforms.color as platform_color
      FROM posts 
      LEFT JOIN platforms ON posts.platform_id = platforms.id
      ${whereClause}
      ORDER BY posts.processed_at DESC LIMIT 10
    `);
    const results = bindings.length > 0 ? await stmt.bind(...bindings).all() : await stmt.all();
    
    const recentPosts = results.results.map((row, index) => ({
      id: row.id,
      subreddit: row.subreddit, // Remove the hardcoded r/ prefix since frontend now handles this
      title: row.title,
      sentiment: row.sentiment || 0.5,
      category: row.category || 'Features',
      time: getTimeAgo(row.created_at),
      platform: {
        id: row.platform_id,
        name: row.platform_name || 'Unknown',
        color: row.platform_color || '#CCCCCC'
      }
    }));
    
    // Cache the result
    await setCache(cacheKey, recentPosts, env);
    
    return new Response(JSON.stringify(recentPosts), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  } catch (error) {
    return new Response(JSON.stringify([]), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  }
}

/**
 * Gets platform metadata and configuration
 * @param {Object} env - Cloudflare Workers environment
 * @param {URL} url - Request URL with query parameters
 * @returns {Response} JSON response with platform information
 */
export async function getPlatformData(env, url) {
  try {
    // Check cache first
    const cacheKey = getCacheKey('platforms', {});
    const cached = await getFromCache(cacheKey, env);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
      });
    }
    
    // Get platform data from database
    const stmt = env.DB.prepare('SELECT id, display_name, color, description, subreddits, active, icon FROM platforms ORDER BY id');
    const results = await stmt.all();
    
    const platforms = results.results.map(row => ({
      id: row.id,
      name: row.display_name,
      color: row.color,
      description: row.description,
      subreddits: JSON.parse(row.subreddits || '[]'),
      active: Boolean(row.active),
      icon: row.icon
    }));
    
    // Cache the result (platforms change rarely)
    await setCache(cacheKey, platforms, env, 3600); // Cache for 1 hour
    
    return new Response(JSON.stringify(platforms), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  } catch (error) {
    console.error('getPlatformData error:', error);
    // Return fallback platform data
    const fallbackPlatforms = [
      {
        id: 'claude',
        name: 'Claude AI',
        color: '#8B4513',
        description: 'Anthropic Claude AI assistant monitoring',
        subreddits: ['Anthropic', 'ClaudeAI', 'ClaudeCode'],
        active: true
      },
      {
        id: 'chatgpt',
        name: 'ChatGPT',
        color: '#10A37F',
        description: 'OpenAI ChatGPT monitoring',
        subreddits: ['ChatGPT', 'OpenAI', 'GPT4'],
        active: true
      },
      {
        id: 'gemini',
        name: 'Google Gemini',
        color: '#4285F4',
        description: 'Google Gemini AI monitoring',
        subreddits: ['GoogleAI', 'Bard', 'Gemini'],
        active: true
      }
    ];
    return new Response(JSON.stringify(fallbackPlatforms), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  }
}

// Helper functions for time series data
async function getHourlyDataUncached(env) {
  try {
    // Calculate 24 hours ago in UTC to match our stored timestamps
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString();
    
    // Get data for the last 24 hours with explicit timestamp comparison
    const stmt = env.DB.prepare(`
      SELECT hour, weighted_sentiment, post_count, comment_count 
      FROM sentiment_hourly 
      WHERE hour >= ?
      ORDER BY hour ASC
    `);
    const results = await stmt.bind(twentyFourHoursAgo).all();
    
    // Get events for the last 24 hours (with some buffer for timezone issues)
    const eventsStmt = env.DB.prepare(`
      SELECT id, title, description, event_date, event_type, url
      FROM events 
      WHERE event_date >= datetime(?, '-2 hours') AND event_date <= datetime('now', '+2 hours')
      ORDER BY event_date ASC
    `);
    const eventsResults = await eventsStmt.bind(twentyFourHoursAgo).all();
    
    // Transform events data
    const events = eventsResults.results.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      date: row.event_date,
      type: row.event_type,
      url: row.url
    }));
    
    // Transform database results and assign each event to its closest time point
    const hourlyData = results.results.map(row => ({
      time: row.hour,
      sentiment: row.weighted_sentiment || 0.5,
      post_count: row.post_count || 0,
      comment_count: row.comment_count || 0,
      posts: (row.post_count || 0) + (row.comment_count || 0),
      events: [] // Initialize empty, will be populated below
    }));
    
    // Assign each event to its closest data point (avoid duplicates)
    events.forEach(event => {
      const eventTime = new Date(event.date).getTime();
      let closestDataPoint = hourlyData[0];
      let minDiff = Math.abs(new Date(hourlyData[0].time).getTime() - eventTime);
      
      hourlyData.forEach(dataPoint => {
        const diff = Math.abs(new Date(dataPoint.time).getTime() - eventTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestDataPoint = dataPoint;
        }
      });
      
      closestDataPoint.events.push(event);
    });
    
    // Clean up empty events arrays
    hourlyData.forEach(dataPoint => {
      if (dataPoint.events.length === 0) {
        dataPoint.events = undefined;
      }
    });
    
    return hourlyData;
  } catch (error) {
    console.error('Error in getHourlyDataUncached:', error);
    return [];
  }
}

async function getDailyAggregatedDataUncached(env, period) {
  try {
    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 365; // 'all' = 1 year max
    
    const stmt = env.DB.prepare(`
      SELECT 
        date(hour) as date,
        AVG(weighted_sentiment) as sentiment,
        SUM(post_count) as post_count,
        SUM(comment_count) as comment_count,
        SUM(post_count + comment_count) as total_posts
      FROM sentiment_hourly 
      WHERE hour >= datetime('now', '-${daysBack} days')
      GROUP BY date(hour)
      ORDER BY date DESC
    `);
    
    const results = await stmt.all();
    
    // Get events for the selected period (with timezone buffer)
    const eventsStmt = env.DB.prepare(`
      SELECT id, title, description, event_date, event_type, url
      FROM events 
      WHERE event_date >= datetime('now', '-${daysBack} days', '-2 hours') 
        AND event_date <= datetime('now', '+2 hours')
      ORDER BY event_date ASC
    `);
    const eventsResults = await eventsStmt.all();
    
    // Transform events data
    const events = eventsResults.results.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      date: row.event_date,
      type: row.event_type,
      url: row.url
    }));
    
    // Transform database results and merge events into closest time points
    const dailyData = results.results.map(row => {
      const dataPointTime = new Date(row.date + 'T12:00:00Z').getTime(); // Use noon for daily data points
      
      // Find events within 12 hours of this data point (half day for daily data)
      const nearbyEvents = events.filter(event => {
        const eventTime = new Date(event.date).getTime();
        const timeDiff = Math.abs(eventTime - dataPointTime);
        return timeDiff <= (12 * 60 * 60 * 1000); // 12 hours in milliseconds
      });
      
      return {
        time: row.date + 'T12:00:00Z',
        sentiment: row.sentiment || 0.5,
        post_count: row.post_count || 0,
        comment_count: row.comment_count || 0,
        posts: row.total_posts || 0,
        events: nearbyEvents.length > 0 ? nearbyEvents : undefined
      };
    }).reverse(); // Frontend expects chronological order
    
    return dailyData;
  } catch (error) {
    return [];
  }
}

// New multi-platform helper functions

async function getMultiPlatformHourlyDataUncached(env) {
  try {
    // Get available platforms
    const platformsResult = await env.DB.prepare('SELECT id, display_name, color FROM platforms WHERE active = 1 ORDER BY id').all();
    const platforms = platformsResult.results;
    
    // Get data for all platforms for the last 24 hours - use SQLite native datetime
    const stmt = env.DB.prepare(`
      SELECT hour, platform_id, weighted_sentiment, post_count, comment_count 
      FROM sentiment_hourly 
      WHERE hour >= datetime('now', '-24 hours')
      ORDER BY hour ASC, platform_id ASC
    `);
    const results = await stmt.all();
    
    // Get events for the last 24 hours (platform-agnostic events for now)
    const eventsStmt = env.DB.prepare(`
      SELECT id, title, description, event_date, event_type, url
      FROM events 
      WHERE event_date >= datetime('now', '-24 hours') AND event_date <= datetime('now', '+2 hours')
      ORDER BY event_date ASC
    `);
    const eventsResults = await eventsStmt.all();
    
    // Transform events data
    const events = eventsResults.results.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      date: row.event_date,
      type: row.event_type,
      url: row.url
    }));
    
    // Group data by hour
    const timeMap = {};
    results.results.forEach(row => {
      const time = row.hour;
      if (!timeMap[time]) {
        timeMap[time] = {};
      }
      
      timeMap[time][row.platform_id] = {
        sentiment: row.weighted_sentiment || 0.5,
        post_count: row.post_count || 0,
        comment_count: row.comment_count || 0,
        posts: (row.post_count || 0) + (row.comment_count || 0)
      };
    });
    
    // Convert to array format
    const hourlyData = Object.keys(timeMap).sort().map(time => ({
      time,
      platforms: timeMap[time]
    }));
    
    // Create platform metadata
    const platformsMetadata = platforms.map(p => ({
      id: p.id,
      name: p.display_name,
      color: p.color
    }));
    
    return {
      data: hourlyData,
      events: events,
      platforms: platformsMetadata
    };
  } catch (error) {
    console.error('Error in getMultiPlatformHourlyDataUncached:', error);
    return {
      data: [],
      events: [],
      platforms: []
    };
  }
}

async function getMultiPlatformDailyAggregatedDataUncached(env, period) {
  try {
    const daysBack = period === '7d' ? 7 : period === '30d' ? 30 : 365; // 'all' = 1 year max
    
    // Get available platforms
    const platformsResult = await env.DB.prepare('SELECT id, display_name, color FROM platforms WHERE active = 1 ORDER BY id').all();
    const platforms = platformsResult.results;
    
    const stmt = env.DB.prepare(`
      SELECT 
        date(hour) as date,
        platform_id,
        AVG(weighted_sentiment) as sentiment,
        SUM(post_count) as post_count,
        SUM(comment_count) as comment_count,
        SUM(post_count + comment_count) as total_posts
      FROM sentiment_hourly 
      WHERE hour >= datetime('now', '-${daysBack} days')
      GROUP BY date(hour), platform_id
      ORDER BY date DESC, platform_id ASC
    `);
    
    const results = await stmt.all();
    
    // Get events for the selected period (with timezone buffer)
    const eventsStmt = env.DB.prepare(`
      SELECT id, title, description, event_date, event_type, url
      FROM events 
      WHERE event_date >= datetime('now', '-${daysBack} days', '-2 hours') 
        AND event_date <= datetime('now', '+2 hours')
      ORDER BY event_date ASC
    `);
    const eventsResults = await eventsStmt.all();
    
    // Transform events data
    const events = eventsResults.results.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      date: row.event_date,
      type: row.event_type,
      url: row.url
    }));
    
    // Group data by date
    const dateMap = {};
    results.results.forEach(row => {
      const date = row.date;
      if (!dateMap[date]) {
        dateMap[date] = {};
      }
      
      dateMap[date][row.platform_id] = {
        sentiment: row.sentiment || 0.5,
        post_count: row.post_count || 0,
        comment_count: row.comment_count || 0,
        posts: row.total_posts || 0
      };
    });
    
    // Convert to array format
    const dailyData = Object.keys(dateMap).sort().reverse().map(date => ({
      time: date + 'T00:00:00Z', // Standardize format
      platforms: dateMap[date]
    }));
    
    // Create platform metadata
    const platformsMetadata = platforms.map(p => ({
      id: p.id,
      name: p.display_name,
      color: p.color
    }));
    
    return {
      data: dailyData,
      events: events,
      platforms: platformsMetadata
    };
  } catch (error) {
    console.error('Error in getMultiPlatformDailyAggregatedDataUncached:', error);
    return {
      data: [],
      events: [],
      platforms: []
    };
  }
}