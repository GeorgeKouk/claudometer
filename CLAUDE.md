# Claudometer Project - Development Guide

## Required Reading
**IMPORTANT**: Always read both files for complete project understanding:
- **project-summary.md** - Comprehensive project overview, architecture, and setup instructions
- **CLAUDE.md** (this file) - Technical implementation details and development behavior

## Technical Implementation Details

### Current Repository Structure
```
Claudometer/
├── claudometer-web/          # React frontend (Cloudflare Pages)
├── claudometer-worker/       # API backend (Cloudflare Workers)
├── project-summary.md        # Complete project overview and setup
└── CLAUDE.md                # This technical development guide
```

## Frontend (claudometer-web/)

### Key Files
- `src/App.tsx` - Main Claudometer dashboard component
- `package.json` - Dependencies (React, TypeScript, Recharts, Tailwind)
- `tailwind.config.js` - Tailwind CSS configuration

### Features
- Real-time sentiment meter with gauge visualization
- 24-hour trend charts using Recharts
- Category breakdown pie charts
- Trending keywords analysis
- Recent posts feed with sentiment scores

### Build Configuration
- **Framework**: Create React App (TypeScript)
- **Build Command**: `npm run build`
- **Output Directory**: `build/`
- **Root Directory**: `claudometer-web/`

## Backend (claudometer-worker/)

### Key Files
- `src/index.js` - Main worker with API endpoints, cron handlers, and KV caching logic
- `wrangler.toml` - Cloudflare Workers configuration with KV binding
- `package.json` - Dependencies and scripts

### API Endpoints (All Public Endpoints Cached for 55 Minutes)
- `GET /` - Health check
- `GET /current-sentiment` - Latest sentiment data (cached by period parameter)
- `GET /hourly-data` - 24-hour trend data (cached by period parameter)
- `GET /topics` - Category breakdown (cached by period parameter)
- `GET /keywords` - Trending keywords (cached by period parameter)
- `GET /recent-posts` - Recent posts feed (cached by period parameter)
- `GET /collect-data` - Manual data collection trigger (REMOVED for security - only accessible via cron)
- `GET /dev/*` - Development endpoints (DEV_MODE_ENABLED=true required)

### Cron Schedule
- **Frequency**: Every hour (`0 * * * *`)
- **Function**: Automated Reddit data collection and analysis

## Configuration & Secrets

### Cloudflare Workers Secrets (via Dashboard)
```bash
# Required environment variables
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
OPENAI_API_KEY=your_openai_api_key
```

### Reddit API Setup
- **Bot Account**: `claudometer_bot` (dedicated Reddit account for API access)
- **App Type**: Script (uses client credentials flow)
- **User-Agent**: `Claudometer/1.0.0 by /u/claudometer_bot`
- **Monitored Subreddits**: r/Anthropic, r/ClaudeAI, r/ClaudeCode

### Database Configuration
- **Type**: Cloudflare D1 SQLite database
- **Name**: `claudometer-db`
- **Database ID**: `a9446fa9-c70d-496f-b9e5-a636e72e8865`
- **Binding**: `DB` (accessible via `env.DB` in worker)

### Cache Configuration
- **Type**: Cloudflare KV store for API response caching
- **Namespace**: `claudometer-cache`
- **Production ID**: `237333e4f2b949d69dfc97a42a6fd780`
- **Preview ID**: `ba39558f32fe4bcbac01d3bd7859a5ec`
- **Binding**: `CLAUDOMETER_CACHE` (accessible via `env.CLAUDOMETER_CACHE` in worker)
- **TTL**: 55 minutes (safe buffer before hourly data updates)
- **Browser Cache**: 5 minutes via Cache-Control headers
- **Cache Keys**: Format `claudometer:endpoint:param=value`
- **Invalidation**: Automatic after hourly data collection

### Current Database Schema
```sql
-- Posts table
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT,
  subreddit TEXT,
  created_at TEXT,
  score INTEGER,
  sentiment REAL,
  category TEXT,
  keywords TEXT,
  processed_at TEXT DEFAULT (datetime('now'))
);

-- Comments table  
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  body TEXT,
  subreddit TEXT,
  score INTEGER,
  sentiment REAL,
  category TEXT,
  keywords TEXT,
  created_at TEXT,
  processed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

-- Hourly aggregation table
CREATE TABLE sentiment_hourly (
  hour TEXT PRIMARY KEY,
  avg_sentiment REAL,
  post_count INTEGER,
  category_breakdown TEXT,
  keyword_counts TEXT,
  comment_count INTEGER DEFAULT 0,
  weighted_sentiment REAL DEFAULT 0.5
);

-- Performance indexes
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_processed_at ON comments(processed_at);
CREATE INDEX idx_posts_processed_at ON posts(processed_at);
CREATE INDEX idx_posts_subreddit ON posts(subreddit);
CREATE INDEX idx_comments_subreddit ON comments(subreddit);
CREATE INDEX idx_sentiment_hourly_hour ON sentiment_hourly(hour);
```

## Deployment Process

### Cloudflare Pages Setup
1. **Repository**: Connected to GitHub repo
2. **Root Directory**: `claudometer-web`
3. **Framework**: Create React App
4. **Build Command**: `npm run build` (NOT `react-scripts build`)
5. **Output Directory**: `build`

### Cloudflare Workers Setup
1. **Configuration**: `wrangler.toml` in `claudometer-worker/`
2. **Secrets**: Set via Cloudflare dashboard
3. **Database**: D1 binding configured in wrangler.toml
4. **Cache**: KV namespace binding configured in wrangler.toml
5. **Cron**: Hourly trigger for data collection with automatic cache invalidation

### Git Integration
- **Single Repository**: Both frontend and backend in same repo
- **Auto Deploy**: Push to main branch triggers both deployments
- **Pages**: Builds from `claudometer-web/` directory
- **Workers**: Deploys from `claudometer-worker/` directory

## Development Commands

### Frontend Development
```bash
cd claudometer-web/
npm start          # Development server
npm run build      # Production build
npm test           # Run tests
```

### Backend Development
```bash
cd claudometer-worker/
npm install        # Install dependencies
npm run dev        # Local development with wrangler
npm run deploy     # Deploy to Cloudflare Workers
```

### Secrets Management
```bash
# Set secrets via wrangler CLI
wrangler secret put REDDIT_CLIENT_ID
wrangler secret put REDDIT_CLIENT_SECRET
wrangler secret put OPENAI_API_KEY

# Create KV namespaces for caching
npx wrangler kv namespace create CLAUDOMETER_CACHE
npx wrangler kv namespace create CLAUDOMETER_CACHE --preview
```

## Critical Implementation Notes

### Key API Behavior
- **Rate Limiting**: Always include 2-3 second delays between Reddit API calls
- **Authentication**: Use Reddit OAuth, not unauthenticated requests
- **OpenAI Integration**: Use `env.OPENAI_API_KEY` (not ANTHROPIC_API_KEY)
- **Weighted Sentiment**: Posts = 3x weight, Comments = 1x weight in calculations
- **Caching Strategy**: KV cache-first approach with 55-minute TTL and automatic invalidation
- **Performance**: ~95% faster responses when cache is warm, <1 second dashboard loads

### Data Collection Logic
- Fetch 20 posts + 5 top comments per subreddit (3 subreddits total)
- Analyze 10 posts + 15 comments with OpenAI (cost control)
- Store posts and comments in separate tables
- Generate hourly aggregations with weighted sentiment

## Troubleshooting

### Common Issues
- **Build Failures**: Check that `claudometer-web` directory contains proper React app
- **ESLint Errors in CI**: CI treats ESLint warnings as errors (`process.env.CI = true`). Fix all React hooks exhaustive-deps warnings by using `useCallback` for functions and adding proper dependencies to useEffect arrays
- **Worker Errors**: Verify all secrets are set in Cloudflare dashboard
- **Database Issues**: Ensure D1 database is created and bound correctly
- **API Failures**: Check Reddit API credentials and rate limits

### Monitoring
- **Worker Logs**: Available in Cloudflare dashboard
- **Pages Deployment**: Check build logs in Cloudflare Pages
- **Database Queries**: Monitor via Cloudflare D1 console

## Deployed URLs

### Production Environment
- **Web Application**: https://claudometer.app
- **API Backend**: https://api.claudometer.app

### API Endpoints (Production)
- Health check: https://api.claudometer.app/
- Current sentiment: https://api.claudometer.app/current-sentiment
- Hourly data: https://api.claudometer.app/hourly-data
- Categories: https://api.claudometer.app/topics
- Keywords: https://api.claudometer.app/keywords
- Recent posts: https://api.claudometer.app/recent-posts
- Manual data collection: REMOVED (only accessible via hourly cron)

## Support Resources
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Reddit API Documentation](https://www.reddit.com/dev/api/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)

## Development Environment Notes

### Cloudflare Tooling
- We installed wrangler and connected it to Cloudflare so you can access the D1 database and run the worker and app 