import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const buildDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <footer className="mt-16 border-t border-opacity-20" style={{ borderColor: '#d4a37f' }}>
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Data Sources & Privacy */}
          <div>
            <h4 className="font-semibold mb-3" style={{ color: '#8b4513' }}>
              Data & Privacy
            </h4>
            <div className="space-y-2 text-sm" style={{ color: '#9f6841' }}>
              <p>
                <strong>Data Sources:</strong> Multi-platform Reddit monitoring (Claude, ChatGPT, Gemini)
              </p>
              <p>
                <strong>Privacy:</strong> No personal data stored. Only public Reddit posts analyzed.
              </p>
              <p>
                <strong>Analysis:</strong> Platform-specific sentiment analysis via OpenAI API
              </p>
            </div>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-semibold mb-3" style={{ color: '#8b4513' }}>
              Information
            </h4>
            <div className="space-y-2 text-sm">
              <Link 
                to="/methodology" 
                className="block hover:underline transition-all duration-200"
                style={{ color: '#9f6841' }}
              >
                How It Works
              </Link>
              <Link 
                to="/contact" 
                className="block hover:underline transition-all duration-200"
                style={{ color: '#9f6841' }}
              >
                Contact Us
              </Link>
            </div>
          </div>

          {/* About */}
          <div>
            <h4 className="font-semibold mb-3" style={{ color: '#8b4513' }}>
              About Claudometer
            </h4>
            <div className="space-y-2 text-sm" style={{ color: '#9f6841' }}>
              <p>
                Real-time sentiment tracking across Claude, ChatGPT, and Gemini communities.
              </p>
              <p>
                <strong>Last Updated:</strong> {buildDate}
              </p>
              <p>
                Data refreshes hourly with staggered multi-platform collection.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-8 pt-6 border-t border-opacity-20 flex flex-col sm:flex-row justify-between items-center" style={{ borderColor: '#d4a37f' }}>
          <div className="text-sm font-medium mb-2 sm:mb-0" style={{ color: '#9f6841' }}>
            © {currentYear} Claudometer. Made with ❤️ for the Claude community by{' '}
            <a 
              href="https://x.com/kouk_george" 
              target="_blank" 
              rel="noopener noreferrer"
              className="hover:underline transition-all duration-200"
              style={{ color: '#8b4513' }}
            >
              @kouk_george
            </a>
          </div>
          <div className="text-xs" style={{ color: '#9f6841' }}>
            Not affiliated with Anthropic
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;