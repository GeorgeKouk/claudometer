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
    const stmt = env.DB.prepare('SELECT avg_sentiment, post_count FROM sentiment_hourly ORDER BY hour DESC LIMIT 1');
    const result = await stmt.first();
    
    const data = result || { weighted_sentiment: 0.5, post_count: 0 };
    
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  } catch (error) {
    return new Response(JSON.stringify({ avg_sentiment: 0.5, post_count: 0 }), {
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders() }
    });
  }
}

async function getHourlyData(env) {
  try {
    const stmt = env.DB.prepare('SELECT hour, avg_sentiment, post_count FROM sentiment_hourly ORDER BY hour DESC LIMIT 24');
    const results = await stmt.all();
    
    // Transform to match expected format
    const hourlyData = results.results.map(row => ({
      time: new Date(row.hour).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      sentiment: row.avg_sentiment || 0.5,
      posts: row.post_count || 0
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
    const stmt = env.DB.prepare('SELECT category, COUNT(*) as count, AVG(sentiment) as avg_sentiment FROM posts WHERE processed_at > datetime("now", "-24 hours") GROUP BY category');
    const results = await stmt.all();
    
    const total = results.results.reduce((sum, row) => sum + row.count, 0);
    
    const categoryData = results.results.map(row => ({
      name: row.category,
      value: Math.round((row.count / total) * 100),
      sentiment: row.avg_sentiment || 0.5
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
    // This is a simplified version - in a real implementation you'd parse the keywords JSON
    const stmt = env.DB.prepare('SELECT keywords, sentiment FROM posts WHERE processed_at > datetime("now", "-24 hours") AND keywords IS NOT NULL');
    const results = await stmt.all();
    
    const keywordCounts = {};
    const keywordSentiments = {};
    
    results.results.forEach(row => {
      if (row.keywords) {
        try {
          const keywords = JSON.parse(row.keywords);
          keywords.forEach(keyword => {
            keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
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
        count,
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
    
    const { posts, comments } = await fetchRedditPosts(env);
    console.log(`Fetched ${posts.length} posts, ${comments.length} comments`);
    
    if (posts.length === 0) {
      return new Response('No posts fetched from Reddit');
    }
    
    // Analyze posts with OpenAI (limit to 10 for cost control)
    const analyzedPosts = await analyzeWithOpenAI(posts.slice(0, 10), env.OPENAI_API_KEY);
    
    // Analyze comments with OpenAI (limit to 15 for cost control) 
    const analyzedComments = await analyzeWithOpenAI(comments.slice(0, 15), env.OPENAI_API_KEY);
    
    // Store both in database
    await storeInDatabase(analyzedPosts, analyzedComments, env);
    
    return new Response(`Collection completed: ${analyzedPosts.length} posts, ${analyzedComments.length} comments processed`);
  } catch (error) {
    console.error('Data collection error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

async function getRedditAccessToken(env) {
  const auth = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);
  
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Claudometer/1.0.0 by /u/yourusername'
    },
    body: 'grant_type=client_credentials'
  });
  
  if (!response.ok) {
    throw new Error(`Reddit auth failed: ${response.status}`);
  }
  
  const data = await response.json();
  return data.access_token;
}

async function fetchRedditPosts(env) {
  const subreddits = ['Anthropic', 'ClaudeAI', 'ClaudeCode'];
  const allPosts = [];
  const allComments = [];
  
  const accessToken = await getRedditAccessToken(env);
  
  for (const subreddit of subreddits) {
    try {
      console.log(`Fetching 20 posts from r/${subreddit}`);
      
      // Fetch posts
      const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/hot?limit=20`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Claudometer/1.0.0 by /u/yourusername'
        }
      });

      if (!response.ok) {
        console.error(`Reddit error for r/${subreddit}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      const posts = data.data.children
        .filter(post => post.data && (post.data.selftext || post.data.title))
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
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 sec delay
          
          console.log(`Fetching comments for post ${post.id}`);
          
          const commentsResponse = await fetch(
            `https://oauth.reddit.com/r/${subreddit}/comments/${post.id}?limit=5&sort=top`, 
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': 'Claudometer/1.0.0 by /u/yourusername'
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
      
      // 3 second delay between subreddits
      await new Promise(resolve => setTimeout(resolve, 3000));
      
    } catch (error) {
      console.error(`Error fetching r/${subreddit}:`, error.message);
    }
  }

  console.log(`Total collected: ${allPosts.length} posts, ${allComments.length} comments`);
  return { posts: allPosts, comments: allComments };
}

async function analyzeWithOpenAI(posts, apiKey) {
  if (!apiKey) {
    console.error('No OpenAI API key provided');
    return posts.map(post => ({
      ...post,
      sentiment: 0.5,
      category: 'General',
      keywords: JSON.stringify(['general'])
    }));
  }

  const analyzed = [];

  for (const post of posts) {
    try {
      const text = `${post.title} ${post.content}`.trim();
      if (!text) continue;

      console.log(`Analyzing post: ${post.title.substring(0, 50)}...`);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          max_tokens: 300,
          messages: [{
            role: 'user',
            content: `Analyze this Reddit post about Claude AI and respond with ONLY a JSON object:

Text: "${text.substring(0, 500)}"

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
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const result = await response.json();
      let analysis;
      
      try {
        analysis = JSON.parse(result.choices[0].message.content);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', result.choices[0].message.content);
        analysis = {
          sentiment: 0.5,
          category: 'General',
          keywords: ['general']
        };
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
      console.error('Analysis error:', error);
      analyzed.push({
        ...post,
        sentiment: 0.5,
        category: 'General',
        keywords: JSON.stringify(['general'])
      });
    }
  }

  return analyzed;
}

async function storeInDatabase(posts, comments, env) {
  if (!env.DB) {
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
        (id, post_id, content, subreddit, created_at, score, sentiment, category, keywords, processed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `);
      
      await stmt.bind(
        comment.id,
        comment.post_id,
        comment.content,
        comment.subreddit,
        comment.created_at,
        comment.score,
        comment.sentiment,
        comment.category,
        comment.keywords
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

    console.log(`Stored ${posts.length} posts and ${comments.length} comments`);
  } catch (error) {
    console.error('Database storage error:', error);
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