# Database Migrations

## Running Migrations

### Remote Database (Production)
```bash
npx wrangler d1 execute claudometer-db --remote --file=database/migration-XXX-description.sql
```

### Local Database (Development)
```bash
npx wrangler d1 execute claudometer-db --file=database/migration-XXX-description.sql
```

## Migration History

### Migration 001: Optimize Schema
**File**: `migration-001-optimize-schema.sql`
**Status**: ✅ Applied
**Changes**:
- Added `subreddit` column to `comments` table
- Created performance indexes:
  - `idx_comments_post_id` 
  - `idx_comments_processed_at`
  - `idx_posts_processed_at`
  - `idx_posts_subreddit`
  - `idx_comments_subreddit`
  - `idx_sentiment_hourly_hour`
- Updated existing comments with subreddit data from linked posts

**Impact**: Improved query performance for filtering by subreddit and date ranges.