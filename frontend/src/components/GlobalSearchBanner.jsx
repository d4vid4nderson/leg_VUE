import React from 'react';
import { Search, Command, ArrowRight, Zap } from 'lucide-react';

const GlobalSearchBanner = ({ onTryNow, expirationDate }) => {
  // Check if banner should be displayed based on expiration date
  const shouldDisplayBanner = () => {
    if (!expirationDate) return true; // If no expiration date is set, always show
    
    const currentDate = new Date();
    const expDate = new Date(expirationDate);
    
    // Banner is visible if current date is before expiration date
    return currentDate < expDate;
  };

  // Don't render anything if banner has expired
  if (!shouldDisplayBanner()) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white shadow-lg mb-4 rounded-lg overflow-hidden">
      <div className="px-4 sm:px-6 py-3 sm:py-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start space-x-3 flex-1">
            {/* Search Icon */}
            <div className="flex-shrink-0 w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center mt-1">
              <Search size={18} className="text-white" />
            </div>
            
            {/* Content */}
            <div className="flex-1">
              <h3 className="text-sm sm:text-base font-bold leading-tight">
                NEW: Global Search Now Available
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 mt-1 leading-tight">
                Search across all bills and orders instantly with{' '}
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded text-xs font-mono">
                    <Command size={10} />
                    <span>K</span>
                  </span>
                  <span className="mx-1">or</span>
                  <span className="inline-flex items-center gap-1 bg-white/20 px-2 py-0.5 rounded text-xs font-mono">
                    <span>Ctrl</span>
                    <span>+</span>
                    <span>K</span>
                  </span>
                </span>
              </p>
            </div>
          </div>

          {/* Try Now Button */}
          <button
            onClick={onTryNow}
            className="bg-white text-purple-600 hover:bg-blue-50 px-4 py-2.5 sm:py-2 rounded-lg font-medium 
                     transition-all duration-200 flex items-center justify-center space-x-2 text-sm sm:text-base w-full sm:w-auto min-h-[44px] sm:min-h-[36px] hover:shadow-lg transform hover:scale-105"
          >
            <Zap className="h-4 w-4 sm:h-3 sm:w-3" />
            <span className="whitespace-nowrap">Try Now</span>
            <ArrowRight className="h-4 w-4 sm:h-3 sm:w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchBanner;