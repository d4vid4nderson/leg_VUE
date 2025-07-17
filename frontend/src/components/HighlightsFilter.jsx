import React from 'react';
import { Star } from 'lucide-react';

const HighlightsFilter = ({ 
  isHighlightFilterActive = false, 
  onHighlightFilterChange, 
  disabled = false,
  loading = false,
  highlightCount = 0
}) => {
  const handleToggle = () => {
    if (disabled) return;
    onHighlightFilterChange(!isHighlightFilterActive);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={disabled || loading}
      className={`flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white transition-all duration-300 w-full sm:w-48 min-h-[44px] ${
        disabled || loading 
          ? 'opacity-50 cursor-not-allowed' 
          : 'hover:bg-gray-50 cursor-pointer'
      } ${isHighlightFilterActive ? 'ring-2 ring-yellow-500 border-yellow-500' : ''}`}
    >
      <div className="flex items-center gap-2">
        <Star 
          size={16} 
          className={`${
            isHighlightFilterActive 
              ? 'text-yellow-600 fill-yellow-600' 
              : 'text-gray-500'
          }`} 
        />
        <span className="truncate">
          {isHighlightFilterActive ? 'Showing Highlights' : 'Highlights'}
        </span>
        {highlightCount > 0 && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            isHighlightFilterActive 
              ? 'bg-yellow-100 text-yellow-800' 
              : 'bg-gray-100 text-gray-700'
          }`}>
            {highlightCount}
          </span>
        )}
      </div>
    </button>
  );
};

export default HighlightsFilter;