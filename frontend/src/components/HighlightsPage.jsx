import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Star,
  Copy,
  Download,
  ExternalLink,
  FileText,
  ScrollText,
  Compass,
  Loader,
  RefreshCw
} from 'lucide-react';

// Simple API service for highlights
class HighlightsAPI {
  static async getHighlights(userId = 1) {
    try {
      console.log('🔍 Fetching highlights for user:', userId);
      // Try multiple endpoint variations to match your backend
      const endpoints = [
        `/api/user-highlights?user_id=user123`,
        `/api/highlights?user_id=${userId}`,
        `/api/user-highlights?user_id=${userId}`
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(`${import.meta.env.VITE_API_URL || ''}${endpoint}`);
          if (response.ok) {
            const data = await response.json();
            const highlights = data.highlights || data.results || data || [];
            console.log('✅ Found highlights:', highlights.length, 'from', endpoint);
            return Array.isArray(highlights) ? highlights : [];
          }
        } catch (err) {
          console.warn('Endpoint failed:', endpoint, err.message);
          continue;
        }
      }
      
      console.warn('⚠️ No working highlights endpoint found');
      return [];
    } catch (error) {
      console.error('Error fetching highlights:', error);
      return [];
    }
  }

  static async removeHighlight(orderId, userId = 1) {
    try {
      console.log('🗑️ Removing highlight:', orderId);
      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/highlights/${orderId}?user_id=${userId}`, {
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
}

// Simple hook for managing highlights
const useHighlights = (userId = 1) => {
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const loadHighlights = async () => {
    try {
      setLoading(true);
      const fetchedHighlights = await HighlightsAPI.getHighlights(userId);
      
      // Transform highlights to consistent format
      const transformedHighlights = fetchedHighlights.map(highlight => ({
        id: highlight.order_id || highlight.id,
        order_id: highlight.order_id || highlight.id,
        title: highlight.title || `${highlight.order_type === 'executive_order' ? 'Executive Order' : 'Bill'} #${highlight.order_id}`,
        description: highlight.description || 'No description available',
        ai_summary: highlight.ai_summary || highlight.description || 'No summary available',
        executive_order_number: highlight.order_type === 'executive_order' ? highlight.order_id : null,
        bill_number: highlight.order_type === 'state_legislation' ? highlight.order_id : null,
        order_type: highlight.order_type,
        category: highlight.category || 'not-applicable',
        state: highlight.state,
        signing_date: highlight.signing_date || highlight.created_at,
        html_url: highlight.html_url,
        pdf_url: highlight.pdf_url,
        legiscan_url: highlight.legiscan_url,
        highlighted_at: highlight.created_at,
        priority_level: highlight.priority_level || 1
      }));
      
      setHighlights(transformedHighlights);
      setLastRefresh(Date.now());
    } catch (error) {
      console.error('Error loading highlights:', error);
      setHighlights([]);
    } finally {
      setLoading(false);
    }
  };

  const removeHighlight = async (highlight) => {
    try {
      const orderId = highlight.order_id || highlight.id;
      await HighlightsAPI.removeHighlight(orderId, userId);
      setHighlights(prev => prev.filter(item => (item.order_id || item.id) !== orderId));
      setLastRefresh(Date.now());
    } catch (error) {
      console.error('Failed to remove highlight:', error);
      throw error;
    }
  };

  const refreshHighlights = async () => {
    await loadHighlights();
  };

  useEffect(() => {
    loadHighlights();
  }, [userId]);

  return {
    highlights,
    loading,
    removeHighlight,
    refreshHighlights,
    lastRefresh
  };
};

