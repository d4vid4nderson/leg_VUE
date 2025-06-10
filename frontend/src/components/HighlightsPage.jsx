// Updated HighlightsPage.jsx with Fuzzy Search Implementation

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ChevronDown,
  Star,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Settings,
  Home,
  ScrollText,
  Compass,
  Loader
} from 'lucide-react';

import { HIGHLIGHTS_FILTERS, highlightsFilterStyles } from '../utils/constants';
import { CategoryTag } from './CommonComponents';
import { getOrderId, stripHtmlTags, formatContent } from '../utils/helpers';
import { useFuzzySearch } from '../utils/useFuzzySearch'; // Import fuzzy search

// API service for highlights persistence
class HighlightsAPI {
  static async getHighlights(userId = 1) {
    try {
      const response = await fetch(`/api/highlights?user_id=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch highlights');
      return await response.json();
    } catch (error) {
      console.error('Error fetching highlights:', error);
      return [];
    }
  }

  static async addHighlight(order, userId = 1, options = {}) {
    try {
      const orderType = order.executive_order_number ? 'executive_order' : 'state_legislation';
      const orderId = order.executive_order_number || order.bill_number || order.id;

      const response = await fetch('/api/highlights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          order_id: orderId,
          order_type: orderType,
          notes: options.notes || null,
          priority_level: options.priority_level || 1,
          tags: options.tags || null,
          is_archived: options.is_archived || false
        })
      });
      
      if (!response.ok) throw new Error('Failed to add highlight');
      return await response.json();
    } catch (error) {
      console.error('Error adding highlight:', error);
      throw error;
    }
  }

  static async removeHighlight(orderId, userId = 1) {
    try {
      const response = await fetch(`/api/highlights/${orderId}?user_id=${userId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to remove highlight');
      return true;
    } catch (error) {
      console.error('Error removing highlight:', error);
      throw error;
    }
  }

  static async clearAllHighlights(userId = 1) {
    try {
      const response = await fetch(`/api/highlights?user_id=${userId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to clear highlights');
      return true;
    } catch (error) {
      console.error('Error clearing highlights:', error);
      throw error;
    }
  }
}

// Custom hook for persistent highlights
const usePersistedHighlights = (userId = 1) => {
  const [highlightedOrders, setHighlightedOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load highlights from database on mount
  useEffect(() => {
    const loadHighlights = async () => {
      try {
        setLoading(true);
        const highlights = await HighlightsAPI.getHighlights(userId);
        setHighlightedOrders(highlights || []);
      } catch (error) {
        console.error('Error loading highlights:', error);
        setHighlightedOrders([]);
      } finally {
        setLoading(false);
      }
    };

    loadHighlights();
  }, [userId]);

  const addHighlight = async (order, options = {}) => {
    try {
      await HighlightsAPI.addHighlight(order, userId, options);
      const updatedHighlights = await HighlightsAPI.getHighlights(userId);
      setHighlightedOrders(updatedHighlights);
    } catch (error) {
      console.error('Failed to add highlight:', error);
      throw error;
    }
  };

  const removeHighlight = async (order) => {
    try {
      const orderId = order.executive_order_number || order.bill_number || order.id;
      await HighlightsAPI.removeHighlight(orderId, userId);
      setHighlightedOrders(prev => 
        prev.filter(item => {
          const itemId = item.executive_order_number || item.bill_number || item.id;
          return itemId !== orderId;
        })
      );
    } catch (error) {
      console.error('Failed to remove highlight:', error);
      throw error;
    }
  };

  const toggleHighlight = async (order, options = {}) => {
    const orderId = order.executive_order_number || order.bill_number || order.id;
    const isHighlighted = highlightedOrders.some(item => {
      const itemId = item.executive_order_number || item.bill_number || item.id;
      return itemId === orderId;
    });

    if (isHighlighted) {
      await removeHighlight(order);
    } else {
      await addHighlight(order, options);
    }
  };

  const clearAllHighlights = async () => {
    try {
      await HighlightsAPI.clearAllHighlights(userId);
      setHighlightedOrders([]);
    } catch (error) {
      console.error('Failed to clear highlights:', error);
      throw error;
    }
  };

  const isHighlighted = (order) => {
    const orderId = order.executive_order_number || order.bill_number || order.id;
    return highlightedOrders.some(item => {
      const itemId = item.executive_order_number || item.bill_number || item.id;
      return itemId === orderId;
    });
  };

  return {
    highlightedOrders,
    loading,
    addHighlight,
    removeHighlight,
    toggleHighlight,
    clearAllHighlights,
    isHighlighted
  };
};

const HighlightsPage = ({
  searchTerm,
  setSearchTerm,
  highlightsFilterHelpers,
  highlightsHandlers,
  getHighlightSource,
  createFormattedReport,
  formatContent,
  stripHtmlTags,
  activeHighlightsFilters,
  copyToClipboard,
  downloadTextFile
}) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '');
  const [highlightsShowFilterDropdown, setHighlightsShowFilterDropdown] = useState(false);
  const highlightsFilterDropdownRef = useRef(null);
  const navigate = useNavigate();

  // Use persistent highlights
  const {
    highlightedOrders,
    loading,
    toggleHighlight,
    clearAllHighlights: clearAllHighlightsDB
  } = usePersistedHighlights();

  // FUZZY SEARCH IMPLEMENTATION
  // First apply category/type filters, then fuzzy search
  const categoryFilteredOrders = useMemo(() => {
    if (!Array.isArray(highlightedOrders)) {
      return [];
    }

    // Apply highlights-specific filters if they exist
    if (highlightsFilterHelpers?.hasActiveFilters && highlightsFilterHelpers.hasActiveFilters()) {
      let filtered = highlightedOrders;
      
      // Apply each active filter
      if (activeHighlightsFilters && activeHighlightsFilters.size > 0) {
        filtered = filtered.filter(order => {
          // Check if order matches any of the active filters
          return Array.from(activeHighlightsFilters).some(filterKey => {
            const filter = HIGHLIGHTS_FILTERS.find(f => f.key === filterKey);
            if (!filter) return false;
            
            // Apply filter logic based on filter type
            switch (filterKey) {
              case 'executive_orders':
                return order.executive_order_number || order.order_type === 'executive_order';
              case 'state_legislation':
                return order.bill_number || order.order_type === 'state_legislation';
              case 'high_priority':
                return order.priority_level >= 3;
              case 'recent':
                const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const orderDate = new Date(order.created_at || order.signing_date || order.date_introduced);
                return orderDate >= oneWeekAgo;
              default:
                return order.category === filterKey;
            }
          });
        });
      }
      
      return filtered;
    }
    
    return highlightedOrders;
  }, [highlightedOrders, activeHighlightsFilters, highlightsFilterHelpers]);

  // Apply fuzzy search to category-filtered results
  const fuzzySearchResults = useFuzzySearch(categoryFilteredOrders, searchTerm, {
    threshold: 0.5, // Adjust for more/less strict matching
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'ai_summary', weight: 0.3 },
      { name: 'description', weight: 0.3 },
      { name: 'executive_order_number', weight: 0.8 },
      { name: 'bill_number', weight: 0.8 },
      { name: 'category', weight: 0.1 },
      { name: 'president', weight: 0.5 },
      { name: 'state', weight: 0.4 }
    ]
  });

  // Final filtered results using fuzzy search
  const filteredHighlightedOrders = fuzzySearchResults;

  // Update local search when prop changes
  useEffect(() => {
    setLocalSearchTerm(searchTerm || '');
  }, [searchTerm]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (highlightsFilterDropdownRef.current && !highlightsFilterDropdownRef.current.contains(event.target)) {
        setHighlightsShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (setSearchTerm) {
      setSearchTerm(localSearchTerm);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAllHighlightsDB();
      if (highlightsFilterHelpers?.clearAllFilters) {
        highlightsFilterHelpers.clearAllFilters();
      }
      if (setSearchTerm) {
        setSearchTerm('');
        setLocalSearchTerm('');
      }
    } catch (error) {
      console.error('Error clearing all:', error);
    }
  };

  // Check if there are any highlighted items to determine if we should show quick actions
  const hasHighlightedItems = highlightedOrders && highlightedOrders.length > 0;

  // Show loading state
  if (loading) {
    return (
      <div className="pt-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Highlights</h2>
          <p className="text-gray-600">Your saved executive orders and legislation for access.</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader className="animate-spin h-8 w-8 text-blue-600" />
          <span className="ml-2 text-gray-600">Loading your highlights...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Highlights</h2>
        <p className="text-gray-600">Your saved executive orders and legislation with fuzzy search.</p>
      </div>

      {/* Search and Filter Bar - Always Show, Consistent Layout */}
      <div className="mb-8">
        <div className="flex gap-4 items-center">
          {/* Filter Dropdown - Left Side */}
          <div className="relative" ref={highlightsFilterDropdownRef}>
            <button
              onClick={() => setHighlightsShowFilterDropdown(!highlightsShowFilterDropdown)}
              className="flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 transition-all duration-300 w-48"
            >
              <div className="flex items-center gap-2">
                {highlightsFilterHelpers?.hasActiveFilters && highlightsFilterHelpers.hasActiveFilters() && (
                  (() => {
                    const activeFilterKey = Array.from(activeHighlightsFilters)[0];
                    const selectedFilter = HIGHLIGHTS_FILTERS.find(f => f.key === activeFilterKey);
                    if (selectedFilter) {
                      const IconComponent = selectedFilter.icon;
                      const colorClass = highlightsFilterStyles[selectedFilter.key];
                      return (
                        <IconComponent 
                          size={16} 
                          className={colorClass}
                        />
                      );
                    }
                    return null;
                  })()
                )}
                <span className="truncate">
                  {highlightsFilterHelpers?.hasActiveFilters && highlightsFilterHelpers.hasActiveFilters()
                    ? activeHighlightsFilters.size === 1 
                      ? HIGHLIGHTS_FILTERS.find(f => f.key === Array.from(activeHighlightsFilters)[0])?.label || 'Filter'
                      : `${activeHighlightsFilters.size} Selected`
                    : 'Filter'
                  }
                </span>
              </div>
              <ChevronDown 
                size={16} 
                className={`transition-transform duration-200 flex-shrink-0 ${highlightsShowFilterDropdown ? 'rotate-180' : ''}`}
              />
            </button>

            {highlightsShowFilterDropdown && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <button
                  onClick={() => {
                    if (highlightsFilterHelpers?.clearAllFilters) {
                      highlightsFilterHelpers.clearAllFilters();
                    }
                    setHighlightsShowFilterDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 ${
                    !highlightsFilterHelpers?.hasActiveFilters || !highlightsFilterHelpers.hasActiveFilters()
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  All Filters
                </button>
                {HIGHLIGHTS_FILTERS.map(filter => {
                  const IconComponent = filter.icon;
                  const isActive = activeHighlightsFilters?.has(filter.key);
                  const colorClass = highlightsFilterStyles[filter.key];
                  return (
                    <button
                      key={filter.key}
                      onClick={() => {
                        if (highlightsFilterHelpers?.toggleFilter) {
                          highlightsFilterHelpers.toggleFilter(filter.key);
                        }
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center gap-3 ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <IconComponent 
                        size={16} 
                        className={colorClass}
                      />
                      <span>{filter.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search Bar - Right Side with Fuzzy Search Indicator */}
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search highlighted items..."
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit(e);
                }
              }}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
            {searchTerm && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  Fuzzy: {filteredHighlightedOrders.length}
                </span>
              </div>
            )}
          </div>

          {((highlightsFilterHelpers?.hasActiveFilters && highlightsFilterHelpers.hasActiveFilters()) || searchTerm) && (
            <button
              onClick={handleClearAll}
              className="px-4 py-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all duration-300 flex-shrink-0"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Highlighted Items Display */}
      <div className="space-y-6 mb-8">
        {filteredHighlightedOrders.length === 0 ? (
          <div className="text-center py-12">
            <Star size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {hasHighlightedItems ? 'No matching highlights found' : 'No Highlights Yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {hasHighlightedItems 
                ? `No highlights match your current search criteria${searchTerm ? ` for "${searchTerm}"` : ''}.`
                : "Start by highlighting executive orders or legislation from other pages."
              }
            </p>
            {(highlightsFilterHelpers?.hasActiveFilters && highlightsFilterHelpers.hasActiveFilters()) || searchTerm ? (
              <button
                onClick={handleClearAll}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300"
              >
                Clear Search & Filters
              </button>
            ) : null}
          </div>
        ) : (
          filteredHighlightedOrders.map((order, index) => (
            <div key={getOrderId(order)} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="flex items-start justify-between px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
                <div 
                  className="flex-1 cursor-pointer hover:bg-gray-50 transition-all duration-300 rounded-md p-2 -ml-2 -mt-2 -mb-1"
                  onClick={() => highlightsHandlers?.handleExpandOrder && highlightsHandlers.handleExpandOrder(order)}
                >
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-1 leading-tight">
                    {index + 1}. {order?.title || 'Untitled'}
                  </h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
                    <span className="font-medium">
                      {order?.executive_order_number 
                        ? `Executive Order #${order.executive_order_number}` 
                        : order?.bill_number 
                          ? `Bill #${order.bill_number}`
                          : 'N/A'
                      }
                    </span>
                    <span>{order?.signing_date || order?.date_introduced ? new Date(order.signing_date || order.date_introduced).toLocaleDateString() : 'No date'}</span>
                    <CategoryTag category={order?.category} />
                    {(() => {
                      const source = getHighlightSource ? getHighlightSource(order) : { icon: 'FileText', label: 'Unknown', color: 'text-gray-600' };
                      const SourceIcon = source.icon === 'ScrollText' ? ScrollText : FileText;
                      return (
                        <span className={`inline-flex items-center gap-1.5 font-medium text-xs ${source.color} bg-gray-100 px-2 py-1 rounded-full`}>
                          <SourceIcon size={12} />
                          <span>From: {source.label}</span>
                        </span>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleHighlight(order);
                    }}
                    className="p-2 hover:bg-red-100 hover:text-red-600 rounded-md transition-all duration-300"
                    title="Remove from highlights"
                  >
                    <Star size={16} className="fill-current text-yellow-500" />
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (highlightsHandlers?.handleExpandOrder) {
                        highlightsHandlers.handleExpandOrder(order);
                      }
                    }}
                    className="p-2 hover:bg-gray-100 rounded-md transition-all duration-300"
                  >
                    <ChevronDown 
                      size={20} 
                      className={`text-gray-500 transition-transform duration-200 ${
                        highlightsHandlers?.isOrderExpanded && highlightsHandlers.isOrderExpanded(order) ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                </div>
              </div>

              {order?.ai_summary && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="bg-violet-50 p-3 rounded-md border border-violet-200">
                    <p className="text-sm font-medium text-violet-800 mb-2 flex items-center gap-2">
                      <span>Azure AI Summary:</span>
                      <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                        ✦ AI Generated
                      </span>
                    </p>
                    <p className="text-sm text-violet-800 leading-relaxed">{stripHtmlTags(order.ai_summary)}</p>
                  </div>
                </div>
              )}
              
              {highlightsHandlers?.isOrderExpanded && highlightsHandlers.isOrderExpanded(order) && (
                <div className="px-3 sm:px-4 pb-3 sm:pb-4 bg-gray-50">
                  {order.ai_talking_points && (
                    <div className="mb-4">
                      <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                        <p className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                          <span>🎯 Key Talking Points:</span>
                          <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                            ✦ AI Generated
                          </span>
                        </p>
                        <div className="text-blue-800">
                          {formatContent(order.ai_talking_points).map((point, idx) => (
                            <div key={idx} className="mb-2 last:mb-0 flex items-start gap-2">
                              <span className="text-blue-600 font-semibold text-sm mt-0.5">•</span>
                              <span className="text-blue-800 text-sm leading-relaxed flex-1">{point}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {order.ai_business_impact && (
                    <div className="mb-4">
                      <div className="bg-green-50 p-3 rounded-md border border-green-200">
                        <p className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
                          <span>📈 Business Impact Analysis:</span>
                          <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                            ✦ AI Generated
                          </span>
                        </p>
                        <div className="text-green-800">
                          {formatContent(order.ai_business_impact).map((impact, idx) => (
                            <div key={idx} className="mb-2 last:mb-0 flex items-start gap-2">
                              <span className="text-green-600 font-semibold text-sm mt-0.5">•</span>
                              <span className="text-green-800 text-sm leading-relaxed flex-1">{impact}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {order.ai_potential_impact && (
                    <div className="mb-4">
                      <div className="bg-orange-50 p-3 rounded-md border border-purple-200">
                        <p className="text-sm font-medium text-orange-600 mb-2 flex items-center gap-2">
                          <span>🔮 Long-term Impact:</span>
                          <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                            ✦ AI Generated
                          </span>
                        </p>
                        <div className="text-orange-800">
                          {formatContent(order.ai_potential_impact).map((impact, idx) => (
                            <div key={idx} className="mb-2 last:mb-0 flex items-start gap-2">
                              <span className="text-orange-600 font-semibold text-sm mt-0.5">•</span>
                              <span className="text-orange-600 text-sm leading-relaxed flex-1">{impact}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => copyToClipboard && createFormattedReport && copyToClipboard(createFormattedReport(order))}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300 text-sm flex items-center gap-2"
                    >
                      <Copy size={14} />
                      <span>Copy Report</span>
                    </button>
                    
                    <button
                      onClick={() => downloadTextFile && createFormattedReport && downloadTextFile(
                        createFormattedReport(order), 
                        `${order.executive_order_number ? 'executive-order' : 'legislation'}-${order.executive_order_number || order.bill_number}.txt`
                      )}
                      className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-all duration-300 text-sm flex items-center gap-2"
                    >
                      <Download size={14} />
                      <span>Download</span>
                    </button>
                    
                    {order.html_url && (
                      <a
                        href={order.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-all duration-300 text-sm flex items-center gap-2"
                      >
                        <ExternalLink size={14} />
                        <span>View Original</span>
                      </a>
                    )}
                    
                    {order.pdf_url && (
                      <a
                        href={order.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all duration-300 text-sm flex items-center gap-2"
                      >
                        <FileText size={14} />
                        <span>View PDF</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Quick Actions Section - Only show when there are no highlighted items */}
      {!hasHighlightedItems && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Compass size={20} className="text-blue-600" />
            <span>To begin select one of the options below</span>
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => navigate('/executive-orders')}
              className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-left transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <ScrollText size={20} className="text-blue-600" />
                <span className="font-semibold text-blue-800">Fetch Executive Orders</span>
              </div>
              <p className="text-sm text-blue-700">
                Go to Executive Orders page to fetch federal data
              </p>
            </button>
            
            <button 
              onClick={() => navigate('/state/california')}
              className="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-left transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <FileText size={20} className="text-green-600" />
                <span className="font-semibold text-green-800">Fetch State Legislation</span>
              </div>
              <p className="text-sm text-green-700">
                Visit any state page to fetch legislation data
              </p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HighlightsPage;