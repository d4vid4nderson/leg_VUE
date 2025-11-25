import React from 'react';
import { AlertTriangle, ArrowRight, Landmark, TrendingUp } from 'lucide-react';

const HR1PolicyBanner = ({ onClick, expirationDate }) => {
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
    <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-400 text-white shadow-lg mb-4 rounded-lg overflow-hidden">
      <div className="px-4 sm:px-6 py-3 sm:py-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-start space-x-3 flex-1">
            {/* Content */}
            <div className="flex-1">
              <h3 className="text-sm sm:text-base font-bold leading-tight">
                URGENT: H.R. 1 Policy Changes Analysis
              </h3>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onClick}
            className="bg-white text-orange-600 hover:bg-red-50 px-4 py-2.5 sm:py-2 rounded-lg font-medium 
                     transition-all duration-200 flex items-center justify-center space-x-2 text-sm sm:text-base w-full sm:w-auto min-h-[44px] sm:min-h-[36px]"
          >
            <TrendingUp className="h-4 w-4 sm:h-3 sm:w-3" />
            <span className="whitespace-nowrap">View Analysis</span>
            <ArrowRight className="h-4 w-4 sm:h-3 sm:w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default HR1PolicyBanner;