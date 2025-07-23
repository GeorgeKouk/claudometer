# Claudometer Project - Development Guide

## Project Overview
Claudometer is a real-time Reddit sentiment tracking dashboard that monitors Claude AI mentions across three subreddits (r/Anthropic, r/ClaudeAI, r/ClaudeCode). The system uses a Cloudflare-native architecture with automated data collection and AI-powered sentiment analysis.

## Architecture

### Repository Structure
```
Claudometer/
├── claudometer-web/          # React frontend (Cloudflare Pages)
├── claudometer-worker/       # API backend (Cloudflare Workers)
├── project_summary.md        # Original project specification
└── CLAUDE.md                # This development guide
```

### Technology Stack
- **Frontend**: React TypeScript with Tailwind CSS and Recharts
- **Backend**: Cloudflare Workers (JavaScript)
- **Database**: Cloudflare D1 (SQLite)
- **APIs**: Reddit OAuth, OpenAI GPT-3.5-turbo
- **Deployment**: Cloudflare Pages + Workers integration

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
- `src/index.js` - Main worker with API endpoints and cron handlers
- `wrangler.toml` - Cloudflare Workers configuration
- `package.json` - Dependencies and scripts

### API Endpoints
- `GET /` - Health check
- `GET /api/current-sentiment` - Latest sentiment data
- `GET /api/hourly-data` - 24-hour trend data
- `GET /api/categories` - Category breakdown
- `GET /api/keywords` - Trending keywords
- `GET /api/recent-posts` - Recent posts feed
- `GET /api/collect-data` - Manual data collection trigger

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

### Required Database Tables
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
  processed_at TEXT
);

-- Comments table  
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  content TEXT,
  subreddit TEXT,
  created_at TEXT,
  score INTEGER,
  sentiment REAL,
  category TEXT,
  keywords TEXT,
  processed_at TEXT
);

-- Hourly aggregation table
CREATE TABLE sentiment_hourly (
  hour TEXT PRIMARY KEY,
  avg_sentiment REAL,
  post_count INTEGER,
  comment_count INTEGER,
  weighted_sentiment REAL
);
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
4. **Cron**: Hourly trigger for data collection

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
```

## Data Flow

1. **Collection**: Cron job triggers hourly Reddit API calls
2. **Analysis**: Posts/comments sent to OpenAI for sentiment analysis
3. **Storage**: Results stored in D1 database with weighted sentiment calculation
4. **Aggregation**: Hourly summaries calculated and stored
5. **API**: Frontend fetches data via worker API endpoints
6. **Visualization**: React dashboard displays real-time sentiment data

## Future Enhancements

### Frontend Improvements
- [ ] Real-time data updates with WebSockets or polling
- [ ] Interactive filtering by subreddit and date range
- [ ] Export functionality for sentiment data
- [ ] Mobile-responsive design improvements

### Backend Improvements
- [ ] Rate limiting and caching for API endpoints
- [ ] Historical data retention policies
- [ ] Enhanced error handling and logging
- [ ] Additional sentiment analysis providers

### Infrastructure
- [ ] Custom domain setup
- [ ] CDN optimization
- [ ] Performance monitoring
- [ ] Automated testing pipeline

## Troubleshooting

### Common Issues
- **Build Failures**: Check that `claudometer-web` directory contains proper React app
- **Worker Errors**: Verify all secrets are set in Cloudflare dashboard
- **Database Issues**: Ensure D1 database is created and bound correctly
- **API Failures**: Check Reddit API credentials and rate limits

### Monitoring
- **Worker Logs**: Available in Cloudflare dashboard
- **Pages Deployment**: Check build logs in Cloudflare Pages
- **Database Queries**: Monitor via Cloudflare D1 console

## Deployed URLs

### Production Environment
- **Web Application**: https://claudometer.pages.dev
- **API Backend**: https://claudometer-api.georgekouk.workers.dev/api/

### API Endpoints (Production)
- Health check: https://claudometer-api.georgekouk.workers.dev/
- Current sentiment: https://claudometer-api.georgekouk.workers.dev/api/current-sentiment
- Hourly data: https://claudometer-api.georgekouk.workers.dev/api/hourly-data
- Categories: https://claudometer-api.georgekouk.workers.dev/api/categories
- Keywords: https://claudometer-api.georgekouk.workers.dev/api/keywords
- Recent posts: https://claudometer-api.georgekouk.workers.dev/api/recent-posts
- Manual data collection: https://claudometer-api.georgekouk.workers.dev/api/collect-data

## Support Resources
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [Reddit API Documentation](https://www.reddit.com/dev/api/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)