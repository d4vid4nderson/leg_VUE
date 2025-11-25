import React from 'react';

const ExecutiveOrderSkeleton = () => {
  return (
    <div className="bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-500 rounded-lg transition-all duration-300 animate-pulse">
      <div className="p-6">
        {/* Header with Title and Star */}
        <div className="flex items-start justify-between gap-4 mb-4">
          {/* Title skeleton */}
          <div className="h-7 bg-gray-200 dark:bg-slate-600 rounded-md flex-1"></div>
          {/* Star button skeleton */}
          <div className="w-10 h-10 bg-gray-200 dark:bg-slate-600 rounded-md flex-shrink-0"></div>
        </div>
        
        {/* Metadata Row */}
        <div className="flex flex-wrap items-center gap-4 text-sm mb-4">
          {/* Order Number */}
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-blue-300 dark:bg-blue-600 rounded"></div>
            <div className="h-5 bg-gray-200 dark:bg-slate-600 rounded w-20"></div>
          </div>
          {/* Date */}
          <div className="flex items-center gap-2">
            <div className="w-3.5 h-3.5 bg-green-300 dark:bg-green-600 rounded"></div>
            <div className="h-5 bg-gray-200 dark:bg-slate-600 rounded w-24"></div>
          </div>
          {/* Category Tag */}
          <div className="h-7 bg-gray-200 dark:bg-slate-600 rounded-lg w-28"></div>
        </div>

        {/* AI Summary Preview */}
        <div className="mb-4">
          <div className="bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-5 bg-gray-200 dark:bg-slate-600 rounded w-36"></div>
              </div>
              <div className="w-6 h-6 bg-gradient-to-br from-purple-300 to-indigo-300 dark:from-purple-600 dark:to-indigo-600 rounded-lg"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded w-full"></div>
              <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 dark:bg-slate-600 rounded w-4/6"></div>
            </div>
          </div>
        </div>
        
        {/* Border */}
        <div className="border-b border-gray-200 dark:border-slate-600 mt-4"></div>
        
        {/* Source and PDF Links with Read More Button */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-6">
            {/* View Source Page */}
            <div className="h-5 bg-gray-200 dark:bg-slate-600 rounded w-28"></div>
            {/* View PDF */}
            <div className="h-5 bg-gray-200 dark:bg-slate-600 rounded w-20"></div>
          </div>
          {/* Read More Button */}
          <div className="h-9 bg-gray-200 dark:bg-slate-600 rounded-lg w-24"></div>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveOrderSkeleton;