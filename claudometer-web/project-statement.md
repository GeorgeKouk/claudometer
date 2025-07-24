# Claudometer Project Specification

## Project Overview

Claudometer is a web-based application that measures community sentiment around Claude AI across Reddit communities in near-real time. The application provides sentiment analysis, product categorization, topic extraction, and trending insights through an intuitive dashboard optimized for both web and mobile viewing.

## Core Features

### 1. Sentiment Analysis
- **Primary Feature**: Sentiment scoring from 0-100 (0 = very negative, 100 = very positive)
- **AI Model**: GPT-4 Mini via OpenAI API for unbiased analysis
- **Scoring Method**: Increments of 5 (25%, 30%, 70%, etc.) with accurate averaging
- **Content Analysis**: Analyzes both post titles and content to detect sarcasm and alternative meanings
- **Sarcasm Detection**: Additional sarcasm confidence score (0-100%) displayed as "Sarcasm?" label for context

### 2. Weighted Scoring System
- **Post Weight**: 3x multiplier for post sentiment scores
- **Comment Weight**: 1x multiplier for comment sentiment scores
- **Calculation**: `(Post_Score × 3 + Comment_Score × 1) / (3 + 1)`
- **Example**: Post (80%) + Comment (40%) = (240 + 40) / 4 = 70% final score

### 3. Product Categorization
Posts (not comments) are categorized into predefined products:
1. **Claude Code**
2. **Claude Web/Desktop**
3. **Claude Models**
4. **Claude API**
5. **Other**

- **Display**: Percentage breakdown of content per product category
- **Analytics**: Average sentiment score per product category
- **Assignment**: AI selects the most prevalent and obvious single category per post

### 4. AI-Generated Topics
- **Dynamic Creation**: AI determines topics from post/comment content
- **Topic Management**: AI can select existing topics or create new ones when necessary
- **Purpose**: Quick insight into current discussion themes
- **Storage**: Topic names stored with assigned colors

### 5. Keyword Extraction
- **Format**: Single words or phrases (2-3 words maximum)
- **Display**: Top 10 trending keywords with usage frequency bars
- **Source**: Extracted from both posts and comments

### 6. Recent Posts Feed
- **Count**: 10 most recent posts (chronologically)
- **Information Displayed**:
  - Post title
  - Subreddit source
  - Product category
  - Time since posted
  - Sentiment score (color-coded with description)

## Technical Architecture

### Data Collection
- **Platform**: Cloudflare Workers with D1 database binding
- **Schedule**: Cron job every 1 hour
- **Time Window**: **CRITICAL** - Only collect posts and comments from the past hour (60 minutes prior to execution time)
  - **Duplication Prevention**: Strict time filtering to avoid processing the same content multiple times
  - **Time Boundaries**: Inclusive of content from exactly 60 minutes ago, exclusive of content older than 60 minutes
- **Reddit Sources**: 
  - r/Anthropic
  - r/ClaudeAI 
  - r/ClaudeCode
- **Volume**: 20 posts + 10 comments per subreddit per hour (only from the past hour timeframe)
- **APIs**: Reddit API for data collection, OpenAI API for analysis

### Data Processing Pipeline
1. **Collection**: Gather posts and comments via Reddit API
2. **Sentiment Analysis**: Process through GPT-4 Mini with carefully crafted prompts
3. **Categorization**: Assign product categories to posts
4. **Topic Extraction**: Generate or assign topics to all content
5. **Keyword Extraction**: Extract trending keywords and phrases
6. **Storage**: Save processed data to D1 database
7. **Aggregation**: Calculate weighted sentiment scores and statistics

## User Interface

### Core Display Elements
- **Sentiment Odometer**: Main sentiment score visualization (0-100)
- **Trend Graph**: Sentiment score progression over time
- **Product Breakdown**: Percentage distribution and average sentiment per product
- **Topic Cloud**: AI-generated topics with visual indicators
- **Keyword Trends**: Top 10 keywords with usage frequency bars
- **Recent Posts**: Latest 10 posts with metadata and sentiment scores

### Filtering Options
- **Time Period Dropdown**:
  - 24 hours (default)
  - 7 days
  - 30 days
  - All time
- **Product Filter Dropdown**: View statistics for individual product categories
- **Data Aggregation**: Recalculate and redraw interface based on selected time period

### Mobile Responsiveness
- **Optimization**: Designed for both web and mobile viewing
- **Layout Considerations**: Careful attention to padding, spacing, and alignment for compressed mobile displays
- **Feature Parity**: All features accessible on mobile with appropriate scaling

## Design Specifications

### Color Scheme
- **Background**: Light brown for most elements
- **Text/Elements**: Darker brown colors
- **Sentiment Colors**:
  - **Negative (0-20%)**: Full red gradient
  - **Neutral (20-80%)**: Red → Gray → Green gradient  
  - **Positive (80-100%)**: Full green gradient
  - **Increments**: Color intensity changes every 10%
- **Product Colors**: Platform-appropriate colors (to be defined during implementation)
- **Topic Colors**: Dynamically assigned and stored with topic data

### Data Refresh Strategy
- **Historical Views**: Query and aggregate data from D1 database for selected time periods
- **Real-time Updates**: Hourly batch processing provides near-real-time insights
- **Performance**: Optimized queries for fast dashboard loading

## Implementation Notes

### API Considerations
- **Reddit API**: OAuth authentication required, rate limits managed within 60 posts/comments per hour limit
- **OpenAI API**: GPT-4 Mini for cost-effective sentiment analysis
- **Prompt Engineering**: Sophisticated prompts for accurate sentiment, sarcasm detection, and categorization

### Database Schema Considerations
- Posts and comments with sentiment scores and metadata
- Product category assignments
- Dynamic topic storage with colors
- Keyword frequency tracking
- Hourly aggregation tables for performance

### Error Handling
- API rate limit management
- Fallback strategies for failed analyses
- Data validation and cleaning processes

## Success Metrics

- **Accuracy**: Reliable sentiment scoring with sarcasm detection
- **Performance**: Sub-second dashboard loading times
- **Coverage**: Consistent hourly data collection from all target subreddits
- **Usability**: Intuitive interface accessible across devices
- **Insights**: Actionable sentiment trends and community discussion patterns