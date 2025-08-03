-- Migration 004: Add multi-platform support
-- Date: 2025-01-25
-- Purpose: Transform single-platform Claude data to support multiple AI platforms

-- Step 1: Create platforms table with metadata
CREATE TABLE platforms (
    id TEXT PRIMARY KEY,              -- 'claude', 'chatgpt', 'gemini'
    display_name TEXT NOT NULL,       -- 'Claude AI', 'ChatGPT', 'Google Gemini'
    color TEXT NOT NULL,              -- '#8B4513', '#10A37F', '#4285F4'  
    description TEXT,
    subreddits TEXT NOT NULL,         -- JSON array: '["Anthropic", "ClaudeAI"]'
    active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial platform data
INSERT INTO platforms (id, display_name, color, description, subreddits, active) VALUES
('claude', 'Claude AI', '#8B4513', 'Anthropic Claude AI assistant monitoring', '["Anthropic", "ClaudeAI", "ClaudeCode"]', true),
('chatgpt', 'ChatGPT', '#10A37F', 'OpenAI ChatGPT monitoring', '["ChatGPT", "OpenAI", "GPT4"]', true),
('gemini', 'Google Gemini', '#4285F4', 'Google Gemini AI monitoring', '["GoogleAI", "Bard", "Gemini"]', true);

-- Step 2: Add platform_id columns to existing tables with default 'claude'
-- This preserves all existing data as Claude platform data
-- Note: SQLite doesn't allow REFERENCES with DEFAULT, so we add them separately

-- Add platform_id to posts table
ALTER TABLE posts ADD COLUMN platform_id TEXT DEFAULT 'claude';

-- Add platform_id to comments table  
ALTER TABLE comments ADD COLUMN platform_id TEXT DEFAULT 'claude';

-- Add platform_id to sentiment_hourly table
ALTER TABLE sentiment_hourly ADD COLUMN platform_id TEXT DEFAULT 'claude';

-- Add platform_id to events table (create table if it doesn't exist)
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    event_date TEXT NOT NULL,
    event_type TEXT DEFAULT 'general',
    url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add platform_id column to events table
ALTER TABLE events ADD COLUMN platform_id TEXT DEFAULT 'claude';

-- Step 3: Update sentiment_hourly primary key to include platform_id
-- Since SQLite doesn't support modifying primary keys, we need to recreate the table

CREATE TABLE sentiment_hourly_new (
  hour TEXT,
  platform_id TEXT DEFAULT 'claude',
  avg_sentiment REAL,
  post_count INTEGER,
  keyword_counts TEXT,
  comment_count INTEGER DEFAULT 0,
  weighted_sentiment REAL DEFAULT 0.5,
  category_breakdown TEXT,
  PRIMARY KEY (hour, platform_id)
);

-- Copy existing data to new table
INSERT INTO sentiment_hourly_new (hour, platform_id, avg_sentiment, post_count, keyword_counts, comment_count, weighted_sentiment, category_breakdown)
SELECT hour, 'claude', avg_sentiment, post_count, keyword_counts, comment_count, weighted_sentiment, category_breakdown
FROM sentiment_hourly;

-- Replace old table with new one
DROP TABLE sentiment_hourly;
ALTER TABLE sentiment_hourly_new RENAME TO sentiment_hourly;

-- Step 4: Create performance indexes for multi-platform queries
CREATE INDEX IF NOT EXISTS idx_sentiment_hourly_platform_hour ON sentiment_hourly(platform_id, hour);
CREATE INDEX IF NOT EXISTS idx_posts_platform_processed ON posts(platform_id, processed_at);
CREATE INDEX IF NOT EXISTS idx_comments_platform_processed ON comments(platform_id, processed_at);
CREATE INDEX IF NOT EXISTS idx_posts_platform_subreddit ON posts(platform_id, subreddit);
CREATE INDEX IF NOT EXISTS idx_comments_platform_subreddit ON comments(platform_id, subreddit);
CREATE INDEX IF NOT EXISTS idx_events_platform_date ON events(platform_id, event_date);

-- Step 5: Ensure all existing data has platform_id = 'claude'
-- (This should already be set by DEFAULT, but ensure consistency)
UPDATE posts SET platform_id = 'claude' WHERE platform_id IS NULL OR platform_id = '';
UPDATE comments SET platform_id = 'claude' WHERE platform_id IS NULL OR platform_id = '';
UPDATE events SET platform_id = 'claude' WHERE platform_id IS NULL OR platform_id = '';

-- Step 6: Add NOT NULL constraints after backfilling data
-- Note: SQLite doesn't support adding NOT NULL to existing columns,
-- but the DEFAULT 'claude' ensures all new records will have a platform_id

-- Verification queries (commented out - run these manually to verify migration)
-- SELECT COUNT(*) as total_posts, platform_id FROM posts GROUP BY platform_id;
-- SELECT COUNT(*) as total_comments, platform_id FROM comments GROUP BY platform_id;  
-- SELECT COUNT(*) as total_hourly_records, platform_id FROM sentiment_hourly GROUP BY platform_id;
-- SELECT COUNT(*) as total_events, platform_id FROM events GROUP BY platform_id;
-- SELECT * FROM platforms;