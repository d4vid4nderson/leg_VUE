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
    if (filterKey === 'all_practice_areas') {
      const practiceAreaKeys = ['civic', 'education', 'engineering', 'healthcare'];
      const allPracticeAreasSelected = practiceAreaKeys.every(key => selectedFilters.includes(key));
      
      if (allPracticeAreasSelected) {
        // If all practice areas are selected, remove them all
        practiceAreaKeys.forEach(key => {
          if (selectedFilters.includes(key)) {
            onToggleFilter(key);
          }
        });
      } else {
        // If not all are selected, select all practice areas
        practiceAreaKeys.forEach(key => {
          if (!selectedFilters.includes(key)) {
            onToggleFilter(key);
          }
        });
      }
    } else {
      // Regular filter toggle
      onToggleFilter(filterKey);
    }
  };

  // Check if "All Practice Areas" should appear active
  const isAllPracticeAreasActive = () => {
    const practiceAreaKeys = ['civic', 'education', 'engineering', 'healthcare'];
    return practiceAreaKeys.every(key => selectedFilters.includes(key));
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

  // Calculate total count for all practice areas (excluding not-applicable)
  const getAllPracticeAreasCount = () => {
    const practiceAreaKeys = ['civic', 'education', 'engineering', 'healthcare'];
    return practiceAreaKeys.reduce((total, key) => total + (counts[key] || 0), 0);
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
        <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
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

            {/* Practice Areas Section */}
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Practice Areas</h4>
              <div className="space-y-1">
                {/* All Practice Areas Option */}
                <button
                  onClick={() => handleFilterToggle('all_practice_areas')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-300 ${
                    getFilterStyles('all_practice_areas', isAllPracticeAreasActive())
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LayoutGrid 
                      size={14} 
                      className={getIconColor('all_practice_areas', isAllPracticeAreasActive())}
                    />
                    All Practice Areas
                  </div>
                  {getAllPracticeAreasCount() > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      isAllPracticeAreasActive() ? 'bg-white bg-opacity-50' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {getAllPracticeAreasCount()}
                    </span>
                  )}
                </button>

                {/* Individual Practice Area Filters - filter out any that might be labeled "All Practice Areas" and Not Applicable */}
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
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-300 ${
                          getFilterStyles(filter.key, isActive)
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <IconComponent 
                            size={14} 
                            className={getIconColor(filter.key, isActive)}
                          />
                          {filter.label}
                        </div>
                        {count > 0 && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            isActive ? 'bg-white bg-opacity-50' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}

                {/* Not Applicable - shown separately */}
                {FILTERS
                  .filter(filter => filter.key === 'not-applicable')
                  .map((filter) => {
                    const IconComponent = filter.icon;
                    const isActive = selectedFilters.includes(filter.key);
                    const count = counts[filter.key] || 0;
                    
                    return (
                      <button
                        key={filter.key}
                        onClick={() => handleFilterToggle(filter.key)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-300 ${
                          getFilterStyles(filter.key, isActive)
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <IconComponent 
                            size={14} 
                            className={getIconColor(filter.key, isActive)}
                          />
                          {filter.label}
                        </div>
                        {count > 0 && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            isActive ? 'bg-white bg-opacity-50' : 'bg-gray-200 text-gray-600'
                          }`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
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

            {/* Review Status Section */}
            {showReviewStatus && (
              <div className="mb-1">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Review Status</h4>
                <div className="space-y-1">
                  <button
                    onClick={() => handleFilterToggle('reviewed')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-300 ${
                      getFilterStyles('reviewed', selectedFilters.includes('reviewed'))
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Check 
                        size={14} 
                        className={getIconColor('reviewed', selectedFilters.includes('reviewed'))}
                      />
                      Reviewed
                    </div>
                    {counts.reviewed > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        selectedFilters.includes('reviewed') ? 'bg-white bg-opacity-50' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {counts.reviewed}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => handleFilterToggle('not_reviewed')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-300 ${
                      getFilterStyles('not_reviewed', selectedFilters.includes('not_reviewed'))
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle 
                        size={14} 
                        className={getIconColor('not_reviewed', selectedFilters.includes('not_reviewed'))}
                      />
                      Not Reviewed
                    </div>
                    {counts.not_reviewed > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        selectedFilters.includes('not_reviewed') ? 'bg-white bg-opacity-50' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {counts.not_reviewed}
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