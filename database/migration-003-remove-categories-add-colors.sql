-- Migration 003: Remove categories and add topic colors
-- Date: 2025-01-24

-- Add color column to topics table
ALTER TABLE topics ADD COLUMN color TEXT;

-- Assign warm earthy colors to existing topics
UPDATE topics SET color = '#E6B891' WHERE name = 'Authentication';     -- Warm sand
UPDATE topics SET color = '#D4A574' WHERE name = 'Performance';        -- Light brown
UPDATE topics SET color = '#C8B99C' WHERE name = 'Integration';        -- Beige
UPDATE topics SET color = '#A8B5A3' WHERE name = 'Troubleshooting';    -- Sage green
UPDATE topics SET color = '#B8A082' WHERE name = 'Features';           -- Dusty brown
UPDATE topics SET color = '#D4C5B9' WHERE name = 'Documentation';      -- Light taupe
UPDATE topics SET color = '#C9A876' WHERE name = 'Comparison';         -- Golden tan
UPDATE topics SET color = '#B3A296' WHERE name = 'Tutorial';           -- Mushroom
UPDATE topics SET color = '#D2B48C' WHERE name = 'Feedback';           -- Tan
UPDATE topics SET color = '#C7B377' WHERE name = 'Pricing';            -- Olive tan

-- Remove category columns from posts and comments tables
-- Note: SQLite doesn't support DROP COLUMN, so we'll create new tables

-- Create new posts table without category column
CREATE TABLE posts_new (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT,
  subreddit TEXT,
  created_at TEXT,
  score INTEGER,
  sentiment REAL,
  keywords TEXT,
  topic_id INTEGER REFERENCES topics(id),
  processed_at TEXT DEFAULT (datetime('now'))
);

-- Copy data from old posts table
INSERT INTO posts_new (id, title, content, subreddit, created_at, score, sentiment, keywords, topic_id, processed_at)
SELECT id, title, content, subreddit, created_at, score, sentiment, keywords, topic_id, processed_at
FROM posts;

-- Drop old posts table and rename new one
DROP TABLE posts;
ALTER TABLE posts_new RENAME TO posts;

-- Create new comments table without category column
CREATE TABLE comments_new (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  body TEXT,
  subreddit TEXT,
  score INTEGER,
  sentiment REAL,
  keywords TEXT,
  topic_id INTEGER REFERENCES topics(id),
  created_at TEXT,
  processed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

-- Copy data from old comments table
INSERT INTO comments_new (id, post_id, body, subreddit, score, sentiment, keywords, topic_id, created_at, processed_at)
SELECT id, post_id, body, subreddit, score, sentiment, keywords, topic_id, created_at, processed_at
FROM comments;

-- Drop old comments table and rename new one
DROP TABLE comments;
ALTER TABLE comments_new RENAME TO comments;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_posts_topic_id ON posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_comments_topic_id ON comments(topic_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_processed_at ON comments(processed_at);
CREATE INDEX IF NOT EXISTS idx_posts_processed_at ON posts(processed_at);
CREATE INDEX IF NOT EXISTS idx_posts_subreddit ON posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_comments_subreddit ON comments(subreddit);
CREATE INDEX IF NOT EXISTS idx_topics_name ON topics(name);

-- Remove category_breakdown from sentiment_hourly and add topic_breakdown
CREATE TABLE sentiment_hourly_new (
  hour TEXT PRIMARY KEY,
  avg_sentiment REAL,
  post_count INTEGER,
  keyword_counts TEXT,
  comment_count INTEGER DEFAULT 0,
  weighted_sentiment REAL DEFAULT 0.5,
  topic_breakdown TEXT
);

-- Copy data from old sentiment_hourly table
INSERT INTO sentiment_hourly_new (hour, avg_sentiment, post_count, keyword_counts, comment_count, weighted_sentiment)
SELECT hour, avg_sentiment, post_count, keyword_counts, comment_count, weighted_sentiment
FROM sentiment_hourly;

-- Drop old sentiment_hourly table and rename new one
DROP TABLE sentiment_hourly;
ALTER TABLE sentiment_hourly_new RENAME TO sentiment_hourly;

-- Recreate sentiment_hourly index
CREATE INDEX IF NOT EXISTS idx_sentiment_hourly_hour ON sentiment_hourly(hour);