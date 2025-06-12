// Working HighlightsPage.jsx - Fetches highlights and resolves full order data

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
  ScrollText,
  Compass,
  Loader,
  RotateCw,
  RefreshCw
} from 'lucide-react';

import { HIGHLIGHTS_FILTERS, highlightsFilterStyles } from '../utils/constants';
import { CategoryTag } from './CommonComponents';
import { getOrderId, stripHtmlTags, formatContent } from '../utils/helpers';
import { useFuzzySearch } from '../utils/useFuzzySearch';

const API_URL = import.meta.env.VITE_API_URL || '';

// Enhanced API service for highlights with full data resolution
class HighlightsAPI {
  static async getHighlights(userId = 1) {
    try {
      console.log('🔍 Fetching highlights for user:', userId);
      const response = await fetch(`${API_URL}/api/highlights?user_id=${userId}`);
      if (!response.ok) throw new Error('Failed to fetch highlights');
      
      const highlights = await response.json();
      console.log('🔍 Raw highlights from API:', highlights);
      
      if (!Array.isArray(highlights)) {
        console.warn('Highlights response is not an array:', highlights);
        return [];
      }

      // Resolve full order data for each highlight
      const resolvedHighlights = await Promise.all(
        highlights.map(async (highlight) => {
          try {
            return await this.resolveHighlightData(highlight);
          } catch (error) {
            console.error('Error resolving highlight:', highlight, error);
            return null;
          }
        })
      );

      // Filter out any failed resolutions
      const validHighlights = resolvedHighlights.filter(h => h !== null);
      console.log('🔍 Resolved highlights:', validHighlights.length, 'valid out of', highlights.length, 'total');
      
      return validHighlights;
    } catch (error) {
      console.error('Error fetching highlights:', error);
      return [];
    }
  }

  static async resolveHighlightData(highlight) {
    console.log('🔍 Resolving highlight data for:', highlight);
    
    const orderId = highlight.order_id;
    const orderType = highlight.order_type;

    try {
      let orderData = null;

      if (orderType === 'executive_order') {
        // Fetch executive order data
        const response = await fetch(`${API_URL}/api/executive-orders?executive_order_number=${orderId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.results && data.results.length > 0) {
            orderData = data.results[0];
          }
        }
      } else if (orderType === 'state_legislation') {
        // Try to extract state from order_id if it's in format "state-bill-number"
        const idParts = orderId.split('-');
        let state = null;
        let billNumber = null;
        
        if (idParts.length >= 3 && idParts[1] === 'bill') {
          state = idParts[0];
          billNumber = idParts[2];
        }

        // Try multiple approaches to find the bill
        const searchApproaches = [
          // Try with extracted state and bill number
          state ? `${API_URL}/api/state-legislation?state=${state}&bill_number=${billNumber}` : null,
          // Try with just the order_id as bill_number
          `${API_URL}/api/state-legislation?bill_number=${orderId}`,
          // Try searching across all state legislation
          `${API_URL}/api/state-legislation?search=${orderId}`
        ].filter(Boolean);

        for (const url of searchApproaches) {
          try {
            const response = await fetch(url);
            if (response.ok) {
              const data = await response.json();
              if (data.results && data.results.length > 0) {
                // Find the exact match
                orderData = data.results.find(bill => 
                  bill.bill_number === billNumber || 
                  bill.bill_number === orderId ||
                  bill.id === orderId ||
                  bill.bill_id === orderId
                ) || data.results[0];
                
                if (orderData) {
                  console.log('✅ Found state legislation data:', orderData.title);
                  break;
                }
              }
            }
          } catch (error) {
            console.warn('Failed to fetch with URL:', url, error);
            continue;
          }
        }
      }

      // If we couldn't fetch the original data, create a minimal representation
      if (!orderData) {
        console.warn('⚠️ Could not resolve full data for highlight, creating minimal representation');
        orderData = {
          id: orderId,
          title: `${orderType === 'executive_order' ? 'Executive Order' : 'Bill'} #${orderId}`,
          description: 'Data not available - item may have been removed',
          category: 'not-applicable',
          status: 'Unknown'
        };
      }

      // Create a unified highlight object with all necessary fields
      const resolvedHighlight = {
        // Core identification
        id: orderId,
        order_id: orderId,
        
        // Title and content
        title: orderData.title || `${orderType === 'executive_order' ? 'Executive Order' : 'Bill'} #${orderId}`,
        description: orderData.description || orderData.ai_summary || 'No description available',
        ai_summary: orderData.ai_summary || orderData.description || 'No summary available',
        ai_talking_points: orderData.ai_talking_points,
        ai_business_impact: orderData.ai_business_impact,
        ai_potential_impact: orderData.ai_potential_impact,
        
        // Type-specific fields
        executive_order_number: orderType === 'executive_order' ? orderId : null,
        bill_number: orderType === 'state_legislation' ? (orderData.bill_number || orderId) : null,
        order_type: orderType,
        
        // Metadata
        category: orderData.category || 'not-applicable',
        status: orderData.status || 'Active',
        state: orderData.state,
        president: orderData.president,
        
        // Dates
        signing_date: orderData.signing_date || orderData.introduced_date,
        introduced_date: orderData.introduced_date,
        date_introduced: orderData.date_introduced,
        
        // URLs
        html_url: orderData.html_url,
        pdf_url: orderData.pdf_url,
        legiscan_url: orderData.legiscan_url,
        
        // Highlight metadata
        highlighted_at: highlight.created_at,
        priority_level: highlight.priority_level || 1,
        notes: highlight.notes,
        tags: highlight.tags,
        user_id: highlight.user_id,
        
        // Source tracking
        source_page: orderType === 'executive_order' ? 'executive-orders' : 'state-legislation'
      };

      console.log('✅ Resolved highlight:', resolvedHighlight.title);
      return resolvedHighlight;

    } catch (error) {
      console.error('Error resolving highlight data:', error);
      throw error;
    }
  }

