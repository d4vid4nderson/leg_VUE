// components/StatePage.jsx - Complete State legislation page component with Review Status
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  Download,
  RotateCw,
  FileText,
  Star,
  Copy,
  ExternalLink,
  BookOpen,
  Building,
  GraduationCap,
  Stethoscope,
  Wrench,
  Check,
  AlertTriangle,
  RotateCw as RefreshIcon
} from 'lucide-react';

import { FILTERS, SUPPORTED_STATES } from '../utils/constants';
import { 
  getApiUrl,
  stripHtmlTags,
  generateUniqueId
} from '../utils/helpers';
import { CategoryTag } from './CommonComponents';

const API_URL = getApiUrl();

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

const StatePage = ({ stateName, stableHandlers, copyToClipboard, makeApiCall }) => {
  const [stateOrders, setStateOrders] = useState([]);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState(null);
  const [stateSearchTerm, setStateSearchTerm] = useState('');
  
  // Multiple filters state
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Review status state
  const [reviewedBills, setReviewedBills] = useState(new Set());
  const [markingReviewed, setMarkingReviewed] = useState(new Set());
  
  // Add expanded state for bill details
  const [expandedBills, setExpandedBills] = useState(new Set());
  
  // CONTRACT CONTROL STATES - DEFAULT CONTRACTED
  const [isFetchExpanded, setIsFetchExpanded] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [fetchStatus, setFetchStatus] = useState(null);
  const [hasData, setHasData] = useState(false);
  
  const filterDropdownRef = useRef(null);

  // CRITICAL: Custom getOrderId function for state bills to match the global one - MUST BE FIRST
  const getStateBillId = useCallback((bill) => {
    if (!bill) return null;
    
    // For state bills, try these fields in order
    if (bill.bill_id) return bill.bill_id;
    if (bill.id && typeof bill.id === 'string') return bill.id;
    if (bill.bill_number) return `state-bill-${bill.bill_number}`;
    
    // Fallback using title or random
    return `state-bill-${bill.title?.slice(0, 10) || Math.random()}`;
  }, []);

  // Helper function to check if a filter is active
  const isFilterActive = (filterKey) => selectedFilters.includes(filterKey);

  // Function to toggle a filter
  const toggleFilter = (filterKey) => {
    setSelectedFilters(prev => {
      const newFilters = prev.includes(filterKey)
        ? prev.filter(f => f !== filterKey)
        : [...prev, filterKey];
      
      return newFilters;
    });
  };

  // Function to clear all filters
  const clearAllFilters = () => {
    setSelectedFilters([]);
    setStateSearchTerm('');
  };

  // Load reviewed bills from localStorage on component mount
  useEffect(() => {
    try {
      const savedReviewed = localStorage.getItem('reviewedStateBills');
      if (savedReviewed) {
        setReviewedBills(new Set(JSON.parse(savedReviewed)));
      }
    } catch (error) {
      console.error('Error loading reviewed bills:', error);
    }
  }, []);

  // Save reviewed bills to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('reviewedStateBills', JSON.stringify([...reviewedBills]));
    } catch (error) {
      console.error('Error saving reviewed bills:', error);
    }
  }, [reviewedBills]);

  // Toggle review status function
  const handleToggleReviewStatus = async (bill) => {
    const billId = getStateBillId(bill);
    if (!billId) return;
    
    const isCurrentlyReviewed = reviewedBills.has(billId);
    setMarkingReviewed(prev => new Set([...prev, billId]));
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (isCurrentlyReviewed) {
        setReviewedBills(prev => {
          const newSet = new Set(prev);
          newSet.delete(billId);
          return newSet;
        });
      } else {
        setReviewedBills(prev => new Set([...prev, billId]));
      }
      
    } catch (error) {
      console.error('Error toggling review status:', error);
    } finally {
      setMarkingReviewed(prev => {
        const newSet = new Set(prev);
        newSet.delete(billId);
        return newSet;
      });
    }
  };

  // Count reviewed/not reviewed bills for display
  const reviewCounts = useMemo(() => {
    const total = stateOrders.length || 0;
    const reviewed = stateOrders.filter(bill => reviewedBills.has(getStateBillId(bill))).length;
    const notReviewed = total - reviewed;
    
    return { total, reviewed, notReviewed };
  }, [stateOrders, reviewedBills, getStateBillId]);

  // Count bills by category for display
  const categoryCounts = useMemo(() => {
    const counts = {};
    FILTERS.forEach(filter => {
      counts[filter.key] = stateOrders.filter(bill => bill?.category === filter.key).length;
    });
    return counts;
  }, [stateOrders]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch existing data on component mount
  useEffect(() => {
    if (stateName && SUPPORTED_STATES[stateName]) {
      fetchExistingData();
    }
  }, [stateName]);

  const fetchExistingData = async () => {
    setStateLoading(true);
    setStateError(null);
    
    try {
      const stateAbbr = SUPPORTED_STATES[stateName];
      console.log('🔍 Fetching data for state:', stateName, 'Abbreviation:', stateAbbr);
      
      // Try both the abbreviation and full name
      const urls = [
        `${API_URL}/api/state-legislation?state=${stateAbbr}`,
        `${API_URL}/api/state-legislation?state=${stateName}`
      ];
      
      let response;
      let data;
      
      for (const url of urls) {
        console.log('🔍 Trying URL:', url);
        response = await fetch(url);
        
        if (response.ok) {
          data = await response.json();
          console.log('🔍 Response data:', data);
          
          if (data.results && data.results.length > 0) {
            console.log('✅ Found data with URL:', url);
            break;
          }
        }
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // ✅ Ensure we always have an array, even if API returns null/undefined
      const results = data?.results || [];
      
      // Transform the bills to match display format with UNIQUE IDs for highlighting
      const transformedBills = results.map((bill, index) => {
        const uniqueId = getStateBillId(bill) || `fallback-${index}`;
        
        return {
          // CRITICAL: Ensure unique ID for highlighting to work
          id: uniqueId,
          bill_id: uniqueId,
          
          // Standard bill fields
          title: bill?.title || 'Untitled Bill',
          status: bill?.status || 'Active',
          category: bill?.category || 'not-applicable',
          description: bill?.description || bill?.ai_summary || 'No description available',
          tags: [bill?.category].filter(Boolean),
          summary: bill?.ai_summary ? stripHtmlTags(bill.ai_summary) : 'No AI summary available',
          bill_number: bill?.bill_number,
          state: bill?.state || stateName,
          legiscan_url: bill?.legiscan_url,
          ai_talking_points: bill?.ai_talking_points,
          ai_business_impact: bill?.ai_business_impact,
          ai_potential_impact: bill?.ai_potential_impact,
          introduced_date: bill?.introduced_date,
          last_action_date: bill?.last_action_date,
          
          // CRITICAL: Fields needed for highlights page compatibility
          executive_order_number: bill?.bill_number || uniqueId,
          signing_date: bill?.introduced_date,
          ai_summary: bill?.ai_summary ? stripHtmlTags(bill.ai_summary) : bill?.description || 'No summary available'
        };
      });
      
      console.log('🔍 Transformed bills:', transformedBills.length, 'bills');
      console.log('🔍 First bill ID:', transformedBills[0]?.id);
      setStateOrders(transformedBills);
      setHasData(transformedBills.length > 0);
    } catch (error) {
      console.error('❌ Error fetching existing state legislation:', error);
      setStateError(error.message);
      setHasData(false);
      setStateOrders([]);
    } finally {
      setStateLoading(false);
    }
  };

  // NEW: Topic-based quick fetch function
  const handleQuickFetchByTopic = async (topic, description) => {
    if (fetchingData) return;
    
    setFetchingData(true);
    setFetchStatus(`🔍 Searching for ${description} legislation in ${stateName}...`);
    
    try {
      const stateAbbr = SUPPORTED_STATES[stateName];
      const response = await fetch(`${API_URL}/api/legiscan/search-and-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: topic,
          state: stateAbbr,
          limit: 15,
          save_to_db: true
        })
      });
      
      const data = await response.json();
      
      if (data.success !== false) {
        const billsCount = data.bills_analyzed || 0;
        setFetchStatus(
          `✅ Successfully found and analyzed ${billsCount} ${description.toLowerCase()} bills! Refreshing data...`
        );
        
        setTimeout(() => {
          fetchExistingData();
        }, 1000);
      } else {
        setFetchStatus(`❌ Error: ${data.message || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Error fetching by topic:', error);
      setFetchStatus(`❌ Error: ${error.message}`);
    } finally {
      setFetchingData(false);
      setTimeout(() => setFetchStatus(null), 8000);
    }
  };

  // ✅ Filter the orders with proper safety checks and multiple filter support
  const filteredStateOrders = useMemo(() => {
    if (!Array.isArray(stateOrders)) {
      console.warn('stateOrders is not an array:', stateOrders);
      return [];
    }

    let filtered = stateOrders;
    
    // Apply category filters (can have multiple)
    const categoryFilters = selectedFilters.filter(f => !['reviewed', 'not_reviewed'].includes(f));
    if (categoryFilters.length > 0) {
      filtered = filtered.filter(bill => categoryFilters.includes(bill?.category));
    }

    // Apply review status filters
    const hasReviewedFilter = selectedFilters.includes('reviewed');
    const hasNotReviewedFilter = selectedFilters.includes('not_reviewed');
    
    if (hasReviewedFilter && hasNotReviewedFilter) {
      // If both are selected, show all items (no filtering by review status)
    } else if (hasReviewedFilter) {
      filtered = filtered.filter(bill => reviewedBills.has(getStateBillId(bill)));
    } else if (hasNotReviewedFilter) {
      filtered = filtered.filter(bill => !reviewedBills.has(getStateBillId(bill)));
    }
    
    // Apply search filter
    if (stateSearchTerm.trim()) {
      const search = stateSearchTerm.toLowerCase().trim();
      filtered = filtered.filter(bill => {
        const title = (bill?.title || '').toLowerCase();
        const description = (bill?.description || '').toLowerCase();
        const summary = (bill?.summary || '').toLowerCase();
        const billNumber = (bill?.bill_number || '').toString().toLowerCase();
        
        return title.includes(search) || 
               description.includes(search) || 
               summary.includes(search) || 
               billNumber.includes(search);
      });
    }
    
    return filtered;
  }, [stateOrders, selectedFilters, reviewedBills, stateSearchTerm]);

  // CRITICAL: Custom highlight handler that works with the global highlighting system
  const handleStateBillHighlight = useCallback((bill) => {
    console.log('🌟 StatePage highlight handler called for:', bill.title);
    console.log('🌟 Bill ID:', bill.id);
    
    // The bill is already transformed with the correct fields for highlighting
    // Just call the stable handler with the correct source
    if (stableHandlers && stableHandlers.handleItemHighlight) {
      stableHandlers.handleItemHighlight(bill, 'state-legislation');
      console.log('🌟 Called stableHandlers.handleItemHighlight');
    } else {
      console.error('❌ stableHandlers.handleItemHighlight not available');
    }
  }, [stableHandlers]);

  // CRITICAL: Custom check if bill is highlighted
  const isStateBillHighlighted = useCallback((bill) => {
    if (!stableHandlers || !stableHandlers.isItemHighlighted) {
      return false;
    }
    
    const isHighlighted = stableHandlers.isItemHighlighted(bill);
    console.log('🌟 Checking if highlighted:', bill.title, 'Result:', isHighlighted);
    return isHighlighted;
  }, [stableHandlers]);

  // Toggle bill expansion
  const toggleBillExpansion = useCallback((billId) => {
    setExpandedBills(prev => {
      const newSet = new Set(prev);
      if (newSet.has(billId)) {
        newSet.delete(billId);
      } else {
        newSet.add(billId);
      }
      return newSet;
    });
  }, []);

  // Early returns for invalid states
  if (!stateName) {
    return (
      <div className="pt-6">
        <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-lg">
          <h3 className="font-semibold mb-2">No State Selected</h3>
          <p>Please select a state from the navigation menu.</p>
        </div>
      </div>
    );
  }

  if (!SUPPORTED_STATES[stateName]) {
    return (
      <div className="pt-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-lg">
          <h3 className="font-semibold mb-2">State Not Supported</h3>
          <p>Legislation tracking for {stateName} is not currently supported.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-6">
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">{stateName} Legislation</h2>
        <p className="text-gray-600">Explore and fetch legislation for {stateName} with AI analysis and review tracking.</p>
      </div>

      {/* Search Bar and Filter */}
      <div className="mb-8">
        <div className="flex gap-4 items-center">
          {/* Filter Dropdown */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              type="button"
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
                              filter.key === 'education' ? 'text-yellow-600' :
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

          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${stateName} legislation...`}
              value={stateSearchTerm}
              onChange={(e) => setStateSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
          </div>

          {/* Clear Filters Button */}
          {(selectedFilters.length > 0 || stateSearchTerm) && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="px-4 py-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all duration-300 flex-shrink-0"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* COLLAPSIBLE Topic-Based Quick Pick Fetch Section */}
      <div className="mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Fetch Header - Collapsible */}
          <div 
            className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
            onClick={() => setIsFetchExpanded(!isFetchExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download size={20} className="text-blue-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Fetch {stateName} Legislation</h3>
                  <p className="text-sm text-gray-600">
                    {isFetchExpanded ? 'Quick access to fetch bills by topic' : 'Click to expand fetch controls'}
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
                  <RotateCw size={16} className="animate-spin text-blue-600" />
                )}
                <ChevronDown 
                  size={20} 
                  className={`text-gray-500 transition-transform duration-200 ${isFetchExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </div>
          </div>

          {/* Expandable Content */}
          {isFetchExpanded && (
            <div className="p-6">
              {/* Fetch Status */}
              {fetchStatus && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-blue-800 text-sm font-medium">{fetchStatus}</p>
                </div>
              )}

              {/* Topic-Based Quick Pick Buttons */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                  <BookOpen size={16} className="text-blue-600" />
                  Quick Fetch by Topic
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Civic */}
                  <button
                    onClick={() => handleQuickFetchByTopic('civic', 'Civic')}
                    disabled={fetchingData}
                    className={`p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-105 ${
                      fetchingData 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg hover:border-blue-300 hover:bg-blue-50'
                    } border-gray-200 bg-white text-gray-700`}
                  >
                    <div className="font-medium mb-2 text-blue-600 flex items-center justify-center gap-2">
                      <Building size={16} />
                      Civic
                    </div>
                    <div className="text-xs text-gray-500">
                      Government & public policy
                    </div>
                  </button>

                  {/* Education */}
                  <button
                    onClick={() => handleQuickFetchByTopic('education', 'Education')}
                    disabled={fetchingData}
                    className={`p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-105 ${
                      fetchingData 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg hover:border-blue-300 hover:bg-blue-50'
                    } border-gray-200 bg-white text-gray-700`}
                  >
                    <div className="font-medium mb-2 text-orange-600 flex items-center justify-center gap-2">
                      <GraduationCap size={16} />
                      Education
                    </div>
                    <div className="text-xs text-gray-500">
                      Schools & learning
                    </div>
                  </button>

                  {/* Engineering */}
                  <button
                    onClick={() => handleQuickFetchByTopic('engineering', 'Engineering')}
                    disabled={fetchingData}
                    className={`p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-105 ${
                      fetchingData 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg hover:border-blue-300 hover:bg-blue-50'
                    } border-gray-200 bg-white text-gray-700`}
                  >
                    <div className="font-medium mb-2 text-green-600 flex items-center justify-center gap-2">
                      <Wrench size={16} />
                      Engineering
                    </div>
                    <div className="text-xs text-gray-500">
                      Infrastructure & technology
                    </div>
                  </button>

                  {/* Healthcare */}
                  <button
                    onClick={() => handleQuickFetchByTopic('healthcare', 'Healthcare')}
                    disabled={fetchingData}
                    className={`p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-105 ${
                      fetchingData 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg hover:border-blue-300 hover:bg-blue-50'
                    } border-gray-200 bg-white text-gray-700`}
                  >
                    <div className="font-medium mb-2 text-red-600 flex items-center justify-center gap-2">
                      <Stethoscope size={16} />
                      Healthcare
                    </div>
                    <div className="text-xs text-gray-500">
                      Medical & health policy
                    </div>
                  </button>
                </div>
              </div>

              {/* Loading Indicator */}
              {fetchingData && (
                <div className="flex items-center justify-center pt-4 border-t border-gray-200">
                  <RotateCw size={20} className="animate-spin text-blue-600 mr-3" />
                  <span className="text-sm text-blue-600 font-medium">Searching and analyzing legislation with AI...</span>
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
            {stateLoading ? (
              <div className="py-12 text-center">
                <div className="mb-6 relative">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-r from-violet-600 to-blue-600 rounded-full flex items-center justify-center animate-pulse">
                    <FileText size={32} className="text-white" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-blue-400 rounded-full animate-ping opacity-30"></div>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Loading {stateName} Legislation</h3>
                <p className="text-gray-600">Please wait while we fetch the data...</p>
              </div>
            ) : stateError ? (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
                <p className="font-semibold mb-2">Error loading {stateName} legislation:</p>
                <p className="text-sm">{stateError}</p>
              </div>
            ) : filteredStateOrders.length > 0 ? (
              <div className="space-y-6">
                {filteredStateOrders.map((bill, index) => {
                  // Additional safety check for each bill
                  if (!bill || typeof bill !== 'object') {
                    console.warn('Invalid bill data at index', index, bill);
                    return null;
                  }

                  const billId = getStateBillId(bill);
                  const isReviewed = reviewedBills.has(billId);

                  return (
                    <div key={bill.id || index} className={`bg-white rounded-lg shadow-sm border overflow-hidden transition-all duration-300 ${
                      isReviewed ? 'border-green-200 bg-green-50' : 'border-gray-200'
                    }`}>
                      {/* Bill Header */}
                      <div className="flex items-start justify-between px-6 pt-6 pb-3">
                        <div className="flex-1 pr-4">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            {index + 1}. {bill.title || 'Untitled Bill'}
                          </h3>
                          
                          {/* Bill Number and Dates */}
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mb-3">
                            {bill.bill_number && (
                              <>
                                <span className="font-semibold">Bill #{bill.bill_number}</span>
                                <span>-</span>
                              </>
                            )}
                            {bill.introduced_date && (
                              <>
                                <span className="font-semibold">Introduced:</span>
                                <span>
                                  {new Date(bill.introduced_date).toLocaleDateString('en-US', {
                                    month: 'numeric',
                                    day: 'numeric', 
                                    year: 'numeric'
                                  })}
                                </span>
                                <span>-</span>
                              </>
                            )}
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {bill.status || 'Unknown Status'}
                            </span>
                            <span>-</span>
                            <CategoryTag category={bill.category} />
                            <span>-</span>
                            <ReviewStatusTag isReviewed={isReviewed} />
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {/* Toggle Review Status Button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleToggleReviewStatus(bill);
                            }}
                            disabled={markingReviewed.has(billId)}
                            className={`p-2 rounded-md transition-all duration-300 ${
                              markingReviewed.has(billId)
                                ? 'text-gray-500 cursor-not-allowed'
                                : isReviewed
                                ? 'text-green-600 bg-green-100 hover:bg-green-200'
                                : 'text-gray-400 hover:bg-green-100 hover:text-green-600'
                            }`}
                            title={isReviewed ? "Mark as not reviewed" : "Mark as reviewed"}
                          >
                            {markingReviewed.has(billId) ? (
                              <div className="flex items-center">
                                <RefreshIcon size={16} className="animate-spin" />
                              </div>
                            ) : (
                              <Check size={16} className={isReviewed ? "text-green-600" : ""} />
                            )}
                          </button>

                          {/* Highlight button */}
                          <button
                            type="button"
                            className={`p-2 rounded-md transition-all duration-300 ${
                              isStateBillHighlighted(bill)
                                ? 'text-yellow-500 hover:bg-yellow-100'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-yellow-500'
                            }`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('🌟 Highlighting bill (clean click):', bill.title);
                              handleStateBillHighlight(bill);
                            }}
                            title={isStateBillHighlighted(bill) ? "Remove from highlights" : "Add to highlights"}
                          >
                            <Star 
                              size={16} 
                              className={isStateBillHighlighted(bill) ? "fill-current" : ""} 
                            />
                          </button>
                        </div>
                      </div>

                      {/* AI Summary */}
                      {bill.summary && bill.summary !== 'No AI summary available' && (
                        <div className="px-6 pb-4">
                          <div className="p-3 bg-violet-50 border border-violet-200 rounded-md">
                            <p className="text-sm font-medium text-violet-800 mb-2 flex items-center gap-2">
                              <span>AI Summary:</span>
                              <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                                ✦ AI Generated
                              </span>
                            </p>
                            <p className="text-sm text-violet-800 leading-relaxed">{bill.summary}</p>
                          </div>
                        </div>
                      )}

                      {/* Description */}
                      <div className="px-6 pb-4">
                        <p className="text-gray-700">{bill.description || 'No description available'}</p>
                      </div>

                      {/* Action Buttons */}
                      <div className="px-6 pb-6">
                        <div className="flex gap-2">
                          {bill.legiscan_url && (
                            <a
                              href={bill.legiscan_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-200 transition-all duration-300"
                            >
                              <ExternalLink size={16} />
                              <span>View on LegiScan</span>
                            </a>
                          )}
                          <button 
                            type="button"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-all duration-300"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              
                              // Create bill report
                              const billReport = [
                                bill.title,
                                'Bill #' + (bill.bill_number || 'N/A'),
                                'State: ' + (bill.state || 'N/A'),
                                'Status: ' + (bill.status || 'Unknown'),
                                'Category: ' + (bill.category || 'N/A'),
                                '',
                                bill.summary && bill.summary !== 'No AI summary available' ? 'AI Summary: ' + bill.summary : '',
                                bill.description ? 'Description: ' + bill.description : '',
                                bill.legiscan_url ? 'LegiScan URL: ' + bill.legiscan_url : ''
                              ].filter(line => line.length > 0).join('\n');
                              
                              // Try to copy to clipboard
                              if (copyToClipboard && typeof copyToClipboard === 'function') {
                                copyToClipboard(billReport);
                                console.log('✅ Copied bill report to clipboard');
                              } else if (navigator.clipboard) {
                                navigator.clipboard.writeText(billReport).catch(console.error);
                                console.log('✅ Copied bill report to clipboard (fallback)');
                              } else {
                                console.log('❌ Copy to clipboard not available');
                              }
                            }}
                          >
                            <Copy size={16} />
                            <span>Copy Details</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : hasData ? (
              <div className="text-center py-12">
                <Search size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Results Found</h3>
                <p className="text-gray-600 mb-4">
                  No bills match your current search criteria.
                </p>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300"
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Legislation Found</h3>
                <p className="text-gray-600 mb-4">
                  No legislation data is currently available for {stateName}. Use the fetch options above to get the latest bills by topic.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatePage;