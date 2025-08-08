# Claudometer Project - Development Guide

## ⚠️ CRITICAL PRODUCTION SAFETY RULES ⚠️
**NEVER DEPLOY TO CLOUDFLARE WITHOUT EXPLICIT USER PERMISSION**
- **NEVER** run `npm run deploy` or `wrangler deploy` - these deploy to live Cloudflare Workers in production
- **NEVER** modify the production database without explicit user permission  
- **ALWAYS** ask before any action that affects the live application
- **REMEMBER**: Frontend and backend compatibility must be maintained - deploying incompatible API changes will break the live application
- **LOCAL DEVELOPMENT OK**: `npm run dev` and `wrangler dev` are safe for local testing

## Required Reading
**IMPORTANT**: Always read these files for complete project understanding:
- **PROJECT-OVERVIEW.md** - Comprehensive project overview, architecture, and setup instructions
- **CLAUDE.md** (this file) - Technical implementation details and development behavior
- **TODO.md** - Development priorities and planned optimizations

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
- **Real-time sentiment meter** with gauge visualization
- **Multi-platform toggle controls** with logo icons (Claude, ChatGPT, Gemini)
- **Client-side platform filtering** with instant response
- **24-hour trend charts** using Recharts with chronological ordering
- **Topic breakdown** pie charts with cross-platform aggregation
- **Trending keywords** analysis with weighted sentiment
- **Recent posts feed** with individual sentiment scores and platform indicators

### Build Configuration
- **Framework**: Create React App (TypeScript)
- **Build Command**: `npm run build`
- **Output Directory**: `build/`
- **Root Directory**: `claudometer-web/`

## Backend (claudometer-worker/)

### Modular Architecture
**Main Entry Point:**
- `src/index.js` - Request router, rate limiting (120 req/hour), and cron scheduler (137 lines)

**Handler Modules:**
- `src/handlers/api.handlers.js` - Multi-platform API endpoints with optional platform filtering
- `src/handlers/dev.handlers.js` - Development tools and debugging endpoints  
- `src/handlers/cron.handlers.js` - Staggered multi-platform data collection logic

**Service Modules:**
- `src/services/cache.service.js` - KV cache management with dynamic TTL
- `src/services/database.service.js` - Multi-platform database operations with platform_id support
- `src/services/reddit.service.js` - Platform-aware Reddit API integration with OAuth
- `src/services/ai.service.js` - Platform-specific OpenAI sentiment analysis with tailored prompts

**Utility & Configuration:**
- `src/utils/` - CORS headers, helpers, input sanitization, and output validation
- `src/config/platforms.js` - Platform definitions (Claude, ChatGPT, Gemini)
- `wrangler.toml` - Cloudflare Workers configuration with D1 and KV bindings
- `package.json` - Dependencies and scripts

### Multi-Platform API Endpoints (All Public Endpoints Cached for 55 Minutes)
**Public API (Rate Limited: 120 requests/hour per IP)**
- `GET /` - Health check
- `GET /current-sentiment` - Multi-platform sentiment data (optional `?platform=claude|chatgpt|gemini` filter)
- `GET /hourly-data` - Multi-platform time series with events (optional platform filter)
- `GET /topics` - Topic breakdown across platforms (optional platform filter)
- `GET /keywords` - Trending keywords analysis (optional platform filter)
- `GET /recent-posts` - Recent posts feed (optional platform filter)
- `GET /platforms` - Available platform metadata and configuration

**⚠️ Frontend Integration**: Current setup requires 6 API calls per dashboard load. See [TODO.md](TODO.md) for planned `/dashboard` endpoint optimization to reduce to 1 call.

### Frontend Platform Integration (Client-Side Filtering)
**Platform Toggle UI:**
- **Location**: Between date controls and dashboard content  
- **Design**: Platform logo buttons with names and visual feedback
- **Interaction**: Toggle platforms individually, minimum one platform required
- **Icons**: WebP logos stored in `public/platform-logos/` (240x240px)
  - `claude.webp` - Anthropic diamond logo
  - `chatgpt.webp` - OpenAI starburst logo  
  - `gemini.webp` - Google Gemini logo
- **Color Matching**: Icons dynamically colored to match platform colors when unselected

**Client-Side Aggregation Logic:**
- **API Efficiency**: Single API call per endpoint returns platform-grouped data
- **Real-Time Filtering**: `useMemo()` hooks aggregate selected platforms instantly
- **Topics Aggregation**: Combines same-name topics across platforms with weighted sentiment
- **Keywords Aggregation**: Sums keyword counts and calculates weighted sentiment
- **Chart Integration**: Platform lines conditionally rendered based on selection
- **Data Consistency**: All dashboard sections update simultaneously on platform toggle

### Development Endpoints (DEV_MODE_ENABLED=true required)
- `GET /dev/events-admin` - HTML interface for event management
- `GET /dev/events` - List all events
- `POST /dev/events` - Create new event
- `DELETE /dev/events/:id` - Delete event
- `GET /dev/clear-cache` - **CRITICAL**: Clear all cache for immediate testing
- `GET /dev/posts` - Debug posts data
- `POST /dev/reevaluate` - Re-analyze sentiment
- `POST /dev/rollback` - Rollback sentiment changes

### Multi-Platform Cron Schedule
- **Trigger**: Every hour (`0 * * * *`)
- **Staggered Collection**: Intelligent scheduling to avoid Reddit API limits
  - **0-15 minutes**: Claude data collection (r/Anthropic, r/ClaudeAI, r/ClaudeCode)
  - **15-30 minutes**: ChatGPT data collection (r/ChatGPT, r/OpenAI, r/GPT4)
  - **30-45 minutes**: Gemini data collection (r/GoogleAI, r/Bard, r/Gemini)
- **Total Volume**: ~225 items analyzed per hour (75 per platform × 3 platforms)
- **Cache Management**: Automatic invalidation after each platform's successful collection

## Configuration & Secrets

### Cloudflare Workers Secrets (via Dashboard)
```bash
# Required environment variables
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
OPENAI_API_KEY=your_openai_api_key
```

### Multi-Platform Reddit API Setup
- **Bot Account**: `claudometer_bot` (dedicated Reddit account for API access)
- **App Type**: Script (uses client credentials flow)
- **Platform-Specific User-Agents**: Each platform uses tailored User-Agent strings
- **Monitored Communities**:
  - **Claude**: r/Anthropic, r/ClaudeAI, r/ClaudeCode
  - **ChatGPT**: r/ChatGPT, r/OpenAI, r/GPT4
  - **Gemini**: r/GoogleAI, r/Bard, r/Gemini
- **Rate Limiting**: 2-3 second delays between requests, staggered collection times

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

### Current Database Tables
**Note**: Schema evolves over time. For current schema, query production database:
```bash
npx wrangler d1 execute claudometer-db --remote --command "PRAGMA table_info(table_name);"
```

**Main Tables:**
- `posts` - Reddit posts with sentiment analysis + platform_id for multi-platform support
- `comments` - Reddit comments with sentiment analysis + platform_id for multi-platform support
- `sentiment_hourly` - Hourly aggregated sentiment data (weighted: posts 3x, comments 1x)
- `platforms` - Platform configuration (claude, chatgpt, gemini) with colors, subreddits, descriptions, **and icon paths**
- `topics` - Topic definitions with colors (used by API endpoints)
- `events` - Event annotations for charts (id, title, description, event_date, event_type, url, created_at)

**System Tables:**
- `_cf_METADATA` - Cloudflare internal metadata
- `sqlite_sequence` - SQLite auto-increment sequences

## Deployment Process

### Cloudflare Pages Setup
1. **Repository**: Connected to GitHub repo
2. **Root Directory**: `claudometer-web`
3. **Framework**: Create React App
4. **Build Command**: `npm run build` (NOT `react-scripts build`)
5. **Output Directory**: `build`

### Cloudflare Workers Setup
1. **Configuration**: `wrangler.toml` in `claudometer-worker/`
2. **Secrets**: Set via Cloudflare dashboard (Reddit OAuth + OpenAI API key)
3. **Database**: D1 binding configured with platforms table for multi-platform support
4. **Cache**: KV namespace binding configured for 55-minute TTL with dynamic invalidation
5. **Cron**: Hourly trigger with intelligent staggered collection (Claude→ChatGPT→Gemini)
6. **Modular Architecture**: Clean separation of concerns across handlers, services, and utilities

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

