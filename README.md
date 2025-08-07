# Claudometer 

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/GeorgeKouk/claudometer)](https://github.com/GeorgeKouk/claudometer/stargazers)
[![Live Demo](https://img.shields.io/badge/demo-live-green.svg)](https://claudometer.app)

Multi-platform AI sentiment tracking dashboard monitoring Claude, ChatGPT, and Gemini discussions across 9 Reddit communities with real-time analytics and platform comparison.

## 🌐 Live Demo

- **Web Application**: https://claudometer.app
- **API Endpoints**: https://api.claudometer.app

## Overview

Claudometer monitors Reddit discussions about major AI platforms and provides:

- **Multi-platform sentiment tracking** for Claude, ChatGPT, and Gemini
- **Interactive platform toggle controls** with client-side filtering  
- **Real-time sentiment analysis** using OpenAI GPT-4o-mini
- **Comparative analytics** across 9 Reddit communities
- **24-hour trend visualization** with chronological ordering
- **Topic and keyword analysis** with cross-platform aggregation
- **Platform-specific data collection** with staggered scheduling
- **Event timeline integration** for significant AI developments

## Architecture

- **Frontend**: React + TypeScript + Tailwind CSS (deployed on Cloudflare Pages)
- **Backend**: Cloudflare Workers with JavaScript
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV for API response caching (55-minute TTL)
- **External APIs**: Reddit OAuth + OpenAI GPT-4o-mini
- **Monitoring**: 
  - **Claude**: r/Anthropic, r/ClaudeAI, r/ClaudeCode
  - **ChatGPT**: r/ChatGPT, r/OpenAI, r/GPT4  
  - **Gemini**: r/GoogleAI, r/Bard, r/Gemini

## Features

### Dashboard
- **Platform toggle controls** with logo icons (Claude, ChatGPT, Gemini)
- **Client-side filtering** with instant aggregation across selected platforms
- **Sentiment gauge** with real-time scores and platform comparison
- **24-hour trend charts** with chronological ordering and post/comment counts
- **Topic breakdown** with cross-platform aggregation and color-coding
- **Trending keywords** analysis with weighted sentiment
- **Recent posts feed** with platform indicators and individual sentiment scores
- **Event timeline** integration for AI industry developments

### API Endpoints
- `GET /current-sentiment` - Multi-platform sentiment data (optional platform filtering)
- `GET /hourly-data` - 24-hour trend data with events (optional platform filtering)
- `GET /topics` - Topic breakdown analysis (optional platform filtering)
- `GET /keywords` - Trending keywords (optional platform filtering)
- `GET /recent-posts` - Recent posts feed (optional platform filtering)
- `GET /platforms` - Platform metadata with icons and configuration

### Performance
- **95% faster responses** with KV caching
- **Sub-second dashboard loads** when cache is warm
- **Automatic cache invalidation** after data updates

## Project Structure

```
Claudometer/
├── claudometer-web/          # React frontend
│   ├── src/
│   │   ├── App.tsx          # Main dashboard
│   │   ├── components/      # Reusable components
│   │   └── pages/           # Contact, Methodology pages
│   └── build/               # Production build
├── claudometer-worker/       # Cloudflare Workers API
│   ├── src/index.js         # Main worker with endpoints
│   └── wrangler.toml        # Cloudflare configuration
├── database/                 # Database migrations
└── docs/                    # Documentation
    ├── project-summary.md   # Complete project overview
    └── CLAUDE.md           # Technical implementation guide
```

## Setup & Development

### Prerequisites
- Node.js 16+
- Cloudflare account
- Reddit API application
- OpenAI API key

### Quick Start
1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/claudometer.git
   cd claudometer
   ```

2. **Set up the backend**
   ```bash
   cd claudometer-worker
   npm install
   
   # Configure secrets
   wrangler secret put REDDIT_CLIENT_ID
   wrangler secret put REDDIT_CLIENT_SECRET
   wrangler secret put OPENAI_API_KEY
   
   # Deploy
   npm run deploy
   ```

3. **Set up the frontend**
   ```bash
   cd ../claudometer-web
   npm install
   npm start  # Development server
   npm run build  # Production build
   ```

### Detailed Setup
See [project-summary.md](project-summary.md) and [CLAUDE.md](CLAUDE.md) for complete setup instructions including:
- Reddit API application setup
- Cloudflare D1 database creation
- KV namespace configuration
- Database migrations
- Deployment configuration

## Environment Variables

All sensitive credentials are managed via Cloudflare Workers secrets:

- `REDDIT_CLIENT_ID` - Reddit API client ID
- `REDDIT_CLIENT_SECRET` - Reddit API client secret
- `OPENAI_API_KEY` - OpenAI API key for sentiment analysis

## Data Collection

- **Frequency**: Every hour via Cloudflare Workers cron with staggered collection
- **Multi-Platform Schedule**: Claude (0-15min), ChatGPT (15-30min), Gemini (30-45min)
- **Sources**: 20 posts + 5 top comments per subreddit × 3 subreddits per platform
- **Analysis**: ALL fetched content analyzed with OpenAI (225 items/hour total)
- **Platform-Specific Prompts**: Tailored sentiment analysis for each AI platform
- **Storage**: Posts and comments stored separately with platform_id and weighted sentiment
- **Caching**: 55-minute API response cache with automatic invalidation after data collection

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **Reddit API** for providing access to community discussions
- **OpenAI** for sentiment analysis capabilities
- **Cloudflare** for the robust infrastructure platform
- **Claude AI community** for the engaging discussions we monitor

## Stats

- **Platforms**: 3 AI platforms (Claude, ChatGPT, Gemini)
- **Communities**: 9 subreddits monitored  
- **Data Collection**: 225 items analyzed hourly (75 per platform)
- **Analysis**: Platform-specific AI-powered sentiment scoring
- **Frontend**: Client-side platform filtering with instant aggregation
- **Performance**: <1s dashboard load times with 55-minute caching
- **Uptime**: 99.9% via Cloudflare infrastructure

---

**Live Site**: [claudometer.app](https://claudometer.app) | **API**: [api.claudometer.app](https://api.claudometer.app)