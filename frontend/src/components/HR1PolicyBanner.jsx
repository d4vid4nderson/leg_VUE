import React from 'react';
import { AlertTriangle, ArrowRight, Landmark, TrendingUp } from 'lucide-react';

const HR1PolicyBanner = ({ onClick }) => {
  return (
    <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-400 text-white shadow-lg mb-8 rounded-lg overflow-hidden">
      <div className="px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Icon and Alert */}
            <div className="flex items-center space-x-2">
              <div className="bg-white/20 p-2 rounded-full">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div className="bg-white/20 p-2 rounded-full">
                <Landmark className="h-5 w-5 text-white" />
              </div>
            </div>
            
            {/* Content */}
            <div className="flex-1">
              <div className="flex items-center flex-wrap gap-2">
                <h3 className="text-lg font-bold flex items-center">
                  🏛️ URGENT: H.R. 1 Policy Changes Analysis
                  <span className="ml-2 text-sm bg-white/20 px-2 py-1 rounded-full">NEW</span>
                </h3>
                <div className="hidden md:flex items-center space-x-4 text-sm">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                    <span>Defense: +Major Increases</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                    <span>Education: -Funding Cuts</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-rose-600 rounded-full"></div>
                    <span>Energy: Mixed Impact</span>
                  </div>
                </div>
              </div>
              <div className="text-sm text-white/90 mt-1 md:hidden">
                Critical changes affecting education, civic, and engineering sectors.
              </div>
              <div className="text-base text-white/90 mt-1 hidden md:block">
                Major budget reconciliation bill impacts defense spending, energy policy, and federal contracts. 
                <span className="font-semibold"> Critical changes affecting education, civic, and engineering sectors.</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={onClick}
            className="bg-white text-orange-600 hover:bg-red-50 px-6 py-3 rounded-lg font-semibold 
                     transition-all duration-200 flex items-center space-x-2 shadow-lg hover:shadow-xl 
                     transform hover:scale-105 min-w-fit text-base"
          >
            <TrendingUp className="h-4 w-4" />
            <span className="whitespace-nowrap">View Analysis</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default HR1PolicyBanner;