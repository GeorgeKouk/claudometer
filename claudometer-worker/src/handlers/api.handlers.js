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
 * Gets current sentiment data for specified time period
 * @param {Object} env - Cloudflare Workers environment
 * @param {URL} url - Request URL with query parameters
 * @returns {Response} JSON response with current sentiment metrics
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

/**
 * Gets time series sentiment data with events
 * @param {Object} env - Cloudflare Workers environment  
 * @param {URL} url - Request URL with query parameters
 * @returns {Response} JSON response with hourly or daily sentiment data
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

/**
 * Gets topic distribution data  
 * @param {Object} env - Cloudflare Workers environment
 * @param {URL} url - Request URL with query parameters
 * @returns {Response} JSON response with topic breakdown
 */
export async function getTopicData(env, url) {
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

/**
 * Gets trending keywords data
 * @param {Object} env - Cloudflare Workers environment
 * @param {URL} url - Request URL with query parameters
 * @returns {Response} JSON response with keyword analysis
 */
export async function getKeywordData(env, url) {
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

/**
 * Gets recent posts feed
 * @param {Object} env - Cloudflare Workers environment
 * @param {URL} url - Request URL with query parameters  
 * @returns {Response} JSON response with recent posts
 */
export async function getRecentPosts(env, url) {
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