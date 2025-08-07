/**
 * Reddit Service - Reddit API interactions and data collection
 * Handles Reddit OAuth, post fetching, and comment retrieval
 */

// Consistent User-Agent for all Reddit API requests
const REDDIT_USER_AGENT = 'Claudometer/1.0.0 by /u/claudometer_bot';

/**
 * Gets an OAuth access token for Reddit API
 * @param {Object} env - Cloudflare Workers environment with Reddit credentials
 * @returns {string} Reddit API access token
 */
export async function getRedditAccessToken(env) {
  console.log('Getting Reddit access token...');
  const auth = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);
  
  const response = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': REDDIT_USER_AGENT
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

/**
 * Fetches posts and comments from specified subreddits
 * @param {Object} env - Cloudflare Workers environment
 * @param {Object} platformConfig - Platform configuration object (optional)
 * @param {Array} subreddits - Array of subreddit names (optional, overrides platform config)
 * @returns {Object} Object with posts and comments arrays
 */
export async function fetchRedditPosts(env, platformConfig = null, subreddits = null) {
  // Use platform config subreddits if provided, otherwise fall back to legacy default
  const targetSubreddits = subreddits || 
    (platformConfig?.subreddits) || 
    ['Anthropic', 'ClaudeAI', 'ClaudeCode'];
  
  // Get rate limits from platform config or use defaults
  const rateLimits = platformConfig?.rateLimits || {
    redditDelay: 2000,
    subredditDelay: 3000
  };
  
  // Get collection settings from platform config or use defaults
  const collection = platformConfig?.collection || {
    postsPerSubreddit: 20,
    commentsPerPost: 5
  };
  const allPosts = [];
  const allComments = [];
  
  const accessToken = await getRedditAccessToken(env);
  
  // Calculate 1 hour ago timestamp for filtering
  const oneHourAgo = Math.floor((Date.now() - (60 * 60 * 1000)) / 1000);
  
  console.log(`Fetching from subreddits: ${targetSubreddits.join(', ')} with ${collection.postsPerSubreddit} posts each`);
  
  for (const subreddit of targetSubreddits) {
    try {
      console.log(`Fetching recent posts from r/${subreddit} (last hour)`);
      
      // Fetch top posts from last hour using platform config limit
      const response = await fetch(`https://oauth.reddit.com/r/${subreddit}/top?t=hour&limit=${collection.postsPerSubreddit}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': REDDIT_USER_AGENT
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

      // Check for duplicates in database to avoid reprocessing
      const newPosts = [];
      for (const post of posts) {
        const existingPost = await env.DB.prepare('SELECT id FROM posts WHERE id = ?').bind(post.id).first();
        if (!existingPost) {
          newPosts.push(post);
        }
      }

      console.log(`Found ${posts.length} posts in r/${subreddit}, ${newPosts.length} are new`);
      allPosts.push(...newPosts);
      
      // Fetch comments for each new post only
      for (const post of newPosts) {
        try {
          console.log(`Fetching comments for post ${post.id}`);
          
          const commentsResponse = await fetch(
            `https://oauth.reddit.com/r/${subreddit}/comments/${post.id}?limit=${collection.commentsPerPost}&sort=top`, 
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'User-Agent': REDDIT_USER_AGENT
              }
            }
          );

          if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            
            // Reddit returns [post_data, comments_data]
            const commentsListing = commentsData[1];
            
            if (commentsListing?.data?.children) {
              const comments = commentsListing.data.children
                .filter(comment => {
                  // Filter for valid comments from the last hour only
                  if (!comment.data?.body || comment.data.body === '[deleted]') {
                    return false;
                  }
                  // Only include comments from the last hour
                  return comment.data.created_utc >= oneHourAgo;
                })
                .slice(0, collection.commentsPerPost) // Top comments per platform config
                .map(comment => ({
                  id: comment.data.id,
                  post_id: post.id,
                  content: comment.data.body,
                  subreddit: subreddit,
                  created_at: new Date(comment.data.created_utc * 1000).toISOString(),
                  score: comment.data.score || 0
                }));
              
              // Check for duplicate comments
              const newComments = [];
              for (const comment of comments) {
                const existingComment = await env.DB.prepare('SELECT id FROM comments WHERE id = ?').bind(comment.id).first();
                if (!existingComment) {
                  newComments.push(comment);
                }
              }
              
              console.log(`Found ${comments.length} comments for post ${post.id}, ${newComments.length} are new`);
              allComments.push(...newComments);
            }
          }
        } catch (commentError) {
          console.error(`Error fetching comments for ${post.id}:`, commentError.message);
        }
        
        // Rate limiting delay between comment requests using platform config
        await new Promise(resolve => setTimeout(resolve, rateLimits.redditDelay));
      }
      
      // Rate limiting delay between subreddit requests using platform config
      await new Promise(resolve => setTimeout(resolve, rateLimits.subredditDelay));
      
    } catch (error) {
      console.error(`Error fetching r/${subreddit}:`, error.message);
    }
  }

  console.log(`Total collected: ${allPosts.length} posts, ${allComments.length} comments`);
  return { posts: allPosts, comments: allComments };
}