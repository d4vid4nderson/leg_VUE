import React from 'react';

const BillCardSkeleton = () => {
  return (
    <div className="bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm animate-pulse relative">
      {/* Star button skeleton */}
      <div className="absolute top-4 right-4">
        <div className="w-9 h-9 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>

      <div className="p-6 pr-16">
        {/* Title Skeleton - Multiple lines to show wrapping */}
        <div className="mb-4 space-y-2">
          <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-md w-full"></div>
          <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-md w-2/3"></div>
        </div>

        {/* Metadata Row - Bill Number, Date, Category, Session */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {/* Bill Number */}
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
          {/* Date */}
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
          {/* Category Tag */}
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-24"></div>
          {/* Session Tag */}
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48"></div>
        </div>

        {/* AI Generated Summary Section */}
        <div className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-5 mb-4">
          {/* Header with AI badge */}
          <div className="flex items-center justify-between mb-3">
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-44"></div>
            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-lg"></div>
          </div>

          {/* Summary text - Multiple lines */}
          <div className="space-y-2.5">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-11/12"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          </div>
        </div>

        {/* View Original Bill Information Link */}
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-52"></div>
      </div>
    </div>
  );
};

export default BillCardSkeleton;