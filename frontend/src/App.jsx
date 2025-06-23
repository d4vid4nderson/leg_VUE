import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

// Context
import { useAuth } from './context/AuthContext';

// Components - with error handling for missing components
import Header from './components/Header';
import HighlightsPage from './components/HighlightsPage';
import ExecutiveOrdersPage from './components/ExecutiveOrdersPage';
import StatePage from './components/StatePage';
import SettingsPage from './components/SettingsPage';
import LoadingAnimation from './components/LoadingAnimation';
import AzureADLoginModal from './components/AzureADLoginModal';
import AuthRedirect from './components/AuthRedirect';

// Debug: Log imported components to identify undefined ones
console.log('🔍 Component imports check:', {
  Header,
  HighlightsPage,
  ExecutiveOrdersPage,
  StatePage,
  SettingsPage,
  LoadingAnimation,
  AzureADLoginModal,
  AuthRedirect,
});

// Hooks
import { useLoadingAnimation } from './hooks/useLoadingAnimation';

// Utils
import { SUPPORTED_STATES } from './utils/constants';

// Styles
import './index.css';

// Constants
import API_URL from './config/api';

const APP_VERSION = '2.1.0';

// Temporary fallback component for missing components
const FallbackComponent = ({ componentName, ...props }) => (
  <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg">
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

  // Auth context
  const { isAuthenticated, currentUser, logout, loading: authLoading } = useAuth();

  // Loading animation
  const { isLoading, LoadingComponent, startLoading, stopLoading } = useLoadingAnimation();

  // Component state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [appVersion, setAppVersion] = useState(APP_VERSION);
  
  // Header dropdown state
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Global highlights state for sharing between pages
  const [globalHighlights, setGlobalHighlights] = useState(new Set());

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

  // Load global highlights on startup
  useEffect(() => {
    const loadGlobalHighlights = async () => {
      try {
        // Use the same endpoint that HighlightsPage uses for consistency
        const response = await fetch(`${API_URL}/api/highlights?user_id=1`);
        
        if (response.ok) {
          const highlights = await response.json();
          const highlightIds = new Set(highlights.map(h => h.order_id || h.id));
          setGlobalHighlights(highlightIds);
          console.log('🌟 Loaded global highlights:', highlightIds.size, 'items');
        } else {
          console.warn('⚠️ Highlights endpoint returned:', response.status);
          setGlobalHighlights(new Set());
        }
      } catch (error) {
        console.error('Error loading global highlights:', error);
        setGlobalHighlights(new Set());
      }
    };
    
    if (isAuthenticated) {
      loadGlobalHighlights();
    }
  }, [isAuthenticated]);

  // Auth effect - show/hide login modal based on auth state
  useEffect(() => {
    if (!authLoading && !isAuthenticated && !showLoginModal) {
      console.log('🔐 Showing login modal');
      setShowLoginModal(true);
    } else if (!authLoading && isAuthenticated && showLoginModal) {
      console.log('✅ User authenticated, hiding login modal');
      setShowLoginModal(false);
    }
  }, [isAuthenticated, authLoading, showLoginModal]);

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

  // Login modal handlers
  const handleLoginModalClose = () => {
    if (isAuthenticated) {
      console.log('✅ User is authenticated, closing modal');
      setShowLoginModal(false);
    } else {
      console.log('❌ User not authenticated, keeping modal open');
    }
  };

  const handleLoginSuccess = () => {
    console.log('✅ Login successful, closing modal');
    setShowLoginModal(false);
  };

  // Auth handlers for Header
  const handleLogin = () => {
    setShowLoginModal(true);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

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
      // Refresh highlights from backend using same endpoint as HighlightsPage
      try {
        const response = await fetch(`${API_URL}/api/highlights?user_id=1`);
        
        if (response.ok) {
          const highlights = await response.json();
          const highlightIds = new Set(highlights.map(h => h.order_id || h.id));
          setGlobalHighlights(highlightIds);
        }
      } catch (error) {
        console.error('Error refreshing highlights:', error);
      }
    }
  }), [globalHighlights]);

  // Show loading during auth check
  if (authLoading) {
    return LoadingComponent ? <LoadingComponent /> : <div>Loading...</div>;
  }

  return (
    <>
      {/* Loading Animation Overlay */}
      {isLoading && LoadingComponent && <LoadingComponent />}

      {/* Login Modal */}
      {showLoginModal && AzureADLoginModal && (
        <AzureADLoginModal
          isOpen={showLoginModal}
          onClose={handleLoginModalClose}
          onLoginSuccess={handleLoginSuccess}
        />
      )}

      {/* Main App Layout */}
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header - Match the container structure */}
        <SafeComponent 
          component={Header}
          fallbackName="Header"
          showDropdown={showDropdown}
          setShowDropdown={setShowDropdown}
          dropdownRef={dropdownRef}
          currentPage={location.pathname}
          isAuthenticated={isAuthenticated}
          currentUser={currentUser}
          onLogout={handleLogout}
          onLogin={handleLogin}
          highlightedCount={globalHighlights.size}
        />

        {/* Main Content - Match Header's container width exactly */}
        <main className="flex-1">
          <div className="container mx-auto px-4 sm:px-6 lg:px-12 py-6">
            <Routes>
              {/* Home/Highlights Route */}
              <Route 
                path="/" 
                element={
                  <SafeComponent
                    component={HighlightsPage}
                    fallbackName="HighlightsPage"
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

              {/* Settings Route */}
              <Route 
                path="/settings" 
                element={
                  <SafeComponent
                    component={SettingsPage}
                    fallbackName="SettingsPage"
                    makeApiCall={makeApiCall}
                    appVersion={appVersion}
                    setAppVersion={setAppVersion}
                  />
                } 
              />

              {/* Auth Redirect Route */}
              <Route 
                path="/auth/redirect" 
                element={
                  <SafeComponent
                    component={AuthRedirect}
                    fallbackName="AuthRedirect"
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
                } 
              />
                          </Routes>
            </div>
        </main>

        {/* Footer - Match Header's container width exactly */}
        <footer className="bg-gray-50 border-t border-gray-200 py-8 mt-auto">
          <div className="container mx-auto px-4 sm:px-6 lg:px-12">
            <div className="text-center text-sm text-gray-600">
              © 2025 Built with ❤️ by MOREgroup Development. All rights reserved. 
              <span className="ml-2">LegislationVUE v{appVersion}</span>
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
const App = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;
