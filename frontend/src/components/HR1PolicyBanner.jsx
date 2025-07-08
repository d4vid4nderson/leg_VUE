import React from 'react';
import { AlertTriangle, ArrowRight, Landmark, TrendingUp } from 'lucide-react';

const HR1PolicyBanner = ({ onClick }) => {
  return (
    <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-400 text-white shadow-lg mb-6 rounded-lg overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Icon and Alert */}
            <div className="flex items-center space-x-2">
              <div className="bg-white/20 p-1.5 rounded-full">
                <AlertTriangle className="h-4 w-4 text-white" />
              </div>
              <div className="bg-white/20 p-1.5 rounded-full">
                <Landmark className="h-4 w-4 text-white" />
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1">
              <div className="flex items-center flex-wrap gap-2">
                <h3 className="text-base font-bold flex items-center">
                  🏛️ URGENT: H.R. 1 Policy Changes Analysis
                  <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded-full">NEW</span>
                </h3>
                <div className="hidden md:flex items-center space-x-4 text-xs">
                  <div className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                    <span>Defense: +Major Increases</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full"></div>
                    <span>Education: -Funding Cuts</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-1.5 h-1.5 bg-rose-600 rounded-full"></div>
                    <span>Energy: Mixed Impact</span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-white/90 mt-1 md:hidden">
                Critical changes affecting education, civic, and engineering sectors.
              </div>
              <div className="text-sm text-white/90 mt-1 hidden md:block">
                Major budget reconciliation bill impacts defense spending, energy policy, and federal contracts. 
                <span className="font-semibold"> Critical changes affecting education, civic, and engineering sectors.</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onClick}
            className="bg-white text-orange-600 hover:bg-red-50 px-4 py-2 rounded-lg font-semibold 
                     transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl 
                     transform hover:scale-105 min-w-fit text-sm"
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