/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run "npm run dev" in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run "npm run deploy" to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */


export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      if (path === '/api/current-sentiment') {
        return await getCurrentSentiment(env);
      } else if (path === '/api/hourly-data') {
        return await getHourlyData(env);
      } else if (path === '/api/categories') {
        return await getCategoryData(env);
      } else if (path === '/api/keywords') {
        return await getKeywordData(env);
      } else if (path === '/api/recent-posts') {
        return await getRecentPosts(env);
      } else if (path === '/api/collect-data') {
        return await collectRedditData(env);
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

async function getCurrentSentiment(env) {
  try {
    const stmt = env.DB.prepare('SELECT weighted_sentiment, post_count, comment_count FROM sentiment_hourly ORDER BY hour DESC LIMIT 1');
    const result = await stmt.first();
    
    const data = result ? {
      avg_sentiment: result.weighted_sentiment,
      post_count: result.post_count,
      comment_count: result.comment_count
    } : { avg_sentiment: 0.5, post_count: 0, comment_count: 0 };
    
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error) {
    return new Response(JSON.stringify({ avg_sentiment: 0.5, post_count: 0, comment_count: 0 }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
}

async function getHourlyData(env) {
  try {
    const stmt = env.DB.prepare('SELECT hour, weighted_sentiment, post_count, comment_count FROM sentiment_hourly ORDER BY hour DESC LIMIT 24');
    const results = await stmt.all();
    
    // Transform to match expected format
    const hourlyData = results.results.map(row => ({
      time: new Date(row.hour).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      sentiment: row.weighted_sentiment || 0.5,
      posts: (row.post_count || 0) + (row.comment_count || 0)
    })).reverse();
    
    return new Response(JSON.stringify(hourlyData), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
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
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
}

async function getKeywordData(env) {
  try {
    // Get keywords from both posts and comments - strict count basis (no weighting for counts)
    const postsStmt = env.DB.prepare('SELECT keywords, sentiment FROM posts WHERE processed_at > datetime("now", "-24 hours") AND keywords IS NOT NULL');
    const commentsStmt = env.DB.prepare('SELECT keywords, sentiment FROM comments WHERE processed_at > datetime("now", "-24 hours") AND keywords IS NOT NULL');
    
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
      .slice(0, 10);
    
    return new Response(JSON.stringify(keywordData), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
}

async function getRecentPosts(env) {
  try {
    const stmt = env.DB.prepare('SELECT title, subreddit, sentiment, category, created_at FROM posts ORDER BY processed_at DESC LIMIT 10');
    const results = await stmt.all();
    
    const recentPosts = results.results.map((row, index) => ({
      id: index + 1,
      subreddit: `r/${row.subreddit}`,
      title: row.title,
      sentiment: row.sentiment || 0.5,
      category: row.category || 'General',
      time: getTimeAgo(row.created_at)
    }));
    
    return new Response(JSON.stringify(recentPosts), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error) {
    return new Response(JSON.stringify([]), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
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
    const analyzedPosts = await analyzeWithOpenAI(posts, env.OPENAI_API_KEY);
    
    // Analyze ALL comments with OpenAI (truncate long content)
    const analyzedComments = await analyzeWithOpenAI(comments, env.OPENAI_API_KEY);
    
    // Store both in database
    await storeInDatabase(analyzedPosts, analyzedComments, env);
    
    return new Response(`Collection completed: ${analyzedPosts.length} posts, ${analyzedComments.length} comments processed`);
  } catch (error) {
    console.error('Data collection error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

async function getRedditAccessToken(env) {
  console.log('Getting Reddit access token...');
  const auth = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);
  
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Claudometer/1.0.0 by /u/claudometer_bot'
    },
    body: 'grant_type=client_credentials'
  });
  
  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Reddit auth failed:', {
      status: response.status,
      statusText: response.statusText, 
      body: errorBody
    });
    throw new Error(`Reddit auth failed: ${response.status}`);
  }
  
  const data = await response.json();
  console.log('Reddit auth successful, token obtained');
  return data.access_token;
}

async function fetchRedditPosts(env) {
  const subreddits = ['Anthropic', 'ClaudeAI', 'ClaudeCode'];
  const allPosts = [];
  const allComments = [];
  
  const accessToken = await getRedditAccessToken(env);
  
  for (const subreddit of subreddits) {
    try {
      console.log(`Fetching 10 posts from r/${subreddit}`);
      
      // Fetch posts
      const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/hot?limit=10`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Claudometer/1.0.0 by /u/claudometer_bot'
        }
      });

      if (!response.ok) {
        console.error(`Reddit error for r/${subreddit}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      // Check if Reddit response has expected structure
      if (!data || !data.data || !data.data.children) {
        console.error(`Invalid Reddit response structure for r/${subreddit}`);
        continue;
      }
      
      const posts = data.data.children
        .filter(post => post && post.data && post.data.id && (post.data.selftext || post.data.title))
        .map(post => ({
          id: post.data.id,
          title: post.data.title || '',
          content: post.data.selftext || '',
          subreddit: post.data.subreddit,
          created_at: new Date(post.data.created_utc * 1000).toISOString(),
          score: post.data.score || 0
        }));

      console.log(`Found ${posts.length} posts in r/${subreddit}`);
      allPosts.push(...posts);
      
      // Fetch comments for each post
      for (const post of posts) {
        try {
          console.log(`Fetching comments for post ${post.id}`);
          
          const commentsResponse = await fetch(
            `https://oauth.reddit.com/r/${subreddit}/comments/${post.id}?limit=5&sort=top`, 
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'Claudometer/1.0.0 by /u/claudometer_bot'
              }
            }
          );

          if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            
            // Reddit returns [post_data, comments_data]
            const commentsListing = commentsData[1];
            
            if (commentsListing?.data?.children) {
              const comments = commentsListing.data.children
                .filter(comment => comment.data?.body && comment.data.body !== '[deleted]')
                .slice(0, 5) // Top 5 comments
                .map(comment => ({
                  id: comment.data.id,
                  post_id: post.id,
                  content: comment.data.body,
                  subreddit: subreddit,
                  created_at: new Date(comment.data.created_utc * 1000).toISOString(),
                  score: comment.data.score || 0
                }));
              
              console.log(`Found ${comments.length} comments for post ${post.id}`);
              allComments.push(...comments);
            }
          }
        } catch (commentError) {
          console.error(`Error fetching comments for ${post.id}:`, commentError.message);
        }
      }
      
    } catch (error) {
      console.error(`Error fetching r/${subreddit}:`, error.message);
    }
  }

  console.log(`Total collected: ${allPosts.length} posts, ${allComments.length} comments`);
  return { posts: allPosts, comments: allComments };
}

async function analyzeWithOpenAI(posts, apiKey) {
  console.log(`analyzeWithOpenAI called with ${posts.length} posts`);
  console.log('API Key status:', apiKey ? `Present (${apiKey.substring(0, 10)}...)` : 'MISSING');
  
  if (!apiKey) {
    console.error('CRITICAL: No OpenAI API key provided - throwing error');
    throw new Error('OpenAI API key not configured');
  }

  const analyzed = [];

  for (const post of posts) {
    try {
      // Skip if post is null/undefined or missing required fields
      if (!post || !post.id) {
        console.log('Skipping invalid post object');
        continue;
      }
      
      const title = post.title || '';
      const content = post.content || '';
      const text = `${title} ${content}`.trim();
      
      if (!text || text === 'undefined undefined' || text === 'undefined' || text.length < 5) {
        console.log(`Skipping post ${post.id} - insufficient text content`);
        continue;
      }
      
      // Truncate long content to 500 characters for cost control
      const truncatedText = text.length > 500 ? text.substring(0, 500) + '...' : text;

      const displayTitle = (post && post.title) ? post.title : 'Untitled';
      console.log(`Analyzing post: ${displayTitle.substring(0, 50)}...`);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `Analyze this Reddit post about Claude AI and respond with ONLY a JSON object:

Text: "${truncatedText}"

JSON format:
{
  "sentiment": 0.75,
  "category": "Web Interface",
  "keywords": ["performance", "helpful"]
}

Categories: Web Interface, Claude Code, API, General
Sentiment: 0.0-1.0 where 0.5 is neutral
Keywords: max 3 relevant keywords`
          }]
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error(`OpenAI API Error Details:`, {
          status: response.status,
          statusText: response.statusText,
          body: errorBody
        });
        
        // Skip post if rate limited or other API error
        if (response.status === 429) {
          console.log('Rate limited, skipping remaining posts');
          break;
        }
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const result = await response.json();
      let analysis;
      
      // Check if response has expected structure
      if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        console.error('Unexpected OpenAI response structure:', result);
        continue;
      }
      
      try {
        analysis = JSON.parse(result.choices[0].message.content);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', result.choices[0].message.content);
        continue;
      }

      analyzed.push({
        ...post,
        sentiment: Math.max(0, Math.min(1, analysis.sentiment || 0.5)),
        category: analysis.category || 'General',
        keywords: JSON.stringify(analysis.keywords || ['general'])
      });

      // Rate limiting for OpenAI API
      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`Analysis error for post "${post.title || 'Untitled'}":`, {
        error: error.message,
        stack: error.stack,
        postId: post.id
      });
      // Skip failed posts instead of adding mock data
      continue;
    }
  }

  return analyzed;
}

async function storeInDatabase(posts, comments, env) {
  console.log(`storeInDatabase called with ${posts.length} posts, ${comments.length} comments`);
  
  if (!env.DB) {
    console.error('CRITICAL: Database not available');
    throw new Error('Database not available');
  }

  try {
    // Store posts (existing table)
    for (const post of posts) {
      const stmt = env.DB.prepare(`
        INSERT OR REPLACE INTO posts 
        (id, title, content, subreddit, created_at, score, sentiment, category, keywords, processed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
        post.keywords
      ).run();
    }

    // Store comments (new table)
    for (const comment of comments) {
      const stmt = env.DB.prepare(`
        INSERT OR REPLACE INTO comments 
        (id, post_id, body, subreddit, score, sentiment, category, keywords, created_at, processed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
        comment.created_at
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
      (hour, avg_sentiment, post_count, comment_count, weighted_sentiment)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    await hourlyStmt.bind(
      currentHour,
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

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function getTimeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMins > 0) return `${diffMins}m ago`;
  return 'Just now';
}