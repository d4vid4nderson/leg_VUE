import React, { forwardRef } from 'react';
import { ChevronDown, LayoutGrid, ScrollText, FileText, Check, AlertTriangle, Filter } from 'lucide-react';
import { FILTERS } from '../utils/constants';

const FilterDropdown = forwardRef(({
  selectedFilters = [],
  showFilterDropdown = false,
  onToggleDropdown,
  onToggleFilter,
  onClearAllFilters,
  counts = {},
  showContentTypes = false,
  showReviewStatus = false,
  className = ""
}, ref) => {

  const isFilterActive = (filterKey) => selectedFilters.includes(filterKey);

  // Handle "All Practice Areas" filter logic
  const handleFilterToggle = (filterKey) => {
    // Simply toggle the filter - no special handling for all_practice_areas
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

  // Get filter style classes based on filter key
  const getFilterStyles = (filterKey, isActive) => {
    if (!isActive) return 'text-gray-600 hover:bg-gray-50';
    
    const styleMap = {
      'civic': 'bg-blue-100 text-blue-700 font-medium',
      'education': 'bg-orange-100 text-orange-700 font-medium',
      'engineering': 'bg-green-100 text-green-700 font-medium',
      'healthcare': 'bg-red-100 text-red-700 font-medium',
      'not-applicable': 'bg-gray-100 text-gray-700 font-medium',
      'executive_order': 'bg-blue-100 text-blue-700 font-medium',
      'state_legislation': 'bg-green-100 text-green-700 font-medium',
      'reviewed': 'bg-green-100 text-green-700 font-medium',
      'not_reviewed': 'bg-yellow-100 text-yellow-700 font-medium',
      'all_practice_areas': 'bg-teal-100 text-teal-700 font-medium'
    };
    
    return styleMap[filterKey] || 'bg-gray-100 text-gray-700 font-medium';
  };

  // Get icon color based on filter key
  const getIconColor = (filterKey, isActive) => {
    if (!isActive) return 'text-gray-400';
    
    const colorMap = {
      'civic': 'text-blue-600',
      'education': 'text-orange-600',
      'engineering': 'text-green-600',
      'healthcare': 'text-red-600',
      'not-applicable': 'text-gray-600',
      'executive_order': 'text-blue-600',
      'state_legislation': 'text-green-600',
      'reviewed': 'text-green-600',
      'not_reviewed': 'text-yellow-600',
      'all_practice_areas': 'text-teal-600'
    };
    
    return colorMap[filterKey] || 'text-gray-600';
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      {/* Filter Button */}
      <button
        onClick={onToggleDropdown}
        className={`flex items-center justify-between px-4 py-3 border rounded-lg text-sm font-medium transition-all duration-300 w-48 ${
          selectedFilters.length > 0
            ? 'bg-blue-100 text-blue-700 border-blue-300'
            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
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
        <ChevronDown size={16} className={`transition-transform duration-200 flex-shrink-0 ${showFilterDropdown ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Content */}
      {showFilterDropdown && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div>
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Filter Options</h3>
                {selectedFilters.length > 0 && (
                  <button
                    onClick={() => {
                      onClearAllFilters();
                      onToggleDropdown();
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Clear All
                  </button>
                )}
              </div>
            </div>

            {/* Practice Areas Section */}
            <div className="pt-2">
              <div className="px-4 py-2 text-sm font-semibold text-gray-700">
                Practice Areas
              </div>
              
              {/* All Practice Areas Option */}
              <button
                onClick={() => handleFilterToggle('all_practice_areas')}
                className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                  isAllPracticeAreasActive()
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                >
                <div className="flex items-center gap-3">
                  <LayoutGrid size={16} />
                  <span>All Practice Areas</span>
                </div>
                <span className="text-xs text-gray-500">({getAllPracticeAreasCount()})</span>
              </button>

              {/* Individual Practice Area Filters */}
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
                  
                  return (
                    <button
                      key={filter.key}
                      onClick={() => handleFilterToggle(filter.key)}
                      className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                        isActive
                          ? filter.key === 'civic' ? 'bg-blue-100 text-blue-700 font-medium' :
                            filter.key === 'education' ? 'bg-orange-100 text-orange-700 font-medium' :
                            filter.key === 'engineering' ? 'bg-green-100 text-green-700 font-medium' :
                            filter.key === 'healthcare' ? 'bg-red-100 text-red-700 font-medium' :
                            'bg-blue-100 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <IconComponent size={16} />
                        <span>{filter.label}</span>
                      </div>
                      <span className="text-xs text-gray-500">({count})</span>
                    </button>
                  );
                })}

              {/* Review Status Section */}
              {showReviewStatus && (
                <>
                  <div className="px-4 py-2 text-sm font-semibold text-gray-700">
                    Review Status
                  </div>
                  <button
                    onClick={() => handleFilterToggle('reviewed')}
                    className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                      selectedFilters.includes('reviewed')
                        ? 'bg-green-100 text-green-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Check size={16} />
                      <span>Reviewed</span>
                    </div>
                    <span className="text-xs text-gray-500">({counts?.reviewed || 0})</span>
                  </button>
                  <button
                    onClick={() => handleFilterToggle('not_reviewed')}
                    className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                      selectedFilters.includes('not_reviewed')
                        ? 'bg-red-100 text-red-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={16} />
                      <span>Not Reviewed</span>
                    </div>
                    <span className="text-xs text-gray-500">({counts?.not_reviewed || 0})</span>
                  </button>
                </>
              )}
            </div>

            {/* Content Types Section */}
            {showContentTypes && (
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Content Types</h4>
                <div className="space-y-1">
                  <button
                    onClick={() => handleFilterToggle('executive_order')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-300 ${
                      getFilterStyles('executive_order', selectedFilters.includes('executive_order'))
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ScrollText 
                        size={14} 
                        className={getIconColor('executive_order', selectedFilters.includes('executive_order'))}
                      />
                      Executive Orders
                    </div>
                    {counts.executive_order > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        selectedFilters.includes('executive_order') ? 'bg-white bg-opacity-50' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {counts.executive_order}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleFilterToggle('state_legislation')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-300 ${
                      getFilterStyles('state_legislation', selectedFilters.includes('state_legislation'))
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText 
                        size={14} 
                        className={getIconColor('state_legislation', selectedFilters.includes('state_legislation'))}
                      />
                      State Legislation
                    </div>
                    {counts.state_legislation > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        selectedFilters.includes('state_legislation') ? 'bg-white bg-opacity-50' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {counts.state_legislation}
                      </span>
                    )}
                  </button>
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