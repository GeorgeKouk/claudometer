/**
 * Development Handlers - Development and debugging endpoint handlers
 * Only accessible when DEV_MODE_ENABLED=true
 */

// Import service functions
import { clearCachePattern } from '../services/cache.service.js';
import { analyzeWithOpenAI } from '../services/ai.service.js';
import { getCorsHeaders } from '../utils/cors.js';
import { getTruncatedText } from '../utils/helpers.js';

/**
 * Gets posts and comments for debugging/reevaluation
 * @param {Object} env - Cloudflare Workers environment
 * @param {URL} url - Request URL with query parameters
 * @returns {Response} JSON response with posts and comments data
 */
export async function getDevPosts(env, url) {
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

/**
 * Re-evaluates sentiment for selected posts/comments
 * @param {Request} request - HTTP request with items to reevaluate
 * @param {Object} env - Cloudflare Workers environment
 * @returns {Response} JSON response with reevaluation results
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

/**
 * Rolls back sentiment changes to previous values
 * @param {Request} request - HTTP request with items to rollback
 * @param {Object} env - Cloudflare Workers environment
 * @returns {Response} JSON response with rollback results
 */
export async function rollbackSentiments(request, env) {
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

/**
 * HTML interface for event management
 * @param {Object} env - Cloudflare Workers environment
 * @returns {Response} HTML response with events admin interface
 */
export async function getEventsAdmin(env) {
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
            
            container.innerHTML = events.map(event => 
                '<div class="event-item">' +
                    '<h3>' + event.title + '</h3>' +
                    '<p><strong>Date:</strong> ' + new Date(event.date).toLocaleString() + '</p>' +
                    '<p><strong>Type:</strong> ' + event.type + '</p>' +
                    (event.description ? '<p><strong>Description:</strong> ' + event.description + '</p>' : '') +
                    (event.url ? '<p><strong>URL:</strong> <a href="' + event.url + '" target="_blank">' + event.url + '</a></p>' : '') +
                    '<div class="event-actions">' +
                        '<button onclick="deleteEvent(' + event.id + ')" class="delete-btn">Delete</button>' +
                    '</div>' +
                '</div>'
            ).join('');
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
                const response = await fetch('/dev/events/' + id, { method: 'DELETE' });
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
</html>\`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html', ...getCorsHeaders(env) }
  });
}

/**
 * Gets all events (JSON endpoint)
 * @param {Object} env - Cloudflare Workers environment
 * @returns {Response} JSON response with events data
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

/**
 * Creates a new event
 * @param {Request} request - HTTP request with event data
 * @param {Object} env - Cloudflare Workers environment
 * @returns {Response} JSON response with success status
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
    
    const stmt = env.DB.prepare(\`
      INSERT INTO events (title, description, event_date, event_type, url)
      VALUES (?, ?, ?, ?, ?)
    \`);
    
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
 * @param {Request} request - HTTP request with updated event data
 * @param {Object} env - Cloudflare Workers environment
 * @param {string} eventId - Event ID to update
 * @returns {Response} JSON response with success status
 */
export async function updateEvent(request, env, eventId) {
  try {
    const { title, description, event_date, event_type, url } = await request.json();
    
    if (!title || !event_date) {
      return new Response(JSON.stringify({ error: 'Title and event_date are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(env) }
      });
    }
    
    const stmt = env.DB.prepare(\`
      UPDATE events 
      SET title = ?, description = ?, event_date = ?, event_type = ?, url = ?
      WHERE id = ?
    \`);
    
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

/**
 * Deletes an event
 * @param {Object} env - Cloudflare Workers environment
 * @param {string} eventId - Event ID to delete
 * @returns {Response} JSON response with success status
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
 * @param {Object} env - Cloudflare Workers environment
 * @returns {Response} JSON response with success status
 */
export async function clearCache(env) {
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