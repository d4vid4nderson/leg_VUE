// components/ShimmerLoader.jsx - Reusable shimmer loading animation component
import React from 'react';

const ShimmerLoader = ({ 
  count = 3, 
  variant = 'executive-order',
  className = '',
  showHeader = false 
}) => {
  
  // Base shimmer animation CSS class
  const shimmerClass = "animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] animate-shimmer";
  
  // Individual shimmer skeleton component
  const ShimmerSkeleton = ({ width, height, className = "", rounded = false }) => (
    <div 
      className={`${shimmerClass} ${rounded ? 'rounded-full' : 'rounded'} ${className}`}
      style={{ width, height }}
    />
  );

  // Executive Order Card Shimmer
  const ExecutiveOrderShimmer = ({ index }) => (
    <div className="bg-white border rounded-lg overflow-hidden shadow-sm mb-4 p-4">
      {/* Header with number, title, and buttons */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {/* Order number and title */}
          <div className="flex items-center gap-2 mb-2">
            <ShimmerSkeleton width="40px" height="20px" />
            <ShimmerSkeleton width="70%" height="24px" />
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2 ml-4">
          <ShimmerSkeleton width="32px" height="32px" rounded />
          <ShimmerSkeleton width="32px" height="32px" rounded />
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <ShimmerSkeleton width="120px" height="16px" />
        <ShimmerSkeleton width="8px" height="16px" />
        <ShimmerSkeleton width="100px" height="16px" />
        <ShimmerSkeleton width="8px" height="16px" />
        <ShimmerSkeleton width="80px" height="24px" rounded />
        <ShimmerSkeleton width="8px" height="16px" />
        <ShimmerSkeleton width="100px" height="24px" rounded />
      </div>

      {/* AI Summary Section */}
      <div className="bg-purple-50 p-4 rounded-md border border-purple-200 mb-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <ShimmerSkeleton width="150px" height="16px" />
          <ShimmerSkeleton width="8px" height="16px" />
          <ShimmerSkeleton width="80px" height="18px" rounded />
        </div>
        
        {/* Content lines */}
        <div className="space-y-2">
          <ShimmerSkeleton width="100%" height="14px" />
          <ShimmerSkeleton width="95%" height="14px" />
          <ShimmerSkeleton width="88%" height="14px" />
          <ShimmerSkeleton width="92%" height="14px" />
        </div>
      </div>

      {/* Action buttons at bottom */}
      <div className="flex flex-wrap gap-2">
        <ShimmerSkeleton width="120px" height="36px" rounded />
        <ShimmerSkeleton width="90px" height="36px" rounded />
        <ShimmerSkeleton width="100px" height="36px" rounded />
      </div>
    </div>
  );

  // State Legislation Card Shimmer
  const StateLegislationShimmer = ({ index }) => (
    <div className="bg-white border rounded-lg overflow-hidden shadow-sm mb-4 p-4">
      {/* Header with number, title, and buttons */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {/* Bill number and title */}
          <div className="flex items-center gap-2 mb-2">
            <ShimmerSkeleton width="40px" height="20px" />
            <ShimmerSkeleton width="75%" height="24px" />
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2 ml-4">
          <ShimmerSkeleton width="32px" height="32px" rounded />
          <ShimmerSkeleton width="32px" height="32px" rounded />
        </div>
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <ShimmerSkeleton width="90px" height="16px" />
        <ShimmerSkeleton width="8px" height="16px" />
        <ShimmerSkeleton width="100px" height="16px" />
        <ShimmerSkeleton width="8px" height="16px" />
        <ShimmerSkeleton width="40px" height="24px" rounded />
        <ShimmerSkeleton width="8px" height="16px" />
        <ShimmerSkeleton width="80px" height="24px" rounded />
        <ShimmerSkeleton width="8px" height="16px" />
        <ShimmerSkeleton width="120px" height="24px" rounded />
      </div>

      {/* AI Summary Section */}
      <div className="bg-purple-50 p-4 rounded-md border border-purple-200 mb-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <ShimmerSkeleton width="150px" height="16px" />
          <ShimmerSkeleton width="8px" height="16px" />
          <ShimmerSkeleton width="80px" height="18px" rounded />
        </div>
        
        {/* Content lines */}
        <div className="space-y-2">
          <ShimmerSkeleton width="100%" height="14px" />
          <ShimmerSkeleton width="97%" height="14px" />
          <ShimmerSkeleton width="85%" height="14px" />
          <ShimmerSkeleton width="90%" height="14px" />
        </div>
      </div>

      {/* Action buttons at bottom */}
      <div className="flex flex-wrap gap-2">
        <ShimmerSkeleton width="140px" height="36px" rounded />
        <ShimmerSkeleton width="110px" height="36px" rounded />
        <ShimmerSkeleton width="95px" height="36px" rounded />
      </div>
    </div>
  );

  // Highlights Card Shimmer (similar to executive order but with additional metadata)
  const HighlightsShimmer = ({ index }) => (
    <div className="bg-white border rounded-lg overflow-hidden shadow-sm mb-4 p-4">
      {/* Header with number, title, and buttons */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {/* Order number and title */}
          <div className="flex items-center gap-2 mb-2">
            <ShimmerSkeleton width="30px" height="20px" />
            <ShimmerSkeleton width="68%" height="24px" />
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-2 ml-4">
          <ShimmerSkeleton width="32px" height="32px" rounded />
          <ShimmerSkeleton width="32px" height="32px" rounded />
        </div>
      </div>

      {/* Extended metadata row for highlights */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <ShimmerSkeleton width="130px" height="16px" />
        <ShimmerSkeleton width="8px" height="16px" />
        <ShimmerSkeleton width="110px" height="16px" />
        <ShimmerSkeleton width="8px" height="16px" />
        <ShimmerSkeleton width="70px" height="24px" rounded />
        <ShimmerSkeleton width="8px" height="16px" />
        <ShimmerSkeleton width="110px" height="24px" rounded />
        <ShimmerSkeleton width="8px" height="16px" />
        <ShimmerSkeleton width="40px" height="24px" rounded />
      </div>

      {/* AI Summary Section - always visible in highlights */}
      <div className="bg-purple-50 p-4 rounded-md border border-purple-200 mb-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <ShimmerSkeleton width="180px" height="16px" />
          <ShimmerSkeleton width="8px" height="16px" />
          <ShimmerSkeleton width="80px" height="18px" rounded />
        </div>
        
        {/* Content lines */}
        <div className="space-y-2">
          <ShimmerSkeleton width="100%" height="14px" />
          <ShimmerSkeleton width="93%" height="14px" />
          <ShimmerSkeleton width="87%" height="14px" />
          <ShimmerSkeleton width="94%" height="14px" />
          <ShimmerSkeleton width="89%" height="14px" />
        </div>
      </div>

      {/* Action buttons at bottom */}
      <div className="flex flex-wrap gap-2">
        <ShimmerSkeleton width="130px" height="36px" rounded />
        <ShimmerSkeleton width="85px" height="36px" rounded />
        <ShimmerSkeleton width="140px" height="36px" rounded />
        <ShimmerSkeleton width="105px" height="36px" rounded />
      </div>
    </div>
  );

  // Simple list item shimmer
  const SimpleListShimmer = ({ index }) => (
    <div className="bg-white border rounded-lg p-4 mb-3">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <ShimmerSkeleton width="75%" height="20px" className="mb-2" />
          <ShimmerSkeleton width="50%" height="16px" />
        </div>
        <ShimmerSkeleton width="32px" height="32px" rounded />
      </div>
    </div>
  );

  // Page header shimmer
  const PageHeaderShimmer = () => (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <ShimmerSkeleton width="32px" height="32px" rounded />
        <ShimmerSkeleton width="200px" height="32px" />
      </div>
      <div className="space-y-2">
        <ShimmerSkeleton width="100%" height="16px" />
        <ShimmerSkeleton width="85%" height="16px" />
        <ShimmerSkeleton width="75%" height="16px" />
      </div>
    </div>
  );

  // Search and filter bar shimmer
  const SearchFilterShimmer = () => (
    <div className="mb-8">
      <div className="flex gap-4 items-center">
        <ShimmerSkeleton width="200px" height="48px" rounded />
        <ShimmerSkeleton width="100%" height="48px" rounded />
        <ShimmerSkeleton width="100px" height="48px" rounded />
      </div>
    </div>
  );

  // Select the appropriate shimmer component
  const getShimmerComponent = () => {
    switch (variant) {
      case 'executive-order':
        return ExecutiveOrderShimmer;
      case 'state-legislation':
        return StateLegislationShimmer;
      case 'highlights':
        return HighlightsShimmer;
      case 'simple-list':
        return SimpleListShimmer;
      default:
        return ExecutiveOrderShimmer;
    }
  };

  const ShimmerComponent = getShimmerComponent();

  return (
    <div className={`${className}`}>
      {/* Optional header shimmer */}
      {showHeader && (
        <>
          <PageHeaderShimmer />
          <SearchFilterShimmer />
        </>
      )}
      
      {/* Shimmer items */}
      <div className="space-y-4">
        {Array.from({ length: count }, (_, index) => (
          <ShimmerComponent key={index} index={index} />
        ))}
      </div>

      {/* CSS for shimmer animation */}
      <style jsx>{`
        @keyframes shimmer {
          0% {
            background-position: -200% 0;
          }
          100% {
            background-position: 200% 0;
          }
        }
        
        .animate-shimmer {
          animation: shimmer 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default ShimmerLoader;