  static async addHighlight(order, userId = 1, options = {}) {
    try {
      const orderType = order.executive_order_number ? 'executive_order' : 'state_legislation';
      const orderId = order.executive_order_number || order.bill_number || order.id;

      console.log('🔍 Adding highlight:', { orderId, orderType, title: order.title });

      const response = await fetch(`${API_URL}/api/highlights`, {
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
      
      if (!response.ok) {
        if (response.status === 409) {
          console.log('ℹ️ Highlight already exists');
          return { success: true, message: 'Already highlighted' };
        }
        throw new Error('Failed to add highlight');
      }
      
      const result = await response.json();
      console.log('✅ Successfully added highlight');
      return result;
    } catch (error) {
      console.error('Error adding highlight:', error);
      throw error;
    }
  }

  static async removeHighlight(orderId, userId = 1) {
    try {
      console.log('🔍 Removing highlight:', orderId);
      const response = await fetch(`${API_URL}/api/highlights/${orderId}?user_id=${userId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to remove highlight');
      console.log('✅ Successfully removed highlight');
      return true;
    } catch (error) {
      console.error('Error removing highlight:', error);
      throw error;
    }
  }

  static async clearAllHighlights(userId = 1) {
    try {
      const response = await fetch(`${API_URL}/api/highlights?user_id=${userId}`, {
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

// Enhanced custom hook for persistent highlights with proper data resolution
const usePersistedHighlights = (userId = 1) => {
  const [highlightedOrders, setHighlightedOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Load highlights from database with full data resolution
  const loadHighlights = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      console.log('🔄 Loading highlights with full data resolution...');
      
      const highlights = await HighlightsAPI.getHighlights(userId);
      setHighlightedOrders(highlights || []);
      setLastRefresh(Date.now());
      
      console.log('🔄 Loaded', highlights?.length || 0, 'highlights with full data');
      return highlights;
    } catch (error) {
      console.error('Error loading highlights:', error);
      setHighlightedOrders([]);
      return [];
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Load highlights on mount and when refreshKey changes
  useEffect(() => {
    loadHighlights();
  }, [userId, refreshKey]);

  // Auto-refresh highlights every 10 seconds (less frequent to avoid too many API calls)
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const currentHighlights = await HighlightsAPI.getHighlights(userId);
        if (currentHighlights.length !== highlightedOrders.length) {
          console.log('🔄 Auto-refreshing highlights due to count change');
          setHighlightedOrders(currentHighlights);
          setLastRefresh(Date.now());
        }
      } catch (error) {
        console.error('Error auto-checking highlights:', error);
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [userId, highlightedOrders.length]);

  // Refresh highlights when page becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('🔄 Page visible, refreshing highlights');
        loadHighlights(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const addHighlight = async (order, options = {}) => {
    try {
      await HighlightsAPI.addHighlight(order, userId, options);
      const updatedHighlights = await HighlightsAPI.getHighlights(userId);
      setHighlightedOrders(updatedHighlights);
      setLastRefresh(Date.now());
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
      setLastRefresh(Date.now());
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
      setLastRefresh(Date.now());
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

  const manualRefresh = async () => {
    setRefreshKey(prev => prev + 1);
    return await loadHighlights();
  };

  return {
    highlightedOrders,
    loading,
    addHighlight,
    removeHighlight,
    toggleHighlight,
    clearAllHighlights,
    isHighlighted,
    manualRefresh,
    lastRefresh
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const highlightsFilterDropdownRef = useRef(null);
  const navigate = useNavigate();

  // Use persistent highlights with auto-refresh and data resolution
  const {
    highlightedOrders,
    loading,
    toggleHighlight,
    clearAllHighlights: clearAllHighlightsDB,
    manualRefresh,
    lastRefresh
  } = usePersistedHighlights(1); // Hardcoded to user_id = 1 for now

  // Manual refresh handler
  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await manualRefresh();
      console.log('🔄 Manual refresh completed');
    } catch (error) {
      console.error('Error during manual refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // FUZZY SEARCH IMPLEMENTATION
  const categoryFilteredOrders = useMemo(() => {
    if (!Array.isArray(highlightedOrders)) {
      return [];
    }

    if (highlightsFilterHelpers?.hasActiveFilters && highlightsFilterHelpers.hasActiveFilters()) {
      let filtered = highlightedOrders;
      
      if (activeHighlightsFilters && activeHighlightsFilters.size > 0) {
        filtered = filtered.filter(order => {
          return Array.from(activeHighlightsFilters).some(filterKey => {
            const filter = HIGHLIGHTS_FILTERS.find(f => f.key === filterKey);
            if (!filter) return false;
            
            switch (filterKey) {
              case 'executive_orders':
                return order.executive_order_number || order.order_type === 'executive_order';
              case 'state_legislation':
                return order.bill_number || order.order_type === 'state_legislation';
              case 'high_priority':
                return order.priority_level >= 3;
              case 'recent':
                const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const orderDate = new Date(order.highlighted_at || order.signing_date || order.date_introduced);
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
    threshold: 0.5,
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

  const filteredHighlightedOrders = fuzzySearchResults;

  // Helper function to get highlight source
  const getHighlightSourceInfo = (order) => {
    if (order.order_type === 'executive_order' || order.executive_order_number) {
      return {
        icon: 'ScrollText',
        label: 'Executive Orders',
        color: 'text-blue-600'
      };
    } else if (order.order_type === 'state_legislation' || order.bill_number) {
      return {
        icon: 'FileText',
        label: order.state ? `${order.state} Legislature` : 'State Legislature',
        color: 'text-green-600'
      };
    }
    return {
      icon: 'FileText',
      label: 'Unknown',
      color: 'text-gray-600'
    };
  };

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

  // Format last refresh time
  const formatLastRefresh = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ago`;
    } else if (seconds > 0) {
      return `${seconds}s ago`;
    } else {
      return 'just now';
    }
  };

  const hasHighlightedItems = highlightedOrders && highlightedOrders.length > 0;

  // Show loading state
  if (loading) {
    return (
      <div className="pt-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Highlights</h2>
          <p className="text-gray-600">Your saved executive orders and legislation.</p>
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
      {/* Enhanced Header with Refresh Button */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Highlights</h2>
            <p className="text-gray-600">Your saved executive orders and legislation with fuzzy search.</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Last Refresh Indicator */}
            <div className="text-sm text-gray-500">
              Last updated: {formatLastRefresh(lastRefresh)}
            </div>
            {/* Manual Refresh Button */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className={`flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-all duration-300 ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              title="Refresh highlights"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <div className="flex gap-4 items-center">
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

          {searchTerm && (
            <button
              onClick={handleClearAll}
              className="px-4 py-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all duration-300 flex-shrink-0"
            >
              Clear Search
            </button>
          )}
        </div>
      </div>

      {/* Auto-refresh indicator */}
      {hasHighlightedItems && (
        <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-md px-4 py-2">
          <div className="flex items-center gap-2 text-blue-700 text-sm">
            <RotateCw size={14} className="animate-spin" />
            <span>Auto-refreshing every 10 seconds</span>
          </div>
          <div className="text-blue-600 text-xs">
            {highlightedOrders.length} item{highlightedOrders.length !== 1 ? 's' : ''} highlighted
          </div>
        </div>
      )}

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
            {searchTerm ? (
              <button
                onClick={handleClearAll}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300"
              >
                Clear Search
              </button>
            ) : null}
          </div>
        ) : (
          filteredHighlightedOrders.map((order, index) => {
            const source = getHighlightSourceInfo(order);
            const SourceIcon = source.icon === 'ScrollText' ? ScrollText : FileText;
            
            return (
              <div key={order.id || index} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-start justify-between px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
                  <div className="flex-1">
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
                      {order?.signing_date && (
                        <span>{new Date(order.signing_date).toLocaleDateString()}</span>
                      )}
                      <CategoryTag category={order?.category} />
                      <span className={`inline-flex items-center gap-1.5 font-medium text-xs ${source.color} bg-gray-100 px-2 py-1 rounded-full`}>
                        <SourceIcon size={12} />
                        <span>From: {source.label}</span>
                      </span>
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
                  </div>
                </div>

                {order?.ai_summary && order.ai_summary !== 'No summary available' && (
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                    <div className="bg-violet-50 p-3 rounded-md border border-violet-200">
                      <p className="text-sm font-medium text-violet-800 mb-2 flex items-center gap-2">
                        <span>AI Summary:</span>
                        <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                          ✦ AI Generated
                        </span>
                      </p>
                      <p className="text-sm text-violet-800 leading-relaxed">{stripHtmlTags ? stripHtmlTags(order.ai_summary) : order.ai_summary}</p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        if (copyToClipboard && createFormattedReport) {
                          const report = createFormattedReport(order);
                          copyToClipboard(report);
                        } else if (navigator.clipboard) {
                          // Fallback report creation
                          const fallbackReport = [
                            order.title,
                            order.executive_order_number ? `Executive Order #${order.executive_order_number}` : order.bill_number ? `Bill #${order.bill_number}` : '',
                            order.state ? `State: ${order.state}` : '',
                            order.category ? `Category: ${order.category}` : '',
                            '',
                            order.ai_summary ? `AI Summary: ${stripHtmlTags ? stripHtmlTags(order.ai_summary) : order.ai_summary}` : '',
                            order.description ? `Description: ${order.description}` : ''
                          ].filter(line => line.length > 0).join('\n');
                          
                          navigator.clipboard.writeText(fallbackReport).catch(console.error);
                        }
                      }}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300 text-sm flex items-center gap-2"
                    >
                      <Copy size={14} />
                      <span>Copy Report</span>
                    </button>
                    
                    <button
                      onClick={() => {
                        if (downloadTextFile && createFormattedReport) {
                          const report = createFormattedReport(order);
                          const filename = `${order.executive_order_number ? 'executive-order' : 'legislation'}-${order.executive_order_number || order.bill_number || 'report'}.txt`;
                          downloadTextFile(report, filename);
                        }
                      }}
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

                    {order.legiscan_url && (
                      <a
                        href={order.legiscan_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-all duration-300 text-sm flex items-center gap-2"
                      >
                        <ExternalLink size={14} />
                        <span>View on LegiScan</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Quick Actions Section - Only show when there are no highlighted items */}
      {!hasHighlightedItems && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Compass size={20} className="text-blue-600" />
            <span>Get Started with Highlights</span>
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button 
              onClick={() => navigate('/executive-orders')}
              className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-left transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <ScrollText size={20} className="text-blue-600" />
                <span className="font-semibold text-blue-800">Executive Orders</span>
              </div>
              <p className="text-sm text-blue-700">
                Browse and highlight federal executive orders
              </p>
            </button>
            
            <button 
              onClick={() => navigate('/state/california')}
              className="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-left transition-colors"
            >
              <div className="flex items-center gap-3 mb-2">
                <FileText size={20} className="text-green-600" />
                <span className="font-semibold text-green-800">State Legislation</span>
              </div>
              <p className="text-sm text-green-700">
                Find and highlight state bills and legislation
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Debug Info - Remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-gray-100 rounded-lg text-sm">
          <h4 className="font-semibold mb-2">Debug Info:</h4>
          <p>Total highlights loaded: {highlightedOrders.length}</p>
          <p>Filtered highlights: {filteredHighlightedOrders.length}</p>
          <p>Search term: "{searchTerm}"</p>
          <p>Last refresh: {new Date(lastRefresh).toLocaleTimeString()}</p>
        </div>
      )}
    </div>
  );
};

export default HighlightsPage;