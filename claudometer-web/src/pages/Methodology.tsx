import React from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

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
            Understanding the methodology behind Claudometer's multi-platform sentiment analysis and data collection
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
            
            <div className="space-y-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(246, 237, 229, 0.5)' }}>
                  <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#8B4513' }}>
                    <div className="w-4 h-4 mask-image" style={{
                      backgroundColor: '#8B4513',
                      maskImage: 'url(/platform-logos/claude.webp)',
                      maskSize: 'contain',
                      maskRepeat: 'no-repeat',
                      maskPosition: 'center',
                      WebkitMaskImage: 'url(/platform-logos/claude.webp)'
                    }} />
                    Claude AI
                  </h4>
                  <ul className="space-y-1 text-xs" style={{ color: '#9f6841' }}>
                    <li>• <strong>r/Anthropic</strong> - Official community</li>
                    <li>• <strong>r/ClaudeAI</strong> - General discussions</li>
                    <li>• <strong>r/ClaudeCode</strong> - Coding topics</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(246, 237, 229, 0.5)' }}>
                  <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#10A37F' }}>
                    <div className="w-4 h-4 mask-image" style={{
                      backgroundColor: '#10A37F',
                      maskImage: 'url(/platform-logos/chatgpt.webp)',
                      maskSize: 'contain',
                      maskRepeat: 'no-repeat',
                      maskPosition: 'center',
                      WebkitMaskImage: 'url(/platform-logos/chatgpt.webp)'
                    }} />
                    ChatGPT
                  </h4>
                  <ul className="space-y-1 text-xs" style={{ color: '#9f6841' }}>
                    <li>• <strong>r/OpenAI</strong> - Official OpenAI</li>
                    <li>• <strong>r/ChatGPT</strong> - Main community</li>
                    <li>• <strong>r/ChatGPTPro</strong> - Premium discussions</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(246, 237, 229, 0.5)' }}>
                  <h4 className="font-semibold mb-3 flex items-center gap-2" style={{ color: '#4285F4' }}>
                    <div className="w-4 h-4 mask-image" style={{
                      backgroundColor: '#4285F4',
                      maskImage: 'url(/platform-logos/gemini.webp)',
                      maskSize: 'contain',
                      maskRepeat: 'no-repeat',
                      maskPosition: 'center',
                      WebkitMaskImage: 'url(/platform-logos/gemini.webp)'
                    }} />
                    Gemini
                  </h4>
                  <ul className="space-y-1 text-xs" style={{ color: '#9f6841' }}>
                    <li>• <strong>r/GeminiAI</strong> - Main community</li>
                    <li>• <strong>r/Bard</strong> - Legacy discussions</li>
                    <li>• <strong>r/GoogleGeminiAI</strong> - Google-specific</li>
                  </ul>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3" style={{ color: '#8b4513' }}>Collection Schedule</h3>
                  <ul className="space-y-2 text-sm" style={{ color: '#9f6841' }}>
                    <li>• <strong>Staggered Collection:</strong> Every hour with 15-minute intervals</li>
                    <li>• <strong>0-15 min:</strong> Claude data collection</li>
                    <li>• <strong>15-30 min:</strong> ChatGPT data collection</li>
                    <li>• <strong>30-45 min:</strong> Gemini data collection</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold mb-3" style={{ color: '#8b4513' }}>Collection Volume</h3>
                  <ul className="space-y-2 text-sm" style={{ color: '#9f6841' }}>
                    <li>• <strong>Per Platform:</strong> 15 posts per subreddit + 5 comments each</li>
                    <li>• <strong>Total Per Hour:</strong> Up to 225 items analyzed (75 × 3 platforms)</li>
                    <li>• <strong>Analysis:</strong> All collected content analyzed with AI</li>
                    <li>• <strong>Rate Limiting:</strong> Smart delays prevent API limits</li>
                  </ul>
                </div>
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
                <h3 className="text-lg font-semibold mb-3" style={{ color: '#8b4513' }}>Multi-Platform AI Analysis</h3>
                <p className="text-sm mb-4" style={{ color: '#9f6841' }}>
                  We use OpenAI's language models with platform-specific prompts to analyze sentiment across Claude, ChatGPT, and Gemini communities. 
                  Each platform has tailored analysis to understand context, terminology, and community-specific discussions.
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
                    <h4 className="font-semibold mb-2" style={{ color: '#8b4513' }}>Platform-Specific Analysis</h4>
                    <p className="text-xs" style={{ color: '#9f6841' }}>
                      Tailored prompts for each platform's terminology, features, and community context
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
                  We analyze approximately 225 items per hour across all platforms. 
                  Staggered collection prevents rate limits while ensuring comprehensive coverage of recent discussions.
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
                <h3 className="font-semibold mb-2" style={{ color: '#8b4513' }}>Platform Representation</h3>
                <p>
                  Data reflects public Reddit discussions across multiple AI platform communities. 
                  Cross-platform comparison helps identify broader trends, though sentiment may differ from private channels or other platforms.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Methodology;