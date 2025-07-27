import React, { useState } from 'react';
import { Link } from 'react-router-dom';

interface PostItem {
  id: string;
  type: 'post' | 'comment';
  title: string;
  content: string;
  truncatedContent: string;
  subreddit: string;
  sentiment: number;
  category: string;
  keywords: string;
  processed_at: string;
  post_id?: string;
}

interface ReevaluationResult {
  id: string;
  type: 'post' | 'comment';
  title: string;
  oldSentiment: number;
  newSentiment: number;
  oldCategory: string;
  newCategory: string;
  oldKeywords: string;
  newKeywords: string;
  truncatedContent: string;
  error?: string;
}

const Reevaluation = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [items, setItems] = useState<PostItem[]>([]);
  const [results, setResults] = useState<ReevaluationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const API_BASE = 'https://api.claudometer.app';

  // Convert AEST date to UTC for API
  const convertToUTC = (dateStr: string, isEndDate = false) => {
    const date = new Date(dateStr);
    if (isEndDate) {
      // End of day in AEST (23:59:59)
      date.setHours(23, 59, 59, 999);
    } else {
      // Start of day in AEST (00:00:00)
      date.setHours(0, 0, 0, 0);
    }
    // Convert AEST to UTC (subtract 10 hours, but handle daylight saving properly)
    const utcDate = new Date(date.getTime() - (10 * 60 * 60 * 1000));
    return utcDate.toISOString();
  };

  const fetchPosts = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    setLoading(true);
    setError(null);
    setItems([]);
    setResults([]);
    
    try {
      const startUTC = convertToUTC(startDate, false);
      const endUTC = convertToUTC(endDate, true);
      
      const response = await fetch(
        `${API_BASE}/dev/posts?start_date=${encodeURIComponent(startUTC)}&end_date=${encodeURIComponent(endUTC)}`
      );
      
      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.status}`);
      }
      
      const data = await response.json();
      setItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  const reevaluateAll = async () => {
    if (items.length === 0) {
      setError('No items to reevaluate');
      return;
    }

    setProcessing(true);
    setError(null);
    setResults([]);
    
    try {
      setProgress(`Processing ${items.length} items...`);
      
      const response = await fetch(`${API_BASE}/dev/reevaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to reevaluate: ${response.status}`);
      }
      
      const data = await response.json();
      setResults(data.results);
      setProgress(`Completed processing ${data.results.length} items`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reevaluate');
      setProgress('');
    } finally {
      setProcessing(false);
    }
  };

  const rollbackSingle = async (result: ReevaluationResult) => {
    try {
      const response = await fetch(`${API_BASE}/dev/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          items: [{
            id: result.id,
            type: result.type,
            oldSentiment: result.oldSentiment,
            oldCategory: result.oldCategory,
            oldKeywords: items.find(i => i.id === result.id)?.keywords,
            newKeywords: result.newKeywords
          }]
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to rollback: ${response.status}`);
      }
      
      // Remove from results
      setResults(results.filter(r => r.id !== result.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollback');
    }
  };

  const rollbackAll = async () => {
    try {
      const rollbackItems = results.map(result => ({
        id: result.id,
        type: result.type,
        oldSentiment: result.oldSentiment,
        oldCategory: result.oldCategory,
        oldKeywords: items.find(i => i.id === result.id)?.keywords,
        newKeywords: result.newKeywords
      }));

      const response = await fetch(`${API_BASE}/dev/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: rollbackItems }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to rollback: ${response.status}`);
      }
      
      setResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rollback all');
    }
  };

  const getSentimentColor = (sentiment: number) => {
    if (sentiment >= 0.8) return '#16a34a';
    if (sentiment >= 0.7) return '#22c55e';
    if (sentiment >= 0.6) return '#65a30d';
    if (sentiment >= 0.5) return '#94a3b8';
    if (sentiment >= 0.4) return '#f59e0b';
    if (sentiment >= 0.3) return '#f97316';
    return '#ef4444';
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
              Sentiment Reevaluation
            </h1>
          </div>
          <p className="text-lg font-medium max-w-2xl mx-auto" style={{ color: '#9f6841' }}>
            Reevaluate sentiment scores for posts and comments within a date range
          </p>
          <div className="mt-4 p-3 rounded-lg border border-orange-300 bg-orange-50">
            <p className="text-sm font-medium text-orange-800">
              ⚠️ DEV MODE ONLY - This tool requires DEV_MODE_ENABLED=true in Cloudflare Workers
            </p>
          </div>
        </div>

        {/* Date Selection */}
        <div className="rounded-2xl shadow-lg border p-6 mb-6" style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          borderColor: 'rgba(212, 163, 127, 0.3)'
        }}>
          <h3 className="text-xl font-semibold mb-4" style={{ color: '#8b4513' }}>
            Select Date Range (AEST)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#8b4513' }}>
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#8b4513' }}>
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={fetchPosts}
                disabled={loading || !startDate || !endDate}
                className="w-full px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
                style={{ 
                  backgroundColor: '#8b4513',
                  color: 'white'
                }}
              >
                {loading ? 'Fetching...' : 'Fetch Posts'}
              </button>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 mb-6">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        {/* Items Summary and Actions */}
        {items.length > 0 && (
          <div className="rounded-2xl shadow-lg border p-6 mb-6" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: 'rgba(212, 163, 127, 0.3)'
          }}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold" style={{ color: '#8b4513' }}>
                Found {items.length} items ({items.filter(i => i.type === 'post').length} posts, {items.filter(i => i.type === 'comment').length} comments)
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={reevaluateAll}
                  disabled={processing}
                  className="px-4 py-2 rounded-lg font-medium transition-all disabled:opacity-50"
                  style={{ 
                    backgroundColor: '#8b4513',
                    color: 'white'
                  }}
                >
                  {processing ? 'Processing...' : 'Reevaluate All'}
                </button>
                {results.length > 0 && (
                  <button
                    onClick={rollbackAll}
                    className="px-4 py-2 rounded-lg font-medium border border-red-500 text-red-500 hover:bg-red-50"
                  >
                    Rollback All
                  </button>
                )}
              </div>
            </div>
            
            {progress && (
              <div className="text-sm font-medium mb-4" style={{ color: '#9f6841' }}>
                {progress}
              </div>
            )}
          </div>
        )}

        {/* Results Display */}
        {results.length > 0 && (
          <div className="rounded-2xl shadow-lg border p-6" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: 'rgba(212, 163, 127, 0.3)'
          }}>
            <h3 className="text-xl font-semibold mb-6" style={{ color: '#8b4513' }}>
              Reevaluation Results ({results.length} items)
            </h3>
            <div className="space-y-4">
              {results.map((result) => (
                <div key={result.id} className="border rounded-lg p-4" style={{ 
                  borderColor: 'rgba(212, 163, 127, 0.3)',
                  backgroundColor: 'rgba(246, 237, 229, 0.3)'
                }}>
                  {result.error ? (
                    <div className="text-red-600 font-medium">
                      Error processing {result.type}: {result.error}
                    </div>
                  ) : (
                    <div>
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm" style={{ color: '#8b4513' }}>
                            {result.title}
                          </h4>
                          <div className="text-xs mt-1" style={{ color: '#9f6841' }}>
                            {result.type} • {result.id}
                          </div>
                        </div>
                        <button
                          onClick={() => rollbackSingle(result)}
                          className="text-xs px-2 py-1 rounded border border-red-500 text-red-500 hover:bg-red-50"
                        >
                          Rollback
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <div className="text-xs font-medium" style={{ color: '#9f6841' }}>Old Score</div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: getSentimentColor(result.oldSentiment) }}>
                              {(result.oldSentiment * 100).toFixed(0)}%
                            </span>
                            <span className="text-xs" style={{ color: getSentimentColor(result.oldSentiment) }}>
                              {getSentimentLabel(result.oldSentiment)}
                            </span>
                          </div>
                          <div className="text-xs" style={{ color: '#9f6841' }}>
                            Category: {result.oldCategory}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium" style={{ color: '#9f6841' }}>New Score</div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium" style={{ color: getSentimentColor(result.newSentiment) }}>
                              {(result.newSentiment * 100).toFixed(0)}%
                            </span>
                            <span className="text-xs" style={{ color: getSentimentColor(result.newSentiment) }}>
                              {getSentimentLabel(result.newSentiment)}
                            </span>
                          </div>
                          <div className="text-xs" style={{ color: '#9f6841' }}>
                            Category: {result.newCategory}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                          <div className="text-xs font-medium mb-1" style={{ color: '#9f6841' }}>Old Keywords</div>
                          <div className="text-xs p-2 rounded" style={{ 
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            color: '#dc2626',
                            minHeight: '2rem'
                          }}>
                            {result.oldKeywords || 'None'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-medium mb-1" style={{ color: '#9f6841' }}>New Keywords</div>
                          <div className="text-xs p-2 rounded" style={{ 
                            backgroundColor: 'rgba(34, 197, 94, 0.1)',
                            color: '#16a34a',
                            minHeight: '2rem'
                          }}>
                            {result.newKeywords || 'None'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-xs p-2 rounded" style={{ 
                        backgroundColor: 'rgba(139, 69, 19, 0.1)',
                        color: '#8b4513'
                      }}>
                        <strong>Content analyzed:</strong> {result.truncatedContent}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Back to Dashboard */}
        <div className="text-center mt-8">
          <Link
            to="/"
            className="inline-block px-6 py-3 rounded-lg font-medium transition-all"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              color: '#8b4513',
              border: '1px solid rgba(212, 163, 127, 0.3)'
            }}
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Reevaluation;