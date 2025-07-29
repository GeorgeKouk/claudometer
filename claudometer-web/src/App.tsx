import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine, Label, Legend } from 'recharts';
import Reevaluation from './Reevaluation';
import Footer from './components/Footer';
import Contact from './pages/Contact';
import Methodology from './pages/Methodology';

const Claudometer = () => {
  const [timeframe, setTimeframe] = useState('24h');
  const [sentimentMode, setSentimentMode] = useState<'latest' | 'average'>('average');
  const [latestSentiment, setLatestSentiment] = useState<number>(0.5);
  const [averageSentiment, setAverageSentiment] = useState<number>(0.5);
  const [latestPostCount, setLatestPostCount] = useState<number>(0);
  const [latestCommentCount, setLatestCommentCount] = useState<number>(0);
  const [avgPostCount, setAvgPostCount] = useState<number>(0);
  const [avgCommentCount, setAvgCommentCount] = useState<number>(0);
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [topicData, setTopicData] = useState<any[]>([]);
  const [keywordData, setKeywordData] = useState<any[]>([]);
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null);
  const [showAllTopics, setShowAllTopics] = useState<boolean>(false);

  // Store raw data for filtering

  const API_BASE = 'https://api.claudometer.app';


  // Calculate next refresh time (3 minutes after each hour)
  const getNextRefreshTime = () => {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 3, 0, 0); // Next hour + 3 minutes
    return nextHour;
  };

  // Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch data with delays to avoid overloading API
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      
      const currentRes = await fetch(`${API_BASE}/current-sentiment?period=${timeframe}`);
      await delay(200);
      
      const hourlyRes = await fetch(`${API_BASE}/hourly-data?period=${timeframe}`);
      await delay(200);
      
      const topicsRes = await fetch(`${API_BASE}/topics?period=${timeframe}`);
      await delay(200);
      
      const keywordsRes = await fetch(`${API_BASE}/keywords?period=${timeframe}`);
      await delay(200);
      
      const postsRes = await fetch(`${API_BASE}/recent-posts?period=${timeframe}`);

      // Parse responses
      const currentData = await currentRes.json();
      const hourlyDataRaw = await hourlyRes.json();
      const topicsDataRaw = await topicsRes.json();
      const keywordsDataRaw = await keywordsRes.json();
      const postsDataRaw = await postsRes.json();

      // Update state
      setLatestSentiment(currentData.latest_sentiment || 0.5);
      setAverageSentiment(currentData.avg_sentiment || 0.5);
      setLatestPostCount(currentData.latest_post_count || 0);
      setLatestCommentCount(currentData.latest_comment_count || 0);
      setAvgPostCount(currentData.avg_post_count || 0);
      setAvgCommentCount(currentData.avg_comment_count || 0);
      
      // Handle new hourly data structure: { data: [...], events: [...] }
      setHourlyData(hourlyDataRaw.data || []);
      setEvents(hourlyDataRaw.events || []);
      console.log('Events loaded:', hourlyDataRaw.events);
      
      // Store raw data for filtering (sort posts by most recent first)
      const sortedPosts = (postsDataRaw || []).sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || a.time);
        const dateB = new Date(b.created_at || b.time);
        return dateB.getTime() - dateA.getTime();
      });
      // Set data directly
      setRecentPosts(sortedPosts);
      setTopicData(topicsDataRaw || []);
      setKeywordData(keywordsDataRaw || []);

      // Update next refresh time
      setNextRefresh(getNextRefreshTime());

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  // Initial fetch and scheduled refresh
  useEffect(() => {
    // Initial fetch
    fetchData();
    setNextRefresh(getNextRefreshTime());

    // Set up hourly refresh at 3 minutes past each hour
    const scheduleNextFetch = () => {
      const now = new Date();
      const nextRefreshTime = getNextRefreshTime();
      const msUntilRefresh = nextRefreshTime.getTime() - now.getTime();
      
      return setTimeout(() => {
        fetchData();
        // Schedule the next refresh
        const interval = setInterval(fetchData, 60 * 60 * 1000); // Every hour
        return () => clearInterval(interval);
      }, msUntilRefresh);
    };

    const timeoutId = scheduleNextFetch();
    return () => clearTimeout(timeoutId);
  }, [fetchData]);

  // Re-fetch data when timeframe changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getSentimentColor = (sentiment: number) => {
    if (sentiment >= 0.8) return '#16a34a'; // Dark green - very positive
    if (sentiment >= 0.7) return '#22c55e'; // Green - positive
    if (sentiment >= 0.6) return '#65a30d'; // Yellow-green - slightly positive
    if (sentiment >= 0.5) return '#94a3b8'; // Gray - neutral
    if (sentiment >= 0.4) return '#f59e0b'; // Orange - slightly negative
    if (sentiment >= 0.3) return '#f97316'; // Dark orange - negative
    return '#ef4444'; // Red - very negative
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

  const SentimentMeter = ({ value, mode, timeframe }: { value: number, mode: 'latest' | 'average', timeframe: string }) => {
    const angle = (value * 180) - 90; // Convert 0-1 to -90 to 90 degrees
    const color = getSentimentColor(value);
    
    return (
      <div className="mx-auto mb-4">
        <div className="relative w-64 h-32 mx-auto">
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


  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #fbf6f2 0%, #f6ede5 50%, #ead1bf 100%)' }}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="text-center mb-6 sm:mb-12">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden" style={{ backgroundColor: '#d4a37f' }}>
              <img 
              src="/logo.png" 
              alt="Claudometer Logo" 
              className="w-full h-full object-contain mix-blend-multiply p-1.5"
            />
            </div>
            <h1 className="text-5xl font-bold" style={{ color: '#824920' }}>
              Claudometer
            </h1>
          </div>
          <p className="text-lg font-medium max-w-2xl mx-auto" style={{ color: '#9f6841' }}>
            Sentiment tracking for Claude AI across Reddit communities
          </p>
          {nextRefresh && (
            <p className="text-sm font-medium mt-2" style={{ color: '#9f6841' }}>
              Next update: {nextRefresh.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
              })}
            </p>
          )}
        </div>

        {/* Time Range Controls */}
        <div className="flex justify-center gap-2 sm:gap-3 mb-5 sm:mb-10">
          {[
            { value: '24h', label: 'Last 24 Hours', shortLabel: '24hrs' },
            { value: '7d', label: 'Last 7 Days', shortLabel: '7 days' },
            { value: '30d', label: 'Last 30 Days', shortLabel: '30 days' },
            { value: 'all', label: 'All Time', shortLabel: 'All' }
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setTimeframe(option.value)}
              className={`px-3 sm:px-6 py-3 rounded-2xl shadow-lg font-medium transition-all duration-300 hover:shadow-xl hover:scale-105 focus:ring-4 focus:outline-none text-sm sm:text-base ${
                timeframe === option.value 
                  ? 'transform scale-105' 
                  : ''
              }`}
              style={{ 
                backgroundColor: timeframe === option.value 
                  ? '#8b4513' 
                  : 'rgba(255, 255, 255, 0.85)',
                color: timeframe === option.value ? '#ffffff' : '#8b4513',
                background: timeframe === option.value
                  ? '#8b4513'
                  : 'linear-gradient(135deg, rgba(255, 255, 255, 0.85) 0%, rgba(251, 246, 242, 0.85) 100%)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(212, 163, 127, 0.2)'
              }}
            >
              <span className="hidden sm:inline">{option.label}</span>
              <span className="sm:hidden">{option.shortLabel}</span>
            </button>
          ))}
        </div>

        {/* Loading/Error States */}
        {loading && (
          <div className="text-center py-12">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-opacity-30 rounded-full animate-spin mb-4" style={{ 
                borderColor: '#8b4513',
                borderTopColor: '#d4a37f'
              }}></div>
              <div className="text-2xl font-semibold" style={{ color: '#8b4513' }}>
                Loading sentiment data...
              </div>
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8 mb-5 sm:mb-10">
          {/* Sentiment Meter */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl shadow-lg border p-4 sm:p-8 h-auto" style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              borderColor: 'rgba(212, 163, 127, 0.3)'
            }}>
              <h3 className="text-xl font-semibold text-left mb-3" style={{ color: '#8b4513' }}>
                Community Sentiment
              </h3>

              <SentimentMeter 
                value={sentimentMode === 'latest' ? latestSentiment : averageSentiment} 
                mode={sentimentMode}
                timeframe={timeframe}
              />
              
              <div className="text-center text-xs font-medium mb-3" style={{ color: '#9f6841' }}>
                Based on {sentimentMode === 'latest' 
                  ? (latestPostCount + latestCommentCount) 
                  : (avgPostCount + avgCommentCount)
                } posts/comments
              </div>
              
              {/* Sentiment Mode Toggle - Below Meter */}
              <div className="flex justify-center gap-2">
                {[
                  { value: 'average', label: 'Average' },
                  { value: 'latest', label: 'Latest' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSentimentMode(option.value as 'latest' | 'average')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      sentimentMode === option.value 
                        ? 'shadow-md transform scale-105' 
                        : 'hover:scale-105'
                    }`}
                    style={{ 
                      backgroundColor: sentimentMode === option.value 
                        ? '#8b4513' 
                        : 'rgba(255, 255, 255, 0.7)',
                      color: sentimentMode === option.value ? '#ffffff' : '#8b4513',
                      border: '1px solid rgba(212, 163, 127, 0.3)'
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Trend Chart */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl shadow-lg border p-4 sm:p-8 h-auto" style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              borderColor: 'rgba(212, 163, 127, 0.3)'
            }}>
              <h3 className="text-xl font-semibold mb-6" style={{ color: '#8b4513' }}>
                Sentiment Trend ({timeframe === '24h' ? '24h' : timeframe === '7d' ? '7 days' : timeframe === '30d' ? '30 days' : 'All Time'})
                {events.length > 0 && <span className="text-sm ml-2">({events.length} events)</span>}
              </h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ead1bf" />
                  <XAxis 
                    dataKey="time" 
                    tick={{ fill: '#9f6841', fontSize: 12 }}
                    axisLine={{ stroke: '#ead1bf' }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      if (timeframe === '24h') {
                        // Show hours for 24h view
                        return date.toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: false,
                          timeZone: 'UTC'
                        });
                      } else {
                        // Show dates for longer periods
                        return date.toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric',
                          timeZone: 'UTC'
                        });
                      }
                    }}
                  />
                  <YAxis 
                    yAxisId="sentiment"
                    domain={[0, 1]} 
                    tickFormatter={(value) => (value * 100).toFixed(0) + '%'}
                    tick={{ fill: '#9f6841', fontSize: 12 }}
                    axisLine={{ stroke: '#ead1bf' }}
                  />
                  <YAxis 
                    yAxisId="posts"
                    orientation="right"
                    domain={[0, 'dataMax']}
                    hide={true}
                  />
                  <Tooltip 
                    formatter={(value, name) => {
                      if (name === 'Sentiment') {
                        return [(Number(value) * 100).toFixed(1) + '%', 'Sentiment'];
                      } else if (name === 'Post Count') {
                        return [value + ' posts', 'Post Count'];
                      }
                      return [value, name];
                    }}
                    labelStyle={{ color: '#8b4513' }}
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(139, 69, 19, 0.1)'
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ paddingTop: '20px' }}
                    iconType="line"
                  />
                  
                  {/* Test reference line - should always show */}
                  <ReferenceLine
                    x={hourlyData[Math.floor(hourlyData.length / 2)]?.time}
                    stroke="#ff0000"
                    strokeWidth={2}
                  >
                    <Label value="TEST LINE" position="top" />
                  </ReferenceLine>
                  
                  {/* Event annotations as reference lines */}
                  {events.map((event) => (
                    <ReferenceLine
                      key={event.id}
                      x={event.date}
                      stroke="#8b4513"
                      strokeWidth={3}
                      opacity={0.8}
                    >
                      <Label 
                        value={event.title} 
                        position="top" 
                        offset={5}
                        style={{ 
                          fill: '#8b4513', 
                          fontSize: '10px', 
                          fontWeight: 'bold',
                          textAnchor: 'middle'
                        }}
                      />
                    </ReferenceLine>
                  ))}
                  
                  <Line 
                    yAxisId="sentiment"
                    type="monotone" 
                    dataKey="sentiment" 
                    stroke="#d4a37f" 
                    strokeWidth={3}
                    dot={{ fill: '#d4a37f', strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5, stroke: '#d4a37f', strokeWidth: 2, fill: '#ffffff' }}
                    name="Sentiment"
                  />
                  <Line 
                    yAxisId="posts"
                    type="monotone" 
                    dataKey="post_count" 
                    stroke="#A0522D" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    opacity={0.6}
                    name="Post Count"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        )}

        {/* Category and Keyword Analysis */}
        {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-5 sm:mb-10">
          {/* Category Breakdown */}
          <div className="rounded-2xl shadow-lg border p-4 sm:p-8 h-auto" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: 'rgba(212, 163, 127, 0.3)'
          }}>
            <h3 className="text-xl font-semibold mb-6" style={{ color: '#8b4513' }}>
              Topic Breakdown
            </h3>
            <div className="flex flex-col sm:flex-row sm:items-center">
              <div className="w-full sm:w-3/5">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={[...topicData].sort((a, b) => b.value - a.value)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      startAngle={90}
                      endAngle={450}
                    >
                      {[...topicData].sort((a, b) => b.value - a.value).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || '#B8A082'} />
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
              </div>
              <div className="w-full sm:w-2/5 space-y-3 mt-4 sm:mt-0">
                {[...topicData].sort((a, b) => b.value - a.value)
                  .slice(0, showAllTopics ? topicData.length : 10)
                  .map((item, index) => (
                    <div key={item.name} className="flex items-center">
                      <div 
                        className="w-4 h-4 rounded-full mr-3 shadow-sm" 
                        style={{ backgroundColor: item.color || '#B8A082' }}
                      ></div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold" style={{ color: '#8b4513' }}>
                          {item.name}
                        </div>
                        <div className="text-xs font-medium" style={{ color: '#9f6841' }}>
                          {getSentimentLabel(item.sentiment)} • {item.referenceCount || 0} references
                        </div>
                      </div>
                    </div>
                  ))}
                {topicData.length > 10 && (
                  <button
                    onClick={() => setShowAllTopics(!showAllTopics)}
                    className="text-xs font-medium mt-2 hover:underline transition-all duration-200"
                    style={{ color: '#8b4513' }}
                  >
                    {showAllTopics ? `Show less` : `Show all ${topicData.length} topics`}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Top Keywords */}
          <div className="rounded-2xl shadow-lg border p-4 sm:p-8 h-auto" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: 'rgba(212, 163, 127, 0.3)'
          }}>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#8b4513' }}>
              Trending Keywords
            </h3>
            <p className="text-sm font-medium mb-6" style={{ color: '#9f6841' }}>
              Color and tag show sentiment toward that keyword.
            </p>
            <div className="space-y-4">
              {keywordData.map((item, index) => {
                const maxCount = Math.max(...keywordData.map(k => k.count));
                return (
                  <div key={item.keyword} className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm" style={{ color: '#8b4513' }}>
                            {item.keyword}
                          </span>
                          <span className="text-xs font-medium" style={{ color: '#9f6841' }}>
                            ({item.count} mentions)
                          </span>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ 
                          backgroundColor: getSentimentColor(item.sentiment) + '20',
                          color: getSentimentColor(item.sentiment)
                        }}>
                          {getSentimentLabel(item.sentiment)}
                        </span>
                      </div>
                      <div className="w-full rounded-full h-2" style={{ backgroundColor: '#f6ede5' }}>
                        <div 
                          className="h-2 rounded-full transition-all duration-500 shadow-sm"
                          style={{ 
                            width: `${(item.count / maxCount) * 100}%`,
                            backgroundColor: getSentimentColor(item.sentiment)
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        )}

        {/* Recent Posts */}
        {!loading && !error && (
        <div className="rounded-2xl shadow-lg border p-4 sm:p-8 h-auto" style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          borderColor: 'rgba(212, 163, 127, 0.3)'
        }}>
          <h3 className="text-xl font-semibold mb-6" style={{ color: '#8b4513' }}>
            Recent Posts & Comments
          </h3>
          <div className="space-y-4">
            {recentPosts.map((post) => (
              <div key={post.id} className="border-l-4 pl-6 py-2 sm:py-4 rounded-r-xl" style={{ 
                borderColor: getSentimentColor(post.sentiment),
                backgroundColor: 'rgba(246, 237, 229, 0.3)'
              }}>
                <div className="space-y-1 sm:space-y-2">
                  {/* First row: Subreddit • Topic • Time */}
                  <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#9f6841' }}>
                    <span className="font-semibold" style={{ color: '#8b4513' }}>
                      {post.subreddit}
                    </span>
                    <span>•</span>
                    <span>{post.category}</span>
                    <span>•</span>
                    <span>{post.time}</span>
                  </div>
                  
                  {/* Second row: Title */}
                  <div className="font-semibold text-base" style={{ color: '#8b4513' }}>
                    {post.title}
                  </div>
                  
                  {/* Third row: Sentiment (bottom left) */}
                  <div className="flex items-center gap-2">
                    <div 
                      className="text-sm font-medium"
                      style={{ color: getSentimentColor(post.sentiment) }}
                    >
                      {(post.sentiment * 100).toFixed(0)}%
                    </div>
                    <div className="text-sm font-medium" style={{ color: getSentimentColor(post.sentiment) }}>
                      {getSentimentLabel(post.sentiment)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        )}

      </div>
      
      <Footer />
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Claudometer />} />
        <Route path="/reevaluation" element={<Reevaluation />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/methodology" element={<Methodology />} />
      </Routes>
    </Router>
  );
}

export default App;