### Multi-Platform API Behavior
- **Rate Limiting**: 120 requests/hour per IP (increased from 20 for multi-platform usage)
- **Staggered Collection**: 15-minute intervals per platform to avoid Reddit API limits
- **Platform-Specific Prompts**: Each platform uses tailored OpenAI analysis prompts for accuracy
- **Comprehensive Analysis**: ALL fetched content analyzed (225 items/hour total)
- **Authentication**: Reddit OAuth with platform-specific User-Agents
- **OpenAI Integration**: Use `env.OPENAI_API_KEY` with input sanitization and output validation
- **Weighted Sentiment**: Posts = 3x weight, Comments = 1x weight in sentiment calculations
- **Caching Strategy**: KV cache-first approach with 55-minute TTL and automatic invalidation per platform
- **Performance**: ~95% faster responses when cache is warm, <1 second dashboard loads
- **Security**: Comprehensive input sanitization and output validation against prompt injection

### CRITICAL: Cache Management for Development
- **Cache TTL**: 55 minutes - API changes may not be visible immediately
- **Testing New Features**: ALWAYS clear cache first using `/dev/clear-cache` endpoint
- **Dev Mode Required**: Set `DEV_MODE_ENABLED = "true"` in `wrangler.toml` for cache clearing
- **Cache Keys**: Format `claudometer:endpoint:param=value`
- **Cache Invalidation**: Automatic after hourly cron jobs, manual via dev endpoint

### Multi-Platform API Response Structure
- **Default Behavior**: All endpoints return data for ALL platforms unless filtered with `?platform=` parameter
- **Platform Filtering**: Optional `?platform=claude|chatgpt|gemini` parameter on all data endpoints
- **Data Format**: `{data: [{time, sentiment, post_count, comment_count, posts, platform_id}], events: [...]}`
- **Platform Metadata**: `/platforms` endpoint provides platform configuration and colors
- **Cross-Platform Events**: Timeline events that may affect multiple platforms simultaneously
- **Backward Compatibility**: Legacy single platform calls still supported for gradual migration

### Multi-Platform Data Collection Logic
**Per Platform Collection (Staggered 15-minute intervals):**
- Fetch 20 posts + 5 top comments per subreddit × 3 subreddits = ~75 items per platform
- Analyze ALL fetched content with OpenAI (no cost control limits - analyze everything)
- Use platform-specific analysis prompts for improved accuracy
- Store posts and comments in separate tables with platform_id
- Generate hourly aggregations with weighted sentiment (posts 3x, comments 1x)

**Total Volume Per Hour:**
- 3 platforms × 75 items = 225 total items analyzed
- Staggered collection prevents Reddit API rate limits
- Automatic cache invalidation after each platform's successful collection

## Troubleshooting

### Common Issues
- **Build Failures**: Check that `claudometer-web` directory contains proper React app
- **ESLint Errors in CI**: CI treats ESLint warnings as errors (`process.env.CI = true`). Fix all React hooks exhaustive-deps warnings by using `useCallback` for functions and adding proper dependencies to useEffect arrays
- **Worker Errors**: Verify all secrets are set in Cloudflare dashboard
- **Database Issues**: Ensure D1 database is created and bound correctly. **CRITICAL**: Platforms table must exist - no fallback data!
- **API Failures**: Check Reddit API credentials and rate limits. Staggered collection should prevent most rate limit issues
- **Cache Issues**: API changes not visible? Clear cache using `/dev/clear-cache` endpoint
- **Frontend Integration**: Dashboard requires 6 API calls - check rate limiting if users can't refresh
- **Platform Data Missing**: Verify platforms table has claude, chatgpt, gemini entries with proper JSON subreddit arrays

### Essential Development Commands
```bash
# Clear cache for immediate testing (DEV_MODE_ENABLED=true required)
curl "https://api.claudometer.app/dev/clear-cache"

# Check new API structure  
curl "https://api.claudometer.app/hourly-data?period=24h" | jq .

# Access events admin interface
open "https://api.claudometer.app/dev/events-admin"

# Query events directly
npx wrangler d1 execute claudometer-db --remote --command "SELECT * FROM events ORDER BY event_date DESC LIMIT 5;"
```

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
- Topics: https://api.claudometer.app/topics
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
- always ask for permission before deploying with wrangler