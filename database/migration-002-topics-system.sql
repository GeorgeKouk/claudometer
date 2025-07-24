-- Migration 002: Replace categories with topics system
-- Date: 2025-01-24

-- Create topics table
CREATE TABLE IF NOT EXISTS topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  post_count INTEGER DEFAULT 0
);

-- Add topic_id columns to existing tables
ALTER TABLE posts ADD COLUMN topic_id INTEGER REFERENCES topics(id);
ALTER TABLE comments ADD COLUMN topic_id INTEGER REFERENCES topics(id);

-- Pre-populate with initial 10 topics
INSERT OR IGNORE INTO topics (name, description) VALUES
  ('Authentication', 'Login, API keys, permissions, and security'),
  ('Performance', 'Speed, optimization, efficiency, and resource usage'),
  ('Integration', 'Connecting with other tools, services, and platforms'),
  ('Troubleshooting', 'Bug reports, error solving, and technical issues'),
  ('Features', 'New capabilities, feature requests, and updates'),
  ('Documentation', 'Guides, examples, help requests, and tutorials'),
  ('Comparison', 'Claude vs other AI tools and competitive analysis'),
  ('Tutorial', 'How-to posts, learning content, and educational material'),
  ('Feedback', 'User experiences, suggestions, and product feedback'),
  ('Pricing', 'Cost discussions, plan questions, and billing topics');

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_topic_id ON posts(topic_id);
CREATE INDEX IF NOT EXISTS idx_comments_topic_id ON comments(topic_id);
CREATE INDEX IF NOT EXISTS idx_topics_name ON topics(name);

-- Update sentiment_hourly to track topic data instead of category
ALTER TABLE sentiment_hourly ADD COLUMN topic_breakdown TEXT;