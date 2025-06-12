import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

import { DebugDashboard, MockDebugEndpoints } from './components/DebugDashboard';
import { useAuth } from './context/AuthContext';
import AzureADLoginModal from './components/AzureADLoginModal';
import AuthRedirect from './components/AuthRedirect';

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

import {
    Building,
    GraduationCap,
    Heart,
    Wrench,
    X as XIcon,
    ScrollText,
    Search,
    RotateCw as RefreshIcon,
    Settings,
    FileText,
    Trash2,
    ChevronDown,
    Download,
    ExternalLink,
    Copy,
    Menu as HamburgerIcon,
    Star,
    Home,
    Info,
    Book,
    Database,
    Globe,
    Zap,
    Shield,
    Users,
    ChevronRight,
    Play,
    BarChart3,
    Mail,
    MessageCircle,
    Phone,
    HelpCircle,
    Monitor,
    BookOpen,
    Map as MapIcon,
    RefreshCw,
    CheckCircle,
    XCircle,
    AlertCircle,
    Clock,
    LogIn,
    LogOut,
    User
} from 'lucide-react';

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
    // ---- React Router hooks ----
    const navigate = useNavigate();
    const location = useLocation();

    // ---- Loading Animation Hook ----
    const { isLoading, LoadingComponent, startLoading, stopLoading } = useLoadingAnimation();
 
    // ✅ FIXED: Better auth context usage
    const { isAuthenticated, currentUser, logout, loading: authLoading } = useAuth();

    // ✅ FIXED: State for login modal with better logic
    const [showLoginModal, setShowLoginModal] = useState(false);

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
    const [appVersion, setAppVersion] = useState('1.0.0');
    const [loadingType, setLoadingType] = useState('default');

    // ---- Federal Date Range State ----
    const [federalDateRange, setFederalDateRange] = useState({
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    // ---- Refs ----
    const dropdownRef = useRef(null);
    const filterDropdownRef = useRef(null);

    // ✅ FIXED: Better authentication check with proper loading handling
    useEffect(() => {
        console.log('🔍 Auth state changed:', { isAuthenticated, authLoading, currentUser: !!currentUser });

        // Only show login modal if:
        // 1. Not currently loading authentication
        // 2. User is not authenticated
        // 3. Modal is not already showing
        if (!authLoading && !isAuthenticated && !showLoginModal) {
            console.log('🔐 Showing login modal');
            setShowLoginModal(true);
        } else if (!authLoading && isAuthenticated && showLoginModal) {
            console.log('✅ User authenticated, hiding login modal');
            setShowLoginModal(false);
        }
    }, [isAuthenticated, authLoading, showLoginModal]);
 
    // ✅ FIXED: Handle login modal close with proper state management
    const handleLoginModalClose = () => {
        console.log('🔐 Login modal close requested');
        // Only allow closing if user is authenticated
        if (isAuthenticated) {
            console.log('✅ User is authenticated, closing modal');
            setShowLoginModal(false);
        } else {
            console.log('❌ User not authenticated, keeping modal open');
            // Don't close the modal if user is not authenticated
        }
    };
 
    // ✅ FIXED: Handle login success
    const handleLoginSuccess = () => {
        console.log('✅ Login successful, closing modal');
        setShowLoginModal(false);
    };

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
    // Data Fetching - UPDATED WITH DEBUG LOGGING
    // ------------------------
    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        
        try {
            const url = `${API_URL}/api/executive-orders?page=${paginationPage}&per_page=${itemsPerPage}`;
            console.log('🔍 Fetching executive orders from:', url);
            const data = await makeApiCall(url);
            console.log('📊 Received data:', data);
            
            if (data && data.results) {
                console.log(`✅ Setting ${data.results.length} orders`);
                setOrders(data.results);
                setTotalPages(data.total_pages || 1);
            } else {
                console.warn('⚠️ No results in response:', data);
                setOrders([]);
                setTotalPages(1);
            }
            
        } catch (error) {
            console.error('❌ Error fetching executive orders:', error);
            setError(error.message);
            setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [paginationPage, itemsPerPage, makeApiCall]);

    // ADDED: Auto-fetch on mount
    useEffect(() => {
        console.log('🚀 App mounted, calling fetchData for executive orders');
        fetchData();
    }, []); // Run once on mount

    // ADDED: Debug logging for orders state changes
    useEffect(() => {
        console.log('📊 Orders state changed:', {
            ordersLength: orders.length,
            firstOrder: orders[0]?.title || 'No orders',
            loading,
            error
        });
    }, [orders, loading, error]);

    // ------------------------
    // Highlighted Orders Management
    // ------------------------
    const highlightedOrders = useMemo(() => {
        if (!highlightedItems || highlightedItems.size === 0) return [];
 
        return Array.from(highlightedItems)
            .map(id => orders.find(o => getOrderId(o) === id))
            .filter(Boolean);
    }, [highlightedItems, orders]);

    // ------------------------
    // Filtered Orders
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
    // Filtered Highlighted Orders
    // ------------------------
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
    // Download Text File Helper
    // ------------------------
    const downloadTextFile = useCallback((content, filename) => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, []);

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
    // Stable Handlers - UPDATED WITH MISSING HANDLERS
    // ------------------------
    const stableHandlers = useMemo(() => ({
        toggleHighlight: (order) => {
            const orderId = getOrderId(order);
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
                    const currentPath = location.pathname;
                    let source = 'executive-orders';
                    if (currentPath.includes('/state/')) {
                        source = 'state-legislation';
                    }
                    setHighlightSources(prevSources => {
                        const newSources = new Map(prevSources);
                        newSources.set(orderId, source);
                        return newSources;
                    });
                }
                return newSet;
            });
        },
        setPaginationPage,
        
        // ADDED: Missing page change handler
        handlePageChange: (newPage) => {
            console.log('📄 Changing to page:', newPage);
            setPaginationPage(newPage);
        },
        
        toggleExpanded: (orderId) => {
            setExpandedOrderId(prev => prev === orderId ? null : orderId);
        },
        
        // ADDED: Missing expand order handler
        handleExpandOrder: (order) => {
            const orderId = getOrderId(order);
            console.log('🔽 Toggling expansion for order:', orderId);
            setExpandedOrderId(prev => prev === orderId ? null : orderId);
        },
        
        isExpanded: (orderId) => expandedOrderId === orderId,
        
        // ADDED: Missing order expanded checker
        isOrderExpanded: (order) => {
            const orderId = getOrderId(order);
            return expandedOrderId === orderId;
        },
        
        isHighlighted: (orderId) => highlightedItems.has(orderId),
        
        // ADDED: Missing item highlighted checker
        isItemHighlighted: (order) => {
            const orderId = getOrderId(order);
            return highlightedItems.has(orderId);
        },
        
        // ADDED: Missing item highlight handler
        handleItemHighlight: (order, sourcePage = 'executive-orders') => {
            console.log('⭐ Toggling highlight for:', getOrderId(order));
            const orderId = getOrderId(order);
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
                        newSources.set(orderId, sourcePage);
                        return newSources;
                    });
                }
                return newSet;
            });
        }
    }), [highlightedItems, expandedOrderId, location.pathname]);

    // ------------------------
    // Highlights Handlers
    // ------------------------
    const highlightsHandlers = useMemo(() => ({
        toggleExpanded: (orderId) => {
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
        isExpanded: (orderId) => highlightsExpandedItems.has(orderId),
    }), [highlightsExpandedItems]);

    // Show loading while checking authentication
    if (authLoading) {
        return (
            <div className="fixed inset-0 bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <h2 className="text-xl font-bold mb-2">Loading...</h2>
                    <p className="text-gray-600">Checking authentication status...</p>
                </div>
            </div>
        );
    }

    // ------------------------
    // MAIN ROUTES RENDER
    // ------------------------
    return (
        <>
            {/* Loading Animation Overlay */}
            {isLoading && (
                <LoadingAnimation type={loadingType} onComplete={stopLoading} />
            )}

            {/* Azure AD Login Modal */}
            <AzureADLoginModal
                isOpen={showLoginModal}
                onClose={handleLoginModalClose}
                onLoginSuccess={handleLoginSuccess}
            />
      
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <Header
                    showDropdown={showDropdown}
                    setShowDropdown={setShowDropdown}
                    dropdownRef={dropdownRef}
                    currentPage={location.pathname.substring(1).split('/')[0] || 'highlights'}
                    isAuthenticated={isAuthenticated}
                    currentUser={currentUser}
                    onLogout={logout}
                    onLogin={() => setShowLoginModal(true)}
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
                            <>
                                {console.log('🔍 Rendering ExecutiveOrdersPage with:', {
                                    ordersCount: orders.length,
                                    loading,
                                    error,
                                    filteredOrdersCount: filteredOrders.length
                                })}
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
                            </>
                        } />
            
                        <Route path="/auth/redirect" element={<AuthRedirect />} />

                        <Route path="/settings" element={
                            <SettingsPage
                                federalDateRange={federalDateRange}
                                setFederalDateRange={setFederalDateRange}
                                makeApiCall={makeApiCall}
                                appVersion={appVersion}
                                setAppVersion={setAppVersion}
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
                            © 2025 Built with ❤️ by MOREgroup Development. All rights reserved. LegislationVUE v{appVersion}
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