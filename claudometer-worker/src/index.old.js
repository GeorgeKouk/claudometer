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
import { getCurrentSentiment, getTimeSeriesData, getTopicData, getKeywordData, getRecentPosts } from './handlers/api.handlers.js';
import { getDevPosts, reevaluateSentiments, rollbackSentiments, getEventsAdmin, getDevEvents, createEvent, updateEvent, deleteEvent, clearCache } from './handlers/dev.handlers.js';
import { collectRedditData } from './handlers/cron.handlers.js';


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Dynamic CORS headers based on environment
    const corsHeaders = getDynamicCorsHeaders(env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Rate limiting: 20 requests per hour per IP
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const rateLimitKey = `rate_limit:${clientIP}`;
    
    try {
      const requestCount = await env.CLAUDOMETER_CACHE.get(rateLimitKey);
      const currentCount = requestCount ? parseInt(requestCount) : 0;
      
      if (currentCount >= 20) {
        return new Response(JSON.stringify({ 
          error: 'Rate limit exceeded', 
          message: 'Maximum 20 requests per hour allowed' 
        }), { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Increment counter with 1 hour expiration
      await env.CLAUDOMETER_CACHE.put(rateLimitKey, (currentCount + 1).toString(), { 
        expirationTtl: 3600 
      });
    } catch (rateLimitError) {
      console.error('Rate limiting error:', rateLimitError);
      // Continue processing request if rate limiting fails
    }

    try {
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
      // Removed public /collect-data endpoint - only accessible via cron
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
    ctx.waitUntil(collectRedditData(env));
  }
};

async function getCurrentSentiment(env, url) {
  try {
    const period = url?.searchParams?.get('period') || '24h';
    const validPeriods = ['24h', '7d', '30d', 'all'];
    
    if (!validPeriods.includes(period)) {
      return new Response(JSON.stringify({ error: 'Invalid period. Use: 24h, 7d, 30d, all' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }
    
    // Check cache first
    const cacheKey = getCacheKey('current-sentiment', { period });
    const cached = await getFromCache(cacheKey, env);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
      });
    }
    
    // Get latest sentiment (most recent data point)
    const latestStmt = env.DB.prepare('SELECT weighted_sentiment, post_count, comment_count FROM sentiment_hourly ORDER BY hour DESC LIMIT 1');
    const latestResult = await latestStmt.first();
    
    // Get average sentiment for the selected period
    const daysBack = period === '24h' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 365;
    const avgStmt = env.DB.prepare(`
      SELECT AVG(weighted_sentiment) as avg_sentiment, SUM(post_count) as total_posts, SUM(comment_count) as total_comments
      FROM sentiment_hourly 
      WHERE hour >= datetime('now', '-${daysBack} days')
    `);
    const avgResult = await avgStmt.first();
    
    const data = {
      latest_sentiment: latestResult ? latestResult.weighted_sentiment : 0.5,
      avg_sentiment: avgResult ? avgResult.avg_sentiment || 0.5 : 0.5,
      latest_post_count: latestResult ? latestResult.post_count || 0 : 0,
      latest_comment_count: latestResult ? latestResult.comment_count || 0 : 0,
      avg_post_count: avgResult ? avgResult.total_posts || 0 : 0,
      avg_comment_count: avgResult ? avgResult.total_comments || 0 : 0
    };
    
    // Cache the result
    await setCache(cacheKey, data, env);
    
    return new Response(JSON.stringify(data), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      latest_sentiment: 0.5, 
      avg_sentiment: 0.5, 
      latest_post_count: 0,
      latest_comment_count: 0,
      avg_post_count: 0, 
      avg_comment_count: 0 
    }), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  }
}

async function getTimeSeriesData(env, url) {
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
      data = await getHourlyDataUncached(env);
    } else {
      data = await getDailyAggregatedDataUncached(env, period);
    }
    
    // Cache the result
    await setCache(cacheKey, data, env);
    
    return new Response(JSON.stringify(data), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  } catch (error) {
    return new Response(JSON.stringify([]), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  }
}

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

async function getCategoryData(env) {
  try {
    // Get posts and comments separately to apply weighted sentiment
    const postsStmt = env.DB.prepare('SELECT category, COUNT(*) as count, AVG(sentiment) as avg_sentiment FROM posts WHERE processed_at > datetime("now", "-24 hours") GROUP BY category');
    const commentsStmt = env.DB.prepare('SELECT category, COUNT(*) as count, AVG(sentiment) as avg_sentiment FROM comments WHERE processed_at > datetime("now", "-24 hours") GROUP BY category');
    
    const [postsResults, commentsResults] = await Promise.all([
      postsStmt.all(),
      commentsStmt.all()
    ]);
    
    // Combine and weight the data (posts = 3x weight, comments = 1x weight)
    const categoryMap = {};
    
    postsResults.results.forEach(row => {
      categoryMap[row.category] = {
        name: row.category,
        totalSentiment: (row.avg_sentiment || 0.5) * row.count * 3,
        totalWeight: row.count * 3,
        count: row.count * 3 // Weight posts 3x for display
      };
    });
    
    commentsResults.results.forEach(row => {
      if (categoryMap[row.category]) {
        categoryMap[row.category].totalSentiment += (row.avg_sentiment || 0.5) * row.count;
        categoryMap[row.category].totalWeight += row.count;
        categoryMap[row.category].count += row.count;
      } else {
        categoryMap[row.category] = {
          name: row.category,
          totalSentiment: (row.avg_sentiment || 0.5) * row.count,
          totalWeight: row.count,
          count: row.count
        };
      }
    });
    
    const total = Object.values(categoryMap).reduce((sum, cat) => sum + cat.count, 0);
    
    const categoryData = Object.values(categoryMap).map(cat => ({
      name: cat.name,
      value: total > 0 ? Math.round((cat.count / total) * 100) : 0,
      sentiment: cat.totalWeight > 0 ? cat.totalSentiment / cat.totalWeight : 0.5
    }));
    
    return new Response(JSON.stringify(categoryData), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}

async function getTopicData(env, url) {
  try {
    const period = url?.searchParams?.get('period') || '24h';
    const validPeriods = ['24h', '7d', '30d', 'all'];
    
    if (!validPeriods.includes(period)) {
      return new Response(JSON.stringify({ error: 'Invalid period. Use: 24h, 7d, 30d, all' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }
    
    // Check cache first
    const cacheKey = getCacheKey('topics', { period });
    const cached = await getFromCache(cacheKey, env);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
      });
    }
    
    // Calculate date filter based on period
    const daysBack = period === '24h' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 365;
    const dateFilter = period === 'all' ? '' : `AND processed_at > datetime("now", "-${daysBack} days")`;
    
    // Get topics from category field with post/comment counts and weighted sentiment
    const postsStmt = env.DB.prepare(`SELECT category, COUNT(*) as count, AVG(sentiment) as avg_sentiment FROM posts WHERE category IS NOT NULL ${dateFilter} GROUP BY category`);
    const commentsStmt = env.DB.prepare(`SELECT category, COUNT(*) as count, AVG(sentiment) as avg_sentiment FROM comments WHERE category IS NOT NULL ${dateFilter} GROUP BY category`);
    
    const [postsResults, commentsResults] = await Promise.all([
      postsStmt.all(),
      commentsStmt.all()
    ]);
    
    // Combine and weight the data (posts = 3x weight, comments = 1x weight)
    const categoryMap = {};
    
    postsResults.results.forEach(row => {
      categoryMap[row.category] = {
        name: row.category,
        totalSentiment: (row.avg_sentiment || 0.5) * row.count * 3,
        totalWeight: row.count * 3,
        count: row.count * 3, // Weight posts 3x for display
        actualCount: row.count // Unweighted count for reference count
      };
    });
    
    commentsResults.results.forEach(row => {
      if (categoryMap[row.category]) {
        categoryMap[row.category].totalSentiment += (row.avg_sentiment || 0.5) * row.count;
        categoryMap[row.category].totalWeight += row.count;
        categoryMap[row.category].count += row.count;
        categoryMap[row.category].actualCount += row.count; // Add unweighted count
      } else {
        categoryMap[row.category] = {
          name: row.category,
          totalSentiment: (row.avg_sentiment || 0.5) * row.count,
          totalWeight: row.count,
          count: row.count,
          actualCount: row.count // Unweighted count for reference count
        };
      }
    });
    
    const total = Object.values(categoryMap).reduce((sum, cat) => sum + cat.count, 0);
    
    // Get colors for each topic
    const topicData = await Promise.all(
      Object.values(categoryMap).map(async cat => ({
        name: cat.name,
        value: total > 0 ? Math.round((cat.count / total) * 100) : 0,
        sentiment: cat.totalWeight > 0 ? cat.totalSentiment / cat.totalWeight : 0.5,
        color: await getTopicColor(cat.name, env),
        referenceCount: cat.actualCount
      }))
    );
    
    // Cache the result
    await setCache(cacheKey, topicData, env);
    
    return new Response(JSON.stringify(topicData), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  } catch (error) {
    console.error('Error in getTopicData:', error);
    return new Response(JSON.stringify([]), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  }
}

async function getKeywordData(env, url) {
  try {
    const period = url?.searchParams?.get('period') || '24h';
    const validPeriods = ['24h', '7d', '30d', 'all'];
    
    if (!validPeriods.includes(period)) {
      return new Response(JSON.stringify({ error: 'Invalid period. Use: 24h, 7d, 30d, all' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }
    
    // Check cache first
    const cacheKey = getCacheKey('keywords', { period });
    const cached = await getFromCache(cacheKey, env);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
      });
    }
    
    // Calculate date filter based on period
    const daysBack = period === '24h' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 365;
    const dateFilter = period === 'all' ? '' : `AND processed_at > datetime("now", "-${daysBack} days")`;
    
    // Get keywords from both posts and comments - strict count basis (no weighting for counts)
    const postsStmt = env.DB.prepare(`SELECT keywords, sentiment FROM posts WHERE keywords IS NOT NULL ${dateFilter}`);
    const commentsStmt = env.DB.prepare(`SELECT keywords, sentiment FROM comments WHERE keywords IS NOT NULL ${dateFilter}`);
    
    const [postsResults, commentsResults] = await Promise.all([
      postsStmt.all(),
      commentsStmt.all()
    ]);
    
    const keywordCounts = {};
    const keywordSentiments = {};
    
    // Process posts (1 count per occurrence, but weighted sentiment)
    postsResults.results.forEach(row => {
      if (row.keywords) {
        try {
          const keywords = JSON.parse(row.keywords);
          keywords.forEach(keyword => {
            keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1; // Strict count
            keywordSentiments[keyword] = keywordSentiments[keyword] || [];
            // Add sentiment 3 times for weighted sentiment calculation
            keywordSentiments[keyword].push(row.sentiment, row.sentiment, row.sentiment);
          });
        } catch (e) {
          // If keywords is not JSON, treat as comma-separated string
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
    
    // Process comments (1 count per occurrence, 1x sentiment weight)
    commentsResults.results.forEach(row => {
      if (row.keywords) {
        try {
          const keywords = JSON.parse(row.keywords);
          keywords.forEach(keyword => {
            keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1; // Strict count
            keywordSentiments[keyword] = keywordSentiments[keyword] || [];
            keywordSentiments[keyword].push(row.sentiment);
          });
        } catch (e) {
          // If keywords is not JSON, treat as comma-separated string
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
        count, // Actual occurrence count
        sentiment: keywordSentiments[keyword].reduce((sum, s) => sum + s, 0) / keywordSentiments[keyword].length
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);
    
    // Cache the result
    await setCache(cacheKey, keywordData, env);
    
    return new Response(JSON.stringify(keywordData), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  } catch (error) {
    return new Response(JSON.stringify([]), {
      headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
    });
  }
}

async function getRecentPosts(env, url) {
  try {
    const period = url?.searchParams?.get('period') || '24h';
    const validPeriods = ['24h', '7d', '30d', 'all'];
    
    if (!validPeriods.includes(period)) {
      return new Response(JSON.stringify({ error: 'Invalid period. Use: 24h, 7d, 30d, all' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }
    
    // Check cache first
    const cacheKey = getCacheKey('recent-posts', { period });
    const cached = await getFromCache(cacheKey, env);
    if (cached) {
      return new Response(JSON.stringify(cached), {
        headers: addCacheHeaders({ 'Content-Type': 'application/json', ...getCorsHeaders(env) })
      });
    }
    
    // Calculate date filter based on period
    const daysBack = period === '24h' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 365;
    const dateFilter = period === 'all' ? '' : `WHERE processed_at > datetime("now", "-${daysBack} days")`;
    
    const stmt = env.DB.prepare(`
      SELECT title, subreddit, sentiment, created_at, category
      FROM posts
      ${dateFilter}
      ORDER BY processed_at DESC LIMIT 10
    `);
    const results = await stmt.all();
    
    const recentPosts = results.results.map((row, index) => ({
      id: index + 1,
      subreddit: `r/${row.subreddit}`,
      title: row.title,
      sentiment: row.sentiment || 0.5,
      category: row.category || 'Features',
      time: getTimeAgo(row.created_at)
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


async function collectRedditData(env) {
  try {
    console.log('Starting Reddit data collection...');
    console.log('Environment check:', {
      hasRedditClientId: !!env.REDDIT_CLIENT_ID,
      hasRedditClientSecret: !!env.REDDIT_CLIENT_SECRET,
      hasOpenAiKey: !!env.OPENAI_API_KEY
    });
    
    const { posts, comments } = await fetchRedditPosts(env);
    console.log(`Fetched ${posts.length} posts, ${comments.length} comments`);
    
    if (posts.length === 0) {
      console.error('ERROR: No posts fetched from Reddit - check API credentials');
      return new Response('No posts fetched from Reddit');
    }
    
    // Analyze ALL posts with OpenAI (truncate long content)
    const analyzedPosts = await analyzeWithOpenAI(posts, env.OPENAI_API_KEY, env);
    
    // Analyze ALL comments with OpenAI (truncate long content)
    const analyzedComments = await analyzeWithOpenAI(comments, env.OPENAI_API_KEY, env);
    
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










// DEV MODE ENDPOINTS - Only accessible when DEV_MODE_ENABLED=true

async function getDevPosts(env, url) {
  try {
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    const categories = url.searchParams.get('categories');
    
    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'start_date and end_date required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }

    // Build category filter
    let categoryFilter = '';
    let categoryParams = [];
    if (categories) {
      const categoryList = categories.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
      if (categoryList.length > 0) {
        categoryFilter = ` AND category IN (${categoryList.map(() => '?').join(',')})`;
        categoryParams = categoryList;
      }
    }

    // Get posts and comments in date range with optional category filtering
    const postsStmt = env.DB.prepare(`
      SELECT id, title, content, subreddit, sentiment, category, keywords, processed_at, 'post' as type
      FROM posts 
      WHERE processed_at >= ? AND processed_at <= ?${categoryFilter}
      ORDER BY processed_at DESC
    `);
    
    const commentsStmt = env.DB.prepare(`
      SELECT id, post_id, body as content, subreddit, sentiment, category, keywords, processed_at, 'comment' as type
      FROM comments 
      WHERE processed_at >= ? AND processed_at <= ?${categoryFilter}
      ORDER BY processed_at DESC
    `);

    const [postsResults, commentsResults] = await Promise.all([
      postsStmt.bind(startDate, endDate, ...categoryParams).all(),
      commentsStmt.bind(startDate, endDate, ...categoryParams).all()
    ]);

    // Combine and format data
    const allItems = [
      ...postsResults.results.map(post => ({
        id: post.id,
        type: 'post',
        title: post.title,
        content: post.content,
        truncatedContent: getTruncatedText(post.title, post.content),
        subreddit: post.subreddit,
        sentiment: post.sentiment,
        category: post.category,
        keywords: post.keywords,
        processed_at: post.processed_at
      })),
      ...commentsResults.results.map(comment => ({
        id: comment.id,
        type: 'comment',
        post_id: comment.post_id,
        title: `Comment on ${comment.post_id}`,
        content: comment.content,
        truncatedContent: getTruncatedText('', comment.content),
        subreddit: comment.subreddit,
        sentiment: comment.sentiment,
        category: comment.category,
        keywords: comment.keywords,
        processed_at: comment.processed_at
      }))
    ].sort((a, b) => new Date(b.processed_at) - new Date(a.processed_at));

    return new Response(JSON.stringify(allItems), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    console.error('Error in getDevPosts:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}

async function reevaluateSentiments(request, env) {
  try {
    const { items } = await request.json();
    
    if (!items || !Array.isArray(items)) {
      return new Response(JSON.stringify({ error: 'items array required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }

    const results = [];
    
    // Process in batches of 50
    for (let i = 0; i < items.length; i += 50) {
      const batch = items.slice(i, i + 50);
      
      for (const item of batch) {
        try {
          // Re-analyze with OpenAI using current prompt
          const analyzed = await analyzeWithOpenAI([{
            id: item.id,
            title: item.title,
            content: item.content
          }], env.OPENAI_API_KEY, env);

          if (analyzed.length > 0) {
            const newSentiment = analyzed[0].sentiment;
            const newCategory = analyzed[0].category;
            const newKeywords = analyzed[0].keywords;

            // Update database
            if (item.type === 'post') {
              await env.DB.prepare(`
                UPDATE posts 
                SET sentiment = ?, category = ?, keywords = ?
                WHERE id = ?
              `).bind(newSentiment, newCategory, newKeywords, item.id).run();
            } else {
              await env.DB.prepare(`
                UPDATE comments 
                SET sentiment = ?, category = ?, keywords = ?
                WHERE id = ?
              `).bind(newSentiment, newCategory, newKeywords, item.id).run();
            }

            results.push({
              id: item.id,
              type: item.type,
              title: item.title,
              oldSentiment: item.sentiment,
              newSentiment: newSentiment,
              oldCategory: item.category,
              newCategory: newCategory,
              oldKeywords: item.keywords,
              newKeywords: newKeywords,
              truncatedContent: item.truncatedContent
            });
          }
        } catch (error) {
          console.error(`Error processing item ${item.id}:`, error);
          results.push({
            id: item.id,
            type: item.type,
            title: item.title,
            error: error.message,
            truncatedContent: item.truncatedContent
          });
        }
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    console.error('Error in reevaluateSentiments:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}

async function rollbackSentiments(request, env) {
  try {
    const { items } = await request.json();
    
    if (!items || !Array.isArray(items)) {
      return new Response(JSON.stringify({ error: 'items array required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }

    const results = [];
    
    for (const item of items) {
      try {
        if (item.type === 'post') {
          await env.DB.prepare(`
            UPDATE posts 
            SET sentiment = ?, category = ?, keywords = ?
            WHERE id = ?
          `).bind(item.oldSentiment, item.oldCategory, item.oldKeywords, item.id).run();
        } else {
          await env.DB.prepare(`
            UPDATE comments 
            SET sentiment = ?, category = ?, keywords = ?
            WHERE id = ?
          `).bind(item.oldSentiment, item.oldCategory, item.oldKeywords, item.id).run();
        }
        
        results.push({ id: item.id, success: true });
      } catch (error) {
        console.error(`Error rolling back item ${item.id}:`, error);
        results.push({ id: item.id, success: false, error: error.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    console.error('Error in rollbackSentiments:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}


// EVENT MANAGEMENT FUNCTIONS

async function getEventsAdmin(env) {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Claudometer Events Admin</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; font-weight: bold; }
        input, textarea, select { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #8b4513; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        button:hover { background: #723a0f; }
        .event-item { border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 4px; }
        .event-actions { margin-top: 10px; }
        .event-actions button { margin-right: 10px; }
        .delete-btn { background: #dc3545; }
        .delete-btn:hover { background: #c82333; }
    </style>
</head>
<body>
    <h1>Claudometer Events Admin</h1>
    
    <h2>Add New Event</h2>
    <form id="eventForm">
        <div class="form-group">
            <label for="title">Title (required):</label>
            <input type="text" id="title" name="title" required>
        </div>
        <div class="form-group">
            <label for="description">Description:</label>
            <textarea id="description" name="description" rows="3"></textarea>
        </div>
        <div class="form-group">
            <label for="event_date">Date & Time (required):</label>
            <input type="datetime-local" id="event_date" name="event_date" required>
        </div>
        <div class="form-group">
            <label for="event_type">Type:</label>
            <select id="event_type" name="event_type">
                <option value="announcement">Announcement</option>
                <option value="feature">Feature</option>
                <option value="pricing">Pricing</option>
                <option value="incident">Incident</option>
            </select>
        </div>
        <div class="form-group">
            <label for="url">URL (optional):</label>
            <input type="url" id="url" name="url">
        </div>
        <button type="submit">Add Event</button>
    </form>
    
    <h2>Existing Events</h2>
    <div id="eventsList"></div>
    
    <script>
        // Load existing events
        async function loadEvents() {
            const response = await fetch('/dev/events');
            const events = await response.json();
            const container = document.getElementById('eventsList');
            
            if (events.length === 0) {
                container.innerHTML = '<p>No events found.</p>';
                return;
            }
            
            container.innerHTML = events.map(event => \`
                <div class="event-item">
                    <h3>\${event.title}</h3>
                    <p><strong>Date:</strong> \${new Date(event.date).toLocaleString()}</p>
                    <p><strong>Type:</strong> \${event.type}</p>
                    \${event.description ? \`<p><strong>Description:</strong> \${event.description}</p>\` : ''}
                    \${event.url ? \`<p><strong>URL:</strong> <a href="\${event.url}" target="_blank">\${event.url}</a></p>\` : ''}
                    <div class="event-actions">
                        <button onclick="deleteEvent(\${event.id})" class="delete-btn">Delete</button>
                    </div>
                </div>
            \`).join('');
        }
        
        // Add new event
        document.getElementById('eventForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            // Convert datetime-local to ISO string
            data.event_date = new Date(data.event_date).toISOString();
            
            const response = await fetch('/dev/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                alert('Event added successfully!');
                e.target.reset();
                loadEvents();
            } else {
                alert('Error adding event');
            }
        });
        
        // Delete event
        async function deleteEvent(id) {
            if (confirm('Are you sure you want to delete this event?')) {
                const response = await fetch(\`/dev/events/\${id}\`, { method: 'DELETE' });
                if (response.ok) {
                    alert('Event deleted successfully!');
                    loadEvents();
                } else {
                    alert('Error deleting event');
                }
            }
        }
        
        // Load events on page load
        loadEvents();
    </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html', ...getCorsHeaders(env) }
  });
}

async function getDevEvents(env) {
  try {
    const stmt = env.DB.prepare('SELECT * FROM events ORDER BY event_date DESC');
    const results = await stmt.all();
    
    const events = results.results.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      date: row.event_date,
      type: row.event_type,
      url: row.url,
      created_at: row.created_at
    }));
    
    return new Response(JSON.stringify(events), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}

async function createEvent(request, env) {
  try {
    const { title, description, event_date, event_type, url } = await request.json();
    
    if (!title || !event_date) {
      return new Response(JSON.stringify({ error: 'Title and event_date are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }
    
    const stmt = env.DB.prepare(`
      INSERT INTO events (title, description, event_date, event_type, url)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    await stmt.bind(
      title,
      description || null,
      event_date,
      event_type || 'announcement',
      url || null
    ).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}

async function updateEvent(request, env, eventId) {
  try {
    const { title, description, event_date, event_type, url } = await request.json();
    
    if (!title || !event_date) {
      return new Response(JSON.stringify({ error: 'Title and event_date are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }
    
    const stmt = env.DB.prepare(`
      UPDATE events 
      SET title = ?, description = ?, event_date = ?, event_type = ?, url = ?
      WHERE id = ?
    `);
    
    await stmt.bind(
      title,
      description || null,
      event_date,
      event_type || 'announcement',
      url || null,
      eventId
    ).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}

async function deleteEvent(env, eventId) {
  try {
    const stmt = env.DB.prepare('DELETE FROM events WHERE id = ?');
    await stmt.bind(eventId).run();
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}

async function clearCache(env) {
  try {
    // Clear all claudometer cache entries
    await clearCachePattern('', env);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'All cache entries cleared successfully' 
    }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}

// CACHE HELPER FUNCTIONS

