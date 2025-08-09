import React from 'react';
import { Link } from 'react-router-dom';

const Contact: React.FC = () => {
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #fbf6f2 0%, #f6ede5 50%, #ead1bf 100%)' }}>
      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-8">
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
              Contact Us
            </h1>
          </div>
          
          <p className="text-lg font-medium max-w-2xl mx-auto" style={{ color: '#9f6841' }}>
            Have feedback, questions, or suggestions for Claudometer? We'd love to hear from you!
          </p>
        </div>

        {/* Contact Information */}
        <div className="max-w-2xl mx-auto">
          <div className="rounded-2xl shadow-lg border p-8 text-center" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            borderColor: 'rgba(212, 163, 127, 0.3)'
          }}>
            <h2 className="text-2xl font-semibold mb-6" style={{ color: '#8b4513' }}>
              Get in Touch
            </h2>
            
            <div className="mb-8">
              <p className="text-lg mb-4" style={{ color: '#9f6841' }}>
                Send us an email at:
              </p>
              
              <div className="text-center">
                <img 
                  src="/email.png" 
                  alt="contact email address"
                  className="mx-auto"
                  style={{ maxWidth: '400px', height: 'auto' }}
                />
              </div>
            </div>

            <div className="space-y-4 text-left">
              <div className="flex items-start gap-3">
                <div className="w-6"></div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: '#8b4513' }}>Feature Requests</h3>
                  <p className="text-sm" style={{ color: '#9f6841' }}>
                    Ideas for new metrics, visualizations, or data sources
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6"></div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: '#8b4513' }}>Bug Reports</h3>
                  <p className="text-sm" style={{ color: '#9f6841' }}>
                    Technical issues, incorrect data, or broken functionality
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6"></div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: '#8b4513' }}>Data Questions</h3>
                  <p className="text-sm" style={{ color: '#9f6841' }}>
                    Questions about methodology, accuracy, or data sources
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-6"></div>
                <div>
                  <h3 className="font-semibold mb-1" style={{ color: '#8b4513' }}>Partnerships</h3>
                  <p className="text-sm" style={{ color: '#9f6841' }}>
                    Collaboration opportunities or API access requests
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(246, 237, 229, 0.5)' }}>
                <p className="text-sm font-medium" style={{ color: '#9f6841' }}>
                  <strong>Response Time:</strong> We will be in contact within 2 working days.
                </p>
              </div>
              
              <div className="p-4 rounded-xl" style={{ backgroundColor: 'rgba(246, 237, 229, 0.5)' }}>
                <p className="text-sm font-medium" style={{ color: '#9f6841' }}>
                  Follow me on X/Twitter: <a 
                    href="https://x.com/kouk_george" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:underline transition-all duration-200"
                    style={{ color: '#8b4513' }}
                  >
                    @kouk_george
                  </a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;