import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import Reevaluation from './Reevaluation';
import Footer from './components/Footer';
import Contact from './pages/Contact';
import Methodology from './pages/Methodology';

const Claudometer = () => {
  const [timeframe, setTimeframe] = useState('24h');
  const [sentimentMode, setSentimentMode] = useState<'latest' | 'average'>('average');
  const [hourlyData, setHourlyData] = useState<any[]>([]);
  const [topicData, setTopicData] = useState<any>({});
  const [keywordData, setKeywordData] = useState<any>({});
  const [recentPosts, setRecentPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [nextRefresh, setNextRefresh] = useState<Date | null>(null);
  const [showAllTopics, setShowAllTopics] = useState<boolean>(false);
  const [showAllKeywords, setShowAllKeywords] = useState<boolean>(false);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['claude', 'chatgpt', 'gemini']);
  const [currentSentimentData, setCurrentSentimentData] = useState<any>({});

  // Store raw data for filtering

  const API_BASE = process.env.NODE_ENV === 'production' 
    ? 'https://api.claudometer.app' 
    : 'http://localhost:8787';


  // Compute filtered sentiment data based on selected platforms
  const filteredSentimentData = useMemo(() => {
    if (!currentSentimentData || selectedPlatforms.length === 0) {
      return {
        latest_sentiment: 0.5,
        avg_sentiment: 0.5,
        latest_post_count: 0,
        latest_comment_count: 0,
        avg_post_count: 0,
        avg_comment_count: 0
      };
    }

    // Get data for selected platforms only
    const selectedPlatformData = selectedPlatforms
      .map(platformId => currentSentimentData[platformId])
      .filter(Boolean);

    if (selectedPlatformData.length === 0) {
      return {
        latest_sentiment: 0.5,
        avg_sentiment: 0.5,
        latest_post_count: 0,
        latest_comment_count: 0,
        avg_post_count: 0,
        avg_comment_count: 0
      };
    }

    // Calculate weighted averages
    const totalLatestPosts = selectedPlatformData.reduce((sum, platform) => sum + (platform.latest_post_count || 0), 0);
    const totalLatestComments = selectedPlatformData.reduce((sum, platform) => sum + (platform.latest_comment_count || 0), 0);
    const totalAvgPosts = selectedPlatformData.reduce((sum, platform) => sum + (platform.avg_post_count || 0), 0);
    const totalAvgComments = selectedPlatformData.reduce((sum, platform) => sum + (platform.avg_comment_count || 0), 0);

    // Weight posts 3x, comments 1x for sentiment calculation
    const latestSentiment = selectedPlatformData.reduce((sum, platform) => {
      const posts = platform.latest_post_count || 0;
      const comments = platform.latest_comment_count || 0;
      const weight = posts * 3 + comments * 1;
      return sum + (platform.latest_sentiment || 0.5) * weight;
    }, 0) / selectedPlatformData.reduce((sum, platform) => {
      const posts = platform.latest_post_count || 0;
      const comments = platform.latest_comment_count || 0;
      return sum + posts * 3 + comments * 1;
    }, 0) || 0.5;

    const avgSentiment = selectedPlatformData.reduce((sum, platform) => {
      const posts = platform.avg_post_count || 0;
      const comments = platform.avg_comment_count || 0;
      const weight = posts * 3 + comments * 1;
      return sum + (platform.avg_sentiment || 0.5) * weight;
    }, 0) / selectedPlatformData.reduce((sum, platform) => {
      const posts = platform.avg_post_count || 0;
      const comments = platform.avg_comment_count || 0;
      return sum + posts * 3 + comments * 1;
    }, 0) || 0.5;

    return {
      latest_sentiment: latestSentiment,
      avg_sentiment: avgSentiment,
      latest_post_count: totalLatestPosts,
      latest_comment_count: totalLatestComments,
      avg_post_count: totalAvgPosts,
      avg_comment_count: totalAvgComments
    };
  }, [currentSentimentData, selectedPlatforms]);

  // Compute filtered topic data based on selected platforms
  const filteredTopicData = useMemo(() => {
    if (!topicData || selectedPlatforms.length === 0) {
      return [];
    }

    const topicMap: { [key: string]: any } = {};
    
    selectedPlatforms.forEach(platformId => {
      (topicData[platformId] || []).forEach((topic: any) => {
        if (!topicMap[topic.name]) {
          topicMap[topic.name] = {
            name: topic.name,
            totalValue: 0,
            totalSentiment: 0,
            totalWeight: 0,
            referenceCount: 0,
            color: topic.color
          };
        }
        
        topicMap[topic.name].totalValue += topic.value;
        topicMap[topic.name].totalSentiment += topic.sentiment * topic.referenceCount;
        topicMap[topic.name].totalWeight += topic.referenceCount;
        topicMap[topic.name].referenceCount += topic.referenceCount;
      });
    });
    
    // Calculate final percentages and sentiment
    const total = Object.values(topicMap).reduce((sum: number, t: any) => sum + t.totalValue, 0);
    
    return Object.values(topicMap).map((topic: any) => ({
      name: topic.name,
      value: total > 0 ? Math.round((topic.totalValue / total) * 100) : 0,
      sentiment: topic.totalWeight > 0 ? topic.totalSentiment / topic.totalWeight : 0.5,
      color: topic.color,
      referenceCount: topic.referenceCount
    })).sort((a, b) => b.value - a.value);
  }, [topicData, selectedPlatforms]);

  // Compute filtered keyword data based on selected platforms
  const filteredKeywordData = useMemo(() => {
    if (!keywordData || selectedPlatforms.length === 0) {
      return [];
    }

    const keywordMap: { [key: string]: any } = {};
    
    selectedPlatforms.forEach(platformId => {
      (keywordData[platformId] || []).forEach((keyword: any) => {
        if (!keywordMap[keyword.keyword]) {
          keywordMap[keyword.keyword] = {
            keyword: keyword.keyword,
            totalCount: 0,
            totalSentiment: 0,
            totalWeight: 0
          };
        }
        
        keywordMap[keyword.keyword].totalCount += keyword.count;
        keywordMap[keyword.keyword].totalSentiment += keyword.sentiment * keyword.count;
        keywordMap[keyword.keyword].totalWeight += keyword.count;
      });
    });
    
    return Object.values(keywordMap)
      .map((kw: any) => ({
        keyword: kw.keyword,
        count: kw.totalCount,
        sentiment: kw.totalWeight > 0 ? kw.totalSentiment / kw.totalWeight : 0.5
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Show top 20 combined
  }, [keywordData, selectedPlatforms]);

  // Memoized expensive computations - now use filtered data
  const sortedTopicData = useMemo(() => {
    return [...filteredTopicData].sort((a, b) => b.value - a.value);
  }, [filteredTopicData]);

  const maxKeywordCount = useMemo(() => {
    return filteredKeywordData.length > 0 ? Math.max(...filteredKeywordData.map(k => k.count)) : 0;
  }, [filteredKeywordData]);

  const chartData = useMemo(() => {
    // Sort hourly data chronologically (oldest to newest) and transform
    const sortedHourlyData = [...hourlyData].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    const transformedHourlyData = sortedHourlyData.map(dataPoint => {
      const platforms = dataPoint.platforms || {};
      
      return {
        time: dataPoint.time,
        // Individual platform sentiments
        claude_sentiment: platforms.claude?.sentiment || null,
        chatgpt_sentiment: platforms.chatgpt?.sentiment || null,
        gemini_sentiment: platforms.gemini?.sentiment || null,
        // For backward compatibility (use claude as primary)
        sentiment: platforms.claude?.sentiment || platforms.chatgpt?.sentiment || platforms.gemini?.sentiment || 0.5,
        post_count: platforms.claude?.post_count || platforms.chatgpt?.post_count || platforms.gemini?.post_count || 0,
        comment_count: platforms.claude?.comment_count || platforms.chatgpt?.comment_count || platforms.gemini?.comment_count || 0,
        posts: platforms.claude?.posts || platforms.chatgpt?.posts || platforms.gemini?.posts || 0,
        events: dataPoint.events || []
      };
    });
    
    return transformedHourlyData;
  }, [hourlyData]);

  // Calculate dynamic Y-axis range based on selected platforms and timeframe
  const yAxisDomain = useMemo(() => {
    // Use default range for 24h view
    if (timeframe === '24h') {
      return [0, 1];
    }

    // For 7d, 30d, and all time views, calculate dynamic range
    const sentimentValues: number[] = [];
    
    chartData.forEach(dataPoint => {
      selectedPlatforms.forEach(platformId => {
        const sentimentKey = `${platformId}_sentiment` as keyof typeof dataPoint;
        const sentiment = dataPoint[sentimentKey] as number;
        if (sentiment !== null && sentiment !== undefined && !isNaN(sentiment)) {
          sentimentValues.push(sentiment);
        }
      });
    });

    if (sentimentValues.length === 0) {
      return [0, 1]; // Fallback to default range
    }

    const minSentiment = Math.min(...sentimentValues);
    const maxSentiment = Math.max(...sentimentValues);
    const range = maxSentiment - minSentiment;
    
    // Add 20% padding on both sides
    const padding = range * 0.2;
    const paddedMin = Math.max(0, minSentiment - padding); // Don't go below 0
    const paddedMax = Math.min(1, maxSentiment + padding); // Don't go above 1
    
    // Round outwards to nearest 5% increment for visual appeal
    // Convert to percentage (0-100), round, then back to 0-1 scale
    const roundedMin = Math.floor((paddedMin * 100) / 5) * 5 / 100;
    const roundedMax = Math.ceil((paddedMax * 100) / 5) * 5 / 100;
    
    return [Math.max(0, roundedMin), Math.min(1, roundedMax)];
  }, [chartData, selectedPlatforms, timeframe]);

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
      await delay(200);
      
      const platformsRes = await fetch(`${API_BASE}/platforms`);

      // Parse responses
      const currentData = await currentRes.json();
      const hourlyDataRaw = await hourlyRes.json();
      const topicsDataRaw = await topicsRes.json();
      const keywordsDataRaw = await keywordsRes.json();
      const postsDataRaw = await postsRes.json();
      const platformsData = await platformsRes.json();

      // Store all platform data for client-side filtering
      setCurrentSentimentData(currentData);
      
      // Handle new multi-platform hourly data structure
      setHourlyData(hourlyDataRaw.data || []);
      
      // Store raw data for filtering (sort posts by most recent first)
      const sortedPosts = (postsDataRaw || []).sort((a: any, b: any) => {
        const dateA = new Date(a.created_at || a.time);
        const dateB = new Date(b.created_at || b.time);
        return dateB.getTime() - dateA.getTime();
      });
      // Set data directly - now expecting platform-grouped objects
      setRecentPosts(sortedPosts);
      setTopicData(topicsDataRaw || {});
      setKeywordData(keywordsDataRaw || {});
      setPlatforms(platformsData || []);

      // Update next refresh time
      setNextRefresh(getNextRefreshTime());

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [timeframe, API_BASE]);

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
            Sentiment tracking for LLMs across reddit communities
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
        <div className="flex justify-center gap-2 sm:gap-3 mb-5 sm:mb-8">
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

        {/* Platform Toggle Controls */}
        <div className="flex justify-center gap-3 mb-5 sm:mb-10">
          {platforms.map((platform) => {
            const isSelected = selectedPlatforms.includes(platform.id);
            const canDeselect = selectedPlatforms.length > 1 || !isSelected;
            
            return (
              <button
                key={platform.id}
                onClick={() => {
                  if (isSelected && canDeselect) {
                    setSelectedPlatforms(prev => prev.filter(id => id !== platform.id));
                  } else if (!isSelected) {
                    setSelectedPlatforms(prev => [...prev, platform.id]);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 focus:ring-4 focus:outline-none ${
                  isSelected ? 'shadow-lg' : 'opacity-50 hover:opacity-75'
                } ${
                  !canDeselect ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
                style={{
                  backgroundColor: isSelected 
                    ? platform.color || '#8b4513'
                    : 'rgba(255, 255, 255, 0.85)',
                  color: isSelected ? '#ffffff' : platform.color || '#8b4513',
                  border: `2px solid ${platform.color || '#8b4513'}`,
                  backdropFilter: 'blur(10px)'
                }}
                disabled={!canDeselect}
              >
                {platform.icon ? (
                  <div className="relative">
                    <img 
                      src={platform.icon} 
                      alt={`${platform.name} logo`}
                      className="w-5 h-5 object-contain"
                      style={{ 
                        filter: isSelected ? 'brightness(0) invert(1)' : 'brightness(0) invert(1)'
                      }}
                    />
                    {!isSelected && (
                      <div 
                        className="absolute inset-0 w-5 h-5 mask-image"
                        style={{ 
                          backgroundColor: platform.color || '#8b4513',
                          maskImage: `url(${platform.icon})`,
                          maskSize: 'contain',
                          maskRepeat: 'no-repeat',
                          maskPosition: 'center',
                          WebkitMaskImage: `url(${platform.icon})`,
                          WebkitMaskSize: 'contain',
                          WebkitMaskRepeat: 'no-repeat',
                          WebkitMaskPosition: 'center'
                        }}
                      />
                    )}
                  </div>
                ) : (
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: isSelected ? '#ffffff' : platform.color || '#8b4513' }}
                  />
                )}
                <span className="text-sm font-semibold">{platform.name}</span>
              </button>
            );
          })}
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
                value={sentimentMode === 'latest' ? filteredSentimentData.latest_sentiment : filteredSentimentData.avg_sentiment} 
                mode={sentimentMode}
                timeframe={timeframe}
              />
              
              <div className="text-center text-xs font-medium mb-3" style={{ color: '#9f6841' }}>
                Based on {sentimentMode === 'latest' 
                  ? (filteredSentimentData.latest_post_count + filteredSentimentData.latest_comment_count) 
                  : (filteredSentimentData.avg_post_count + filteredSentimentData.avg_comment_count)
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
              </h3>
              {chartData.length === 0 ? (
                <div className="w-full h-70 flex items-center justify-center" style={{ height: '280px' }}>
                  <div className="text-center">
                    <div className="text-xl font-semibold mb-2" style={{ color: '#8b4513' }}>
                      Something went wrong, we have no data for this period
                    </div>
                    <div className="text-sm font-medium" style={{ color: '#9f6841' }}>
                      Try selecting a different time range or check back later
                    </div>
                  </div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                <LineChart 
                  data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ead1bf" />
                  <XAxis 
                    dataKey="time"
                    tick={{ fill: '#9f6841', fontSize: 12 }}
                    axisLine={{ stroke: '#ead1bf' }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      if (timeframe === '24h') {
                        // Show hours for 24h view in local time
                        return date.toLocaleTimeString('en-US', { 
                          hour: '2-digit', 
                          minute: '2-digit',
                          hour12: false
                        });
                      } else {
                        // Show dates for longer periods in local time
                        return date.toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric'
                        });
                      }
                    }}
                  />
                  <YAxis 
                    yAxisId="sentiment"
                    domain={yAxisDomain} 
                    tickFormatter={(value) => (value * 100).toFixed(0) + '%'}
                    tick={{ fill: '#9f6841', fontSize: 12 }}
                    axisLine={{ stroke: '#ead1bf' }}
                    width={45}
                  />
                  <YAxis 
                    yAxisId="posts"
                    orientation="right"
                    domain={[0, 'dataMax']}
                    hide={true}
                  />
                  <Tooltip 
                    formatter={(value, name, props) => {
                      if (name === 'Claude AI' || name === 'ChatGPT' || name === 'Gemini') {
                        return [(Number(value) * 100).toFixed(1) + '%', name];
                      }
                      return [value, name];
                    }}
                    labelFormatter={(label) => {
                      try {
                        // Parse date and format nicely
                        const date = new Date(label);
                        // Format: "Dec 31, 2024 at 2:30 PM" or "Dec 31 at 2:30 PM" for current year
                        const now = new Date();
                        const isCurrentYear = date.getFullYear() === now.getFullYear();
                        
                        const options: Intl.DateTimeFormatOptions = {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        };
                        
                        if (!isCurrentYear) {
                          options.year = 'numeric';
                        }
                        
                        return date.toLocaleDateString('en-US', options).replace(',', ' at');
                      } catch (e) {
                        return label;
                      }
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
                    content={(props) => {
                      const { payload } = props;
                      return (
                        <div className="flex justify-center gap-6 flex-wrap">
                          {payload?.map((entry, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <svg width="20" height="8">
                                <line x1="0" y1="4" x2="20" y2="4" stroke={entry.color} strokeWidth="3" />
                                <circle cx="10" cy="4" r="3" fill={entry.color} stroke="#fff" strokeWidth="1" />
                              </svg>
                              <span style={{ 
                                color: entry.color, 
                                fontSize: '14px',
                                fontWeight: 'bold'
                              }}>{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }}
                  />
                  
                  
                  {/* Conditionally render platform lines based on selection */}
                  {selectedPlatforms.includes('claude') && (
                    <Line 
                      yAxisId="sentiment"
                      type="monotone" 
                      dataKey="claude_sentiment" 
                      stroke="#8B4513" 
                      strokeWidth={3}
                      name="Claude AI"
                      connectNulls={false}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        // Only show events on first selected platform to avoid duplication
                        const showEvents = selectedPlatforms[0] === 'claude';
                        // Don't render dot if no sentiment data for this platform
                        if (payload?.claude_sentiment === null || payload?.claude_sentiment === undefined) {
                          return <g />;
                        }
                        return (
                          <g key={`claude-dot-${payload?.time || cx}`}>
                            {/* Event vertical lines - only renders if events exist and this is first platform */}
                            {showEvents && payload?.events && payload.events.map((event: any, index: number) => (
                              <g key={event.id}>
                                {/* Vertical line from sentiment dot to event label */}
                                <line 
                                  x1={cx} 
                                  y1={cy}     // Start at sentiment dot
                                  x2={cx} 
                                  y2={25}     // End a bit lower than before
                                  stroke="#8b4513" 
                                  strokeWidth={2}
                                />
                                {/* Event label background */}
                                <rect
                                  x={cx - (event.title.length * 2.6 + 4)}
                                  y={10}
                                  width={event.title.length * 5.2 + 8}
                                  height={18}
                                  rx={5}
                                  ry={5}
                                  fill="#8b4513"
                                  stroke="#fff"
                                  strokeWidth={1}
                                  opacity={1}
                                />
                                {/* Event label text */}
                                <text
                                  x={cx}
                                  y={22}
                                  textAnchor="middle"
                                  fontSize="9"
                                  fill="#ffffff"
                                  fillOpacity={1}
                                  fontWeight="600"
                                >
                                  {event.title}
                                </text>
                              </g>
                            ))}
                            {/* Claude sentiment dot */}
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={4} 
                              fill="#8B4513" 
                              stroke="#fff" 
                              strokeWidth={2}
                            />
                          </g>
                        );
                      }}
                      activeDot={{ r: 6, stroke: '#8B4513', strokeWidth: 2, fill: '#ffffff' }}
                    />
                  )}
                  
                  {selectedPlatforms.includes('chatgpt') && (
                    <Line 
                      yAxisId="sentiment"
                      type="monotone" 
                      dataKey="chatgpt_sentiment" 
                      stroke="#10A37F" 
                      strokeWidth={3}
                      name="ChatGPT"
                      connectNulls={false}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        // Only show events on first selected platform to avoid duplication
                        const showEvents = selectedPlatforms[0] === 'chatgpt';
                        // Don't render dot if no sentiment data for this platform
                        if (payload?.chatgpt_sentiment === null || payload?.chatgpt_sentiment === undefined) {
                          return <g />;
                        }
                        return (
                          <g key={`chatgpt-dot-${payload?.time || cx}`}>
                            {/* Event vertical lines - only renders if events exist and this is first platform */}
                            {showEvents && payload?.events && payload.events.map((event: any, index: number) => (
                              <g key={event.id}>
                                {/* Vertical line from sentiment dot to event label */}
                                <line 
                                  x1={cx} 
                                  y1={cy}     // Start at sentiment dot
                                  x2={cx} 
                                  y2={25}     // End a bit lower than before
                                  stroke="#10A37F" 
                                  strokeWidth={2}
                                />
                                {/* Event label background */}
                                <rect
                                  x={cx - (event.title.length * 2.6 + 4)}
                                  y={10}
                                  width={event.title.length * 5.2 + 8}
                                  height={18}
                                  rx={5}
                                  ry={5}
                                  fill="#10A37F"
                                  stroke="#fff"
                                  strokeWidth={1}
                                  opacity={1}
                                />
                                {/* Event label text */}
                                <text
                                  x={cx}
                                  y={22}
                                  textAnchor="middle"
                                  fontSize="9"
                                  fill="#ffffff"
                                  fillOpacity={1}
                                  fontWeight="600"
                                >
                                  {event.title}
                                </text>
                              </g>
                            ))}
                            {/* ChatGPT sentiment dot */}
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={4} 
                              fill="#10A37F" 
                              stroke="#fff" 
                              strokeWidth={2}
                            />
                          </g>
                        );
                      }}
                      activeDot={{ r: 6, stroke: '#10A37F', strokeWidth: 2, fill: '#ffffff' }}
                    />
                  )}
                  
                  {selectedPlatforms.includes('gemini') && (
                    <Line 
                      yAxisId="sentiment"
                      type="monotone" 
                      dataKey="gemini_sentiment" 
                      stroke="#4285F4" 
                      strokeWidth={3}
                      name="Gemini"
                      connectNulls={false}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        // Only show events on first selected platform to avoid duplication
                        const showEvents = selectedPlatforms[0] === 'gemini';
                        // Don't render dot if no sentiment data for this platform
                        if (payload?.gemini_sentiment === null || payload?.gemini_sentiment === undefined) {
                          return <g />;
                        }
                        return (
                          <g key={`gemini-dot-${payload?.time || cx}`}>
                            {/* Event vertical lines - only renders if events exist and this is first platform */}
                            {showEvents && payload?.events && payload.events.map((event: any, index: number) => (
                              <g key={event.id}>
                                {/* Vertical line from sentiment dot to event label */}
                                <line 
                                  x1={cx} 
                                  y1={cy}     // Start at sentiment dot
                                  x2={cx} 
                                  y2={25}     // End a bit lower than before
                                  stroke="#4285F4" 
                                  strokeWidth={2}
                                />
                                {/* Event label background */}
                                <rect
                                  x={cx - (event.title.length * 2.6 + 4)}
                                  y={10}
                                  width={event.title.length * 5.2 + 8}
                                  height={18}
                                  rx={5}
                                  ry={5}
                                  fill="#4285F4"
                                  stroke="#fff"
                                  strokeWidth={1}
                                  opacity={1}
                                />
                                {/* Event label text */}
                                <text
                                  x={cx}
                                  y={22}
                                  textAnchor="middle"
                                  fontSize="9"
                                  fill="#ffffff"
                                  fillOpacity={1}
                                  fontWeight="600"
                                >
                                  {event.title}
                                </text>
                              </g>
                            ))}
                            {/* Gemini sentiment dot */}
                            <circle 
                              cx={cx} 
                              cy={cy} 
                              r={4} 
                              fill="#4285F4" 
                              stroke="#fff" 
                              strokeWidth={2}
                            />
                          </g>
                        );
                      }}
                      activeDot={{ r: 6, stroke: '#4285F4', strokeWidth: 2, fill: '#ffffff' }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
              )}
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
              <div className="w-full sm:w-1/2">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={sortedTopicData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                      paddingAngle={3}
                      dataKey="value"
                      startAngle={90}
                      endAngle={450}
                    >
                      {sortedTopicData.map((entry, index) => (
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
              <div className="w-full sm:w-1/2 space-y-3 mt-4 sm:mt-0">
                {sortedTopicData
                  .slice(0, showAllTopics ? filteredTopicData.length : 10)
                  .map((item) => (
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
                {filteredTopicData.length > 10 && (
                  <button
                    onClick={() => setShowAllTopics(!showAllTopics)}
                    className="text-xs font-medium mt-2 hover:underline transition-all duration-200"
                    style={{ color: '#8b4513' }}
                  >
                    {showAllTopics ? `Show less` : `Show all ${filteredTopicData.length} topics`}
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
              {filteredKeywordData.slice(0, showAllKeywords ? filteredKeywordData.length : 10).map((item) => {
                const maxCount = maxKeywordCount;
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
              {filteredKeywordData.length > 10 && (
                <button
                  onClick={() => setShowAllKeywords(!showAllKeywords)}
                  className="text-xs font-medium mt-2 hover:underline transition-all duration-200"
                  style={{ color: '#8b4513' }}
                >
                  {showAllKeywords ? `Show less` : `Show all ${filteredKeywordData.length} keywords`}
                </button>
              )}
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
            {recentPosts
              .filter(post => selectedPlatforms.includes(post.platform?.id || 'claude'))
              .map((post) => (
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
                  
                  {/* Second row: Title (clickable link to Reddit) */}
                  <div className="font-semibold text-base">
                    {post.subreddit && post.id ? (
                      <a 
                        href={`https://www.reddit.com/${post.subreddit.startsWith('r/') ? '' : 'r/'}${post.subreddit}/comments/${post.id}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline transition-all duration-200 inline-flex items-center gap-1"
                        style={{ color: '#8b4513' }}
                      >
                        {post.title}
                        <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    ) : (
                      <span style={{ color: '#8b4513' }}>{post.title}</span>
                    )}
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
