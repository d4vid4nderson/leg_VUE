// Updated ExecutiveOrdersPage.jsx with Multiple Filter Support - Fixed Version

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  Download,
  RotateCw as RefreshIcon,
  ScrollText,
  Star,
  Copy,
  FileText,
  ExternalLink,
  Calendar,
  User,
  Clock,
  Check,
  AlertTriangle
} from 'lucide-react';

import { FILTERS } from '../utils/constants';
import { 
  getApiUrl,
  getOrderId,
  getExecutiveOrderNumber,
  stripHtmlTags,
  createFormattedReport,
  getFederalRegisterUrl
} from '../utils/helpers';
import { CategoryTag, Pagination } from './CommonComponents';
import { useFuzzySearch } from '../utils/useFuzzySearch';

const API_URL = import.meta.env.VITE_API_URL || '';

// Review Status Tag Component
const ReviewStatusTag = ({ isReviewed }) => {
  if (isReviewed) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
        <Check size={12} />
        Reviewed
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
      <AlertTriangle size={12} />
      Not Reviewed
    </span>
  );
};

// Extended FILTERS array with review status options
const EXTENDED_FILTERS = [
  ...FILTERS,
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

const ExecutiveOrdersPage = ({
  orders = [],
  loading = false,
  error = null,
  searchTerm = '',
  setSearchTerm = () => {},
  activeFilter = null,
  setActiveFilter = () => {},
  filteredOrders: originalFilteredOrders = [],
  paginationPage = 1,
  totalPages = 1,
  stableHandlers = {},
  showFilterDropdown = false,
  setShowFilterDropdown = () => {},
  filterDropdownRef = null,
  fetchData = () => {},
  copyToClipboard = () => {},
  downloadTextFile = () => {},
  makeApiCall = () => {}
}) => {
  // All state declarations first
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState(0);
  const [fetchingData, setFetchingData] = useState(false);
  const [fetchStatus, setFetchStatus] = useState(null);
  const [isFetchExpanded, setIsFetchExpanded] = useState(false);
  const [reviewedOrders, setReviewedOrders] = useState(new Set());
  const [markingReviewed, setMarkingReviewed] = useState(new Set());

  // Initialize from activeFilter prop
  useEffect(() => {
    if (activeFilter && selectedFilters.length === 0) {
      setSelectedFilters([activeFilter]);
    }
  }, [activeFilter]);

  // Sync with parent activeFilter prop changes
  useEffect(() => {
    if (activeFilter && !selectedFilters.includes(activeFilter)) {
      setSelectedFilters([activeFilter]);
    } else if (!activeFilter && selectedFilters.length > 0) {
      setSelectedFilters([]);
    }
  }, [activeFilter, selectedFilters]);

  // Helper function to check if a filter is active
  const isFilterActive = (filterKey) => selectedFilters.includes(filterKey);

  // Function to toggle a filter
  const toggleFilter = (filterKey) => {
    setSelectedFilters(prev => {
      const newFilters = prev.includes(filterKey)
        ? prev.filter(f => f !== filterKey)
        : [...prev, filterKey];
      
      if (setActiveFilter) {
        setActiveFilter(newFilters.length > 0 ? newFilters[0] : null);
      }
      
      return newFilters;
    });
  };

  // Function to clear all filters
  const clearAllFilters = () => {
    setSelectedFilters([]);
    setSearchTerm('');
    setLocalSearchTerm('');
    if (setActiveFilter) {
      setActiveFilter(null);
    }
  };

  // Load reviewed orders from localStorage on component mount
  useEffect(() => {
    try {
      const savedReviewed = localStorage.getItem('reviewedExecutiveOrders');
      if (savedReviewed) {
        setReviewedOrders(new Set(JSON.parse(savedReviewed)));
      }
    } catch (error) {
      console.error('Error loading reviewed orders:', error);
    }
  }, []);

  // Save reviewed orders to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('reviewedExecutiveOrders', JSON.stringify([...reviewedOrders]));
    } catch (error) {
      console.error('Error saving reviewed orders:', error);
    }
  }, [reviewedOrders]);

  // ENHANCED FILTERING LOGIC - Support multiple filters
  const filteredOrdersByCategory = useMemo(() => {
    if (!Array.isArray(orders)) {
      return [];
    }

    let filtered = orders;

    // Apply category filters (can have multiple)
    const categoryFilters = selectedFilters.filter(f => !['reviewed', 'not_reviewed'].includes(f));
    if (categoryFilters.length > 0) {
      filtered = filtered.filter(order => categoryFilters.includes(order?.category));
    }

    // Apply review status filters
    const hasReviewedFilter = selectedFilters.includes('reviewed');
    const hasNotReviewedFilter = selectedFilters.includes('not_reviewed');
    
    if (hasReviewedFilter && hasNotReviewedFilter) {
      // If both are selected, show all items (no filtering by review status)
    } else if (hasReviewedFilter) {
      filtered = filtered.filter(order => reviewedOrders.has(getOrderId(order)));
    } else if (hasNotReviewedFilter) {
      filtered = filtered.filter(order => !reviewedOrders.has(getOrderId(order)));
    }
    
    return filtered;
  }, [orders, selectedFilters, reviewedOrders]);

  // Apply fuzzy search to filtered results
  const fuzzySearchResults = useFuzzySearch(filteredOrdersByCategory, searchTerm, {
    threshold: 0.4,
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'ai_summary', weight: 0.3 },
      { name: 'ai_talking_points', weight: 0.2 },
      { name: 'executive_order_number', weight: 0.8 },
      { name: 'category', weight: 0.1 },
      { name: 'president', weight: 0.5 }
    ]
  });

  // Final filtered results using fuzzy search
  const filteredOrders = fuzzySearchResults;

  // Count reviewed/not reviewed orders for display
  const reviewCounts = useMemo(() => {
    const total = orders.length || 0;
    const reviewed = orders.filter(order => reviewedOrders.has(getOrderId(order))).length;
    const notReviewed = total - reviewed;
    
    return { total, reviewed, notReviewed };
  }, [orders, reviewedOrders]);

  // Count orders by category for display
  const categoryCounts = useMemo(() => {
    const counts = {};
    FILTERS.forEach(filter => {
      counts[filter.key] = orders.filter(order => order?.category === filter.key).length;
    });
    return counts;
  }, [orders]);

  useEffect(() => {
    setLocalSearchTerm(searchTerm || '');
  }, [searchTerm]);

  // Advanced loading animation effect
  useEffect(() => {
    if (loading) {
      setLoadingProgress(0);
      setLoadingStage(0);

      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          const newProgress = prev + Math.random() * 4 + 1;
          
          if (newProgress >= 0 && newProgress < 21) setLoadingStage(0);
          else if (newProgress >= 21 && newProgress < 41) setLoadingStage(1);
          else if (newProgress >= 41 && newProgress < 61) setLoadingStage(2);
          else if (newProgress >= 61 && newProgress < 81) setLoadingStage(3);
          else if (newProgress >= 81) setLoadingStage(4);

          if (newProgress >= 100) {
            clearInterval(progressInterval);
            return 100;
          }
          
          return newProgress;
        });
      }, 200);

      return () => {
        clearInterval(progressInterval);
      };
    }
  }, [loading]);

  // UNIVERSAL TEXT CONTENT FORMATTER
  const formatTalkingPoints = (content) => {
    if (!content) return null;

    if (content.includes('<ol>') && content.includes('<li>')) {
      return (
        <div 
          className="universal-ai-content numbered-list-content" 
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

    let textContent = content;
    textContent = textContent.replace(/<[^>]*>/g, '');
    const lines = textContent.split(/\n+/).map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) return <div className="universal-text-content">{content}</div>;

    const talkingPoints = [];
    
    lines.forEach(line => {
      line = line.replace(/^(\d+[\.\)]?\s*|[•\-*→·]\s*)/, '').trim();
      if (line && line.length > 5) {
        talkingPoints.push(line);
      }
    });

    if (talkingPoints.length > 0) {
      return (
        <div className="universal-numbered-content">
          {talkingPoints.map((point, idx) => (
            <div key={idx} className="numbered-item">
              <span className="number-bullet">{idx + 1}.</span>
              <span className="numbered-text">{point}</span>
            </div>
          ))}
        </div>
      );
    }

    return <div className="universal-text-content">{content}</div>;
  };

  const formatUniversalContent = (content) => {
    if (!content) return null;

    if (content.includes('<ol>') || content.includes('<ul>') || content.includes('<li>') || content.includes('<p>')) {
      return (
        <div 
          className="universal-ai-content" 
          dangerouslySetInnerHTML={{ __html: content }}
        />
      );
    }

    const lines = content.split(/\n+/).filter(line => line.trim());
    if (lines.length === 0) return <div className="universal-text-content">{content}</div>;

    const hasNumberedList = lines.some(line => line.match(/^\d+\.\s+/));
    
    if (hasNumberedList) {
      const numberedItems = [];
      
      lines.forEach(line => {
        line = line.trim();
        const numberMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (numberMatch) {
          const [, number, text] = numberMatch;
          numberedItems.push({
            number: number,
            text: text.trim()
          });
        } else if (line && numberedItems.length > 0) {
          const lastItem = numberedItems[numberedItems.length - 1];
          lastItem.text += ' ' + line;
        }
      });

      if (numberedItems.length > 0) {
        return (
          <div className="universal-numbered-content">
            {numberedItems.map((item, idx) => (
              <div key={idx} className="numbered-item">
                <span className="number-bullet">{item.number}.</span>
                <span className="numbered-text">{item.text}</span>
              </div>
            ))}
          </div>
        );
      }
    }

    return <div className="universal-text-content">{content}</div>;
  };

  // SIMPLIFIED FETCH FUNCTION
  const handleQuickFetch = async (type, key, description) => {
    if (fetchingData) return;
    
    setFetchingData(true);
    setFetchStatus(`🔍 Fetching executive orders for ${description}...`);
    
    try {
      const requestBody = { save_to_db: true };
      
      if (type === 'period') {
        requestBody.period = key;
      } else if (type === 'president') {
        requestBody.president = key;
      } else if (type === 'custom' && key === 'last_7_days') {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        requestBody.start_date = startDate;
        requestBody.end_date = endDate;
      }

      const response = await fetch(`${API_URL}/api/executive-orders/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      
      if (data.success) {
        const ordersCount = data.orders_fetched || 0;
        const validatedCount = data.orders_validated || 0;
        const savedCount = data.orders_saved || 0;
        
        setFetchStatus(
          `✅ Successfully fetched ${ordersCount} orders (${validatedCount} validated, ${savedCount} saved)! Refreshing data...`
        );
        
        setTimeout(() => {
          if (fetchData) fetchData();
        }, 1000);
      } else {
        setFetchStatus(`❌ Error: ${data.message || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Error fetching executive orders:', error);
      setFetchStatus(`❌ Error: ${error.message}`);
    } finally {
      setFetchingData(false);
      setTimeout(() => setFetchStatus(null), 8000);
    }
  };

  // Toggle review status function
  const handleToggleReviewStatus = async (order) => {
    const orderId = getOrderId(order);
    if (!orderId) return;
    
    const isCurrentlyReviewed = reviewedOrders.has(orderId);
    setMarkingReviewed(prev => new Set([...prev, orderId]));
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (isCurrentlyReviewed) {
        setReviewedOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
      } else {
        setReviewedOrders(prev => new Set([...prev, orderId]));
      }
      
    } catch (error) {
      console.error('Error toggling review status:', error);
    } finally {
      setMarkingReviewed(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const loadingStages = [
    "Fetching Executive Orders...",
    "Sending Executive Orders to AI for Analysis...",
    "AI Processing Executive Orders...",
    "AI Getting Executive Orders ready to display...",
    "Making final preparations and formatting..."
  ];

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (setSearchTerm) {
      setSearchTerm(localSearchTerm);
    }
  };

  // Handle highlighting with backend integration
  const handleItemHighlight = async (order, sourcePage = 'executive-orders') => {
    const orderId = getOrderId(order);
    if (!orderId) return;
    
    const isCurrentlyHighlighted = stableHandlers.isItemHighlighted?.(order);
    
    try {
      if (isCurrentlyHighlighted) {
        const response = await fetch(`${API_URL}/api/highlights/${orderId}?user_id=1`, {
          method: 'DELETE',
        });
        
        if (response.ok) {
          stableHandlers.handleItemHighlight?.(order, sourcePage);
        } else {
          console.error('Failed to remove highlight');
        }
      } else {
        const response = await fetch(`${API_URL}/api/highlights`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: 1,
            order_id: orderId,
            order_type: 'executive_order',
            notes: null,
            priority_level: 1,
            tags: null,
            is_archived: false
          })
        });
        
        if (response.ok) {
          stableHandlers.handleItemHighlight?.(order, sourcePage);
        } else {
          const errorData = await response.json();
          if (response.status === 409) {
            stableHandlers.handleItemHighlight?.(order, sourcePage);
          } else {
            console.error('Failed to add highlight:', errorData.detail);
          }
        }
      }
    } catch (error) {
      console.error('Error managing highlight:', error);
      stableHandlers.handleItemHighlight?.(order, sourcePage);
    }
  };

  return (
    <div className="pt-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Federal Executive Orders</h2>
        <p className="text-gray-600">Explore executive orders by time period with AI analysis and fuzzy search.</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-8">
        <div className="flex gap-4 items-center">
          {/* Filter Dropdown - Left Side */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 transition-all duration-300 w-48"
            >
              <div className="flex items-center gap-2">
                <span className="truncate">
                  {selectedFilters.length === 0 
                    ? 'Filters'
                    : selectedFilters.length === 1
                    ? EXTENDED_FILTERS.find(f => f.key === selectedFilters[0])?.label || 'Filter'
                    : `${selectedFilters.length} Filters`
                  }
                </span>
                {selectedFilters.length > 0 && (
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full font-medium">
                    {selectedFilters.length}
                  </span>
                )}
              </div>
              <ChevronDown 
                size={16} 
                className={`transition-transform duration-200 flex-shrink-0 ${showFilterDropdown ? 'rotate-180' : ''}`}
              />
            </button>

            {showFilterDropdown && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50 max-h-96 overflow-y-auto">
                {/* Clear All Button */}
                {selectedFilters.length > 0 && (
                  <div className="px-4 py-2 border-b border-gray-200">
                    <button
                      onClick={() => {
                        clearAllFilters();
                        setShowFilterDropdown(false);
                      }}
                      className="w-full text-left px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-all duration-300"
                    >
                      Clear All Filters ({selectedFilters.length})
                    </button>
                  </div>
                )}
                
                {/* Category Filters */}
                <div className="border-b border-gray-200 pb-2">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Categories
                  </div>
                  {FILTERS.map(filter => {
                    const IconComponent = filter.icon;
                    const isActive = isFilterActive(filter.key);
                    const count = categoryCounts[filter.key] || 0;
                    return (
                      <button
                        key={filter.key}
                        onClick={() => toggleFilter(filter.key)}
                        className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <IconComponent 
                            size={16} 
                            className={
                              filter.key === 'civic' ? 'text-blue-600' :
                              filter.key === 'education' ? 'text-orange-600' :
                              filter.key === 'engineering' ? 'text-green-600' :
                              filter.key === 'healthcare' ? 'text-red-600' :
  
                              'text-gray-600'
                            }
                          />
                          <span>{filter.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">({count})</span>
                          {isActive && (
                            <Check size={14} className="text-blue-600" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Review Status Filters */}
                <div className="pt-2">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Review Status
                  </div>
                  <button
                    onClick={() => toggleFilter('reviewed')}
                    className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                      isFilterActive('reviewed')
                        ? 'bg-green-50 text-green-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Check size={16} className="text-green-600" />
                      <span>Reviewed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">({reviewCounts.reviewed})</span>
                      {isFilterActive('reviewed') && (
                        <Check size={14} className="text-green-600" />
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => toggleFilter('not_reviewed')}
                    className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                      isFilterActive('not_reviewed')
                        ? 'bg-red-50 text-red-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={16} className="text-red-600" />
                      <span>Not Reviewed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">({reviewCounts.notReviewed})</span>
                      {isFilterActive('not_reviewed') && (
                        <Check size={14} className="text-red-600" />
                      )}
                    </div>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Search Bar - Right Side with Fuzzy Search Indicator */}
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="earch executive orders..."
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
                  Fuzzy: {filteredOrders.length}
                </span>
              </div>
            )}
          </div>

          {(selectedFilters.length > 0 || searchTerm) && (
            <button
              onClick={clearAllFilters}
              className="px-4 py-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all duration-300 flex-shrink-0"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* COLLAPSIBLE Quick Pick Fetch Section */}
      <div className="mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div 
            className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
            onClick={() => setIsFetchExpanded(!isFetchExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download size={20} className="text-blue-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Fetch Executive Orders</h3>
                  <p className="text-sm text-gray-600">
                    {isFetchExpanded ? 'Quick access to fetch orders by time period' : 'Click to expand fetch controls'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {fetchStatus && (
                  <div className="text-sm text-blue-600 font-medium max-w-xs truncate">
                    {fetchStatus}
                  </div>
                )}
                {fetchingData && (
                  <RefreshIcon size={16} className="animate-spin text-blue-600" />
                )}
                <ChevronDown 
                  size={20} 
                  className={`text-gray-500 transition-transform duration-200 ${isFetchExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </div>
          </div>

          {isFetchExpanded && (
            <div className="p-6">
              {fetchStatus && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-blue-800 text-sm font-medium">{fetchStatus}</p>
                </div>
              )}

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                  <Clock size={16} className="text-blue-600" />
                  Quick Fetch Executive Orders
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <button
                    onClick={() => handleQuickFetch('period', 'inauguration', 'Since Inauguration Day')}
                    disabled={fetchingData}
                    className={`p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-105 ${
                      fetchingData 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg hover:border-blue-300 hover:bg-blue-50'
                    } border-gray-200 bg-white text-gray-700`}
                  >
                    <div className="font-medium mb-2 text-blue-600">
                      🏛️ Since Inauguration
                    </div>
                    <div className="text-xs text-gray-500">
                      Jan 20, 2025 - Present
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickFetch('period', 'last_90_days', 'Last 90 Days')}
                    disabled={fetchingData}
                    className={`p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-105 ${
                      fetchingData 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg hover:border-blue-300 hover:bg-blue-50'
                    } border-gray-200 bg-white text-gray-700`}
                  >
                    <div className="font-medium mb-2 text-blue-600">
                      📊 Last 90 Days
                    </div>
                    <div className="text-xs text-gray-500">
                      Quarterly overview
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickFetch('period', 'last_30_days', 'Last 30 Days')}
                    disabled={fetchingData}
                    className={`p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-105 ${
                      fetchingData 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg hover:border-blue-300 hover:bg-blue-50'
                    } border-gray-200 bg-white text-gray-700`}
                  >
                    <div className="font-medium mb-2 text-blue-600">
                      📅 Last 30 Days
                    </div>
                    <div className="text-xs text-gray-500">
                      Most recent orders
                    </div>
                  </button>

                  <button
                    onClick={() => handleQuickFetch('custom', 'last_7_days', 'Last 7 Days')}
                    disabled={fetchingData}
                    className={`p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-105 ${
                      fetchingData 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg hover:border-blue-300 hover:bg-blue-50'
                    } border-gray-200 bg-white text-gray-700`}
                  >
                    <div className="font-medium mb-2 text-blue-600">
                      📰 Last Week
                    </div>
                    <div className="text-xs text-gray-500">
                      Past 7 days
                    </div>
                  </button>
                </div>
              </div>

              {fetchingData && (
                <div className="flex items-center justify-center pt-4 border-t border-gray-200">
                  <RefreshIcon size={20} className="animate-spin text-blue-600 mr-3" />
                  <span className="text-sm text-blue-600 font-medium">Fetching and analyzing executive orders with AI...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Results Section */}
      <div className="mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
            {loading ? (
              <div className="py-12 text-center">
                <div className="mb-6 relative">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-r from-violet-600 to-blue-600 rounded-full flex items-center justify-center animate-pulse">
                    <ScrollText size={32} className="text-white" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-blue-400 rounded-full animate-ping opacity-30"></div>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Loading Executive Orders</h3>
                <p className="text-gray-600">{loadingStages[loadingStage]}</p>
                <div className="text-2xl font-bold text-blue-600 mt-4">
                  {Math.round(loadingProgress)}%
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
                <p className="font-semibold mb-2">Error loading executive orders:</p>
                <p className="text-sm">{error}</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <ScrollText size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Executive Orders Found</h3>
                <p className="text-gray-600 mb-4">
                  {(selectedFilters.length > 0 || searchTerm) 
                    ? `No executive orders match your current search criteria${searchTerm ? ` for "${searchTerm}"` : ''}.` 
                    : "No executive orders are currently loaded. Use the quick pick buttons above to fetch orders by time period."
                  }
                </p>
                {(selectedFilters.length > 0 || searchTerm) && (
                  <button
                    onClick={clearAllFilters}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300"
                  >
                    Clear Search & Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {filteredOrders.map((order, index) => {
                  const orderId = getOrderId(order);
                  const isReviewed = reviewedOrders.has(orderId);
                  
                  return (
                    <div key={orderId} className={`bg-white rounded-lg shadow-sm border overflow-hidden transition-all duration-300 ${
                      isReviewed ? 'border-green-200 bg-green-50' : 'border-gray-200'
                    }`}>
                      <div className="flex items-start justify-between px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
                        <div 
                          className="flex-1 cursor-pointer hover:bg-gray-50 transition-all duration-300 rounded-md p-2 -ml-2 -mt-2 -mb-1"
                          onClick={() => stableHandlers.handleExpandOrder?.(order)}
                        >
                          <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-2 leading-tight">
                            {index + 1}. {order?.title || 'Untitled'}
                          </h3>
                          
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mb-2">
                            <span>Executive Order #{getExecutiveOrderNumber(order)}</span>
                            <span>-</span>
                            <span>Sign Date:</span>
                            <span>
                              {order?.signing_date 
                                ? new Date(order.signing_date).toLocaleDateString('en-US', {
                                    month: 'numeric',
                                    day: 'numeric', 
                                    year: 'numeric'
                                  })
                                : 'No date'
                              }
                            </span>
                            <span>-</span>
                            <CategoryTag category={order?.category} />
                            <span>-</span>
                            <ReviewStatusTag isReviewed={isReviewed} />
                            {order?.president && (
                              <>
                                <span>-</span>
                                <span className="font-medium">{order.president}</span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleToggleReviewStatus(order);
                            }}
                            disabled={markingReviewed.has(orderId)}
                            className={`p-2 rounded-md transition-all duration-300 ${
                              markingReviewed.has(orderId)
                                ? 'text-gray-500 cursor-not-allowed'
                                : isReviewed
                                ? 'text-green-600 bg-green-100 hover:bg-green-200'
                                : 'text-gray-400 hover:bg-green-100 hover:text-green-600'
                            }`}
                            title={isReviewed ? "Mark as not reviewed" : "Mark as reviewed"}
                          >
                            {markingReviewed.has(orderId) ? (
                              <div className="flex items-center">
                                <RefreshIcon size={16} className="animate-spin" />
                              </div>
                            ) : (
                              <Check size={16} className={isReviewed ? "text-green-600" : ""} />
                            )}
                          </button>

                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleItemHighlight(order, 'executive-orders');
                            }}
                            className={`p-2 rounded-md transition-all duration-300 ${
                              stableHandlers.isItemHighlighted?.(order)
                                ? 'text-yellow-500 hover:bg-yellow-100'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-yellow-500'
                            }`}
                            title={stableHandlers.isItemHighlighted?.(order) ? "Remove from highlights" : "Add to highlights"}
                          >
                            <Star size={16} className={stableHandlers.isItemHighlighted?.(order) ? "fill-current" : ""} />
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              stableHandlers.handleExpandOrder?.(order);
                            }}
                            className="p-2 hover:bg-gray-100 rounded-md transition-all duration-300"
                          >
                            <ChevronDown 
                              size={20} 
                              className={`text-gray-500 transition-transform duration-200 ${
                                stableHandlers.isOrderExpanded?.(order) ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {order?.ai_summary && (
                        <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                          <div className="bg-violet-50 p-3 rounded-md border border-violet-200">
                            <p className="text-md font-bold text-violet-800 mb-2 flex items-center gap-2">
                              <span>Azure AI Summary:</span>
                              <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                                ✦ AI Generated
                              </span>
                            </p>
                            <div className="text-violet-800">
                              {formatUniversalContent(order.ai_summary)}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {stableHandlers.isOrderExpanded?.(order) && (
                        <div className="px-3 sm:px-4 pb-3 sm:pb-4 bg-gray-50">
                          {order.ai_talking_points && (
                            <div className="mb-4">
                              <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                                <p className="text-md font-bold text-blue-800 mb-3 flex items-center gap-2">
                                  <span>🎯 Key Talking Points:</span>
                                  <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                                    ✦ AI Generated
                                  </span>
                                </p>
                                <div className="text-blue-800">
                                  {formatTalkingPoints(order.ai_talking_points)}
                                </div>
                              </div>
                            </div>
                          )}

                          {order.ai_business_impact && (
                            <div className="mb-4">
                              <div className="bg-green-50 p-3 rounded-md border border-green-200">
                                <p className="text-md font-bold text-green-800 mb-3 flex items-center gap-2">
                                  <span>📈 Business Impact Analysis:</span>
                                  <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                                    ✦ AI Generated
                                  </span>
                                </p>
                                <div className="text-green-800">
                                  {formatUniversalContent(order.ai_business_impact)}
                                </div>
                              </div>
                            </div>
                          )}

                          {order.ai_potential_impact && (
                            <div className="mb-4">
                              <div className="bg-orange-50 p-3 rounded-md border border-purple-200">
                                <p className="text-md font-bold text-orange-800 mb-3 flex items-center gap-2">
                                  <span>🔮 Long-term Impact:</span>
                                  <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                                    ✦ AI Generated
                                  </span>
                                </p>
                                <div className="text-orange-800">
                                  {formatUniversalContent(order.ai_potential_impact)}
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                            <a
                              href={getFederalRegisterUrl(order)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-all duration-300 text-sm flex items-center gap-2"
                            >
                              <ExternalLink size={14} />
                              <span>Federal Register</span>
                            </a>
                            
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
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pagination */}
      {!loading && !error && filteredOrders.length > 0 && (
        <Pagination
          paginationPage={paginationPage}
          totalPages={totalPages}
          onPageChange={stableHandlers.handlePageChange}
          loading={loading}
        />
      )}

      {/* Universal CSS Styles */}
      <style>{`
        .universal-ai-content,
        .universal-structured-content,
        .universal-text-content {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: inherit;
        }

        .universal-numbered-content {
          margin: 8px 0;
        }

        .numbered-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 6px;
          font-size: 14px;
          line-height: 1.5;
        }

        .numbered-item:last-child {
          margin-bottom: 0;
        }

        .number-bullet {
          font-weight: 600;
          font-size: 14px;
          color: currentColor;
          min-width: 20px;
          flex-shrink: 0;
        }

        .numbered-text {
          flex: 1;
          font-size: 14px;
          line-height: 1.5;
          color: inherit;
        }

        .universal-bullet-content {
          margin: 8px 0;
        }

        .bullet-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 6px;
          font-size: 14px;
          line-height: 1.5;
        }

        .bullet-item:last-child {
          margin-bottom: 0;
        }

        .bullet-point {
          font-weight: 600;
          font-size: 16px;
          color: currentColor;
          min-width: 12px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .bullet-text {
          flex: 1;
          font-size: 14px;
          line-height: 1.5;
          color: inherit;
        }

        .numbered-list-content ol {
          margin: 8px 0;
          padding-left: 0;
          list-style: none;
          counter-reset: talking-points;
        }

        .numbered-list-content li {
          position: relative;
          padding-left: 24px;
          margin-bottom: 6px;
          font-size: 14px;
          line-height: 1.5;
          color: inherit;
          counter-increment: talking-points;
        }

        .numbered-list-content li:before {
          content: counter(talking-points) ".";
          position: absolute;
          left: 0;
          top: 0;
          font-weight: 600;
          font-size: 14px;
          color: currentColor;
          min-width: 20px;
        }

        .numbered-list-content li:last-child {
          margin-bottom: 0;
        }

        .universal-ai-content p {
          margin: 0 0 8px 0;
          font-size: 14px;
          line-height: 1.5;
        }

        .universal-ai-content p:last-child {
          margin-bottom: 0;
        }

        .universal-ai-content ol,
        .universal-ai-content ul {
          margin: 8px 0;
          padding-left: 20px;
          font-size: 14px;
        }

        .universal-ai-content li {
          margin-bottom: 4px;
          font-size: 14px;
          line-height: 1.5;
          color: inherit;
        }

        .universal-ai-content li:last-child {
          margin-bottom: 0;
        }

        .universal-ai-content strong {
          font-weight: 600;
          font-size: 14px;
        }

        .text-blue-800 .universal-ai-content,
        .text-blue-800 .universal-structured-content,
        .text-blue-800 .universal-text-content,
        .text-blue-800 .number-bullet,
        .text-blue-800 .numbered-text,
        .text-blue-800 .bullet-point,
        .text-blue-800 .bullet-text {
          color: #1e40af;
        }

        .text-green-800 .universal-ai-content,
        .text-green-800 .universal-structured-content,
        .text-green-800 .universal-text-content,
        .text-green-800 .number-bullet,
        .text-green-800 .numbered-text,
        .text-green-800 .bullet-point,
        .text-green-800 .bullet-text {
          color: #166534;
        }

        .text-orange-800 .universal-ai-content,
        .text-orange-800 .universal-structured-content,
        .text-orange-800 .universal-text-content,
        .text-orange-800 .number-bullet,
        .text-orange-800 .numbered-text,
        .text-orange-800 .bullet-point,
        .text-orange-800 .bullet-text {
          color: #9a3412;
        }

        .text-violet-800 .universal-ai-content,
        .text-violet-800 .universal-structured-content,
        .text-violet-800 .universal-text-content,
        .text-violet-800 .number-bullet,
        .text-violet-800 .numbered-text,
        .text-violet-800 .bullet-point,
        .text-violet-800 .bullet-text {
          color: #5b21b6;
        }
      `}</style>
    </div>
  );
};

export default ExecutiveOrdersPage;