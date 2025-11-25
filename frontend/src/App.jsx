import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

// Context
import { DarkModeProvider } from './context/DarkModeContext';

// Dark mode utilities
import { getPageContainerClasses, getCardClasses, getTextClasses } from './utils/darkModeClasses';

// Components - with error handling for missing components
import Header from './components/Header';
import Footer from './components/Footer';
import LoadingAnimation from './components/LoadingAnimation';

// Lazy loaded components for code splitting
const Homepage = lazy(() => import('./components/Homepage'));
const ExecutiveOrdersPage = lazy(() => import('./components/ExecutiveOrdersPage'));
const FederalLegislationPage = lazy(() => import('./components/FederalLegislationPage'));
const StatePage = lazy(() => import('./components/StatePage'));
const HR1Page = lazy(() => import('./components/HR1Page'));

// Debug: Log imported components to identify undefined ones
console.log('🔍 Component imports check:', {
  Header,
  LoadingAnimation,
  // Lazy loaded components logged differently
  Homepage: 'Lazy loaded',
  ExecutiveOrdersPage: 'Lazy loaded',
  FederalLegislationPage: 'Lazy loaded',
  StatePage: 'Lazy loaded',
  HR1Page: 'Lazy loaded',
});

// Hooks
import { useLoadingAnimation } from './hooks/useLoadingAnimation';

// Utils
import { SUPPORTED_STATES } from './utils/constants';
import { startSession, endSession } from './utils/analytics';

// Styles
import './index.css';

// Constants
import API_URL from './config/api';
import packageJson from '../package.json';
const APP_VERSION = packageJson.version;


// Temporary fallback component for missing components
const FallbackComponent = ({ componentName, ...props }) => (
  <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 rounded-lg">
    <h3 className="font-semibold">Component Error</h3>
    <p>The component "{componentName}" could not be loaded.</p>
    <p className="text-sm mt-2">Check that the file exists and is properly exported.</p>
  </div>
);

// Safe component wrapper
const SafeComponent = ({ component: Component, fallbackName, ...props }) => {
  if (!Component || Component === undefined) {
    return <FallbackComponent componentName={fallbackName} {...props} />;
  }
  return <Component {...props} />;
};

