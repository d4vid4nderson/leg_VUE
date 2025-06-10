// Main App.jsx - Cleaned up and modular
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// React Router
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation
} from "react-router-dom";

// Components
import Header from './components/Header';
import HighlightsPage from './components/HighlightsPage';
import ExecutiveOrdersPage from './components/ExecutiveOrdersPage';
import StatePage from './components/StatePage';
import SettingsPage from './components/SettingsPage';
import LoadingAnimation from './components/LoadingAnimation';

// Hooks
import { useLoadingAnimation } from './hooks/useLoadingAnimation';

// Utils
import {
  getApiUrl,
  getOrderId,
  getExecutiveOrderNumber,
  stripHtmlTags,
  formatContent,
  formatContentForCopy,
  createFormattedReport,
  getFederalRegisterUrl
} from './utils/helpers';

// Constants
import { FILTERS, filterStyles, SUPPORTED_STATES } from './utils/constants';

// Styles
import './index.css';


// API URL
const API_URL = getApiUrl();

// ------------------------
// Main App Content Component
// ------------------------
const AppContent = () => {
  // ---- Version Management State ----
  const [appVersion, setAppVersion] = useState('1.0.1');

  // ---- Loading Animation Hook ----
  const { isLoading, loadingType, startLoading, stopLoading } = useLoadingAnimation();

  // ---- State management ----
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [highlightedItems, setHighlightedItems] = useState(new Set());
  const [highlightsExpandedItems, setHighlightsExpandedItems] = useState(new Set());
  const [activeHighlightsFilters, setActiveHighlightsFilters] = useState(new Set());
  const [paginationPage, setPaginationPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage] = useState(25);

  const [federalDateRange, setFederalDateRange] = useState({
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 20000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  
  const dropdownRef = useRef(null);
  const filterDropdownRef = useRef(null);

  // React Router hooks
  const navigate = useNavigate();
  const location = useLocation();

  // ---- Version Management Effect ----
  useEffect(() => {
    // Load initial version from localStorage
    const savedVersion = localStorage.getItem('appVersion');
    if (savedVersion) {
      setAppVersion(savedVersion);
    }

    // Listen for version updates from Settings page
    const handleVersionUpdate = (event) => {
      setAppVersion(event.detail.version);
    };

    window.addEventListener('versionUpdated', handleVersionUpdate);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('versionUpdated', handleVersionUpdate);
    };
  }, []);

  // ------------------------
  // API Helper
  // ------------------------
  const makeApiCall = useCallback(async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Cannot connect to backend server at ${API_URL}. Make sure the backend is running.`);
      }
      throw error;
    }
  }, []);

  // ------------------------
  // Highlight Sources Management
  // ------------------------
  const [highlightSources, setHighlightSources] = useState(new Map());
  
  const getHighlightSource = (order) => {
    const orderId = getOrderId(order);
    const source = highlightSources.get(orderId);
    switch(source) {
      case 'executive-orders':
        return { label: 'Executive Orders', icon: 'ScrollText', color: 'text-purple-700' };
      case 'state-legislation':
        return { label: 'State Legislation', icon: 'FileText', color: 'text-indigo-700' };
      default:
        return { label: 'Unknown Source', icon: 'ScrollText', color: 'text-gray-700' };
    }
  };

  // ------------------------
  // Highlights Handlers
  // ------------------------
  const highlightsHandlers = useMemo(() => ({
    handleExpandOrder: (order) => {
      const orderId = getOrderId(order);
      setHighlightsExpandedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(orderId)) {
          newSet.delete(orderId);
        } else {
          newSet.add(orderId);
        }
        return newSet;
      });
    },
    isOrderExpanded: (order) => {
      const orderId = getOrderId(order);
      return highlightsExpandedItems.has(orderId);
    }
  }), [highlightsExpandedItems]);

  // ------------------------
  // Highlights Filter Helpers
  // ------------------------
  const highlightsFilterHelpers = useMemo(() => ({
    toggleFilter: (filterKey) => {
      setActiveHighlightsFilters(prev => {
        const newFilters = new Set(prev);
        if (newFilters.has(filterKey)) {
          newFilters.delete(filterKey);
        } else {
          newFilters.add(filterKey);
        }
        return newFilters;
      });
    },
    clearAllFilters: () => setActiveHighlightsFilters(new Set()),
    hasActiveFilters: () => activeHighlightsFilters.size > 0,
  }), [activeHighlightsFilters]);

  // ------------------------
  // Stable Handlers
  // ------------------------
  const stableHandlers = useMemo(() => ({
    handleOrderSelection: (orderNumber) => {
      setSelectedOrders(prev => {
        const newSet = new Set(prev);
        if (newSet.has(orderNumber)) {
          newSet.delete(orderNumber);
        } else {
          newSet.add(orderNumber);
        }
        return newSet;
      });
    },
    
    handlePageChange: (newPage) => {
      if (newPage < 1 || (totalPages && newPage > totalPages) || loading) return;
      setPaginationPage(newPage);
      setExpandedOrderId(null);
    },
    
    handleExpandOrder: (order) => {
      const orderId = getOrderId(order);
      setExpandedOrderId(prev => prev === orderId ? null : orderId);
    },
    
    handleItemHighlight: (order, sourcePage = null) => {
      const orderId = getOrderId(order);
      if (!orderId) return;
      
      setHighlightedItems(prev => {
        const newSet = new Set(prev);
        if (newSet.has(orderId)) {
          newSet.delete(orderId);
          setHighlightSources(prevSources => {
            const newSources = new Map(prevSources);
            newSources.delete(orderId);
            return newSources;
          });
        } else {
          newSet.add(orderId);
          setHighlightSources(prevSources => {
            const newSources = new Map(prevSources);
            let source = sourcePage;
            if (!source) {
              if (location.pathname === '/executive-orders') {
                source = 'executive-orders';
              } else if (Object.keys(SUPPORTED_STATES).some(state => 
                location.pathname === `/state/${state.toLowerCase().replace(' ', '-')}`
              )) {
                source = 'state-legislation';
              } else {
                source = 'executive-orders';
              }
            }
            newSources.set(orderId, source);
            return newSources;
          });
        }
        return newSet;
      });
    },
    
    isItemHighlighted: (order) => {
      const orderId = getOrderId(order);
      return !!orderId && highlightedItems.has(orderId);
    },
    
    isOrderExpanded: (order) => {
      const orderId = getOrderId(order);
      return expandedOrderId === orderId;
    }
  }), [totalPages, loading, expandedOrderId, highlightedItems, location.pathname]);

  // ------------------------
  // Click Outside Effect
  // ------------------------
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // ------------------------
  // Data Fetching
  // ------------------------
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const url = `${API_URL}/api/executive-orders?page=${paginationPage}&per_page=${itemsPerPage}`;
      const data = await makeApiCall(url);
      setOrders(data.results || []);
      setTotalPages(data.total_pages || 1);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [paginationPage, itemsPerPage, makeApiCall]);

  // Fetch data on component mount and pagination change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ------------------------
  // Filtering Logic
  // ------------------------
  const filteredOrders = useMemo(() => {
    let filtered = orders;
    
    // Apply category filter
    if (activeFilter) {
      filtered = filtered.filter(order => order.category === activeFilter);
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(order => {
        const title = (order.title || '').toLowerCase();
        const summary = stripHtmlTags(order.ai_summary || '').toLowerCase();
        const abstract = stripHtmlTags(order.abstract || '').toLowerCase();
        const orderNumber = (order.executive_order_number || '').toString();
        
        return title.includes(search) || 
               summary.includes(search) || 
               abstract.includes(search) || 
               orderNumber.includes(search);
      });
    }
    
    return filtered;
  }, [orders, activeFilter, searchTerm]);

  // ------------------------
  // Highlighted Orders Filtering
  // ------------------------
  const highlightedOrders = useMemo(() => {
    if (!highlightedItems || highlightedItems.size === 0) return [];
    
    return Array.from(highlightedItems)
      .map(id => orders.find(o => getOrderId(o) === id))
      .filter(Boolean);
  }, [highlightedItems, orders]);

  const filteredHighlightedOrders = useMemo(() => {
    let filtered = highlightedOrders;
    
    // Apply filters (both category and source filters)
    if (activeHighlightsFilters.size > 0) {
      filtered = filtered.filter(order => {
        const orderId = getOrderId(order);
        const source = highlightSources.get(orderId);
        
        // Check category filters
        const categoryMatch = order.category && activeHighlightsFilters.has(order.category);
        
        // Check source filters
        let sourceMatch = false;
        if (source === 'executive-orders' && activeHighlightsFilters.has('executive-orders')) {
          sourceMatch = true;
        } else if (source === 'state-legislation' && activeHighlightsFilters.has('state-legislation')) {
          sourceMatch = true;
        }
        
        return categoryMatch || sourceMatch;
      });
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(order => {
        const title = (order.title || '').toLowerCase();
        const summary = stripHtmlTags(order.ai_summary || '').toLowerCase();
        const abstract = stripHtmlTags(order.abstract || '').toLowerCase();
        const orderNumber = (order.executive_order_number || '').toString();
        
        return title.includes(search) || 
               summary.includes(search) || 
               abstract.includes(search) || 
               orderNumber.includes(search);
      });
    }
    
    return filtered;
  }, [highlightedOrders, activeHighlightsFilters, searchTerm, highlightSources]);

  // ------------------------
  // Copy to Clipboard Helper
  // ------------------------
  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      console.log('Copied to clipboard');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        console.log('Copied to clipboard (fallback)');
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
      }
      document.body.removeChild(textArea);
    }
  }, []);

  // ------------------------
  // Download Helper
  // ------------------------
  const downloadTextFile = useCallback((content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // ------------------------
  // MAIN ROUTES RENDER
  // ------------------------
  return (
    <>
      {/* Loading Animation Overlay */}
      {isLoading && (
        <LoadingAnimation type={loadingType} onComplete={stopLoading} />
      )}
      
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header
          showDropdown={showDropdown}
          setShowDropdown={setShowDropdown}
          dropdownRef={dropdownRef}
          currentPage={location.pathname.substring(1).split('/')[0] || 'highlights'}
          highlightedCount={highlightedItems.size}
        />
        
        <div className="container mx-auto px-4 sm:px-6 lg:px-12 flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={
              <HighlightsPage
                highlightedOrders={highlightedOrders}
                filteredHighlightedOrders={filteredHighlightedOrders}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                highlightsFilterHelpers={highlightsFilterHelpers}
                highlightsHandlers={highlightsHandlers}
                stableHandlers={stableHandlers}
                getHighlightSource={getHighlightSource}
                createFormattedReport={createFormattedReport}
                formatContent={formatContent}
                stripHtmlTags={stripHtmlTags}
                activeHighlightsFilters={activeHighlightsFilters}
                copyToClipboard={copyToClipboard}
                downloadTextFile={downloadTextFile}
              />
            } />
            
            <Route path="/highlights" element={
              <HighlightsPage
                highlightedOrders={highlightedOrders}
                filteredHighlightedOrders={filteredHighlightedOrders}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                highlightsFilterHelpers={highlightsFilterHelpers}
                highlightsHandlers={highlightsHandlers}
                stableHandlers={stableHandlers}
                getHighlightSource={getHighlightSource}
                createFormattedReport={createFormattedReport}
                formatContent={formatContent}
                stripHtmlTags={stripHtmlTags}
                activeHighlightsFilters={activeHighlightsFilters}
                copyToClipboard={copyToClipboard}
                downloadTextFile={downloadTextFile}
              />
            } />
            
            <Route path="/executive-orders" element={
              <ExecutiveOrdersPage
                orders={orders}
                loading={loading}
                error={error}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                filteredOrders={filteredOrders}
                paginationPage={paginationPage}
                totalPages={totalPages}
                stableHandlers={stableHandlers}
                showFilterDropdown={showFilterDropdown}
                setShowFilterDropdown={setShowFilterDropdown}
                filterDropdownRef={filterDropdownRef}
                fetchData={fetchData}
                copyToClipboard={copyToClipboard}
                downloadTextFile={downloadTextFile}
                makeApiCall={makeApiCall}
              />
            } />
            
            <Route path="/settings" element={
            <SettingsPage
                federalDateRange={federalDateRange}
                setFederalDateRange={setFederalDateRange}
                makeApiCall={makeApiCall}
                appVersion={appVersion}          // ← Make sure this is here
                setAppVersion={setAppVersion}    // ← Make sure this is here
            />
            } />

            {/* Dynamic State Routes */}
            {Object.keys(SUPPORTED_STATES).map(state => (
              <Route 
                key={state}
                path={`/state/${state.toLowerCase().replace(' ', '-')}`} 
                element={
                  <StatePage 
                    stateName={state} 
                    stableHandlers={stableHandlers} 
                    copyToClipboard={copyToClipboard}
                    makeApiCall={makeApiCall}
                  />
                }
              />
            ))}
            
            {/* Catch-all route for 404 */}
            <Route path="*" element={
              <div className="pt-6">
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-6 rounded-lg text-center">
                  <h3 className="font-semibold mb-2">Page Not Found</h3>
                  <p className="mb-4">The page you're looking for doesn't exist.</p>
                  <button
                    onClick={() => navigate('/')}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300"
                  >
                    Go to Highlights
                  </button>
                </div>
              </div>
            } />
          </Routes>
        </div>
        
        {/* Footer */}
        <footer className="bg-gray-50 border-t border-gray-200 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center text-sm text-gray-600">
            © 2025 MOREgroup. All rights reserved. LegislationVue v{appVersion}
            </div>
        </div>
        </footer>
      </div>
    </>
  );
};

// ------------------------
// Main App Component with Router
// ------------------------
const App = () => (
  <Router>
    <AppContent />
  </Router>
);

export default App;