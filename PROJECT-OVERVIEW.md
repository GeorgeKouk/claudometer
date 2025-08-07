# Claudometer Project Summary

## Project Overview
Built a real-time Reddit sentiment tracking dashboard for **multi-platform AI assistant monitoring** across Claude AI, ChatGPT, and Google Gemini. Tracks sentiment mentions across 9 subreddit communities with staggered data collection to optimize API usage.

## Architecture
- **Backend**: Cloudflare Worker (API + data collection + KV caching)
- **Frontend**: Cloudflare Pages (React dashboard)
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV (API response caching)
- **External APIs**: Reddit OAuth, OpenAI GPT-4o-mini

## Backend - Cloudflare Worker

### Environment Variables Required
```
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
OPENAI_API_KEY=your_openai_api_key
DEV_MODE_ENABLED=false  # Set to "true" to enable dev endpoints
```

### KV Cache Configuration
```
Namespace: claudometer-cache
Binding: CLAUDOMETER_CACHE
TTL: 55 minutes (automatic expiry)
Cache Keys: claudometer:endpoint:params
Invalidation: Automatic after data collection
```

### Database Schema
See CLAUDE.md for current database schema and technical details.

### API Endpoints (All Cached for 55 Minutes)
**Public API Endpoints (Rate Limited: 120 requests/hour per IP)**
- `GET /` - Health check
- `GET /current-sentiment` - Multi-platform sentiment data (optional `?platform=claude|chatgpt|gemini` filter)
- `GET /hourly-data` - Multi-platform time series with events (optional platform filter)
- `GET /topics` - Topic breakdown across platforms (optional platform filter)
- `GET /keywords` - Trending keywords analysis (optional platform filter)
- `GET /recent-posts` - Recent posts feed (optional platform filter)
- `GET /platforms` - Available platform metadata and configuration

**Development Endpoints (DEV_MODE_ENABLED=true required)**
- `GET /dev/posts` - Debug posts data with filtering
- `POST /dev/reevaluate` - Re-analyze sentiment for selected items
- `POST /dev/rollback` - Rollback sentiment changes (TODO: implementation needed)
- `GET /dev/events-admin` - Events management interface
- `GET /dev/events` - List all events
- `POST /dev/events` - Create new event
- `PUT /dev/events/:id` - Update event (TODO: implementation needed)
- `DELETE /dev/events/:id` - Delete event
- `GET /dev/clear-cache` - Clear all cache entries

**⚠️ Rate Limiting Note**: Frontend requires 6 API calls per dashboard load. See [TODO.md](TODO.md) for planned `/dashboard` endpoint optimization.

### Multi-Platform Data Collection Process
**Staggered Collection Schedule (Per Hour):**
- **0-15 minutes**: Claude AI data collection (r/Anthropic, r/ClaudeAI, r/ClaudeCode)
- **15-30 minutes**: ChatGPT data collection (r/ChatGPT, r/OpenAI, r/GPT4)  
- **30-45 minutes**: Google Gemini data collection (r/GoogleAI, r/Bard, r/Gemini)

**Collection Process Per Platform:**
1. **Reddit OAuth**: Authenticates with platform-specific User-Agent
2. **Fetch Data**: 20 posts + 5 top comments per subreddit × 3 subreddits = ~75 posts + ~15 comments per platform
3. **OpenAI Analysis**: Sentiment analysis on ALL fetched content (225 total items per hour across all platforms)
4. **Platform-Specific Prompts**: Each platform uses tailored analysis prompts for accuracy
5. **Weighted Scoring**: Posts = 3x weight, Comments = 1x weight (for sentiment calculations only)
6. **Storage**: Separate tables for posts/comments with platform_id + hourly aggregation
7. **Cache Invalidation**: Automatic cache clearing after successful data collection

### Modular Architecture (Post-Refactoring)
**Handler Modules:**
- `api.handlers.js` - Multi-platform API endpoints with optional platform filtering
- `dev.handlers.js` - Development tools and debugging endpoints
- `cron.handlers.js` - Staggered multi-platform data collection logic

