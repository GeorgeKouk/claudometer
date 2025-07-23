import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Claudometer = () => {
  const [timeframe, setTimeframe] = useState('24h');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentSentiment, setCurrentSentiment] = useState(0.5);
  const [hourlyData, setHourlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [keywordData, setKeywordData] = useState([]);
  const [recentPosts, setRecentPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_BASE = 'https://claudometer-api.georgekouk.workers.dev/api';

  // Fetch data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch all data in parallel
        const [currentRes, hourlyRes, categoriesRes, keywordsRes, postsRes] = await Promise.all([
          fetch(`${API_BASE}/current-sentiment`),
          fetch(`${API_BASE}/hourly-data`),
          fetch(`${API_BASE}/categories`),
          fetch(`${API_BASE}/keywords`),
          fetch(`${API_BASE}/recent-posts`)
        ]);

        // Parse responses
        const currentData = await currentRes.json();
        const hourlyDataRaw = await hourlyRes.json();
        const categoriesDataRaw = await categoriesRes.json();
        const keywordsDataRaw = await keywordsRes.json();
        const postsDataRaw = await postsRes.json();

        // Update state
        setCurrentSentiment(currentData.avg_sentiment || 0.5);
        setHourlyData(hourlyDataRaw || []);
        setCategoryData(categoriesDataRaw || []);
        setKeywordData(keywordsDataRaw || []);
        setRecentPosts(postsDataRaw || []);

      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    
    // Refresh data every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const getSentimentColor = (sentiment: number) => {
    if (sentiment >= 0.7) return '#22c55e'; // Light green - positive
    if (sentiment >= 0.5) return '#94a3b8'; // Light gray - neutral  
    return '#ef4444'; // Light red - negative
  };

  const getSentimentLabel = (sentiment: number) => {
    if (sentiment >= 0.8) return 'Very Positive';
    if (sentiment >= 0.7) return 'Positive';
    if (sentiment >= 0.6) return 'Slightly Positive';
    if (sentiment >= 0.5) return 'Neutral';
    if (sentiment >= 0.4) return 'Slightly Negative';
    if (sentiment >= 0.3) return 'Negative';
    return 'Very Negative';
  };

  const SentimentMeter = ({ value }: { value: number }) => {
    const angle = (value * 180) - 90; // Convert 0-1 to -90 to 90 degrees
    const color = getSentimentColor(value);
    
    return (
      <div className="mx-auto mb-4">
        <div className="relative w-64 h-40 mx-auto">
          <svg viewBox="0 0 200 130" className="w-full h-full">
            {/* Background arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke="#f6ede5"
              strokeWidth="16"
            />
            {/* Sentiment arc */}
            <path
              d="M 20 100 A 80 80 0 0 1 180 100"
              fill="none"
              stroke={color}
              strokeWidth="16"
              strokeDasharray={`${value * 251.2} 251.2`}
              className="transition-all duration-1000 drop-shadow-sm"
            />
            {/* Center dot */}
            <circle cx="100" cy="100" r="6" fill="#8b4513" />
            {/* Needle */}
            <line
              x1="100"
              y1="100"
              x2="100"
              y2="45"
              stroke="#8b4513"
              strokeWidth="3"
              transform={`rotate(${angle} 100 100)`}
              className="transition-transform duration-1000 drop-shadow-sm"
            />
          </svg>
        </div>
        <div className="text-center -mt-2">
          <div className="text-4xl font-bold" style={{ color: '#8b4513' }}>
            {(value * 100).toFixed(0)}%
          </div>
          <div className="text-sm font-medium" style={{ color: '#9f6841' }}>
            {getSentimentLabel(value)}
          </div>
        </div>
      </div>
    );
  };

  // Category colors - semantically meaningful and distinct from warm theme
  const COLORS = [
    '#3b82f6', // Bright blue for Web Interface (web/browser association)
    '#8b5cf6', // Purple for Claude Code (developer/terminal association) 
    '#059669', // Emerald green for API (technical/data association)
    '#f59e0b'  // Amber/orange for General (warm, approachable)
  ];

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #fbf6f2 0%, #f6ede5 50%, #ead1bf 100%)' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: 'linear-gradient(135deg, #d4a37f 0%, #b8974a 100%)' }}>
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="text-5xl font-bold" style={{ color: '#8b4513' }}>
              Claudometer
            </h1>
          </div>
          <p className="text-lg font-medium max-w-2xl mx-auto" style={{ color: '#9f6841' }}>
            Real-time community sentiment tracking for Claude AI across Reddit communities
          </p>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mb-10">
          <select 
            value={timeframe} 
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-6 py-3 border-0 rounded-xl shadow-sm font-medium focus:ring-2 focus:outline-none transition-all"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.9)', 
              color: '#8b4513'
            }}
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <select 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-6 py-3 border-0 rounded-xl shadow-sm font-medium focus:ring-2 focus:outline-none transition-all"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.9)', 
              color: '#8b4513'
            }}
          >
            <option value="all">All Categories</option>
            <option value="web">Web Interface</option>
            <option value="code">Claude Code</option>
            <option value="api">API</option>
          </select>
        </div>

        {/* Loading/Error States */}
        {loading && (
          <div className="text-center py-12">
            <div className="text-2xl font-semibold" style={{ color: '#8b4513' }}>
              Loading sentiment data...
            </div>
          </div>
        )}

        {error && (
          <div className="text-center py-12">
            <div className="text-2xl font-semibold text-red-600">
              {error}
            </div>
            <div className="text-sm mt-2" style={{ color: '#9f6841' }}>
              Please try refreshing the page
            </div>
          </div>
        )}

        {/* Main Dashboard */}
        {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          {/* Sentiment Meter */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl shadow-lg border p-8" style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              borderColor: 'rgba(212, 163, 127, 0.3)'
            }}>
              <h3 className="text-xl font-semibold text-center mb-6" style={{ color: '#8b4513' }}>
                Current Community Sentiment
              </h3>
              <SentimentMeter value={currentSentiment} />
              <div className="text-center text-sm font-medium mt-2" style={{ color: '#9f6841' }}>
                Based on {hourlyData.reduce((sum, d) => sum + d.posts, 0)} posts/comments
              </div>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl shadow-lg border p-8" style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              borderColor: 'rgba(212, 163, 127, 0.3)'
            }}>
              <h3 className="text-xl font-semibold mb-6" style={{ color: '#8b4513' }}>
                Sentiment Trend (24h)
              </h3>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ead1bf" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fill: '#9f6841', fontSize: 12 }}
                    axisLine={{ stroke: '#ead1bf' }}
                  />
                  <YAxis 
                    domain={[0, 1]} 
                    tickFormatter={(value) => (value * 100).toFixed(0) + '%'}
                    tick={{ fill: '#9f6841', fontSize: 12 }}
                    axisLine={{ stroke: '#ead1bf' }}
                  />
                  <Tooltip 
                    formatter={(value) => [(Number(value) * 100).toFixed(1) + '%', 'Sentiment']}
                    labelStyle={{ color: '#8b4513' }}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(139, 69, 19, 0.1)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="sentiment" 
                    stroke="#d4a37f" 
                    strokeWidth={3}
                    dot={{ fill: '#d4a37f', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 7, stroke: '#d4a37f', strokeWidth: 2, fill: '#ffffff' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Category and Keyword Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
          {/* Category Breakdown */}
          <div className="rounded-2xl shadow-lg border p-8" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: 'rgba(212, 163, 127, 0.3)'
          }}>
            <h3 className="text-xl font-semibold mb-6" style={{ color: '#8b4513' }}>
              Category Breakdown
            </h3>
            <div className="flex items-center">
              <ResponsiveContainer width="60%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [value + '%', 'Share']} 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(139, 69, 19, 0.1)'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="w-2/5 space-y-3">
                {categoryData.map((item, index) => (
                  <div key={item.name} className="flex items-center">
                    <div 
                      className="w-4 h-4 rounded-full mr-3 shadow-sm" 
                      style={{ backgroundColor: COLORS[index] }}
                    ></div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold" style={{ color: '#8b4513' }}>
                        {item.name}
                      </div>
                      <div className="text-xs font-medium" style={{ color: '#9f6841' }}>
                        {(item.sentiment * 100).toFixed(0)}% sentiment
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Keywords */}
          <div className="rounded-2xl shadow-lg border p-8" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: 'rgba(212, 163, 127, 0.3)'
          }}>
            <h3 className="text-xl font-semibold mb-6" style={{ color: '#8b4513' }}>
              Trending Keywords
            </h3>
            <div className="space-y-4">
              {keywordData.map((item, index) => (
                <div key={item.keyword} className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="font-semibold text-sm" style={{ color: '#8b4513' }}>
                        {item.keyword}
                      </span>
                      <span className="ml-2 text-xs font-medium" style={{ color: '#9f6841' }}>
                        ({item.count})
                      </span>
                    </div>
                    <div className="w-full rounded-full h-2 mt-2" style={{ backgroundColor: '#f6ede5' }}>
                      <div 
                        className="h-2 rounded-full transition-all duration-500 shadow-sm"
                        style={{ 
                          width: `${(item.count / 31) * 100}%`,
                          backgroundColor: getSentimentColor(item.sentiment)
                        }}
                      ></div>
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <div 
                      className="text-sm font-bold"
                      style={{ color: getSentimentColor(item.sentiment) }}
                    >
                      {(item.sentiment * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Posts */}
        <div className="rounded-2xl shadow-lg border p-8" style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          borderColor: 'rgba(212, 163, 127, 0.3)'
        }}>
          <h3 className="text-xl font-semibold mb-6" style={{ color: '#8b4513' }}>
            Recent Posts & Comments
          </h3>
          <div className="space-y-4">
            {recentPosts.map((post) => (
              <div key={post.id} className="border-l-4 pl-6 py-4 rounded-r-xl" style={{ 
                borderColor: getSentimentColor(post.sentiment),
                backgroundColor: 'rgba(246, 237, 229, 0.3)'
              }}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: '#9f6841' }}>
                      <span className="font-semibold" style={{ color: '#8b4513' }}>
                        {post.subreddit}
                      </span>
                      <span>•</span>
                      <span>{post.category}</span>
                      <span>•</span>
                      <span>{post.time}</span>
                    </div>
                    <div className="font-semibold text-base" style={{ color: '#8b4513' }}>
                      {post.title}
                    </div>
                  </div>
                  <div className="ml-6 text-right">
                    <div 
                      className="text-xl font-bold"
                      style={{ color: getSentimentColor(post.sentiment) }}
                    >
                      {(post.sentiment * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs font-medium" style={{ color: '#9f6841' }}>
                      {getSentimentLabel(post.sentiment)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* Footer */}
        <div className="text-center mt-12 text-sm">
          <p className="font-medium" style={{ color: '#9f6841' }}>
            Data updates hourly from r/Anthropic, r/ClaudeAI, and r/ClaudeCode
          </p>
          <p className="mt-1" style={{ color: '#9f6841' }}>
            Sentiment analysis powered by Claude AI
          </p>
        </div>
      </div>
    </div>
  );
};

function App() {
  return <Claudometer />;
}

export default App;
