import React from 'react';

const BillCardSkeleton = () => {
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm animate-pulse">
      <div className="p-6">
        {/* Title skeleton */}
        <div className="flex items-start justify-between mb-4">
          <div className="h-6 sm:h-7 bg-gray-200 rounded-md w-3/4"></div>
          <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
        </div>
        
        {/* Metadata Row - Bill Number, Date, Status, Session */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="h-5 bg-blue-200 rounded-md w-16"></div>
          <div className="h-5 bg-gray-200 rounded-md w-20"></div>
          <div className="h-8 bg-gray-200 rounded-lg w-28"></div>
          <div className="h-5 bg-purple-200 rounded-md w-48"></div>
        </div>
        
        {/* Progress Bar skeleton */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            {/* Progress circles */}
            <div className="flex items-center gap-4 flex-1">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-blue-300 rounded-full"></div>
                <div className="h-3 bg-gray-200 rounded w-8 mt-1"></div>
              </div>
              <div className="flex-1 h-1 bg-gray-200 rounded"></div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="h-3 bg-gray-200 rounded w-8 mt-1"></div>
              </div>
              <div className="flex-1 h-1 bg-gray-200 rounded"></div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="h-3 bg-gray-200 rounded w-8 mt-1"></div>
              </div>
              <div className="flex-1 h-1 bg-gray-200 rounded"></div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="h-3 bg-gray-200 rounded w-10 mt-1"></div>
              </div>
              <div className="flex-1 h-1 bg-gray-200 rounded"></div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="h-3 bg-gray-200 rounded w-10 mt-1"></div>
              </div>
            </div>
          </div>
        </div>
        
        {/* AI Summary skeleton */}
        <div className="mb-6">
          <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-200 rounded-lg p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-purple-300 rounded-full"></div>
              <div className="h-5 bg-gray-200 rounded-md w-48"></div>
            </div>
            <div className="space-y-2 mb-4">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="h-4 bg-blue-200 rounded w-40"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BillCardSkeleton;