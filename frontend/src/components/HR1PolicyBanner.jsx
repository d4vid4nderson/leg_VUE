import React from 'react';
import { AlertTriangle, ArrowRight, Landmark, TrendingUp } from 'lucide-react';

const HR1PolicyBanner = ({ onClick }) => {
  return (
    <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-400 text-white shadow-lg mb-4 rounded-lg overflow-hidden">
      <div className="px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Content */}
            <div className="flex-1">
              <h3 className="text-sm font-bold flex items-center">
                URGENT: H.R. 1 Policy Changes Analysis
                <span className="ml-2 text-xs bg-white/20 px-2 py-1 rounded-full">NEW</span>
              </h3>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onClick}
            className="bg-white text-orange-600 hover:bg-red-50 px-4 py-2 rounded-lg font-medium 
                     transition-all duration-200 flex items-center space-x-2 text-sm"
          >
            <TrendingUp className="h-3 w-3" />
            <span className="whitespace-nowrap">View Analysis</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default HR1PolicyBanner;