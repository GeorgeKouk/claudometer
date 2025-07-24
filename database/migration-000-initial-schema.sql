-- Migration 000: Initial Schema
-- Creates the base tables for the Claudometer project

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT,
  subreddit TEXT,
  created_at TEXT,
  score INTEGER,
  sentiment REAL,
  category TEXT,
  keywords TEXT,
  processed_at TEXT DEFAULT (datetime('now'))
);

-- Comments table  
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT,
  body TEXT,
  subreddit TEXT,
  score INTEGER,
  sentiment REAL,
  category TEXT,
  keywords TEXT,
  created_at TEXT,
  processed_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (post_id) REFERENCES posts(id)
);

-- Hourly aggregation table
CREATE TABLE IF NOT EXISTS sentiment_hourly (
  hour TEXT PRIMARY KEY,
  avg_sentiment REAL,
  post_count INTEGER,
  category_breakdown TEXT,
  keyword_counts TEXT,
  comment_count INTEGER DEFAULT 0,
  weighted_sentiment REAL DEFAULT 0.5
);