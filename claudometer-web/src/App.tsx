import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Claudometer = () => {
  const [timeframe, setTimeframe] = useState('24h');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [currentSentiment, setCurrentSentiment] = useState(0.72);

  // Mock data - in real implementation, this would come from your Reddit API + AI analysis
  const hourlyData = [
    { time: '00:00', sentiment: 0.68, posts: 12 },
    { time: '01:00', sentiment: 0.71, posts: 8 },
    { time: '02:00', sentiment: 0.69, posts: 5 },
    { time: '03:00', sentiment: 0.73, posts: 4 },
    { time: '04:00', sentiment: 0.67, posts: 7 },
    { time: '05:00', sentiment: 0.75, posts: 9 },
    { time: '06:00', sentiment: 0.72, posts: 15 },
    { time: '07:00', sentiment: 0.78, posts: 22 },
    { time: '08:00', sentiment: 0.74, posts: 31 },
    { time: '09:00', sentiment: 0.69, posts: 28 },
    { time: '10:00', sentiment: 0.71, posts: 35 },
    { time: '11:00', sentiment: 0.73, posts: 42 },
    { time: '12:00', sentiment: 0.76, posts: 38 },
    { time: '13:00', sentiment: 0.74, posts: 44 },
    { time: '14:00', sentiment: 0.72, posts: 41 },
    { time: '15:00', sentiment: 0.70, posts: 39 },
    { time: '16:00', sentiment: 0.68, posts: 37 },
    { time: '17:00', sentiment: 0.71, posts: 45 },
    { time: '18:00', sentiment: 0.73, posts: 52 },
    { time: '19:00', sentiment: 0.72, posts: 48 },
    { time: '20:00', sentiment: 0.74, posts: 46 },
    { time: '21:00', sentiment: 0.76, posts: 43 },
    { time: '22:00', sentiment: 0.75, posts: 38 },
    { time: '23:00', sentiment: 0.72, posts: 29 }
  ];

  const categoryData = [
    { name: 'Web Interface', value: 45, sentiment: 0.71 },
    { name: 'Claude Code', value: 30, sentiment: 0.74 },
    { name: 'API', value: 15, sentiment: 0.68 },
    { name: 'General', value: 10, sentiment: 0.76 }
  ];

  const keywordData = [
    { keyword: 'performance', count: 23, sentiment: 0.65 },
    { keyword: 'daily limits', count: 18, sentiment: 0.42 },
    { keyword: 'bugs', count: 15, sentiment: 0.38 },
    { keyword: 'service degradation', count: 12, sentiment: 0.35 },
    { keyword: 'helpful', count: 31, sentiment: 0.85 },
    { keyword: 'improved', count: 14, sentiment: 0.82 }
  ];

  const recentPosts = [
    { id: 1, subreddit: 'r/ClaudeAI', title: 'Claude has been amazing for coding lately', sentiment: 0.89, category: 'Web Interface', time: '2h ago' },
    { id: 2, subreddit: 'r/Anthropic', title: 'Daily limits seem lower than before', sentiment: 0.23, category: 'Web Interface', time: '3h ago' },
    { id: 3, subreddit: 'r/ClaudeCode', title: 'Love the new CLI features!', sentiment: 0.91, category: 'Claude Code', time: '4h ago' },
    { id: 4, subreddit: 'r/ClaudeAI', title: 'API responses slower today?', sentiment: 0.34, category: 'API', time: '5h ago' },
    { id: 5, subreddit: 'r/Anthropic', title: 'Claude helped me debug a complex issue', sentiment: 0.87, category: 'General', time: '6h ago' }
  ];

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
              color: '#8b4513',
              focusRingColor: '#d4a37f'
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

        {/* Main Dashboard */}
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
                    formatter={(value) => [(value * 100).toFixed(1) + '%', 'Sentiment']}
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
              <div className="w-40% space-y-3">
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
