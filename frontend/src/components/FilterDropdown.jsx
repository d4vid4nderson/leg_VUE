// FilterDropdown.jsx - Standardized filter dropdown component
import React, { forwardRef } from 'react';
import { ChevronDown, LayoutGrid, ScrollText, FileText, Check, AlertTriangle, Filter } from 'lucide-react';
import { FILTERS } from '../utils/constants';
import FilterButton from './FilterButton';

const FilterDropdown = forwardRef(({
  selectedFilters = [],
  showFilterDropdown = false,
  onToggleDropdown,
  onToggleFilter,
  onClearAllFilters,
  counts = {},
  showContentTypes = false,
  showReviewStatus = false,
  title = "Filter Options",
  className = ""
}, ref) => {

  const isFilterActive = (filterKey) => selectedFilters.includes(filterKey);

  // Handle filter toggle
  const handleFilterToggle = (filterKey) => {
    onToggleFilter(filterKey);
  };

  // Check if "All Practice Areas" should appear active
  const isAllPracticeAreasActive = () => {
    return selectedFilters.includes('all_practice_areas');
  };

  // Get the display text for the filter button
  const getFilterButtonText = () => {
    if (selectedFilters.length === 0) return 'Filters';
    if (selectedFilters.length === 1) {
      // Special handling for all_practice_areas
      if (selectedFilters[0] === 'all_practice_areas') {
        return 'All Practice Areas';
      }
      const filter = FILTERS.find(f => f.key === selectedFilters[0]);
      return filter?.label || 'Filter';
    }
    return `${selectedFilters.length} Filters`;
  };

  // Get count for all_practice_areas category specifically
  const getAllPracticeAreasCount = () => {
    return counts.all_practice_areas || 0;
  };

  // Get category colors for consistent styling
  const getCategoryColors = (filterKey) => {
    const colorMap = {
      'civic': {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        icon: 'text-blue-600',
        count: 'bg-blue-50 text-blue-700 border border-blue-200'
      },
      'education': {
        bg: 'bg-orange-50',
        text: 'text-orange-700',
        icon: 'text-orange-600',
        count: 'bg-orange-50 text-orange-700 border border-orange-200'
      },
      'engineering': {
        bg: 'bg-green-50',
        text: 'text-green-700',
        icon: 'text-green-600',
        count: 'bg-green-50 text-green-700 border border-green-200'
      },
      'healthcare': {
        bg: 'bg-red-50',
        text: 'text-red-700',
        icon: 'text-red-600',
        count: 'bg-red-50 text-red-700 border border-red-200'
      },
      'all_practice_areas': {
        bg: 'bg-teal-50',
        text: 'text-teal-700',
        icon: 'text-teal-600',
        count: 'bg-teal-50 text-teal-700 border border-teal-200'
      },
      'reviewed': {
        bg: 'bg-green-50',
        text: 'text-green-700',
        icon: 'text-green-600',
        count: 'bg-green-50 text-green-700 border border-green-200'
      },
      'not_reviewed': {
        bg: 'bg-red-50',
        text: 'text-red-700',
        icon: 'text-red-600',
        count: 'bg-red-50 text-red-700 border border-red-200'
      },
      'executive_order': {
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        icon: 'text-blue-600',
        count: 'bg-blue-50 text-blue-700 border border-blue-200'
      },
      'state_legislation': {
        bg: 'bg-green-50',
        text: 'text-green-700',
        icon: 'text-green-600',
        count: 'bg-green-50 text-green-700 border border-green-200'
      }
    };
    
    return colorMap[filterKey] || {
      bg: 'bg-gray-50',
      text: 'text-gray-700',
      icon: 'text-gray-600',
      count: 'bg-gray-50 text-gray-700 border border-gray-200'
    };
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      {/* Filter Button - Standardized */}
      <button
        type="button"
        onClick={onToggleDropdown}
        className={`flex items-center justify-between px-4 py-2.5 border rounded-lg text-sm font-medium transition-all duration-300 w-48 h-11 ${
          selectedFilters.length > 0
            ? 'bg-blue-100 text-blue-700 border-blue-300'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Filter size={16} className="flex-shrink-0" />
          <span className="truncate">
            {getFilterButtonText()}
          </span>
          {selectedFilters.length > 0 && (
            <span className="bg-blue-200 text-blue-800 text-xs px-1.5 py-0.5 rounded-full flex-shrink-0">
              {selectedFilters.length}
            </span>
          )}
        </div>
        <ChevronDown 
          size={16} 
          className={`transition-transform duration-200 flex-shrink-0 ${showFilterDropdown ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu - Standardized Container */}
      {showFilterDropdown && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[120] min-w-[280px] max-w-[320px] overflow-hidden">
          <div className="p-3 pb-3"> {/* Tighter padding */}
            
            {/* Header - Standardized */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-800">Filter Options</h3>
              {selectedFilters.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAllFilters}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Separator - Standardized */}
            <div className="border-t border-gray-200 my-3"></div>

            {/* Practice Areas Section - Standardized */}
            <div className="mb-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Practice Areas</h4>
              <div className="space-y-1">
                {/* All Practice Areas */}
                <FilterButton
                  isActive={isAllPracticeAreasActive()}
                  onClick={() => handleFilterToggle('all_practice_areas')}
                  icon={<LayoutGrid size={16} />}
                  label="All Practice Areas"
                  count={getAllPracticeAreasCount()}
                  colorClasses={getCategoryColors('all_practice_areas')}
                />

                {/* Individual Categories */}
                {FILTERS
                  .filter(filter => 
                    filter.label !== 'All Practice Areas' && 
                    filter.key !== 'all_practice_areas' &&
                    filter.key !== 'not-applicable'
                  )
                  .map((filter) => {
                    const IconComponent = filter.icon;
                    const isActive = selectedFilters.includes(filter.key);
                    const count = counts[filter.key] || 0;
                    const colors = getCategoryColors(filter.key);
                    
                    return (
                      <FilterButton
                        key={filter.key}
                        isActive={isActive}
                        onClick={() => handleFilterToggle(filter.key)}
                        icon={<IconComponent size={16} />}
                        label={filter.label}
                        count={count}
                        colorClasses={colors}
                      />
                    );
                  })}
              </div>
            </div>

            {/* Review Status Section - Conditional */}
            {showReviewStatus && (
              <div className="mb-3">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Review Status</h4>
                <div className="space-y-1">
                  <FilterButton
                    isActive={selectedFilters.includes('reviewed')}
                    onClick={() => handleFilterToggle('reviewed')}
                    icon={<Check size={16} />}
                    label="Reviewed"
                    count={counts?.reviewed || 0}
                    colorClasses={getCategoryColors('reviewed')}
                  />
                  
                  <FilterButton
                    isActive={selectedFilters.includes('not_reviewed')}
                    onClick={() => handleFilterToggle('not_reviewed')}
                    icon={<AlertTriangle size={16} />}
                    label="Not Reviewed"
                    count={counts?.not_reviewed || 0}
                    colorClasses={getCategoryColors('not_reviewed')}
                  />
                </div>
              </div>
            )}

            {/* Content Types Section - Conditional for HighlightsPage */}
            {showContentTypes && (
              <div className="mb-0">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Content Types</h4>
                <div className="space-y-1">
                  <FilterButton
                    isActive={selectedFilters.includes('executive_order')}
                    onClick={() => handleFilterToggle('executive_order')}
                    icon={<ScrollText size={16} />}
                    label="Executive Orders"
                    count={counts?.executive_order || 0}
                    colorClasses={getCategoryColors('executive_order')}
                  />
                  
                  <FilterButton
                    isActive={selectedFilters.includes('state_legislation')}
                    onClick={() => handleFilterToggle('state_legislation')}
                    icon={<FileText size={16} />}
                    label="State Legislation"
                    count={counts?.state_legislation || 0}
                    colorClasses={getCategoryColors('state_legislation')}
                  />
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
});

FilterDropdown.displayName = 'FilterDropdown';

export default FilterDropdown;