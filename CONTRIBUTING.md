# Contributing to Claudometer 🤝

Thank you for your interest in contributing to Claudometer! This guide will help you get started with development and contributions.

## 🚀 Getting Started

### Prerequisites
- Node.js 16 or higher
- Cloudflare account (free tier works)
- Reddit account for API access
- OpenAI API key

### Development Setup

1. **Fork and Clone**
   ```bash
   git fork https://github.com/username/claudometer.git
   cd claudometer
   ```

2. **Backend Setup (claudometer-worker/)**
   ```bash
   cd claudometer-worker
   npm install
   
   # Install Cloudflare CLI if not already installed
   npm install -g wrangler
   
   # Login to Cloudflare
   wrangler login
   ```

3. **Create Your Own Resources**
   
   **D1 Database:**
   ```bash
   # Create database
   wrangler d1 create claudometer-db-dev
   
   # Update wrangler.toml with your database ID
   # Run migrations
   wrangler d1 migrations apply claudometer-db-dev --local
   ```
   
   **KV Cache:**
   ```bash
   # Create KV namespaces
   wrangler kv namespace create CLAUDOMETER_CACHE
   wrangler kv namespace create CLAUDOMETER_CACHE --preview
   
   # Update wrangler.toml with your KV IDs
   ```

4. **Configure Secrets**
   ```bash
   # Set up your API credentials
   wrangler secret put REDDIT_CLIENT_ID
   wrangler secret put REDDIT_CLIENT_SECRET
   wrangler secret put OPENAI_API_KEY
   ```

5. **Frontend Setup (claudometer-web/)**
   ```bash
   cd ../claudometer-web
   npm install
   npm start  # Starts development server on http://localhost:3000
   ```

## 🔧 Development Workflow

### Backend Development
```bash
cd claudometer-worker

# Start local development server
npm run dev

# Deploy to Cloudflare (your account)
npm run deploy

# Enable dev mode for testing
# In wrangler.toml: DEV_MODE_ENABLED = "true"

# Clear cache during development
curl "https://your-worker.your-subdomain.workers.dev/dev/clear-cache"
```

### Frontend Development
```bash
cd claudometer-web

# Start development server
npm start

# Run tests
npm test

# Build for production
npm run build

# Type checking
npx tsc --noEmit
```

## 🧪 Testing

### API Testing
```bash
# Test main endpoints
curl "https://your-worker.your-subdomain.workers.dev/current-sentiment"
curl "https://your-worker.your-subdomain.workers.dev/hourly-data"
curl "https://your-worker.your-subdomain.workers.dev/topics"

# Dev endpoints (when DEV_MODE_ENABLED=true)
curl "https://your-worker.your-subdomain.workers.dev/dev/clear-cache"
curl "https://your-worker.your-subdomain.workers.dev/dev/events"
```

### Database Testing
```bash
# Local database operations
wrangler d1 execute claudometer-db-dev --local --command "SELECT COUNT(*) FROM posts"

# Remote database operations  
wrangler d1 execute claudometer-db-dev --remote --command "SELECT COUNT(*) FROM posts"
```

## 📋 Code Guidelines

### JavaScript/TypeScript
- Use meaningful variable names
- Add comments for complex logic
- Follow existing code patterns
- Use environment variables via `env.*`

### React Components
- Use TypeScript interfaces for props
- Follow existing component structure
- Use Tailwind CSS for styling
- Keep components focused and reusable

### API Development
- Always validate input parameters
- Use proper HTTP status codes
- Include CORS headers for browser requests
- Cache responses when appropriate
- Handle errors gracefully

### Database
- Use prepared statements for queries
- Include proper indexes for performance
- Write migrations for schema changes
- Test both local and remote databases

## 🔄 Contribution Process

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Follow code guidelines
   - Test thoroughly
   - Update documentation if needed

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

4. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   
   Then create a Pull Request on GitHub.

## 🐛 Bug Reports

When reporting bugs, please include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Browser/environment details
- Console errors (if applicable)

Use this template:
```markdown
**Bug Description:**
Brief description of the bug

**Steps to Reproduce:**
1. Go to...
2. Click on...
3. See error

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Environment:**
- Browser: Chrome 120
- OS: macOS 14
- URL: claudometer.app
```

## 💡 Feature Requests

For new features:
- Describe the feature and use case
- Explain why it would be valuable
- Consider implementation complexity
- Discuss API implications if applicable

## 🏗️ Architecture Notes

### Key Components
- **Data Collection**: `collectRedditData()` runs hourly via cron
- **Sentiment Analysis**: `analyzeWithOpenAI()` processes posts/comments
- **Caching**: KV store with 55-minute TTL
- **Database**: D1 SQLite with hourly aggregations

### Performance Considerations
- API responses are cached for 55 minutes
- Use `DEV_MODE_ENABLED=true` and `/dev/clear-cache` during development
- Database queries use prepared statements
- Frontend uses React.memo for expensive components

### Security Best Practices
- Never commit API keys or secrets
- Use Cloudflare Workers secrets for credentials
- Validate all user inputs
- Use prepared statements to prevent SQL injection

## 📚 Resources

- [Project Summary](project-summary.md) - Complete project overview
- [Technical Guide](CLAUDE.md) - Implementation details
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/)
- [Reddit API Docs](https://www.reddit.com/dev/api/)
- [OpenAI API Docs](https://platform.openai.com/docs/)

## ❓ Getting Help

- **GitHub Issues**: For bugs and feature requests
- **Discussions**: For questions and general discussion
- **Documentation**: Check project-summary.md and CLAUDE.md first

## 🎯 Good First Issues

Looking for ways to contribute? Try these:
- Improve error handling in API endpoints
- Add new chart visualizations
- Enhance mobile responsiveness
- Add more comprehensive tests
- Improve documentation
- Optimize database queries

## 📝 Development Notes

### Cache Management
During development, frequently clear the KV cache:
```bash
curl "https://your-worker.workers.dev/dev/clear-cache"
```

### Database Migrations
Always test migrations locally first:
```bash
wrangler d1 migrations apply claudometer-db-dev --local
```

### Environment Variables
Use the dev environment variables in `wrangler.toml`:
```toml
[vars]
DEV_MODE_ENABLED = "true"  # Enable dev endpoints
```

---

Happy contributing! 🚀