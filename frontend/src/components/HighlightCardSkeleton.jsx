import React from 'react';

const HighlightCardSkeleton = () => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 animate-pulse">
      <div className="p-6">
        {/* Header Section */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            {/* Type Badge Skeleton */}
            <div className="h-5 bg-gray-200 rounded-md w-32 mb-3"></div>
            
            {/* Title skeleton */}
            <div className="h-7 bg-gray-200 rounded-md w-4/5 mb-3"></div>
            
            {/* Metadata Row skeleton */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-5 bg-gray-200 rounded-md w-20"></div>
              <div className="h-5 bg-gray-200 rounded-md w-24"></div>
              <div className="h-5 bg-gray-200 rounded-md w-28"></div>
              <div className="h-5 bg-gray-200 rounded-md w-24"></div>
            </div>
          </div>
          
          {/* Action Buttons skeleton */}
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
            <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
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