import React, { forwardRef } from 'react';
import { ChevronDown, LayoutGrid, ScrollText, FileText, Check, AlertTriangle, Filter } from 'lucide-react';
import { FILTERS, getFilterActiveClass, getFilterIconClass } from '../utils/constants';

const FilterDropdown = forwardRef(({
  selectedFilters = [],
  showFilterDropdown = false,
  onToggleDropdown,
  onToggleFilter,
  onClearAllFilters,
  counts = {},
  additionalFilters = [], // For custom sections
  showContentTypes = false, // New prop to show Content Types section
  showReviewStatus = false, // New prop to show Review Status section
  className = ""
}, ref) => {

  const isFilterActive = (filterKey) => selectedFilters.includes(filterKey);

  // Extended filters that include all possible filter types
  const EXTENDED_FILTERS = [
    ...FILTERS,
    {
      key: 'executive_order',
      label: 'Executive Orders',
      icon: ScrollText,
      type: 'order_type'
    },
    {
      key: 'state_legislation',
      label: 'State Legislation',
      icon: FileText,
      type: 'order_type'
    },
    {
      key: 'reviewed',
      label: 'Reviewed',
      icon: Check,
      type: 'review_status'
    },
    {
      key: 'not_reviewed',
      label: 'Not Reviewed',
      icon: AlertTriangle,
      type: 'review_status'
    }
  ];

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
          <span className={`truncate ${
            selectedFilters.length === 0
              ? 'text-gray-600'
              : ''
          }`}>
            {selectedFilters.length === 0
              ? 'Filters'
              : selectedFilters.length === 1
              ? EXTENDED_FILTERS.find(f => f.key === selectedFilters[0])?.label || 'Filter'
              : `${selectedFilters.length} Filters`
            }
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
                {/* All Practice Areas Option - FIXED */}
                <button
                  onClick={() => onToggleFilter('all_practice_areas')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-300 ${
                    selectedFilters.includes('all_practice_areas')
                      ? 'bg-teal-100 text-teal-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LayoutGrid 
                      size={14} 
                      className={selectedFilters.includes('all_practice_areas') ? 'text-teal-600' : 'text-gray-400'} 
                    />
                    All Practice Areas
                  </div>
                  {counts.all_practice_areas > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                      selectedFilters.includes('all_practice_areas') ? 'bg-white bg-opacity-50' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {counts.all_practice_areas}
                    </span>
                  )}
                </button>

                {FILTERS.map((filter) => {
                  const IconComponent = filter.icon;
                  const isActive = selectedFilters.includes(filter.key);
                  const count = counts[filter.key] || 0;
                  
                  return (
                    <button
                      key={filter.key}
                      onClick={() => onToggleFilter(filter.key)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-300 ${
                        isActive
                          ? filter.key === 'civic' ? 'bg-blue-100 text-blue-700 font-medium' :
                            filter.key === 'education' ? 'bg-orange-100 text-orange-700 font-medium' :
                            filter.key === 'engineering' ? 'bg-green-100 text-green-700 font-medium' :
                            filter.key === 'healthcare' ? 'bg-red-100 text-red-700 font-medium' :
                            'bg-gray-100 text-gray-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <IconComponent 
                          size={14} 
                          className={isActive ? 
                            filter.key === 'civic' ? 'text-blue-600' :
                            filter.key === 'education' ? 'text-orange-600' :
                            filter.key === 'engineering' ? 'text-green-600' :
                            filter.key === 'healthcare' ? 'text-red-600' :
                            'text-gray-600'
                            : 'text-gray-400'
                          } 
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
                    onClick={() => onToggleFilter('executive_order')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-300 ${
                      selectedFilters.includes('executive_order')
                        ? 'bg-blue-100 text-blue-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ScrollText 
                        size={14} 
                        className={selectedFilters.includes('executive_order') ? 'text-blue-600' : 'text-gray-400'} 
                      />
                      Executive Orders
                    </div>
                    {counts.executive_order > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        selectedFilters.includes('executive_order') ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {counts.executive_order}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => onToggleFilter('state_legislation')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-300 ${
                      selectedFilters.includes('state_legislation')
                        ? 'bg-green-100 text-green-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText 
                        size={14} 
                        className={selectedFilters.includes('state_legislation') ? 'text-green-600' : 'text-gray-400'} 
                      />
                      State Legislation
                    </div>
                    {counts.state_legislation > 0 && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        selectedFilters.includes('state_legislation') ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {counts.state_legislation}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Custom Additional Filters */}
            {additionalFilters.length > 0 && (
              <div>
                {additionalFilters.map((section, sectionIndex) => (
                  <div key={sectionIndex} className={sectionIndex > 0 ? "border-t border-gray-200 pt-4 mt-4" : ""}>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">{section.title}</h4>
                    <div className="space-y-1">
                      {section.filters.map(filter => {
                        const IconComponent = filter.icon;
                        const isActive = isFilterActive(filter.key);
                        const count = counts[filter.key] || 0;
                        
                        return (
                          <button
                            key={filter.key}
                            onClick={() => onToggleFilter(filter.key)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-all duration-300 ${
                              isActive
                                ? filter.activeClass || 'bg-teal-100 text-teal-700 font-medium'
                                : 'text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <IconComponent 
                                size={14} 
                                className={filter.iconClass || 'text-teal-600'}
                              />
                              <span>{filter.label}</span>
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
                ))}
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