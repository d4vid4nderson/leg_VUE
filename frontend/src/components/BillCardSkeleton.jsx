import React from 'react';

const BillCardSkeleton = () => {
  return (
    <div className="bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 animate-pulse relative">
      {/* Mobile Highlight Button */}
      <div className="absolute top-4 right-4 lg:hidden">
        <div className="w-11 h-11 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>
      
      <div className="p-6">
        {/* Card Header */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-4 gap-4">
          <div className="flex-1 min-w-0 pr-10 lg:pr-4">
            {/* Title skeleton */}
            <div className="h-6 sm:h-7 bg-gray-200 dark:bg-gray-700 rounded-md w-3/4 mb-3"></div>
            
            {/* Metadata Row */}
            <div className="space-y-3 mb-0">
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 text-sm">
                {/* Bill Number */}
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-16"></div>
                {/* Date */}
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-20"></div>
                {/* Category Tag */}
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-24"></div>
                {/* Session Tag */}
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-32"></div>
              </div>
            </div>
          </div>
          
          {/* Desktop Action Buttons */}
          <div className="hidden lg:flex items-center justify-end gap-2 flex-shrink-0">
            <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </div>
        
        {/* Progress Bar skeleton */}
        <div className="mb-6">
          {/* Labels */}
          <div className="flex justify-between items-center mb-2">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8"></div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-1">
            <div className="bg-gray-300 dark:bg-gray-600 h-2 rounded-full w-2/3"></div>
          </div>
          
          {/* Stage markers */}
          <div className="flex justify-between mt-1">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
          </div>
        </div>
        
        {/* AI Summary skeleton */}
        <div className="mb-6">
          <div className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-48"></div>
              </div>
              <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5"></div>
            </div>
            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillCardSkeleton;