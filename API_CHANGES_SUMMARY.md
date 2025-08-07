# Multi-Platform API Changes Summary

## Overview
The Claudometer API has been updated to support multiple AI platforms (Claude, ChatGPT, Gemini) with **breaking changes** to response formats.

## ✅ Updated Endpoints

### 1. `/current-sentiment`
**Before:**
```json
{
  "latest_sentiment": 0.75,
  "avg_sentiment": 0.72,
  "latest_post_count": 12,
  "latest_comment_count": 45,
  "avg_post_count": 120,
  "avg_comment_count": 350
}
```

**After:**
```json
{
  "claude": {
    "display_name": "Claude",
    "color": "#8B4513",
    "latest_sentiment": 0.75,
    "avg_sentiment": 0.72,
    "latest_post_count": 12,
    "latest_comment_count": 45,
    "avg_post_count": 120,
    "avg_comment_count": 350
  },
  "chatgpt": {
    "display_name": "ChatGPT", 
    "color": "#10A37F",
    "latest_sentiment": 0.68,
    "avg_sentiment": 0.65,
    "latest_post_count": 8,
    "latest_comment_count": 32,
    "avg_post_count": 95,
    "avg_comment_count": 280
  },
  "gemini": {
    "display_name": "Gemini",
    "color": "#4285F4",
    "latest_sentiment": 0.71,
    "avg_sentiment": 0.69,
    "latest_post_count": 5,
    "latest_comment_count": 18,
    "avg_post_count": 50,
    "avg_comment_count": 150
  }
}
```

### 2. `/hourly-data` (Breaking Change)
**Before:**
```json
[
  {
    "time": "2025-08-02T10:00:00Z",
    "sentiment": 0.75,
    "post_count": 12,
    "comment_count": 45,
    "posts": 57
  }
]
```

**After:**
```json
{
  "data": [
    {
      "time": "2025-08-02T10:00:00Z",
      "platforms": {
        "claude": {
          "sentiment": 0.75,
          "post_count": 12,
          "comment_count": 45,
          "posts": 57
        },
        "chatgpt": {
          "sentiment": 0.68,
          "post_count": 8,
          "comment_count": 32,
          "posts": 40
        }
      }
    }
  ],
  "events": [
    {
      "id": 1,
      "title": "Claude 3.5 Release",
      "description": "Major update with improved capabilities",
      "date": "2025-08-02T09:00:00Z",
      "type": "release",
      "url": "https://example.com"
    }
  ],
  "platforms": [
    {
      "id": "claude",
      "name": "Claude", 
      "color": "#8B4513"
    },
    {
      "id": "chatgpt",
      "name": "ChatGPT",
      "color": "#10A37F"
    },
    {
      "id": "gemini",
      "name": "Gemini",
      "color": "#4285F4"
    }
  ]
}
```

### 3. `/recent-posts` (Enhanced)
**Before:**
```json
[
  {
    "id": 1,
    "subreddit": "r/ClaudeAI",
    "title": "Claude is amazing!",
    "sentiment": 0.8,
    "category": "Features",
    "time": "2h ago"
  }
]
```

**After:**
```json
[
  {
    "id": 1,
    "subreddit": "r/ClaudeAI", 
    "title": "Claude is amazing!",
    "sentiment": 0.8,
    "category": "Features",
    "time": "2h ago",
    "platform": {
      "id": "claude",
      "name": "Claude",
      "color": "#8B4513"
    }
  }
]
```

### 4. `/topics` (Enhanced with filtering)
**Unchanged format** but now supports:
- `?platform=claude` - Filter to specific platform
- Default: Aggregated across all platforms

### 5. `/keywords` (Enhanced with filtering)  
**Unchanged format** but now supports:
- `?platform=claude` - Filter to specific platform
- Default: Aggregated across all platforms

### 6. `/platforms` (New Endpoint)
```json
[
  {
    "id": "claude",
    "name": "Claude", 
    "color": "#8B4513",
    "description": "Anthropic Claude AI assistant monitoring",
    "subreddits": ["Anthropic", "ClaudeAI", "ClaudeCode"],
    "active": true,
    "icon": "/platform-logos/claude.webp"
  },
  {
    "id": "chatgpt",
    "name": "ChatGPT",
    "color": "#10A37F", 
    "description": "OpenAI ChatGPT monitoring",
    "subreddits": ["ChatGPT", "OpenAI", "GPT4"],
    "active": true,
    "icon": "/platform-logos/chatgpt.webp"
  },
  {
    "id": "gemini",
    "name": "Gemini",
    "color": "#4285F4",
    "description": "Google Gemini AI monitoring", 
    "subreddits": ["GoogleAI", "Bard", "Gemini"],
    "active": true,
    "icon": "/platform-logos/gemini.webp"
  }
]
```

## Platform Colors & Icons
- **Claude**: `#8B4513` (Brown) - `/platform-logos/claude.webp` (Diamond logo)
- **ChatGPT**: `#10A37F` (Green) - `/platform-logos/chatgpt.webp` (Starburst logo)
- **Gemini**: `#4285F4` (Blue) - `/platform-logos/gemini.webp` (Starburst logo)

## Query Parameters
All endpoints support:
- `?period=24h|7d|30d|all` (existing)
- `?platform=claude|chatgpt|gemini` (new - for filtering)

## Caching
- Platform-specific requests cached separately
- Cache keys include platform parameter when specified
- Cache invalidation works across all platforms

## Breaking Changes Summary
1. **`/current-sentiment`**: Returns object with platform keys instead of flat object
2. **`/hourly-data`**: Returns `{data: [...], events: [...], platforms: [...]}` instead of array
3. **`/recent-posts`**: Added `platform` object to each post

## Frontend Platform Toggle Implementation
The frontend now features client-side platform filtering:

### Platform Toggle UI
- **Toggle Controls**: Logo buttons between date controls and dashboard content
- **Visual Design**: Platform icons with color-matching when unselected, white when selected
- **Interaction**: Click to toggle platforms, minimum one platform required
- **Icon Assets**: WebP logos stored in `public/platform-logos/` (240x240px)

### Client-Side Data Processing
- **Efficient API Usage**: Single API call per endpoint returns platform-grouped data
- **Real-Time Filtering**: JavaScript aggregation based on selected platforms
- **Topic Aggregation**: Combines topics with same name across selected platforms
- **Keyword Aggregation**: Sums keyword counts across selected platforms
- **Chart Integration**: Platform sentiment lines conditionally rendered
- **Instant Updates**: All dashboard sections update simultaneously on toggle

### Technical Implementation
- **State Management**: `useState` for selected platforms array
- **Data Processing**: `useMemo` hooks for performance-optimized aggregation
- **CSS Masking**: Icons colored to match platform colors using CSS mask properties
- **Chronological Ordering**: Chart data sorted by timestamp (oldest to newest)

## Migration Guide
Frontend components need to be updated to:
1. Handle new multi-platform response structures
2. Iterate over platform keys in `/current-sentiment`
3. Access `.data` array in `/hourly-data` responses
4. Display platform information in recent posts
5. Use platform colors and icons for consistent UI theming
6. **NEW**: Implement client-side platform filtering and data aggregation