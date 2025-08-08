/**
 * Development Handlers - Development and debugging endpoint handlers
 * Only accessible when DEV_MODE_ENABLED=true
 */

// Import service functions
import { clearCachePattern } from '../services/cache.service.js';
import { analyzeWithOpenAI } from '../services/ai.service.js';
import { getCorsHeaders } from '../utils/cors.js';
import { getTruncatedText } from '../utils/helpers.js';
// Import cron handlers for manual collection
import { collectRedditData, collectClaudeData, collectChatGPTData, collectGeminiData, collectAllPlatformsData } from './cron.handlers.js';

/**
 * Gets posts and comments for debugging/reevaluation
 */
export async function getDevPosts(env, url) {
  try {
    const startDate = url.searchParams.get('start_date');
    const endDate = url.searchParams.get('end_date');
    
    if (!startDate || !endDate) {
      return new Response(JSON.stringify({ error: 'start_date and end_date required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }

    // Get posts with platform_id
    const postsStmt = env.DB.prepare(`
      SELECT id, title, content, subreddit, sentiment, category, keywords, processed_at, platform_id, 'post' as type
      FROM posts 
      WHERE processed_at >= ? AND processed_at <= ?
      ORDER BY processed_at DESC
    `);
    
    // Also get comments with post_id
    const commentsStmt = env.DB.prepare(`
      SELECT id, '' as title, body as content, subreddit, sentiment, category, keywords, processed_at, platform_id, post_id, 'comment' as type
      FROM comments 
      WHERE processed_at >= ? AND processed_at <= ?
      ORDER BY processed_at DESC
    `);
    
    const [postsResults, commentsResults] = await Promise.all([
      postsStmt.bind(startDate, endDate).all(),
      commentsStmt.bind(startDate, endDate).all()
    ]);
    
    const items = [...postsResults.results, ...commentsResults.results].map(item => {
      const baseItem = {
        id: item.id,
        type: item.type,
        title: item.title,
        content: item.content,
        truncatedContent: getTruncatedText(item.title, item.content),
        subreddit: item.subreddit,
        sentiment: item.sentiment,
        category: item.category,
        keywords: item.keywords,
        processed_at: item.processed_at,
        platform_id: item.platform_id
      };
      
      // Add post_id for comments (required by frontend)
      if (item.type === 'comment' && item.post_id) {
        baseItem.post_id = item.post_id;
      }
      
      return baseItem;
    }).sort((a, b) => new Date(b.processed_at) - new Date(a.processed_at));

    return new Response(JSON.stringify(items), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}

/**
 * Re-evaluates sentiment for selected posts/comments
 */
export async function reevaluateSentiments(request, env) {
  try {
    const { items } = await request.json();
    
    if (!items || !Array.isArray(items)) {
      return new Response(JSON.stringify({ error: 'items array required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }

    // Import platform configs
    const { getPlatformConfig } = await import('../config/platforms.js');

    const results = [];
    
    for (const item of items) {
      try {
        // Get platform configuration based on platform_id
        const platformConfig = getPlatformConfig(item.platform_id || 'claude');
        
        const analyzed = await analyzeWithOpenAI([{
          id: item.id,
          title: item.title,
          content: item.content
        }], env.OPENAI_API_KEY, env, platformConfig);

        if (analyzed.length > 0) {
          const newSentiment = analyzed[0].sentiment;
          const newCategory = analyzed[0].category;
          const newKeywords = analyzed[0].keywords;

          // Update the correct table based on item type
          const tableName = item.type === 'comment' ? 'comments' : 'posts';
          await env.DB.prepare(`
            UPDATE ${tableName} 
            SET sentiment = ?, category = ?, keywords = ?
            WHERE id = ?
          `).bind(newSentiment, newCategory, newKeywords, item.id).run();

          results.push({
            id: item.id,
            type: item.type,
            title: item.title,
            truncatedContent: getTruncatedText(item.title, item.content),
            platform_id: item.platform_id,
            oldSentiment: item.sentiment,
            newSentiment: newSentiment,
            oldCategory: item.category,
            newCategory: newCategory,
            oldKeywords: item.keywords || '',
            newKeywords: newKeywords || ''
          });
        }
      } catch (error) {
        results.push({
          id: item.id,
          type: item.type,
          title: item.title,
          truncatedContent: getTruncatedText(item.title, item.content),
          platform_id: item.platform_id,
          error: error.message
        });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}

/**
 * Rolls back sentiment changes to previous values
 */
export async function rollbackSentiments(request, env) {
  return new Response(JSON.stringify({ message: 'Rollback not implemented yet' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
  });
}

/**
 * Simple HTML interface for event management
 */
export async function getEventsAdmin(env) {
  const html = '<html><body><h1>Events Admin - Simplified</h1><p>Event management interface coming soon</p></body></html>';
  return new Response(html, {
    headers: { 'Content-Type': 'text/html', ...getCorsHeaders(env) }
  });
}

/**
 * Gets all events (JSON endpoint)
 */
export async function getDevEvents(env) {
  try {
    const stmt = env.DB.prepare('SELECT * FROM events ORDER BY event_date DESC');
    const results = await stmt.all();
    
    const events = results.results.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      date: row.event_date,
      type: row.event_type,
      url: row.url
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

/**
 * Creates a new event
 */
export async function createEvent(request, env) {
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

/**
 * Updates an existing event
 */
export async function updateEvent(request, env, eventId) {
  return new Response(JSON.stringify({ message: 'Update not implemented yet' }), {
    status: 501,
    headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
  });
}

/**
 * Deletes an event
 */
export async function deleteEvent(env, eventId) {
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

/**
 * Clears all cache entries
 */
export async function clearCache(env) {
  try {
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

/**
 * Manual data collection endpoints (DEV mode only)
 */

/**
 * Manually collect data for Claude platform
 */
export async function manualCollectClaude(env) {
  try {
    const result = await collectClaudeData(env);
    const resultText = await result.text();
    
    return new Response(JSON.stringify({
      success: true,
      platform: 'claude',
      message: resultText
    }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      platform: 'claude',
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}

/**
 * Manually collect data for ChatGPT platform
 */
export async function manualCollectChatGPT(env) {
  try {
    const result = await collectChatGPTData(env);
    const resultText = await result.text();
    
    return new Response(JSON.stringify({
      success: true,
      platform: 'chatgpt',
      message: resultText
    }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      platform: 'chatgpt',
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}

/**
 * Manually collect data for Gemini platform
 */
export async function manualCollectGemini(env) {
  try {
    const result = await collectGeminiData(env);
    const resultText = await result.text();
    
    return new Response(JSON.stringify({
      success: true,
      platform: 'gemini',
      message: resultText
    }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      platform: 'gemini',
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}

/**
 * Manually collect data for all platforms
 */
export async function manualCollectAllPlatforms(env) {
  try {
    const result = await collectAllPlatformsData(env);
    const resultText = await result.text();
    
    return new Response(JSON.stringify({
      success: true,
      platform: 'all',
      message: resultText
    }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      platform: 'all',
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}

/**
 * Manually collect data for a specific platform via URL parameter
 */
export async function manualCollectPlatform(env, url) {
  try {
    const platform = url.searchParams.get('platform');
    
    if (!platform) {
      return new Response(JSON.stringify({ 
        error: 'Platform parameter required',
        usage: 'Use ?platform=claude|chatgpt|gemini|all'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }

    let result;
    switch (platform.toLowerCase()) {
      case 'claude':
        result = await collectClaudeData(env);
        break;
      case 'chatgpt':
        result = await collectChatGPTData(env);
        break;
      case 'gemini':
        result = await collectGeminiData(env);
        break;
      case 'all':
        result = await collectAllPlatformsData(env);
        break;
      default:
        return new Response(JSON.stringify({ 
          error: 'Invalid platform',
          usage: 'Use ?platform=claude|chatgpt|gemini|all'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
        });
    }
    
    const resultText = await result.text();
    
    return new Response(JSON.stringify({
      success: true,
      platform: platform,
      message: resultText
    }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  } catch (error) {
    return new Response(JSON.stringify({ 
      success: false,
      error: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
    });
  }
}