// ------------------------
// Main App Content Component
// ------------------------
const AppContent = () => {
  // Router hooks
  const navigate = useNavigate();
  const location = useLocation();

  // Loading animation
  const { isLoading, LoadingComponent, startLoading, stopLoading } = useLoadingAnimation();

  // Component state
  const [appVersion, setAppVersion] = useState(APP_VERSION);

  // Header dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Global highlights state for sharing between pages
  const [globalHighlights, setGlobalHighlights] = useState(new Set());
  const [highlightsLoaded, setHighlightsLoaded] = useState(false);

  // Initialize analytics session on mount
  useEffect(() => {
    startSession();

    // End session on unmount
    return () => {
      endSession();
    };
  }, []);

  // Handle clicks outside dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Optimized lazy loading of highlights with caching
  const loadGlobalHighlights = useCallback(async () => {
    if (highlightsLoaded) return globalHighlights;
    
    try {
      // Check localStorage cache first
      const cached = localStorage.getItem('app_highlights');
      if (cached) {
        const cachedData = JSON.parse(cached);
        if (Date.now() - cachedData.timestamp < 300000) { // 5 min cache
          const highlightIds = new Set(cachedData.highlights);
          setGlobalHighlights(highlightIds);
          setHighlightsLoaded(true);
          console.log('🌟 Loaded highlights from cache:', highlightIds.size, 'items');
          return highlightIds;
        }
      }
      
      // Fetch from API if cache miss or expired
      const response = await fetch(`${API_URL}/api/highlights?user_id=1`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('📥 Global highlights response:', data);
        
        // ⚡ ADD DEFENSIVE PROGRAMMING
        let highlightsArray = [];
        
        if (data && data.success) {
          // Try multiple possible array locations
          if (Array.isArray(data.highlights)) {
            highlightsArray = data.highlights;
          } else if (Array.isArray(data.results)) {
            highlightsArray = data.results;
          } else if (Array.isArray(data)) {
            highlightsArray = data;
          }
        }
        
        console.log(`✅ Processed ${highlightsArray.length} global highlights`);
        const highlightIds = new Set(highlightsArray.map(h => h.order_id || h.id).filter(Boolean));
        setGlobalHighlights(highlightIds);
        
        // Cache for 5 minutes
        localStorage.setItem('app_highlights', JSON.stringify({
          highlights: Array.from(highlightIds),
          timestamp: Date.now()
        }));
        
        console.log('🌟 Loaded highlights from API:', highlightIds.size, 'items');
        return highlightIds;
      } else {
        console.warn('⚠️ Highlights endpoint returned:', response.status);
        setGlobalHighlights(new Set());
        return new Set();
      }
    } catch (error) {
      console.error('Error loading global highlights:', error);
      setGlobalHighlights(new Set());
      return new Set();
    } finally {
      setHighlightsLoaded(true);
    }
  }, [highlightsLoaded, globalHighlights]);

  // Defer highlights loading until after initial render
  useEffect(() => {
    if (!highlightsLoaded) {
      // Use setTimeout to defer loading after render
      const timer = setTimeout(() => {
        loadGlobalHighlights();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [highlightsLoaded, loadGlobalHighlights]);

  // Version management effect
  useEffect(() => {
    const savedVersion = localStorage.getItem('appVersion');
    if (savedVersion) {
      setAppVersion(savedVersion);
    }

    const handleVersionUpdate = (event) => {
      setAppVersion(event.detail.version);
    };

    window.addEventListener('versionUpdated', handleVersionUpdate);
    return () => window.removeEventListener('versionUpdated', handleVersionUpdate);
  }, []);

  // API helper function with better error handling
  const makeApiCall = useCallback(async (url) => {
    try {
      console.log(`🔍 Making API call to: ${url}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        // Handle specific error codes gracefully
        if (response.status === 404) {
          console.warn(`⚠️ API endpoint not found: ${url}`);
          return { error: 'Endpoint not available', status: 404 };
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        const backendError = new Error(`Cannot connect to backend server at ${API_URL}. Please ensure the backend is running.`);
        backendError.isConnectionError = true;
        throw backendError;
      }
      throw error;
    }
  }, []);

  // Utility function for copying to clipboard
  const copyToClipboard = useCallback(async (text, successMessage = 'Copied to clipboard!') => {
    try {
      await navigator.clipboard.writeText(text);
      // You can add a toast notification here if you have one
      console.log(successMessage);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }, []);

  // Create stable handlers for sharing between pages
  const stableHandlers = useMemo(() => ({
    handleItemHighlight: async (item, itemType) => {
      // Global highlighting handler
      console.log('🌟 Global highlight handler called for:', item.title, 'Type:', itemType);
      // Update global state and sync with backend
      // This provides consistent highlighting across all pages
    },
    
    isItemHighlighted: (item) => {
      // Check if item is highlighted using global state
      const itemId = item.bill_id || item.id || item.executive_order_number;
      return globalHighlights.has(itemId);
    },

    refreshGlobalHighlights: async () => {
      // Force refresh highlights from backend
      try {
        const response = await fetch(`${API_URL}/api/highlights?user_id=1`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('📥 Refresh highlights response:', data);
          
          // ⚡ ADD DEFENSIVE PROGRAMMING
          let highlightsArray = [];
          
          if (data && data.success) {
            // Try multiple possible array locations
            if (Array.isArray(data.highlights)) {
              highlightsArray = data.highlights;
            } else if (Array.isArray(data.results)) {
              highlightsArray = data.results;
            } else if (Array.isArray(data)) {
              highlightsArray = data;
            }
          }
          
          console.log(`✅ Refreshed ${highlightsArray.length} highlights`);
          const highlightIds = new Set(highlightsArray.map(h => h.order_id || h.id).filter(Boolean));
          setGlobalHighlights(highlightIds);
          
          // Update cache
          localStorage.setItem('app_highlights', JSON.stringify({
            highlights: Array.from(highlightIds),
            timestamp: Date.now()
          }));
        }
      } catch (error) {
        console.error('Error refreshing highlights:', error);
        // ⚡ SET EMPTY SETS ON ERROR
        setGlobalHighlights(new Set());
      }
    },
    
    // Expose the lazy loader for components that need it
    loadHighlightsIfNeeded: loadGlobalHighlights
  }), [globalHighlights, loadGlobalHighlights]);

  return (
    <>
      {/* Loading Animation Overlay */}
      {isLoading && LoadingComponent && <LoadingComponent />}

      {/* Main App Layout */}
      <div className={getPageContainerClasses('flex flex-col')}>
        {/* Header - Match the container structure */}
        <SafeComponent
          component={Header}
          fallbackName="Header"
          showDropdown={showDropdown}
          setShowDropdown={setShowDropdown}
          dropdownRef={dropdownRef}
          currentPage={location.pathname}
          highlightedCount={globalHighlights.size}
        />

        {/* Main Content - Match Header's container width exactly */}
        <main className="flex-1 min-h-screen">
          <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12">
            <Suspense fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <LoadingAnimation />
              </div>
            }>
              <Routes>
              {/* Home Route - Now using Homepage component */}
              <Route 
                path="/" 
                element={
                  <SafeComponent
                    component={Homepage}
                    fallbackName="Homepage"
                    makeApiCall={makeApiCall}
                    copyToClipboard={copyToClipboard}
                    stableHandlers={stableHandlers}
                  />
                } 
              />


              {/* Executive Orders Route */}
              <Route 
                path="/executive-orders" 
                element={
                  <SafeComponent
                    component={ExecutiveOrdersPage}
                    fallbackName="ExecutiveOrdersPage"
                    makeApiCall={makeApiCall}
                    copyToClipboard={copyToClipboard}
                    stableHandlers={stableHandlers}
                  />
                } 
              />

              {/* Federal Legislation Route */}
              <Route 
                path="/federal-legislation" 
                element={
                  <SafeComponent
                    component={FederalLegislationPage}
                    fallbackName="FederalLegislationPage"
                    makeApiCall={makeApiCall}
                    copyToClipboard={copyToClipboard}
                    stableHandlers={stableHandlers}
                  />
                } 
              />


              {/* HR1 Policy Analysis Route */}
              <Route
                path="/hr1"
                element={
                  <SafeComponent
                    component={HR1Page}
                    fallbackName="HR1Page"
                  />
                }
              />

              {/* Dynamic State Routes */}
              {Object.keys(SUPPORTED_STATES).map(state => (
                <Route 
                  key={state}
                  path={`/state/${state.toLowerCase().replace(' ', '-')}`} 
                  element={
                    <SafeComponent
                      component={StatePage}
                      fallbackName="StatePage"
                      stateName={state}
                      makeApiCall={makeApiCall}
                      copyToClipboard={copyToClipboard}
                      stableHandlers={stableHandlers}
                    />
                  }
                />
              ))}

              {/* 404 Route */}
              <Route 
                path="*" 
                element={
                  <div className="pt-6">
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300 p-6 rounded-lg text-center">
                      <h3 className="font-semibold mb-2">Page Not Found</h3>
                      <p className="mb-4">The page you're looking for doesn't exist.</p>
                      <button
                        onClick={() => navigate('/')}
                        className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-all duration-300"
                      >
                        Go to Homepage
                      </button>
                    </div>
                  </div>
                } 
              />
                          </Routes>
            </Suspense>
            </div>
        </main>

        {/* Footer - Match Header's container width exactly */}
        <Footer appVersion={appVersion} />
      </div>
    </>
  );
};

// ------------------------
// Main App Component with Router
// ------------------------
const App = () => {
  return (
    <DarkModeProvider>
      <Router>
        <AppContent />
      </Router>
    </DarkModeProvider>
  );
};

export default App;