**Service Modules:**
- `cache.service.js` - KV cache management with dynamic TTL
- `database.service.js` - Multi-platform database operations with platform_id support
- `reddit.service.js` - Platform-aware Reddit API integration with OAuth
- `ai.service.js` - Platform-specific OpenAI sentiment analysis with tailored prompts

**Utility Modules:**
- `cors.js` - Environment-based CORS header management
- `helpers.js` - Time formatting and text utilities
- `validation.js` - Input sanitization and output validation for security

**Configuration:**
- `platforms.js` - Platform definitions (Claude, ChatGPT, Gemini) with subreddits, prompts, schedules, and rate limits

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

### Multi-Platform Frontend Features (**IMPLEMENTED**)
- **Interactive Platform Toggles**: Logo buttons with dynamic color matching and visual feedback
- **Client-Side Filtering**: Instant platform selection with real-time data aggregation
- **Platform Icons**: WebP logo assets (240x240px) with CSS masking for color consistency
- **Cross-Platform Aggregation**: Topics and keywords combined across selected platforms
- **Comparative Sentiment Charts**: Multiple platform lines with chronological ordering
- **Unified Dashboard Updates**: All sections update simultaneously on platform toggle
- **Efficient API Integration**: Single endpoint calls with client-side data processing

**Current API Integration**: 6 calls per dashboard load (see [TODO.md](TODO.md) for optimization plan)

## Deployment Configuration

### Worker Deployment
```toml
# wrangler.toml
name = "claudometer-api"
main = "src/index.js"
compatibility_date = "2024-01-15"

[triggers]
crons = ["0 * * * *"]  # Hourly trigger for staggered multi-platform data collection

[[d1_databases]]
binding = "DB"
database_name = "claudometer-db"
database_id = "your-d1-database-id"

[[kv_namespaces]]
binding = "CLAUDOMETER_CACHE"
id = "your-kv-namespace-id"
preview_id = "your-preview-kv-namespace-id"
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

## Major Architecture Updates

### Multi-Platform Transformation
1. **Platform Expansion**: Extended from Claude-only to Claude + ChatGPT + Gemini monitoring
2. **Staggered Collection**: Implemented intelligent scheduling to avoid Reddit API limits
3. **Platform-Specific Configuration**: Separate subreddit lists, analysis prompts, and rate limits per platform
4. **Modular Refactoring**: Transformed 1200+ line monolith into organized modular architecture
5. **Database Evolution**: Added platform_id support and platforms configuration table with icon paths

### Frontend Platform Integration (Latest)
6. **Interactive Platform Toggles**: Logo-based controls with dynamic visual feedback
7. **Client-Side Data Aggregation**: Real-time filtering and cross-platform data combination
8. **Visual Design System**: Platform icons with CSS masking for consistent color theming
9. **Performance Optimization**: Single API calls with JavaScript-based data processing
10. **Chronological Chart Ordering**: Fixed sentiment timeline to show oldest-to-newest progression

### Performance & Reliability Improvements
11. **Enhanced Rate Limiting**: Increased from 20 to 120 requests/hour for better usability
12. **Comprehensive Analysis**: Now analyzes ALL fetched content (225 items/hour) instead of subset
13. **Advanced Caching**: KV cache system with 55-minute TTL + automatic invalidation
14. **Security Hardening**: Input sanitization and output validation against prompt injection
15. **Production Monitoring**: Comprehensive error handling and logging throughout

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

# Create KV namespaces for caching
npx wrangler kv namespace create CLAUDOMETER_CACHE
npx wrangler kv namespace create CLAUDOMETER_CACHE --preview

# Deploy worker
cd worker && wrangler deploy

# Deploy pages (via GitHub integration)
# Push to GitHub → Connect repo in Cloudflare Pages dashboard
```

This summary covers all components needed to recreate the full Claudometer system with proper Git integration.