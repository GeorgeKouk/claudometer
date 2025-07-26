import React from 'react';
import { Link } from 'react-router-dom';

const Methodology: React.FC = () => {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #fbf6f2 0%, #f6ede5 50%, #ead1bf 100%)' }}>
      <div className="max-w-5xl mx-auto px-3 sm:px-6 py-8">
        {/* Back Button */}
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all duration-200 hover:scale-105"
            style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              color: '#8b4513',
              border: '1px solid rgba(212, 163, 127, 0.3)'
            }}
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-12">
          
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden" style={{ backgroundColor: '#d4a37f' }}>
              <img 
                src="/logo.png" 
                alt="Claudometer Logo" 
                className="w-full h-full object-contain mix-blend-multiply p-1.5"
              />
            </div>
            <h1 className="text-4xl font-bold" style={{ color: '#824920' }}>
              How It Works
            </h1>
          </div>
          
          <p className="text-lg font-medium" style={{ color: '#9f6841' }}>
            Understanding the methodology behind Claudometer's sentiment analysis and data collection
          </p>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Data Collection */}
          <div className="rounded-2xl shadow-lg border p-8" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: 'rgba(212, 163, 127, 0.3)'
          }}>
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3" style={{ color: '#8b4513' }}>
              Data Collection
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3" style={{ color: '#8b4513' }}>Sources</h3>
                <ul className="space-y-2 text-sm" style={{ color: '#9f6841' }}>
                  <li>• <strong>r/Anthropic</strong> - Official Anthropic community</li>
                  <li>• <strong>r/ClaudeAI</strong> - General Claude discussions</li>
                  <li>• <strong>r/ClaudeCode</strong> - Claude Code specific topics</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3" style={{ color: '#8b4513' }}>Collection Process</h3>
                <ul className="space-y-2 text-sm" style={{ color: '#9f6841' }}>
                  <li>• <strong>Frequency:</strong> Every hour</li>
                  <li>• <strong>Posts:</strong> Top 20 recent posts per subreddit</li>
                  <li>• <strong>Comments:</strong> Top 5 comments per post</li>
                  <li>• <strong>Analysis:</strong> All collected posts and comments analyzed</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Sentiment Analysis */}
          <div className="rounded-2xl shadow-lg border p-8" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: 'rgba(212, 163, 127, 0.3)'
          }}>
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3" style={{ color: '#8b4513' }}>
              Sentiment Analysis
            </h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3" style={{ color: '#8b4513' }}>AI-Powered Analysis</h3>
                <p className="text-sm mb-4" style={{ color: '#9f6841' }}>
                  We use OpenAI's language models to analyze the sentiment of each post and comment. 
                  The AI evaluates the overall tone, context, and emotional indicators to assign a sentiment score.
                </p>
                
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(246, 237, 229, 0.5)' }}>
                    <h4 className="font-semibold mb-2" style={{ color: '#8b4513' }}>Scoring Scale</h4>
                    <p className="text-xs" style={{ color: '#9f6841' }}>
                      0.0 = Very Negative<br/>
                      0.5 = Neutral<br/>
                      1.0 = Very Positive
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(246, 237, 229, 0.5)' }}>
                    <h4 className="font-semibold mb-2" style={{ color: '#8b4513' }}>Weighted Average</h4>
                    <p className="text-xs" style={{ color: '#9f6841' }}>
                      Posts: 3x weight<br/>
                      Comments: 1x weight<br/>
                      More balanced representation
                    </p>
                  </div>
                  
                  <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(246, 237, 229, 0.5)' }}>
                    <h4 className="font-semibold mb-2" style={{ color: '#8b4513' }}>Context Aware</h4>
                    <p className="text-xs" style={{ color: '#9f6841' }}>
                      Considers sarcasm, technical discussions, and Claude-specific terminology
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Topic Classification */}
          <div className="rounded-2xl shadow-lg border p-8" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: 'rgba(212, 163, 127, 0.3)'
          }}>
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3" style={{ color: '#8b4513' }}>
              Topic Classification
            </h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-3" style={{ color: '#8b4513' }}>Current Topic Categories</h3>
                <div className="grid grid-cols-2 gap-2 text-sm" style={{ color: '#9f6841' }}>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF6B6B' }}></div>
                    <span>Authentication</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#4ECDC4' }}></div>
                    <span>Performance</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#45B7D1' }}></div>
                    <span>Integration</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#96CEB4' }}></div>
                    <span>Troubleshooting</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FECA57' }}></div>
                    <span>Features</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF9FF3' }}></div>
                    <span>Documentation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#54A0FF' }}></div>
                    <span>Comparison</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#5F27CD' }}></div>
                    <span>Tutorial</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#00D2D3' }}></div>
                    <span>Feedback</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FF9F43' }}></div>
                    <span>Pricing</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold mb-3" style={{ color: '#8b4513' }}>Keyword Extraction</h3>
                <p className="text-sm mb-3" style={{ color: '#9f6841' }}>
                  AI identifies trending keywords and phrases from posts and comments, 
                  tracking their frequency and associated sentiment over time.
                </p>
                <ul className="space-y-1 text-xs" style={{ color: '#9f6841' }}>
                  <li>• Automatic keyword detection</li>
                  <li>• Sentiment scoring per keyword</li>
                  <li>• Trend analysis over time periods</li>
                  <li>• Noise filtering for relevant terms</li>
                </ul>
              </div>
            </div>
          </div>


          {/* Limitations & Accuracy */}
          <div className="rounded-2xl shadow-lg border p-8" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: 'rgba(212, 163, 127, 0.3)'
          }}>
            <h2 className="text-2xl font-semibold mb-6 flex items-center gap-3" style={{ color: '#8b4513' }}>
              Limitations & Considerations
            </h2>
            
            <div className="space-y-4 text-sm" style={{ color: '#9f6841' }}>
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(246, 237, 229, 0.5)' }}>
                <h3 className="font-semibold mb-2" style={{ color: '#8b4513' }}>Data Sampling</h3>
                <p>
                  Due to API rate limits and cost considerations, we analyze a subset of posts and comments. 
                  Results represent trends rather than comprehensive community sentiment.
                </p>
              </div>
              
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(246, 237, 229, 0.5)' }}>
                <h3 className="font-semibold mb-2" style={{ color: '#8b4513' }}>AI Limitations</h3>
                <p>
                  Sentiment analysis may not capture nuanced context, sarcasm, or technical discussions perfectly. 
                  Results should be interpreted as general trends rather than absolute measures.
                </p>
              </div>
              
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(246, 237, 229, 0.5)' }}>
                <h3 className="font-semibold mb-2" style={{ color: '#8b4513' }}>Reddit Bias</h3>
                <p>
                  Data reflects only public Reddit discussions. Community sentiment may differ from 
                  broader user sentiment across other platforms or private channels.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Methodology;