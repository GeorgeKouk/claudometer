-- Migration 001: Optimize Schema - Add missing indexes and subreddit column
-- Run with: npx wrangler d1 execute claudometer-db --remote --file=database/migration-001-optimize-schema.sql

-- Add missing subreddit column to comments table
ALTER TABLE comments ADD COLUMN subreddit TEXT;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_processed_at ON comments(processed_at);
CREATE INDEX IF NOT EXISTS idx_posts_processed_at ON posts(processed_at);
CREATE INDEX IF NOT EXISTS idx_posts_subreddit ON posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_comments_subreddit ON comments(subreddit);
CREATE INDEX IF NOT EXISTS idx_sentiment_hourly_hour ON sentiment_hourly(hour);

-- Update existing comments to have subreddit based on their post
UPDATE comments 
SET subreddit = (
    SELECT posts.subreddit 
    FROM posts 
    WHERE posts.id = comments.post_id
) 
WHERE subreddit IS NULL;