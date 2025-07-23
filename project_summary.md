# Claudometer Project Summary

## Project Overview
Built a real-time Reddit sentiment tracking dashboard for Claude AI mentions across r/Anthropic, r/ClaudeAI, and r/ClaudeCode.

## Architecture
- **Backend**: Cloudflare Worker (API + data collection)
- **Frontend**: Cloudflare Pages (React dashboard)
- **Database**: Cloudflare D1 (SQLite)
- **External APIs**: Reddit OAuth, OpenAI GPT-3.5-turbo

## Backend - Cloudflare Worker

### Environment Variables Required
```
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
OPENAI_API_KEY=your_openai_api_key
```

### Database Schema
```sql
-- Posts table (existing)
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT,
  subreddit TEXT,
  created_at TEXT,
  score INTEGER DEFAULT 0,
  sentiment REAL DEFAULT 0.5,
  category TEXT DEFAULT 'General',
  keywords TEXT,
  processed_at TEXT
);

-- Comments table (new)
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  content TEXT,
  subreddit TEXT,
  created_at TEXT,
  score INTEGER DEFAULT 0,
  sentiment REAL DEFAULT 0.5,
  category TEXT DEFAULT 'General',
  keywords TEXT,
  processed_at TEXT
);

-- Hourly aggregation (updated)
CREATE TABLE sentiment_hourly (
  hour TEXT PRIMARY KEY,
  avg_sentiment REAL DEFAULT 0.5,
  post_count INTEGER DEFAULT 0,
  category_breakdown TEXT,
  keyword_counts TEXT,
  comment_count INTEGER DEFAULT 0,
  weighted_sentiment REAL DEFAULT 0.5
);

-- Indexes
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_processed_at ON comments(processed_at);
```

### API Endpoints
- `GET /` - Health check
- `GET /api/current-sentiment` - Latest weighted sentiment
- `GET /api/hourly-data` - 24h trend data
- `GET /api/categories` - Category breakdown
- `GET /api/keywords` - Trending keywords
- `GET /api/recent-posts` - Latest posts
- `GET /api/collect-data` - Manual data collection

### Data Collection Process
1. **Reddit OAuth**: Authenticates with Reddit API
2. **Fetch Data**: 20 posts + 5 top comments per subreddit (3 subreddits = ~180 items)
3. **OpenAI Analysis**: Sentiment analysis on 10 posts + 15 comments (cost control)
4. **Weighted Scoring**: Posts = 3x weight, Comments = 1x weight
5. **Storage**: Separate tables for posts/comments + hourly aggregation
6. **Scheduled**: Runs hourly via cron trigger

### Key Functions Updated
- `fetchRedditPosts()` - Now fetches posts + comments with OAuth
- `analyzeWithOpenAI()` - Fixed to use `env.OPENAI_API_KEY` (not ANTHROPIC)
- `storeInDatabase()` - Now handles both posts and comments separately
- `getCurrentSentiment()` - Returns `weighted_sentiment` instead of `avg_sentiment`

## Frontend - Cloudflare Pages

### Simple HTML Version (Current)
- Single `index.html` file
- Pure HTML/CSS/JS (no build process)
- API integration with error handling
- Visual progress bars and sentiment meter

### React Version (Recommended for Git Integration)
```bash
npx create-react-app claudometer
cd claudometer
npm install recharts
# Replace src/App.js with React component
npm run build
# Deploy build/ folder to Pages
```

### Key Frontend Changes
- Uses `weighted_sentiment` from API
- Displays both posts and comments data
- Real-time updates every 5 minutes
- Manual refresh and data collection buttons

## Deployment Configuration

### Worker Deployment
```toml
# wrangler.toml
name = "claudometer-api"
main = "src/index.js"
compatibility_date = "2024-01-15"

[triggers]
crons = ["0 * * * *"]  # Hourly data collection

[[d1_databases]]
binding = "DB"
database_name = "claudometer-db"
database_id = "your-d1-database-id"
```

### Pages Deployment
- Connect GitHub repository
- Build command: `npm run build` (for React)
- Output directory: `build`
- Or upload zip with single `index.html`

## File Structure for Git Repository

```
claudometer/
├── worker/
│   ├── src/
│   │   └── index.js          # Complete worker code
│   ├── wrangler.toml         # Worker configuration
│   └── package.json
├── frontend/
│   ├── public/
│   │   └── index.html        # Simple HTML version
│   ├── src/
│   │   ├── App.js           # React component
│   │   └── index.js
│   └── package.json         # React dependencies
├── database/
│   └── schema.sql           # Database schema
└── README.md               # Setup instructions
```

## Recent Critical Fixes
1. **Reddit OAuth**: Added proper authentication (was failing with unauthenticated requests)
2. **API Key Fix**: Changed `env.ANTHROPIC_API_KEY` to `env.OPENAI_API_KEY`
3. **Weighted Sentiment**: Posts count 3x more than comments in overall sentiment
4. **Separate Storage**: Posts and comments in different tables
5. **Increased Data**: 20 posts + 5 comments per subreddit (vs 10 posts only)
6. **Rate Limiting**: 2-3 second delays between API calls

## Environment Setup for Local Development
```bash
# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create D1 database
wrangler d1 create claudometer-db

# Run database migrations
wrangler d1 execute claudometer-db --file=database/schema.sql

# Set environment variables
wrangler secret put REDDIT_CLIENT_ID
wrangler secret put REDDIT_CLIENT_SECRET  
wrangler secret put OPENAI_API_KEY

# Deploy worker
cd worker && wrangler deploy

# Deploy pages (via GitHub integration)
# Push to GitHub → Connect repo in Cloudflare Pages dashboard
```

This summary covers all components needed to recreate the full Claudometer system with proper Git integration.