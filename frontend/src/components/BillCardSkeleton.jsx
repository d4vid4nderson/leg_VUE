import React from 'react';

const BillCardSkeleton = () => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm animate-pulse">
      <div className="p-6">
        {/* Card Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            {/* Title skeleton */}
            <div className="h-7 bg-gray-200 rounded-md w-3/4 mb-3"></div>
            
            {/* Metadata Row skeleton */}
            <div className="flex flex-wrap items-center gap-4 mb-3">
              <div className="h-6 bg-gray-200 rounded-md w-24"></div>
              <div className="h-6 bg-gray-200 rounded-md w-32"></div>
              <div className="h-6 bg-gray-200 rounded-md w-20"></div>
              <div className="h-6 bg-gray-200 rounded-md w-28"></div>
            </div>
          </div>
          
          {/* Action Buttons skeleton */}
          <div className="flex items-center gap-3 ml-6 flex-shrink-0">
            <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
            <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
            <div className="w-8 h-8 bg-gray-200 rounded-md"></div>
          </div>
        </div>
        
        {/* AI Summary skeleton */}
        <div className="mb-6">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-purple-300 rounded-full"></div>
                <div className="h-6 bg-purple-200 rounded-md w-40"></div>
              </div>
              <div className="h-5 bg-purple-300 rounded-md w-24"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-purple-200 rounded w-full"></div>
              <div className="h-4 bg-purple-200 rounded w-5/6"></div>
              <div className="h-4 bg-purple-200 rounded w-4/6"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillCardSkeleton;