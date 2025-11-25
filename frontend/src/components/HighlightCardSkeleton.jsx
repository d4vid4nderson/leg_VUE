import React from 'react';

const HighlightCardSkeleton = () => {
  return (
    <div className="border rounded-lg overflow-hidden transition-all duration-300 border-gray-200 animate-pulse">
      <div className="p-4">
        {/* Card Header - Mobile Responsive */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-4 gap-4">
          <div className="flex-1 min-w-0">
            {/* Title skeleton */}
            <div className="h-6 sm:h-7 bg-gray-200 rounded-md w-4/5 mb-3"></div>
            
            {/* Metadata Rows - Mobile Optimized */}
            <div className="space-y-3 mb-3">
              {/* Top Row - Number and Date */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="h-5 bg-gray-200 rounded-md w-20"></div>
                <div className="h-5 bg-gray-200 rounded-md w-24"></div>
              </div>
              
              {/* Bottom Row - Category and Type Tags */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-8 bg-gray-200 rounded-lg w-32"></div>
                <div className="h-8 bg-gray-200 rounded-lg w-24"></div>
                <div className="h-8 bg-gray-200 rounded-lg w-20"></div>
              </div>
            </div>
          </div>
          
          {/* Action Buttons - Mobile Optimized */}
          <div className="flex items-center justify-center lg:justify-end gap-2 flex-shrink-0">
            <div className="w-11 h-11 bg-gray-200 rounded-lg"></div>
            <div className="w-11 h-11 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
        
        {/* AI Summary skeleton */}
        <div className="mt-4">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-300 rounded-full"></div>
                <div className="h-5 bg-purple-200 rounded-md w-36"></div>
              </div>
              <div className="h-4 bg-purple-300 rounded-md w-20"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3.5 bg-purple-200 rounded w-full"></div>
              <div className="h-3.5 bg-purple-200 rounded w-5/6"></div>
              <div className="h-3.5 bg-purple-200 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HighlightCardSkeleton;