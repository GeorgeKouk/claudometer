/**
 * Database Service - Cloudflare D1 database operations
 * Handles data persistence, topic management, and sentiment aggregation
 */

/**
 * Stores analyzed posts and comments in database with sentiment aggregation
 * @param {Array} posts - Array of analyzed post objects
 * @param {Array} comments - Array of analyzed comment objects
 * @param {Object} env - Cloudflare Workers environment
 * @param {string} platformId - Platform identifier (default: 'claude')
 */
export async function storeInDatabase(posts, comments, env, platformId = 'claude') {
  console.log(`storeInDatabase called with ${posts.length} posts, ${comments.length} comments for platform: ${platformId}`);
  
  if (!env.DB) {
    console.error('CRITICAL: Database not available');
    throw new Error('Database not available');
  }

  try {
    // Store posts with platform_id
    for (const post of posts) {
      const stmt = env.DB.prepare(`
        INSERT OR REPLACE INTO posts 
        (id, title, content, subreddit, created_at, score, sentiment, category, keywords, platform_id, processed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      
      await stmt.bind(
        post.id,
        post.title,
        post.content,
        post.subreddit,
        post.created_at,
        post.score,
        post.sentiment,
        post.category,
        post.keywords,
        platformId
      ).run();
    }

    // Store comments with platform_id
    for (const comment of comments) {
      const stmt = env.DB.prepare(`
        INSERT OR REPLACE INTO comments 
        (id, post_id, body, subreddit, score, sentiment, category, keywords, created_at, platform_id, processed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      
      await stmt.bind(
        comment.id,
        comment.post_id,
        comment.content,
        comment.subreddit,
        comment.score,
        comment.sentiment,
        comment.category,
        comment.keywords,
        comment.created_at,
        platformId
      ).run();
    }

    // Calculate weighted sentiment (posts = 3x weight, comments = 1x weight)
    const totalPostSentiment = posts.reduce((sum, p) => sum + (p.sentiment * 3), 0);
    const totalCommentSentiment = comments.reduce((sum, c) => sum + c.sentiment, 0);
    const totalWeight = (posts.length * 3) + comments.length;
    
    const weightedAvgSentiment = totalWeight > 0 ? 
      (totalPostSentiment + totalCommentSentiment) / totalWeight : 0.5;

    // Store hourly aggregation with weighted sentiment
    const now = new Date();
    const currentHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).toISOString();

    const hourlyStmt = env.DB.prepare(`
      INSERT OR REPLACE INTO sentiment_hourly 
      (hour, platform_id, avg_sentiment, post_count, comment_count, weighted_sentiment)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    await hourlyStmt.bind(
      currentHour,
      platformId,
      posts.reduce((sum, p) => sum + p.sentiment, 0) / posts.length || 0.5,
      posts.length,
      comments.length,
      weightedAvgSentiment
    ).run();

    console.log(`Successfully stored ${posts.length} posts and ${comments.length} comments`);
    console.log('Weighted sentiment calculated:', weightedAvgSentiment);
  } catch (error) {
    console.error('Database storage error:', {
      error: error.message,
      stack: error.stack,
      postsCount: posts.length,
      commentsCount: comments.length
    });
    throw error;
  }
}

/**
 * Gets or creates a topic color for sentiment visualization
 * @param {string} topicName - Name of the topic/category
 * @param {Object} env - Cloudflare Workers environment
 * @returns {string} Hex color code for the topic
 */
export async function getTopicColor(topicName, env) {
  try {
    // Check if topic exists in topics table (hardcoded topics)
    const existingTopic = await env.DB.prepare('SELECT color FROM topics WHERE name = ?').bind(topicName).first();
    
    if (existingTopic) {
      return existingTopic.color;
    }
    
    // Check if this is an old topic that exists in posts/comments but not in topics table
    const oldTopicExists = await env.DB.prepare(`
      SELECT 1 FROM (
        SELECT category FROM posts WHERE category = ? 
        UNION 
        SELECT category FROM comments WHERE category = ?
      ) LIMIT 1
    `).bind(topicName, topicName).first();
    
    if (oldTopicExists) {
      // Old topic - return black color
      return '#000000';
    }
    
    // New topic created by AI - assign next available color from palette
    const colorPalette = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', 
      '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43',
      '#EE5A24', '#0ABDE3', '#006BA6', '#A55EEA', '#26DE81',
      '#FD79A8', '#FDCB6E', '#6C5CE7', '#A29BFE', '#74B9FF',
      '#FD79A8', '#FDCB6E', '#55A3FF', '#26C281', '#FF7675',
      '#6C5CE7', '#A29BFE', '#FDCB6E', '#00B894', '#E17055'
    ];
    
    // Get all existing colors from topics table
    const existingColors = await env.DB.prepare('SELECT color FROM topics').all();
    const usedColors = new Set(existingColors.results.map(row => row.color));
    
    // Find first unused color from palette
    let selectedColor = '#CCCCCC'; // fallback gray
    for (const color of colorPalette) {
      if (!usedColors.has(color)) {
        selectedColor = color;
        break;
      }
    }
    
    // Store the new topic with its assigned color
    await env.DB.prepare('INSERT INTO topics (name, color) VALUES (?, ?)')
      .bind(topicName, selectedColor)
      .run();
    
    return selectedColor;
  } catch (error) {
    console.error('Error getting topic color:', error);
    return '#CCCCCC'; // Fallback gray
  }
}