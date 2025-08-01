# Claudometer 📊

Real-time Reddit sentiment tracking for Claude AI mentions across r/Anthropic, r/ClaudeAI, and r/ClaudeCode.

## 🌐 Live Demo

- **Web Application**: https://claudometer.app
- **API Endpoints**: https://api.claudometer.app

## 📋 Overview

Claudometer monitors Reddit discussions about Claude AI and provides:

- **Real-time sentiment analysis** using OpenAI GPT-4o-mini
- **24-hour trend visualization** with interactive charts
- **Topic categorization** of discussions
- **Trending keywords** analysis
- **Event annotations** for significant moments
- **Hourly automated data collection**

## 🏗️ Architecture

- **Frontend**: React + TypeScript + Tailwind CSS (deployed on Cloudflare Pages)
- **Backend**: Cloudflare Workers with JavaScript
- **Database**: Cloudflare D1 (SQLite)
- **Cache**: Cloudflare KV for API response caching (55-minute TTL)
- **External APIs**: Reddit OAuth + OpenAI GPT-4o-mini
- **Monitoring**: r/Anthropic, r/ClaudeAI, r/ClaudeCode

## 🚀 Features

### Dashboard
- Sentiment gauge with real-time scores
- 24-hour trend charts with post/comment counts
- Topic breakdown with color-coded categories
- Trending keywords with sentiment weighting
- Recent posts feed with individual sentiment scores
- Event timeline integration

### API Endpoints
- `GET /current-sentiment` - Latest sentiment data
- `GET /hourly-data` - 24-hour trend data with events
- `GET /topics` - Topic breakdown analysis
- `GET /keywords` - Trending keywords
- `GET /recent-posts` - Recent posts feed

### Performance
- **95% faster responses** with KV caching
- **Sub-second dashboard loads** when cache is warm
- **Automatic cache invalidation** after data updates

## 📂 Project Structure

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

## 🛠️ Setup & Development

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

## 🔐 Environment Variables

All sensitive credentials are managed via Cloudflare Workers secrets:

- `REDDIT_CLIENT_ID` - Reddit API client ID
- `REDDIT_CLIENT_SECRET` - Reddit API client secret
- `OPENAI_API_KEY` - OpenAI API key for sentiment analysis

## 📊 Data Collection

- **Frequency**: Every hour via Cloudflare Workers cron
- **Sources**: 20 posts + 5 top comments per subreddit
- **Analysis**: 10 posts + 15 comments analyzed with OpenAI (cost control)
- **Storage**: Posts and comments stored separately with weighted sentiment
- **Caching**: 55-minute API response cache with automatic invalidation

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Reddit API** for providing access to community discussions
- **OpenAI** for sentiment analysis capabilities
- **Cloudflare** for the robust infrastructure platform
- **Claude AI community** for the engaging discussions we monitor

## 📈 Stats

- **Monitoring**: 3 subreddits
- **Data Points**: 180+ items collected hourly
- **Analysis**: AI-powered sentiment scoring
- **Uptime**: 99.9% via Cloudflare infrastructure
- **Performance**: <1s dashboard load times with caching

---

**Live Site**: [claudometer.app](https://claudometer.app) | **API**: [api.claudometer.app](https://api.claudometer.app)