const HighlightsPage = ({ makeApiCall, copyToClipboard, stableHandlers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  // Use highlights hook
  const {
    highlights,
    loading,
    removeHighlight,
    refreshHighlights,
    lastRefresh
  } = useHighlights(1);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await refreshHighlights();
      console.log('🔄 Manual refresh completed');
    } catch (error) {
      console.error('Error during manual refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter highlights based on search
  const filteredHighlights = highlights.filter(highlight => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      highlight.title?.toLowerCase().includes(term) ||
      highlight.ai_summary?.toLowerCase().includes(term) ||
      highlight.description?.toLowerCase().includes(term) ||
      highlight.executive_order_number?.toString().toLowerCase().includes(term) ||
      highlight.bill_number?.toString().toLowerCase().includes(term)
    );
  });

  // Helper function to get highlight source info
  const getHighlightSourceInfo = (highlight) => {
    if (highlight.order_type === 'executive_order' || highlight.executive_order_number) {
      return {
        icon: ScrollText,
        label: 'Executive Orders',
        color: 'text-blue-600'
      };
    } else if (highlight.order_type === 'state_legislation' || highlight.bill_number) {
      return {
        icon: FileText,
        label: highlight.state ? `${highlight.state} Legislature` : 'State Legislature',
        color: 'text-green-600'
      };
    }
    return {
      icon: FileText,
      label: 'Unknown',
      color: 'text-gray-600'
    };
  };

  // Handle highlight removal
  const handleRemoveHighlight = async (highlight) => {
    try {
      await removeHighlight(highlight);
      // Also update global state if available
      if (stableHandlers?.refreshGlobalHighlights) {
        stableHandlers.refreshGlobalHighlights();
      }
    } catch (error) {
      console.error('Failed to remove highlight:', error);
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

  const hasHighlights = highlights && highlights.length > 0;

  // Show loading state
  if (loading) {
    return (
      <div className="pt-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Highlights</h2>
          <p className="text-gray-600">Your saved executive orders and legislation with fuzzy search.</p>
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
      {/* Header with Refresh Button */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-gray-800 mb-2">Highlights</h2>
            <p className="text-gray-600">Your saved executive orders and legislation with fuzzy search.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              Last updated: {formatLastRefresh(lastRefresh)}
            </div>
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
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
            {searchTerm && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  {filteredHighlights.length} found
                </span>
              </div>
            )}
          </div>

          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="px-4 py-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all duration-300 flex-shrink-0"
            >
              Clear Search
            </button>
          )}
        </div>
      </div>

      {/* Highlights Display */}
      <div className="space-y-6 mb-8">
        {filteredHighlights.length === 0 ? (
          <div className="text-center py-12">
            <Star size={48} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {hasHighlights ? 'No matching highlights found' : 'No Highlights Yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {hasHighlights 
                ? `No highlights match your search for "${searchTerm}".`
                : "Start by highlighting executive orders or legislation from other pages."
              }
            </p>
            {searchTerm ? (
              <button
                onClick={() => setSearchTerm('')}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300"
              >
                Clear Search
              </button>
            ) : null}
          </div>
        ) : (
          filteredHighlights.map((highlight, index) => {
            const source = getHighlightSourceInfo(highlight);
            const SourceIcon = source.icon;
            
            return (
              <div key={highlight.id || index} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-start justify-between px-4 pt-4 pb-2">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-800 mb-1 leading-tight">
                      {index + 1}. {highlight.title || 'Untitled'}
                    </h3>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                      <span className="font-medium">
                        {highlight.executive_order_number 
                          ? `Executive Order #${highlight.executive_order_number}` 
                          : highlight.bill_number 
                            ? `Bill #${highlight.bill_number}`
                            : 'N/A'
                        }
                      </span>
                      {highlight.signing_date && (
                        <span>{new Date(highlight.signing_date).toLocaleDateString()}</span>
                      )}
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
                        handleRemoveHighlight(highlight);
                      }}
                      className="p-2 hover:bg-red-100 hover:text-red-600 rounded-md transition-all duration-300"
                      title="Remove from highlights"
                    >
                      <Star size={16} className="fill-current text-yellow-500" />
                    </button>
                  </div>
                </div>

                {/* AI Summary */}
                {highlight.ai_summary && highlight.ai_summary !== 'No summary available' && (
                  <div className="px-4 pb-4">
                    <div className="bg-violet-50 p-3 rounded-md border border-violet-200">
                      <p className="text-sm font-medium text-violet-800 mb-2 flex items-center gap-2">
                        <span>AI Summary:</span>
                        <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                          ✦ AI Generated
                        </span>
                      </p>
                      <p className="text-sm text-violet-800 leading-relaxed">
                        {highlight.ai_summary.replace(/<[^>]*>/g, '')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="px-4 pb-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        // Create a simple report
                        const report = [
                          highlight.title,
                          highlight.executive_order_number ? `Executive Order #${highlight.executive_order_number}` : 
                          highlight.bill_number ? `Bill #${highlight.bill_number}` : '',
                          highlight.state ? `State: ${highlight.state}` : '',
                          '',
                          highlight.ai_summary ? `AI Summary: ${highlight.ai_summary.replace(/<[^>]*>/g, '')}` : '',
                          highlight.description ? `Description: ${highlight.description}` : ''
                        ].filter(line => line.length > 0).join('\n');
                        
                        if (copyToClipboard) {
                          copyToClipboard(report);
                        } else if (navigator.clipboard) {
                          navigator.clipboard.writeText(report).catch(console.error);
                        }
                      }}
                      className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300 text-sm flex items-center gap-2"
                    >
                      <Copy size={14} />
                      <span>Copy Report</span>
                    </button>
                    
                    {highlight.html_url && (
                      <a
                        href={highlight.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-all duration-300 text-sm flex items-center gap-2"
                      >
                        <ExternalLink size={14} />
                        <span>View Original</span>
                      </a>
                    )}
                    
                    {highlight.pdf_url && (
                      <a
                        href={highlight.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all duration-300 text-sm flex items-center gap-2"
                      >
                        <FileText size={14} />
                        <span>View PDF</span>
                      </a>
                    )}

                    {highlight.legiscan_url && (
                      <a
                        href={highlight.legiscan_url}
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

      {/* Quick Actions Section - Only show when no highlights */}
      {!hasHighlights && (
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
    </div>
  );
};

export default HighlightsPage;