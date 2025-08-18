// StatePage.jsx - Updated with fetch button and sliding time period buttons

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    ChevronDown,
    FileText,
    Star,
    ExternalLink,
    Check,
    AlertTriangle,
    RotateCw as RefreshIcon,
    ChevronLeft,
    ChevronRight,
    ArrowUp,
    ArrowDown,
    ArrowUp as ArrowUpIcon,
    Calendar,
    CalendarDays,
    Hash,
    X,
    LayoutGrid,
    Users,
    Vote,
    Trophy,
    FileCheck
} from 'lucide-react';

import { FILTERS, SUPPORTED_STATES } from '../utils/constants';
import { stripHtmlTags } from '../utils/helpers';
import { calculateAllCounts } from '../utils/filterUtils';
import useReviewStatus from '../hooks/useReviewStatus';
import { usePageTracking } from '../hooks/usePageTracking';
import { trackPageView } from '../utils/analytics';
import BillCardSkeleton from '../components/BillCardSkeleton';
import BillProgressBar from '../components/BillProgressBar';
import SessionNotification from '../components/SessionNotification';
import SessionFilter from '../components/SessionFilter';
import StatusFilter from '../components/StatusFilter';
import API_URL from '../config/api';
import { getTextClasses, getPageContainerClasses, getCardClasses } from '../utils/darkModeClasses';

// Request cache to prevent duplicate API calls
const requestCache = new Map();
const CACHE_DURATION = 1000; // 1 second cache

// Utility function to add timeout to fetch requests
const fetchWithTimeout = async (url, options = {}, timeoutMs = 300000) => { // 5 minutes default
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeoutMs / 1000} seconds. Large datasets may take longer to process.`);
        }
        throw error;
    }
};

// Cached fetch to prevent duplicate requests
const cachedFetch = async (url, options = {}) => {
    const cacheKey = url + JSON.stringify(options);
    const now = Date.now();
    
    // Check if we have a recent cached response
    if (requestCache.has(cacheKey)) {
        const { timestamp, responseData } = requestCache.get(cacheKey);
        if (now - timestamp < CACHE_DURATION) {
            // Return a cloned response to avoid "body already consumed" error
            return new Response(JSON.stringify(responseData.data), {
                status: responseData.status,
                statusText: responseData.statusText,
                headers: responseData.headers
            });
        }
        requestCache.delete(cacheKey);
    }
    
    // Create new request
    const response = await fetchWithTimeout(url, options);
    
    // Only cache successful JSON responses
    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
        try {
            const clonedResponse = response.clone();
            const data = await clonedResponse.json();
            
            requestCache.set(cacheKey, {
                timestamp: now,
                responseData: {
                    data,
                    status: response.status,
                    statusText: response.statusText,
                    headers: Object.fromEntries(response.headers.entries())
                }
            });
            
            // Clean up cache entry after duration
            setTimeout(() => {
                requestCache.delete(cacheKey);
            }, CACHE_DURATION);
        } catch (error) {
            console.warn('Failed to cache response:', error);
        }
    }
    
    return response;
};
import { 
    getCurrentStatus, 
    mapLegiScanStatus, 
    getStatusDescription
} from '../utils/statusUtils';

// Pagination configuration
const ITEMS_PER_PAGE = 25;

// Bill status filter options
const STATUS_FILTERS = [
    {
        key: 'introduced',
        label: 'Introduced',
        icon: FileText,
        type: 'bill_status',
        description: 'Bills that have been introduced to the legislature'
    },
    {
        key: 'committee',
        label: 'Committee',
        icon: Users,
        type: 'bill_status',
        description: 'Bills in committee review'
    },
    {
        key: 'floor',
        label: 'Floor Vote',
        icon: Vote,
        type: 'bill_status',
        description: 'Bills in floor debate and voting'
    },
    {
        key: 'passed',
        label: 'Passed',
        icon: Trophy,
        type: 'bill_status',
        description: 'Bills that have passed one or both chambers'
    },
    {
        key: 'enacted',
        label: 'Enacted',
        icon: FileCheck,
        type: 'bill_status',
        description: 'Bills that have been signed into law'
    }
];

// Helper Functions
// Get status stage matching progress bar logic
const getStatusStage = (billStatus) => {
    if (!billStatus) return 'introduced';
    
    const statusLower = billStatus.toLowerCase();
    
    // Exact matches for our database status values
    if (statusLower === 'enrolled') {
        return 'enacted';  // Enrolled bills are ready to be enacted
    }
    
    if (statusLower === 'passed') {
        return 'passed';
    }
    
    if (statusLower === 'engrossed') {
        return 'floor';  // Engrossed bills are in floor process
    }
    
    if (statusLower === 'introduced' || statusLower === 'pending' || statusLower === 'vetoed') {
        return 'introduced';
    }
    
    // Enacted/Signed into law
    if (statusLower.includes('enacted') || 
        statusLower.includes('signed') || 
        statusLower.includes('law') ||
        statusLower.includes('approved by governor') ||
        statusLower.includes('chaptered')) {
        return 'enacted';
    }
    
    // Passed one chamber
    if (statusLower.includes('passed') || 
        statusLower.includes('enrolled') ||
        statusLower.includes('concurred') ||
        statusLower.includes('sent to governor')) {
        return 'passed';
    }
    
    // Floor action/voting
    if (statusLower.includes('floor') || 
        statusLower.includes('vote') || 
        statusLower.includes('reading') ||
        statusLower.includes('debate') ||
        statusLower.includes('amended') ||
        statusLower.includes('engrossed') ||
        statusLower.includes('calendar')) {
        return 'floor';
    }
    
    // Committee review
    if (statusLower.includes('committee') || 
        statusLower.includes('referred') ||
        statusLower.includes('hearing') ||
        statusLower.includes('markup') ||
        statusLower.includes('reported')) {
        return 'committee';
    }
    
    // Default to introduced
    return 'introduced';
};

const cleanCategory = (category) => {
    if (!category || typeof category !== 'string') return 'not-applicable';
    const trimmedCategory = category.trim().toLowerCase();
    
    if (trimmedCategory === 'unknown' || trimmedCategory === '') {
        return 'not-applicable';
    }
    
    const categoryMap = {
        'government': 'civic',
        'public policy': 'civic',
        'municipal': 'civic',
        'school': 'education',
        'university': 'education',
        'learning': 'education',
        'infrastructure': 'engineering',
        'technology': 'engineering',
        'construction': 'engineering',
        'medical': 'healthcare',
        'health': 'healthcare',
        'hospital': 'healthcare'
    };
    
    const mappedCategory = categoryMap[trimmedCategory] || trimmedCategory;
    const validCategories = FILTERS.map(f => f.key);
    validCategories.push('not-applicable');
    
    return validCategories.includes(mappedCategory) ? mappedCategory : 'not-applicable';
};

// Helper function to extract year from session string
const extractYearFromSession = (sessionString) => {
    if (!sessionString) return null;
    const yearMatch = sessionString.match(/(\d{4})/);
    return yearMatch ? parseInt(yearMatch[1]) : null;
};

const cleanBillTitle = (title) => {
    if (!title) return 'Untitled Bill';
    
    let cleaned = title
        .replace(/^\s*["'"']|["'"']\s*$/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    
    if (cleaned.length > 0) {
        cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    return cleaned || 'Untitled Bill';
};

// Custom Category Tag Component - Editable version
const EditableCategoryTag = ({ category, itemId, onCategoryChange, disabled }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(cleanCategory(category));
    const dropdownRef = useRef(null);
    
    const handleCategorySelect = async (newCategory) => {
        if (newCategory !== selectedCategory && onCategoryChange) {
            try {
                // Track category change
                trackPageView(`State Bill Category - ${newCategory}`, window.location.pathname);
                
                await onCategoryChange(itemId, newCategory);
                setSelectedCategory(newCategory);
            } catch (error) {
                console.error('Failed to update category:', error);
            }
        }
        setIsEditing(false);
    };
    
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsEditing(false);
            }
        };
        
        if (isEditing) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isEditing]);
    
    const cleanedCategory = cleanCategory(selectedCategory);
    const matchingFilter = FILTERS.find(filter => filter.key === cleanedCategory);
    const IconComponent = matchingFilter?.icon || AlertTriangle;
    
    const getCategoryStyle = (cat) => {
        switch (cat) {
            case 'civic': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700';
            case 'education': return 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700';
            case 'engineering': return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700';
            case 'healthcare': return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700';
            case 'all_practice_areas': return 'bg-teal-100 dark:bg-teal-900/20 text-teal-800 dark:text-teal-200 border-teal-200 dark:border-teal-700';
            default: return 'bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600';
        }
    };
    
    const getCategoryLabel = (cat) => {
        const matchingFilter = FILTERS.find(filter => filter.key === cat);
        return matchingFilter?.label || 'Not Applicable';
    };
    
    if (disabled) {
        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${getCategoryStyle(cleanedCategory)}`}>
                <IconComponent size={12} />
                {getCategoryLabel(cleanedCategory)}
            </span>
        );
    }
    
    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsEditing(!isEditing)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer hover:shadow-sm transition-all duration-200 ${getCategoryStyle(cleanedCategory)}`}
                title="Click to change category"
            >
                <IconComponent size={12} />
                {getCategoryLabel(cleanedCategory)}
                <ChevronDown size={10} className="ml-1" />
            </button>
            
            {isEditing && (
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[120] min-w-[160px] w-max">
                    <div className="py-1">
                        {FILTERS.map((filter) => {
                            const isSelected = filter.key === cleanedCategory;
                            return (
                                <button
                                    key={filter.key}
                                    onClick={() => handleCategorySelect(filter.key)}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2 ${
                                        isSelected ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-200'
                                    }`}
                                >
                                    <filter.icon size={12} />
                                    {filter.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};




// Pagination Component
const PaginationControls = ({ currentPage, totalPages, totalItems, itemsPerPage, onPageChange, itemType = 'bills' }) => {
    // Early return if no pagination needed
    if (totalPages <= 1) return null;
    
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 7;
        
        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            const startPage = Math.max(1, currentPage - 3);
            const endPage = Math.min(totalPages, currentPage + 3);
            
            if (startPage > 1) {
                pages.push(1);
                if (startPage > 2) pages.push('...');
            }
            
            for (let i = startPage; i <= endPage; i++) {
                pages.push(i);
            }
            
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) pages.push('...');
                pages.push(totalPages);
            }
        }
        
        return pages;
    };
    
    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-4 bg-gray-50 dark:bg-dark-bg-tertiary border-t border-gray-200 dark:border-dark-border">
            <div className="text-xs sm:text-sm text-gray-700 dark:text-dark-text text-center sm:text-left">
                Showing <span className="font-medium">{startItem}</span> to{' '}
                <span className="font-medium">{endItem}</span> of{' '}
                <span className="font-medium">{totalItems}</span> {itemType}
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`p-2 sm:p-2 rounded-md text-sm font-medium transition-all duration-200 min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center ${
                            currentPage === 1 ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary'
                        }`}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    
                    <div className="hidden sm:flex items-center gap-1">
                        {getPageNumbers().map((page, index) => (
                            <button
                                key={index}
                                onClick={() => typeof page === 'number' && onPageChange(page)}
                                disabled={page === '...'}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 min-w-[40px] min-h-[36px] flex items-center justify-center ${
                                    page === currentPage
                                        ? 'bg-blue-600 dark:bg-blue-700 text-white'
                                        : page === '...'
                                            ? 'text-gray-400 dark:text-gray-500 cursor-default'
                                            : 'text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary'
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                    </div>
                    
                    {/* Mobile: Simple Page Indicator */}
                    <div className="flex sm:hidden items-center gap-2 px-3 py-2 bg-white dark:bg-dark-bg-secondary rounded-md border border-gray-300 dark:border-gray-600">
                        <span className="text-sm font-medium text-gray-700 dark:text-dark-text">
                            {currentPage} of {totalPages}
                        </span>
                    </div>
                    
                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`p-2 sm:p-2 rounded-md text-sm font-medium transition-all duration-200 min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center ${
                            currentPage === totalPages ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed' : 'text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary'
                        }`}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
        </div>
    );
};

// Scroll to Top Button
const ScrollToTopButton = () => {
    const [isVisible, setIsVisible] = useState(false);
    
    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            setIsVisible(scrollTop > 300);
        };
        
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    
    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    if (!isVisible) return null;
    
    return (
        <button
            onClick={scrollToTop}
            className={`fixed right-6 bottom-6 z-[200] p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
            }`}
            title="Scroll to top"
        >
            <ArrowUp size={20} />
        </button>
    );
};

// Status Tooltip Component
const StatusHelperTooltip = ({ status, isOpen, onClose, position }) => {
    if (!isOpen) return null;

    const statusText = mapLegiScanStatus(status);
    const statusDescription = getStatusDescription(status);

    // Calculate position to keep tooltip within viewport
    const calculatePosition = () => {
        const tooltipWidth = 256; // w-64 = 16rem = 256px
        const viewportWidth = window.innerWidth;
        const containerPadding = 32; // Approximate container padding
        
        let left = position?.left || 0;
        let transform = 'translate(-50%, 8px)';
        
        // Check if we're in the left third of the viewport (likely left side of container)
        const isLeftSide = left < viewportWidth / 3;
        // Check if we're in the right third of the viewport (likely right side of container)
        const isRightSide = left > (viewportWidth * 2) / 3;
        
        if (isLeftSide) {
            // For left side elements, align tooltip to the right of the trigger
            left = left;
            transform = 'translate(0, 8px)';
        } else if (isRightSide) {
            // For right side elements, align tooltip to the left of the trigger
            left = left - tooltipWidth;
            transform = 'translate(0, 8px)';
        } else {
            // For center elements, keep centered
            left = left;
            transform = 'translate(-50%, 8px)';
        }
        
        // Final boundary checks to ensure tooltip stays within viewport
        if (left < containerPadding) {
            left = containerPadding;
            transform = 'translate(0, 8px)';
        }
        if (left + tooltipWidth > viewportWidth - containerPadding) {
            left = viewportWidth - tooltipWidth - containerPadding;
            transform = 'translate(0, 8px)';
        }
        
        return {
            top: position?.top || 0,
            left: left,
            transform: transform
        };
    };

    const calculatedPosition = calculatePosition();
    
    // Determine arrow position based on tooltip positioning
    const getArrowPosition = () => {
        const originalLeft = position?.left || 0;
        const tooltipLeft = calculatedPosition.left;
        const tooltipWidth = 256;
        
        // Calculate where the arrow should point (relative to tooltip)
        const arrowLeft = Math.max(16, Math.min(tooltipWidth - 16, originalLeft - tooltipLeft));
        
        return {
            left: `${arrowLeft}px`
        };
    };
    
    const arrowPosition = getArrowPosition();

    return (
        <div 
            className="status-tooltip fixed sm:absolute bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 w-64 z-[120]"
            style={calculatedPosition}
        >
            <div className="absolute bottom-full transform -translate-y-0" style={arrowPosition}>
                <div className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-200 dark:border-b-gray-700"></div>
                <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[3px] border-transparent border-b-white dark:border-b-dark-bg-secondary absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-px"></div>
            </div>
            
            <div className="flex justify-between items-start mb-2">
                <h4 className={`text-sm font-semibold flex-1 ${getTextClasses('primary')}`}>
                    {statusText}
                </h4>
                <button
                    onClick={onClose}
                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 ml-2 flex-shrink-0"
                >
                    <X size={12} />
                </button>
            </div>
            
            <p className={`text-xs leading-relaxed ${getTextClasses('secondary')}`}>
                {statusDescription}
            </p>
        </div>
    );
};

// AI Content Formatting Functions

// Main StatePage Component
const StatePage = ({ stateName }) => {
    // Authentication context
    const { currentUser } = useAuth();
    
    // Track page view with state-specific name
    usePageTracking(`State Legislation - ${stateName || 'Unknown State'}`);
    
    // Helper function to get current user identifier
    const getCurrentUserId = () => {
        // Use numeric user ID for database compatibility
        // In production, this should map MSI user to numeric ID
        return '1'; // Consistent with analytics tracking
    };
    
    // Core state
    const [stateOrders, setStateOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [fetchLoading, setFetchLoading] = useState(false); // New state for fetch loading
    const [fetchSuccess, setFetchSuccess] = useState(null); // Success message for fetch
    const [fetchProgress, setFetchProgress] = useState(null); // Progress message for long operations
    const [actualBillCount, setActualBillCount] = useState(null); // Actual count from database
    
    // Manual refresh state
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Filter state (matching ExecutiveOrdersPage pattern)
    const [selectedFilters, setSelectedFilters] = useState([]);
    const [selectedStatusFilter, setSelectedStatusFilter] = useState(null);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    // Removed showFetchDropdown - using single fetch button now
    
    // Sort state
    const [sortOrder, setSortOrder] = useState('latest');
    
    // Session filter state
    const [selectedSessions, setSelectedSessions] = useState([]);
    const [availableSessions, setAvailableSessions] = useState([]);
    
    // Highlights filter state - persistent in localStorage
    const [isHighlightFilterActive, setIsHighlightFilterActive] = useState(() => {
        const saved = localStorage.getItem('highlightFilterActive');
        return saved === 'true';
    });
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    
    // Status tooltip state
    const [statusTooltipOpen, setStatusTooltipOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState(null);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    
    // Filter counts state
    const [allFilterCounts, setAllFilterCounts] = useState({
        civic: 0,
        education: 0,
        engineering: 0,
        healthcare: 0,
        'not-applicable': 0,
        reviewed: 0,
        not_reviewed: 0,
        total: 0
    });
    
    // Review status hook
    const { isItemReviewed } = useReviewStatus(stateOrders, 'state_legislation');
    
    // Highlights state
    const [localHighlights, setLocalHighlights] = useState(new Set());
    const [highlightLoading, setHighlightLoading] = useState(new Set());
    
    
    const filterDropdownRef = useRef(null);
    
    // Fetch available sessions from API
    useEffect(() => {
        const fetchAvailableSessions = async () => {
            if (!SUPPORTED_STATES[stateName]) return;
            
            try {
                const response = await cachedFetch(`${API_URL}/api/legiscan/session-status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        states: [SUPPORTED_STATES[stateName]],
                        include_all_sessions: true
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    // Removed verbose session response logging
                    if (data.success && data.active_sessions && data.active_sessions[SUPPORTED_STATES[stateName]]) {
                        const sessions = data.active_sessions[SUPPORTED_STATES[stateName]];
                        // API sessions loaded successfully
                        setAvailableSessions(sessions);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch available sessions:', error);
            }
        };
        
        fetchAvailableSessions();
    }, [stateName]);
    
    // Early returns for invalid states
    if (!stateName || !SUPPORTED_STATES[stateName]) {
        return (
            <div className="pt-6">
                <div className="bg-red-50 border border-red-200 text-red-800 p-6 rounded-lg">
                    <h3 className="font-semibold mb-2">Invalid State</h3>
                    <p>Please select a valid state from the navigation menu.</p>
                </div>
            </div>
        );
    }
    
    // Helper function to get unique bill ID
    const getStateBillId = useCallback((bill) => {
        if (!bill) return null;
        if (bill.bill_id && typeof bill.bill_id === 'string') return bill.bill_id;
        if (bill.id && typeof bill.id === 'string') return bill.id;
        if (bill.bill_number && bill.state) {
            return `${bill.state}-${bill.bill_number}`;
        }
        if (bill.bill_number) {
            return `${stateName || 'unknown'}-${bill.bill_number}`;
        }
        return `state-bill-${Math.random().toString(36).substring(2, 11)}`;
    }, [stateName]);
    
    
    // Helper function to get bill status with proper database field mapping
    const getBillStatus = useCallback((bill) => {
        // Check all possible status fields from the database schema
        const possibleStatus = 
            bill.status ||                    // Primary status field
            bill.legiscan_status ||           // LegiScan specific status
            getCurrentStatus(bill) ||         // Utility function fallback
            bill.bill_status ||               // Legacy field
            null;
        
        // Debug: log status for first few bills
        if (stateOrders.length <= 3) {
            console.log('🔍 Bill status debug:', {
                billId: getStateBillId(bill),
                status: bill.status,
                legiscan_status: bill.legiscan_status,
                getCurrentStatus: getCurrentStatus(bill),
                final: possibleStatus,
                billKeys: Object.keys(bill).filter(key => key.includes('status'))
            });
        }
        
        return possibleStatus;
    }, [stateOrders.length, getStateBillId]);
    
    
    const handleCategoryUpdate = useCallback(async (itemId, newCategory) => {
        try {
            // Optimistically update the local state
            setStateOrders(prevBills => 
                prevBills.map(bill => {
                    const currentBillId = getStateBillId(bill);
                    if (currentBillId === itemId) {
                        return { ...bill, category: newCategory };
                    }
                    return bill;
                })
            );
            
            // Make API call to update category
            const response = await cachedFetch(`${API_URL}/api/state-legislation/${itemId}/category`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    category: newCategory,
                    user_id: getCurrentUserId()
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to update category: ${response.statusText}`);
            }
            
            // Check if response is actually JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.error('❌ Expected JSON but got:', contentType, 'Response:', textResponse.substring(0, 200));
                throw new Error(`API returned ${contentType || 'unknown content type'} instead of JSON. Check if backend is running properly.`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ Category updated successfully');
            } else {
                throw new Error(result.message || 'Update failed');
            }
            
        } catch (error) {
            console.error('❌ Failed to update category:', error);
            
            // Revert the local state change on error
            setStateOrders(prevBills => 
                prevBills.map(bill => {
                    const currentBillId = getStateBillId(bill);
                    if (currentBillId === itemId) {
                        // Revert to original category
                        return { ...bill, category: cleanCategory(bill.category) };
                    }
                    return bill;
                })
            );
            
            // Show error message to user
            setError(`Failed to update category: ${error.message}`);
            setTimeout(() => setError(null), 5000);
            
            throw error;
        }
    }, [getStateBillId]);

    const closeStatusTooltip = () => {
        setStatusTooltipOpen(false);
        setSelectedStatus(null);
    };
    
    // Filter helper functions
    const toggleFilter = (filterKey) => {
        setSelectedFilters(prev => {
            // If clicking the same filter, deselect it
            if (prev.includes(filterKey)) {
                return [];
            }
            // Otherwise, select only this filter
            return [filterKey];
        });
        setCurrentPage(1);
        // Close dropdown after selection
        setShowFilterDropdown(false);
    };
    

    const clearPracticeAreaFilters = () => {
        setSelectedFilters([]);
        setCurrentPage(1);
    };
    
    // Status filter handler
    const handleStatusFilterChange = (statusKey) => {
        setSelectedStatusFilter(statusKey);
        setCurrentPage(1);
    };
    

    // New fetch handler for time periods - uses incremental fetch with streaming
    const handleFetch = useCallback(async (period) => {
        setFetchLoading(true);
        setError(null); // Clear any existing errors
        setFetchSuccess(null); // Clear any existing success messages
        
        try {
            console.log(`🔄 Starting incremental fetch for ${period} in state ${stateName}`);
            
            const stateAbbr = SUPPORTED_STATES[stateName];
            
            // Use the new incremental fetch endpoint
            const fetchUrl = `${API_URL}/api/legiscan/fetch-recent`;
            
            // Determine limit based on period
            let limit = 50; // Start smaller for recent fetches
            if (period === '30days') limit = 100;
            else if (period === '90days') limit = 150;
            
            const requestBody = {
                state: stateAbbr,
                enhanced_ai: true,
                limit: limit
            };
            
            console.log(`🚀 Making incremental fetch API call...`);
            
            const response = await fetchWithTimeout(fetchUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            }, 300000); // 5 minute timeout for large requests
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Check if response is actually JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.error('❌ Expected JSON but got:', contentType, 'Response:', textResponse.substring(0, 200));
                throw new Error(`API returned ${contentType || 'unknown content type'} instead of JSON. Check if backend is running properly.`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ Incremental fetch completed:`, result);
                console.log(`📊 Bills found: ${result.bills_found}, Bills processed: ${result.bills_processed}`);
                console.log(`📅 Most recent date before: ${result.most_recent_date_before}`);
                console.log(`🔍 Search query used: ${result.search_query_used}`);
                
                // Show success message based on results
                if (result.bills_processed > 0) {
                    setFetchSuccess(
                        `Successfully fetched ${result.bills_processed} new bills! ` +
                        `Found ${result.bills_found} total bills, processed ${result.bills_processed} new ones. ` +
                        `Database now includes the latest bills since ${result.most_recent_date_before || 'the beginning'}.`
                    );
                    
                    // Refresh the page data to show new bills
                    await fetchFromDatabase(1);
                    
                    // Clear success message after 7 seconds (longer for more detailed message)
                    setTimeout(() => setFetchSuccess(null), 7000);
                } else if (result.bills_found === 0) {
                    setFetchSuccess('No new bills found - the database is already up to date with the latest legislation.');
                    setTimeout(() => setFetchSuccess(null), 4000);
                } else {
                    setFetchSuccess(
                        `Found ${result.bills_found} bills but they were already in the database. ` +
                        `Your database is current with the latest legislation.`
                    );
                    setTimeout(() => setFetchSuccess(null), 5000);
                }
            } else {
                throw new Error(result.error || result.detail || 'Failed to fetch bills from LegiScan');
            }
            
        } catch (error) {
            console.error('❌ Error fetching fresh bills:', error);
            
            // Handle different error types
            if (error.message.includes('timeout') || error.message.includes('504')) {
                setError(
                    `LegiScan API timeout - The service is slow or temporarily unavailable. ` +
                    `Please try again in a few minutes or use a smaller search window.`
                );
            } else if (error.message.includes('503') || error.message.includes('connection')) {
                setError(
                    `LegiScan API connection failed - The service may be down. ` +
                    `Please check back later or contact support if the issue persists.`
                );
            } else if (error.message.includes('abort')) {
                setError(`Request was cancelled due to timeout. Try fetching fewer bills at once.`);
            } else {
                setError(`Failed to fetch fresh bills: ${error.message}`);
            }
            
            // Clear error after 10 seconds for timeout/connection errors (they need more time to read)
            setTimeout(() => setError(null), 10000);
        } finally {
            setFetchLoading(false);
        }
    }, [stateName]);

    // Universal Smart Fetch - combines enhanced and incremental approaches
    const handleUniversalFetch = useCallback(async () => {
        setFetchLoading(true);
        setError(null);
        setFetchSuccess(null);
        
        try {
            console.log(`🚀 Starting enhanced fetch (master list) for ${stateName}`);
            
            const stateAbbr = SUPPORTED_STATES[stateName];
            
            const fetchUrl = `${API_URL}/api/legiscan/check-and-update`;
            
            const requestBody = {
                state: stateAbbr
            };
            
            console.log(`📡 Making enhanced fetch API call...`);
            
            const response = await fetchWithTimeout(fetchUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            }, 900000); // 15 minute timeout for large datasets
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.error('❌ Expected JSON but got:', contentType, 'Response:', textResponse.substring(0, 200));
                throw new Error(`API returned ${contentType || 'unknown content type'} instead of JSON. Check if backend is running properly.`);
            }
            
            const result = await response.json();
            
            if (result.success || result.status === 'success') {
                console.log(`✅ Enhanced fetch completed:`, result);
                console.log(`📊 Bills found: ${result.bills_found}, Method: ${result.method_used || result.source_method}`);
                
                if (result.bills_found > 1000) {
                    setFetchSuccess(
                        `🎉 Enhanced fetch SUCCESS! Found ${result.bills_found} bills including session 89 - ` +
                        `much more comprehensive than the previous 723 bills! Refresh the page to see all new bills.`
                    );
                } else if (result.bills_found > 723) {
                    setFetchSuccess(
                        `✅ Enhanced fetch completed! Found ${result.bills_found} bills - an improvement over previous fetches. ` +
                        `Refresh the page to see the updated results.`
                    );
                } else if (result.bills_found > 0) {
                    setFetchSuccess(
                        `✅ Enhanced fetch completed! Found ${result.bills_found} bills using comprehensive search. ` +
                        `Refresh the page to see any new session 89 bills.`
                    );
                } else {
                    setFetchSuccess(
                        `ℹ️ Enhanced search completed but found no new bills. Session 89 bills may already be in the database.`
                    );
                }
                
                // Refresh the page data to show new bills
                try {
                    await fetchFromDatabase(1);
                } catch (refreshError) {
                    console.warn('Failed to refresh data after enhanced update:', refreshError);
                }
                
                // Clear success message after 10 seconds
                setTimeout(() => setFetchSuccess(null), 10000);
                
            } else {
                throw new Error(result.error || result.detail || result.message || 'Enhanced fetch failed');
            }
            
        } catch (error) {
            console.error('❌ Error in enhanced fetch:', error);
            
            if (error.message.includes('timeout') || error.message.includes('504')) {
                setError(
                    `Enhanced fetch timeout - Large datasets may take longer to process. ` +
                    `The operation may still be completing in the background. Check back in a few minutes.`
                );
            } else if (error.message.includes('503') || error.message.includes('connection')) {
                setError(
                    `LegiScan API connection failed - The service may be down. ` +
                    `Please check back later or try the standard Fetch option.`
                );
            } else {
                setError(`Enhanced fetch failed: ${error.message || 'Unknown error'}`);
            }
            
        } finally {
            setFetchLoading(false);
        }
    }, [stateName]);

    // Check for updates handler - compares API data with database and processes missing bills one-by-one
    const handleCheckForUpdates = useCallback(async () => {
        setFetchLoading(true);
        setError(null);
        setFetchSuccess(null);
        setFetchProgress('🔍 Checking LegiScan API for new bills...');
        
        try {
            console.log(`🔄 Starting check for updates for ${stateName}`);
            
            const stateAbbr = SUPPORTED_STATES[stateName];
            
            const fetchUrl = `${API_URL}/api/legiscan/check-and-update`;
            
            const requestBody = {
                state: stateAbbr
            };
            
            console.log(`🚀 Making check and update API call...`);
            setFetchProgress('🤖 Processing missing bills with AI analysis...');
            
            const response = await fetchWithTimeout(fetchUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            }, 120000); // 2 minute timeout - allow larger batches to complete
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.error('❌ Expected JSON but got:', contentType, 'Response:', textResponse.substring(0, 200));
                throw new Error(`API returned ${contentType || 'unknown content type'} instead of JSON. Check if backend is running properly.`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ Check for updates completed:`, result);
                console.log(`📊 API Bills: ${result.api_bills_found}, Existing: ${result.existing_bills}, Missing: ${result.missing_bills}, Processed: ${result.processed_bills}`);
                
                // Show success message based on results
                if (result.processed_bills > 0) {
                    const remainingBills = result.remaining_bills || 0;
                    
                    if (remainingBills > 0) {
                        setFetchSuccess(
                            `✅ Batch completed! Processed ${result.processed_bills} of ${result.missing_bills} missing bills. ` +
                            `${remainingBills} bills remaining. Click "Fetch" again to process more.`
                        );
                    } else {
                        setFetchSuccess(
                            `✅ Update completed! Found ${result.missing_bills} missing bills and processed ${result.processed_bills} new bills with AI analysis. ` +
                            `Your database now includes the latest legislation for ${stateName}.`
                        );
                    }
                    
                    // Refresh data without page reload
                    try {
                        await fetchFromDatabase(1);
                    } catch (refreshError) {
                        console.warn('Failed to refresh data after update:', refreshError);
                        // Don't let refresh errors break the success flow
                    }
                    
                    // Clear success message after 8 seconds
                    setTimeout(() => setFetchSuccess(null), 8000);
                } else if (result.missing_bills === 0) {
                    setFetchSuccess(
                        `✅ Database is up to date! Found ${result.api_bills_found} bills in API, all ${result.existing_bills} are already in your database. ` +
                        `No new bills to process for ${stateName}.`
                    );
                    setTimeout(() => setFetchSuccess(null), 6000);
                } else {
                    setFetchSuccess(
                        `⚠️ Found ${result.missing_bills} missing bills but processed ${result.processed_bills}. ` +
                        `Some bills may have had processing issues - check logs for details.`
                    );
                    setTimeout(() => setFetchSuccess(null), 6000);
                }
            } else {
                throw new Error(result.error || result.detail || 'Failed to check for updates');
            }
            
        } catch (error) {
            console.error('❌ Error checking for updates:', error);
            
            // Handle different error types
            if (error.message.includes('timeout') || error.message.includes('504')) {
                setError(
                    `Update check timed out - This can happen with large datasets. ` +
                    `The process may still be running in the background. Please try again in a few minutes.`
                );
            } else if (error.message.includes('503') || error.message.includes('connection')) {
                setError(
                    `API connection failed - The LegiScan service may be temporarily unavailable. ` +
                    `Please try again later.`
                );
            } else {
                setError(`Failed to check for updates: ${error.message}`);
            }
            
            // Clear error after 10 seconds for timeout/connection errors
            setTimeout(() => setError(null), 10000);
        } finally {
            setFetchLoading(false);
            setFetchProgress(null);
        }
    }, [stateName]);
    
    // Fetch data from database
    // Fetch the actual count from database
    const fetchActualBillCount = useCallback(async () => {
        try {
            const stateAbbr = SUPPORTED_STATES[stateName];
            const countUrl = `${API_URL}/api/state-legislation/count?state=${stateAbbr}`;
            
            const response = await fetch(countUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setActualBillCount(data.count);
                }
            }
        } catch (error) {
            console.error('Error fetching actual bill count:', error);
            // Fallback to filtered count if the endpoint fails
            setActualBillCount(null);
        }
    }, [stateName]);

    // Status update function
    const updateBillStatuses = useCallback(async () => {
        try {
            console.log('🔄 Updating bill statuses from LegiScan API...');
            
            const response = await fetch(`${API_URL}/api/bills/update-statuses`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ quick_mode: true })
            });

            if (response.ok) {
                const result = await response.json();
                console.log('✅ Status update completed:', result);
                return result;
            } else {
                console.warn('⚠️ Status update failed:', response.status);
                return null;
            }
        } catch (error) {
            console.error('❌ Error updating bill statuses:', error);
            return null;
        }
    }, []);

    const fetchFromDatabase = useCallback(async (pageNum = 1) => {
        try {
            setLoading(true);
            setError(null);
            
            const perPage = 25;
            const stateAbbr = SUPPORTED_STATES[stateName];
            const url = `${API_URL}/api/state-legislation?state=${stateAbbr}&page=${pageNum}&per_page=${perPage}`;
            
            // Use cached fetch to prevent duplicate requests
            const response = await cachedFetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }, 120000); // 2 minutes for regular database queries
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Check if response is actually JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.error('❌ Expected JSON but got:', contentType, 'Response:', textResponse.substring(0, 200));
                throw new Error(`API returned ${contentType || 'unknown content type'} instead of JSON. Check if backend is running properly.`);
            }
            
            const data = await response.json();
            
            // Extract orders from response
            let ordersArray = [];
            let totalCount = 0;
            let currentPage = pageNum;
            
            if (Array.isArray(data)) {
                ordersArray = data;
                totalCount = data.length;
            } else if (data.results && Array.isArray(data.results)) {
                ordersArray = data.results;
                totalCount = data.total || data.count || 0;
                currentPage = data.page || pageNum;
            } else if (data.data && Array.isArray(data.data)) {
                ordersArray = data.data;
                totalCount = data.total || data.count || 0;
                currentPage = data.page || pageNum;
            }
            
            const totalPages = data.total_pages || Math.ceil(totalCount / perPage);
            
            // Transform bills
            const transformedBills = ordersArray.map((bill, index) => {
                const uniqueId = getStateBillId(bill) || `fallback-${pageNum}-${index}`;
                
                const transformedBill = {
                    id: uniqueId,
                    bill_id: uniqueId,
                    title: bill?.title || 'Untitled Bill',
                    category: cleanCategory(bill?.category),
                    description: bill?.description || bill?.ai_summary || 'No description available',
                    summary: bill?.ai_summary ? stripHtmlTags(bill.ai_summary) : (bill?.summary ? stripHtmlTags(bill.summary) : 'No summary available'),
                    bill_number: bill?.bill_number,
                    state: bill?.state || stateName,
                    status: bill?.status, // ✅ ADD THE STATUS FIELD!
                    legiscan_url: bill?.legiscan_url,
                    introduced_date: bill?.introduced_date,
                    last_action_date: bill?.last_action_date,
                    reviewed: bill?.reviewed || false,
                    // Session fields
                    session: bill?.session || '',
                    session_name: bill?.session_name || '',
                    session_id: bill?.session_id || '',
                    order_type: 'state_legislation'
                };
                
                // Debug session data (removed for production)
                
                return transformedBill;
            });
            
            setStateOrders(transformedBills);
            
        } catch (err) {
            console.error('❌ Error fetching data:', err);
            setError(`Failed to load state legislation: ${err.message}`);
            setStateOrders([]);
        } finally {
            setLoading(false);
        }
    }, [stateName, getStateBillId]);
    
    // Session fetch handler - fetches bills from specific sessions
    // Add browser warning for long operations
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (fetchLoading) {
                e.preventDefault();
                e.returnValue = 'A data fetch operation is in progress. Leaving may interrupt the process. Are you sure?';
                return e.returnValue;
            }
        };
        
        if (fetchLoading) {
            window.addEventListener('beforeunload', handleBeforeUnload);
        }
        
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [fetchLoading]);
    
    // Handle page change
    const handlePageChange = useCallback((newPage) => {
        setCurrentPage(newPage);
        fetchFromDatabase(newPage);
    }, [fetchFromDatabase]);
    
    // Handle highlighting
    const handleStateBillHighlight = useCallback(async (bill) => {
        const billId = getStateBillId(bill);
        if (!billId) return;
        
        const isCurrentlyHighlighted = localHighlights.has(billId);
        setHighlightLoading(prev => new Set([...prev, billId]));
        
        try {
            if (isCurrentlyHighlighted) {
                setLocalHighlights(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(billId);
                    return newSet;
                });
                
                const response = await cachedFetch(`${API_URL}/api/highlights/${billId}?user_id=${getCurrentUserId()}`, {
                    method: 'DELETE',
                });
                
                if (!response.ok) {
                    setLocalHighlights(prev => new Set([...prev, billId]));
                }
            } else {
                setLocalHighlights(prev => new Set([...prev, billId]));
                
                const response = await cachedFetch(`${API_URL}/api/highlights`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: getCurrentUserId(),
                        order_id: billId,
                        order_type: 'state_legislation',
                        notes: null,
                        priority_level: 1,
                        tags: null,
                        is_archived: false
                    })
                });
                
                if (!response.ok && response.status !== 409) {
                    setLocalHighlights(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(billId);
                        return newSet;
                    });
                }
            }
        } catch (error) {
            console.error('❌ Error managing highlight:', error);
            // Revert optimistic update
            if (isCurrentlyHighlighted) {
                setLocalHighlights(prev => new Set([...prev, billId]));
            } else {
                setLocalHighlights(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(billId);
                    return newSet;
                });
            }
        } finally {
            setHighlightLoading(prev => {
                const newSet = new Set(prev);
                newSet.delete(billId);
                return newSet;
            });
        }
    }, [localHighlights, getStateBillId]);
    
    // Check if bill is highlighted
    const isStateBillHighlighted = useCallback((bill) => {
        const billId = getStateBillId(bill);
        return billId ? localHighlights.has(billId) : false;
    }, [localHighlights, getStateBillId]);
    
    // Check if bill is being highlighted
    const isBillHighlightLoading = useCallback((bill) => {
        const billId = getStateBillId(bill);
        return billId ? highlightLoading.has(billId) : false;
    }, [highlightLoading, getStateBillId]);
    
    // Filter counts
    const filterCounts = useMemo(() => {
        return {
            civic: allFilterCounts.civic || 0,
            education: allFilterCounts.education || 0,
            engineering: allFilterCounts.engineering || 0,
            healthcare: allFilterCounts.healthcare || 0,
            'not-applicable': allFilterCounts['not-applicable'] || 0,
            all_practice_areas: allFilterCounts.all_practice_areas || 0,
            reviewed: allFilterCounts.reviewed || 0,
            not_reviewed: allFilterCounts.not_reviewed || 0,
            total: allFilterCounts.total || 0
        };
    }, [allFilterCounts]);
    
    // Calculate filter counts when stateOrders changes
    useEffect(() => {
        if (Array.isArray(stateOrders) && stateOrders.length > 0) {
            const counts = calculateAllCounts(stateOrders, {
                getCategoryFn: (item) => cleanCategory(item?.category),
                reviewStatusFn: (item) => isItemReviewed(item)
            });
            
            setAllFilterCounts(counts);
        } else {
            // Reset counts when no data
            setAllFilterCounts({
                civic: 0,
                education: 0,
                engineering: 0,
                healthcare: 0,
                'not-applicable': 0,
                reviewed: 0,
                not_reviewed: 0,
                total: 0
            });
        }
    }, [stateOrders, isItemReviewed]);

    
    // Filtered orders (simple filtering without fuzzy search)
    const filteredStateOrders = useMemo(() => {
        if (!Array.isArray(stateOrders)) return [];
        
        let filtered = stateOrders;
        
        // Apply category filters
        if (selectedFilters.length > 0) {
            filtered = filtered.filter(bill => selectedFilters.includes(cleanCategory(bill?.category)));
        }
        
        // Apply status filter
        if (selectedStatusFilter) {
            filtered = filtered.filter(bill => {
                const billStage = getStatusStage(bill.status);
                return billStage === selectedStatusFilter;
            });
        }
        
        // Apply highlights filter
        if (isHighlightFilterActive) {
            filtered = filtered.filter(bill => isStateBillHighlighted(bill));
        }
        
        // Apply session filters
        if (selectedSessions.length > 0) {
            // Applying session filter
            
            // Create a map from session IDs to session names for lookup
            const sessionIdToNameMap = new Map();
            availableSessions.forEach(session => {
                if (session.session_id && session.session_name) {
                    sessionIdToNameMap.set(session.session_id, session.session_name);
                }
            });
            
            // Convert selected session IDs to session names
            const selectedSessionNames = selectedSessions.map(sessionId => {
                const sessionName = sessionIdToNameMap.get(sessionId);
                // Mapping session ID to name
                return sessionName || sessionId; // fallback to sessionId if no name found
            }).filter(Boolean);
            
            // Session names prepared for filtering
            
            filtered = filtered.filter(bill => {
                const billSession = bill.session || bill.session_name;
                const matches = billSession && selectedSessionNames.includes(billSession);
                
                // Debug first few non-matching bills
                // Filter bills by session
                
                return matches;
            });
            
            // Session filtering completed
        }
        
        // Sort by date
        filtered.sort((a, b) => {
            const getDate = (bill) => {
                const dateStr = bill.introduced_date || bill.last_action_date || '1900-01-01';
                const parsedDate = new Date(dateStr);
                return isNaN(parsedDate.getTime()) ? new Date('1900-01-01') : parsedDate;
            };
            
            const dateA = getDate(a);
            const dateB = getDate(b);
            
            return sortOrder === 'latest' 
                ? dateB.getTime() - dateA.getTime()
                : dateA.getTime() - dateB.getTime();
        });
        
        return filtered;
    }, [stateOrders, selectedFilters, selectedStatusFilter, sortOrder, selectedSessions, isHighlightFilterActive, isStateBillHighlighted]);
    
    // Pagination calculations
    const totalItems = filteredStateOrders.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentPageItems = filteredStateOrders.slice(startIndex, endIndex);
    
    // Load data on mount
    useEffect(() => {
        if (stateName && SUPPORTED_STATES[stateName]) {
            // Update bill statuses first, then load data
            const loadData = async () => {
                // Only update statuses for Texas (since we have the endpoint for TX)
                if (stateName === 'texas') {
                    await updateBillStatuses();
                }
                
                fetchFromDatabase(1);
                fetchActualBillCount(); // Also fetch the actual count
            };
            
            loadData();
        }
    }, [stateName, fetchFromDatabase, fetchActualBillCount, updateBillStatuses]);
    
    // Removed unused refresh handlers to clean up code
    
    
    const handleRefreshNeeded = useCallback(() => {
        // Scroll to the header refresh button
        const refreshButton = document.getElementById('main-refresh-button');
        if (refreshButton) {
            refreshButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Add a subtle highlight effect
            refreshButton.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
            setTimeout(() => {
                refreshButton.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
            }, 2000);
        }
    }, []);
    
    // Load highlights on mount
    useEffect(() => {
        const loadHighlights = async () => {
            try {
                const response = await cachedFetch(`${API_URL}/api/highlights?user_id=${getCurrentUserId()}`);
                if (response.ok) {
                    // Check if response is actually JSON
                    const contentType = response.headers.get('content-type');
                    if (!contentType || !contentType.includes('application/json')) {
                        const textResponse = await response.text();
                        console.error('❌ Expected JSON but got:', contentType, 'Response:', textResponse.substring(0, 200));
                        return; // Exit early if not JSON
                    }
                    
                    const data = await response.json();
                    let highlights = [];
                    
                    if (Array.isArray(data)) {
                        highlights = data;
                    } else if (data.highlights && Array.isArray(data.highlights)) {
                        highlights = data.highlights;
                    } else if (data.results && Array.isArray(data.results)) {
                        highlights = data.results;
                    }
                    
                    const stateBillIds = new Set();
                    highlights.forEach(highlight => {
                        if (highlight.order_type === 'state_legislation' && highlight.order_id) {
                            stateBillIds.add(highlight.order_id);
                        }
                    });
                    
                    setLocalHighlights(stateBillIds);
                }
            } catch (error) {
                console.error('Error loading highlights:', error);
            }
        };
        
        loadHighlights();
    }, []);
    
    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
                setShowFilterDropdown(false);
            }
            // Removed fetch dropdown handling - using single button now
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    // Close status tooltip on any click
    useEffect(() => {
        const handleClickAnywhere = (event) => {
            if (statusTooltipOpen && !event.target.closest('.status-tooltip')) {
                closeStatusTooltip();
            }
        };
        
        if (statusTooltipOpen) {
            document.addEventListener('mousedown', handleClickAnywhere);
            return () => document.removeEventListener('mousedown', handleClickAnywhere);
        }
    }, [statusTooltipOpen]);
    
    return (
        <div className={getPageContainerClasses()}>
            <ScrollToTopButton />
            
            {/* Page Header */}
            <section id="page-header" className="relative overflow-hidden pt-12 pb-12">
                <div className="max-w-7xl mx-auto relative z-10">
                    <div className="text-center mb-8">
                        {/* Main Title */}
                        <h1 className={getTextClasses('primary', 'text-4xl md:text-6xl font-bold mb-6 leading-tight')}>
                            <span className="block">{stateName}</span>
                            <span className="block bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent py-2">Legislation</span>
                        </h1>
                        
                        {/* Description */}
                        <p className={getTextClasses('secondary', 'text-xl mb-8 max-w-3xl mx-auto leading-relaxed')}>
                            Access the latest legislation and bills from {stateName} with simple, clear overviews. Stay informed about new legislation and track the status of important bills affecting your state.
                        </p>
                        
                    </div>
                </div>
            </section>
            
            {/* Single Smart Notification System */}
            <div className="max-w-7xl mx-auto mb-4">
                {/* Progress Message */}
                {fetchProgress && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 flex items-start space-x-3 mb-4">
                        <RefreshIcon size={20} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0 animate-spin" />
                        <div>
                            <p className="text-blue-800 dark:text-blue-200 font-medium">Processing Request</p>
                            <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">{fetchProgress}</p>
                            <p className="text-blue-600 dark:text-blue-400 text-xs mt-2">Please keep this page open. Large datasets may take up to 10 minutes to process.</p>
                        </div>
                    </div>
                )}
                
                {/* Success Message */}
                {fetchSuccess && (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 flex items-start space-x-3 mb-4">
                        <Check size={20} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-green-800 dark:text-green-200 font-medium">Update Successful</p>
                            <p className="text-green-700 dark:text-green-300 text-sm mt-1">{fetchSuccess}</p>
                        </div>
                    </div>
                )}
                
                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-4 flex items-start space-x-3 mb-4">
                        <AlertTriangle size={20} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-red-800 dark:text-red-200 font-medium">Update Failed</p>
                            <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
                        </div>
                        <button
                            onClick={() => setError(null)}
                            className="text-red-400 hover:text-red-600 ml-auto"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}
                
                {/* Refreshing Progress */}
                {isRefreshing && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 flex items-center space-x-3 mb-4">
                        <RefreshIcon size={20} className="text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0" />
                        <div>
                            <p className="text-blue-800 dark:text-blue-200 font-medium">Refreshing Bills...</p>
                            <p className="text-blue-700 dark:text-blue-300 text-sm">Fetching the latest data from LegiScan</p>
                        </div>
                    </div>
                )}
                
                {/* Enhanced Session Notification with integrated updates */}
                <SessionNotification 
                    stateName={stateName} 
                    stateAbbr={SUPPORTED_STATES[stateName]}
                    visible={true}
                    onRefreshNeeded={handleRefreshNeeded}
                    hasUpdates={false} // Remove duplicate update indication
                />
            </div>
            
            
            {/* Results Section */}
            <section className="py-6 sm:py-8">
                <div className="max-w-7xl mx-auto">
                    <div className={getCardClasses('rounded-lg shadow-sm')}>
                        <div className="p-4 sm:p-6">
                        {/* Controls Bar - Fetch button left, filters right */}
                        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 mb-6 w-full">
                            {/* Fetch Button with Session Options - Left side */}
                            <div className="flex items-center gap-3 justify-start">
                                <button
                                    onClick={handleUniversalFetch}
                                    disabled={fetchLoading || loading}
                                    className={`flex items-center justify-center gap-2 px-4 py-3 sm:py-2 border rounded-lg text-sm sm:text-base font-medium transition-all duration-300 whitespace-nowrap w-full sm:w-auto min-h-[48px] sm:min-h-[44px] ${
                                        fetchLoading || loading
                                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'
                                            : 'bg-blue-600 dark:bg-blue-700 text-white border-blue-600 dark:border-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 hover:border-blue-700 dark:hover:border-blue-600'
                                    }`}
                                >
                                    {fetchLoading && (
                                        <RefreshIcon size={16} className="animate-spin flex-shrink-0" />
                                    )}
                                    <span>
                                        {fetchLoading ? 'Processing...' : 'Smart Fetch'}
                                    </span>
                                </button>
                                
                                {/* Bill Count Display */}
                                <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs">
                                    <FileText size={12} className="text-gray-500 dark:text-gray-400" />
                                    <span className="font-medium text-gray-700 dark:text-gray-300">
                                        {loading ? '...' : `${(actualBillCount !== null ? actualBillCount : filteredStateOrders.length).toLocaleString()}`}
                                    </span>
                                    {actualBillCount !== null && actualBillCount > filteredStateOrders.length && (
                                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                            ({filteredStateOrders.length.toLocaleString()} shown)
                                        </span>
                                    )}
                                </div>
                            </div>
                            
                            {/* Filter button group - right aligned */}
                            <div className="flex flex-col xl:flex-row gap-3 xl:gap-2 items-stretch xl:items-center">
                                {/* Sort Button */}
                                <button
                                    onClick={() => setSortOrder(sortOrder === 'latest' ? 'earliest' : 'latest')}
                                    className="flex items-center justify-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium transition-all duration-300 bg-white dark:bg-dark-bg-secondary text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[44px] w-full xl:w-[100px]"
                                >
                                    <div className="flex items-center gap-2">
                                        {sortOrder === 'latest' ? (
                                            <ArrowDown size={16} />
                                        ) : (
                                            <ArrowUpIcon size={16} />
                                        )}
                                        <span className="min-w-[44px] text-center">
                                            {sortOrder === 'latest' ? 'Latest' : 'Earliest'}
                                        </span>
                                    </div>
                                </button>
                                
                                {/* Highlights Filter - Hidden on mobile */}
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newValue = !isHighlightFilterActive;
                                        setIsHighlightFilterActive(newValue);
                                        localStorage.setItem('highlightFilterActive', newValue.toString());
                                    }}
                                    className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium transition-all duration-300 min-h-[44px] w-full xl:w-[130px] ${
                                        isHighlightFilterActive
                                            ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/50'
                                            : 'bg-white dark:bg-dark-bg-secondary text-gray-700 dark:text-dark-text border-gray-300 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary'
                                    }`}
                                >
                                    <Star size={16} className={isHighlightFilterActive ? 'fill-current' : ''} />
                                    <span className="whitespace-nowrap">{isHighlightFilterActive ? 'Highlights' : 'All Items'}</span>
                                </button>
                                
                                {/* Session Filter */}
                                <SessionFilter 
                                    sessions={useMemo(() => {
                                        // Start with API sessions as the primary source (same as SessionNotification)
                                        // Removed excessive logging for performance
                                        
                                        const sessionMap = new Map();
                                        
                                        // First, add all sessions from the API exactly as they come
                                        availableSessions.forEach((session) => {
                                            if (session.session_name) {
                                                // Use session_name as the key, but keep original data intact
                                                const sessionKey = session.session_name;
                                                sessionMap.set(sessionKey, {
                                                    session_id: session.session_id || session.session_name,
                                                    session_name: session.session_name,
                                                    year_start: session.year_start || extractYearFromSession(session.session_name),
                                                    year_end: session.year_end || null,
                                                    is_active: session.is_active || false,
                                                    is_likely_active: session.is_likely_active || false,
                                                    state: SUPPORTED_STATES[stateName],
                                                    source: 'api'
                                                });
                                            }
                                        });
                                        
                                        // Then add sessions from bills ONLY if they are truly missing
                                        const billSessions = new Set();
                                        stateOrders.forEach((bill) => {
                                            const sessionName = bill.session || bill.session_name;
                                            if (sessionName && sessionName.trim() && sessionName !== 'Unknown Session') {
                                                billSessions.add(sessionName);
                                                
                                                // Only add if exact session name doesn't exist in API data
                                                if (!sessionMap.has(sessionName)) {
                                                    sessionMap.set(sessionName, {
                                                        session_id: sessionName,
                                                        session_name: sessionName,
                                                        year_start: extractYearFromSession(sessionName),
                                                        year_end: null,
                                                        is_active: sessionName.includes('2025') || sessionName.includes('2024'),
                                                        is_likely_active: sessionName.includes('2025'),
                                                        state: SUPPORTED_STATES[stateName],
                                                        source: 'bills'
                                                    });
                                                }
                                            }
                                        });
                                        
                                        const finalSessions = Array.from(sessionMap.values());
                                        
                                        // Only log summary information once for debugging
                                        // Sessions loaded and processed
                                        
                                        return finalSessions;
                                    }, [availableSessions, stateOrders])}
                                    sessionCounts={useMemo(() => {
                                        const counts = {};
                                        const sessions = [];
                                        
                                        // Build session list similar to above
                                        const sessionMap = new Map();
                                        
                                        availableSessions.forEach((session) => {
                                            if (session.session_name) {
                                                const sessionKey = session.session_name;
                                                sessionMap.set(sessionKey, {
                                                    session_id: session.session_id || session.session_name,
                                                    session_name: session.session_name,
                                                });
                                            }
                                        });
                                        
                                        stateOrders.forEach((bill) => {
                                            const sessionName = bill.session || bill.session_name;
                                            if (sessionName && sessionName.trim() && sessionName !== 'Unknown Session') {
                                                if (!sessionMap.has(sessionName)) {
                                                    sessionMap.set(sessionName, {
                                                        session_id: sessionName,
                                                        session_name: sessionName,
                                                    });
                                                }
                                            }
                                        });
                                        
                                        // Count bills per session
                                        Array.from(sessionMap.values()).forEach(session => {
                                            const sessionName = session.session_name;
                                            const sessionId = session.session_id;
                                            counts[sessionId] = stateOrders.filter(bill => {
                                                const billSessionName = bill.session || bill.session_name;
                                                return billSessionName === sessionName;
                                            }).length;
                                        });
                                        
                                        return counts;
                                    }, [stateOrders, availableSessions])}
                                    selectedSessions={selectedSessions}
                                    onSessionChange={setSelectedSessions}
                                    disabled={loading || fetchLoading}
                                    loading={loading}
                                />
                                
                                {/* Status Filter */}
                                <StatusFilter 
                                    statusOptions={STATUS_FILTERS}
                                    selectedStatus={selectedStatusFilter}
                                    onStatusChange={handleStatusFilterChange}
                                    disabled={loading || fetchLoading}
                                    loading={loading}
                                    statusCounts={(() => {
                                        const counts = {};
                                        STATUS_FILTERS.forEach(filter => {
                                            counts[filter.key] = stateOrders.filter(bill => {
                                                const billStage = getStatusStage(bill.status);
                                                return billStage === filter.key;
                                            }).length;
                                        });
                                        return counts;
                                    })()}
                                />
                                
                                {/* Practice Areas Filter Dropdown */}
                                <div className="relative" ref={filterDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                                        className={`flex items-center justify-center sm:justify-between px-4 py-3 sm:py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm sm:text-base font-medium bg-white dark:bg-dark-bg-secondary text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 w-full sm:w-auto min-h-[48px] sm:min-h-[44px] ${
                                            selectedFilters.length > 0 ? 'ring-2 ring-blue-500 dark:ring-blue-400 border-blue-500 dark:border-blue-400' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {(() => {
                                                if (selectedFilters.length > 0) {
                                                    const selectedFilter = FILTERS.find(f => f.key === selectedFilters[0]);
                                                    if (selectedFilter) {
                                                        const IconComponent = selectedFilter.icon;
                                                        return <IconComponent size={16} className="text-gray-500 dark:text-gray-300" />;
                                                    }
                                                }
                                                return <LayoutGrid size={16} className="text-gray-500 dark:text-gray-300" />;
                                            })()}
                                            <span className="truncate">
                                                {selectedFilters.length > 0 ? (
                                                    (() => {
                                                        const selectedFilter = FILTERS.find(f => f.key === selectedFilters[0]);
                                                        return selectedFilter ? selectedFilter.label : 'All Practice Areas';
                                                    })()
                                                ) : 'All Practice Areas'}
                                            </span>
                                        </div>
                                        <ChevronDown 
                                            size={16} 
                                            className={`ml-4 text-gray-500 dark:text-gray-300 transition-transform duration-200 flex-shrink-0 ${showFilterDropdown ? 'rotate-180' : ''}`}
                                        />
                                    </button>

                                    {/* Dropdown content - Match HighlightsPage structure exactly */}
                                    {showFilterDropdown && (
                                        <div className={`absolute top-full mt-2 w-full sm:w-80 xl:w-64 ${getCardClasses('')} rounded-lg shadow-lg overflow-hidden z-[120] left-0 right-0 sm:left-0 sm:right-auto xl:left-auto xl:right-0`}>
                                            {/* Header */}
                                            <div className="sticky top-0 bg-gray-50 dark:bg-dark-bg-secondary px-4 py-3 sm:py-2 border-b border-gray-200 dark:border-dark-border">
                                                <div className="flex items-center justify-between">
                                                    <span className={getTextClasses('secondary', 'text-xs font-medium')}>
                                                        Filter by Practice Area
                                                    </span>
                                                    {selectedFilters.length > 0 && (
                                                        <button
                                                            onClick={() => {
                                                                clearPracticeAreaFilters();
                                                                setShowFilterDropdown(false);
                                                            }}
                                                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                                                        >
                                                            Clear
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div>
                                                {/* Practice Areas Section */}
                                                <div className="border-b border-gray-200 dark:border-dark-border pb-2">
                                                
                                                {/* All filter options from FILTERS array */}
                                                {FILTERS.map((filter) => {
                                                    const IconComponent = filter.icon;
                                                    const isActive = selectedFilters.includes(filter.key);
                                                    const count = filterCounts[filter.key] || 0;
                                                    
                                                    return (
                                                        <button
                                                            key={filter.key}
                                                            onClick={() => toggleFilter(filter.key)}
                                                            className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                                                                isActive
                                                                    ? filter.key === 'all_practice_areas' ? 'bg-teal-100 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 font-medium' :
                                                                      filter.key === 'civic' ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium' :
                                                                      filter.key === 'education' ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 font-medium' :
                                                                      filter.key === 'engineering' ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-medium' :
                                                                      filter.key === 'healthcare' ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 font-medium' :
                                                                      filter.key === 'not-applicable' ? 'bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 font-medium' :
                                                                      'bg-gray-100 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300 font-medium'
                                                                    : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <IconComponent size={16} />
                                                                <span>{filter.label}</span>
                                                            </div>
                                                            <span className="text-xs text-gray-500 dark:text-gray-400">({count})</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        {/* Success Message */}
                        {fetchSuccess && (
                            <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-md mb-6">
                                <p className="font-semibold mb-1">✅ Fetch Successful</p>
                                <p className="text-sm">{fetchSuccess}</p>
                            </div>
                        )}
                        
                        {/* Results */}
                        {loading ? (
                            <div className="space-y-6">
                                {[...Array(4)].map((_, index) => (
                                    <BillCardSkeleton key={index} />
                                ))}
                            </div>
                        ) : error ? (
                            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
                                <p className="font-semibold mb-2">Error loading {stateName} legislation:</p>
                                <p className="text-sm">{error}</p>
                            </div>
                        ) : currentPageItems.length > 0 ? (
                            <div className="space-y-6">
                                {currentPageItems.map((bill, index) => {
                                    return (
                                        <div key={bill.id || index} className={`${getCardClasses('border rounded-xl shadow-sm hover:shadow-md transition-all duration-300')} relative`}>
                                            {/* Mobile Menu Button - Top Right Corner */}
                                            {/* Mobile Highlight Button */}
                                            <div className="absolute top-4 right-4 lg:hidden">
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        if (!isBillHighlightLoading(bill)) {
                                                            handleStateBillHighlight(bill);
                                                        }
                                                    }}
                                                    disabled={isBillHighlightLoading(bill)}
                                                    className={`p-2 rounded-lg transition-all duration-300 border ${
                                                        isStateBillHighlighted(bill) 
                                                            ? 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100' 
                                                            : 'border-gray-200 hover:bg-gray-100'
                                                    }`}
                                                    title={isStateBillHighlighted(bill) ? 'Remove from highlights' : 'Add to highlights'}
                                                >
                                                    <Star 
                                                        size={20} 
                                                        className={
                                                            isBillHighlightLoading(bill) 
                                                                ? "text-gray-400 animate-pulse" 
                                                                : isStateBillHighlighted(bill) 
                                                                    ? "text-yellow-500 fill-current" 
                                                                    : "text-gray-600 dark:text-gray-400"
                                                        } 
                                                    />
                                                </button>
                                            </div>
                                            
                                            <div className="p-4 sm:p-6">
                                                {/* Card Header - Mobile Responsive */}
                                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-4">
                                                    <div className="flex-1 min-w-0 pr-4 sm:pr-2">
                                                        <h3 className={`text-base sm:text-lg md:text-xl font-bold mb-3 leading-tight pr-2 ${getTextClasses('primary')}`}>
                                                            {cleanBillTitle(bill.title)}
                                                        </h3>
                                                        
                                                        {/* Metadata Row - Mobile Optimized */}
                                                        <div className="space-y-3 mb-0">
                                                            {/* Top Row - Bill Number, Date, and Category */}
                                                            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm">
                                                                <div className={`flex items-center gap-1.5 ${getTextClasses('secondary')}`}>
                                                                    <Hash size={16} className="text-blue-600 dark:text-blue-400" />
                                                                    <span className="font-medium">{bill.bill_number || 'Unknown'}</span>
                                                                </div>
                                                                {bill.introduced_date && (
                                                                    <div className={`flex items-center gap-1.5 ${getTextClasses('secondary')}`}>
                                                                        <Calendar size={16} className="text-green-600 dark:text-green-400" />
                                                                        <span>
                                                                            {new Date(bill.introduced_date).toLocaleDateString('en-US', {
                                                                                month: 'numeric',
                                                                                day: 'numeric',
                                                                                year: 'numeric'
                                                                            })}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                <EditableCategoryTag 
                                                                    category={bill.category}
                                                                    itemId={getStateBillId(bill)}
                                                                    itemType="state_legislation"
                                                                    onCategoryChange={handleCategoryUpdate}
                                                                    disabled={loading || fetchLoading}
                                                                />
                                                                
                                                                {/* Session Tag */}
                                                                {(bill.session_name || bill.session) && (
                                                                    <div className={`flex items-center gap-1.5 ${getTextClasses('secondary')}`}>
                                                                        <CalendarDays size={16} className={
                                                                            (bill.session_name || bill.session || '').toLowerCase().includes('special') 
                                                                                ? 'text-purple-600 dark:text-purple-400' 
                                                                                : 'text-blue-600 dark:text-blue-400'
                                                                        } />
                                                                        <span className={`font-medium ${
                                                                            (bill.session_name || bill.session || '').toLowerCase().includes('special') 
                                                                                ? 'text-purple-700 dark:text-purple-300' 
                                                                                : 'text-blue-700 dark:text-blue-300'
                                                                        }`}>
                                                                            {bill.session_name || bill.session}
                                                                        </span>
                                                                    </div>
                                                                )}
                                                                
                                                            </div>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Desktop Action Buttons - Hidden on Mobile */}
                                                    <div className="hidden lg:flex items-center justify-end gap-2 flex-shrink-0">
                                                        
                                                        {/* Highlight Button - Touch Friendly */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (!isBillHighlightLoading(bill)) {
                                                                    handleStateBillHighlight(bill);
                                                                }
                                                            }}
                                                            disabled={isBillHighlightLoading(bill)}
                                                            className={`hidden xl:flex p-3 rounded-lg transition-all duration-300 min-w-[44px] min-h-[44px] items-center justify-center ${
                                                                isStateBillHighlighted(bill)
                                                                    ? 'text-yellow-500 bg-yellow-50 border border-yellow-200 hover:bg-yellow-100'
                                                                    : 'text-gray-400 hover:bg-gray-100 hover:text-yellow-500 border border-gray-200'
                                                            } ${isBillHighlightLoading(bill) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            title={
                                                                isBillHighlightLoading(bill)
                                                                    ? "Processing..."
                                                                    : isStateBillHighlighted(bill)
                                                                        ? "Remove from highlights"
                                                                        : "Add to highlights"
                                                            }
                                                        >
                                                            {isBillHighlightLoading(bill) ? (
                                                                <RefreshIcon size={18} className="animate-spin" />
                                                            ) : (
                                                                <Star size={18} className={isStateBillHighlighted(bill) ? "fill-current" : ""} />
                                                            )}
                                                        </button>
                                                        
                                                    </div>
                                                </div>
                                                
                                                {/* Bill Progress Bar */}
                                                <div className="mb-6">
                                                    <BillProgressBar 
                                                        status={getBillStatus(bill)} 
                                                        className="w-full"
                                                    />
                                                </div>
                                                
                                                {/* Simplified Summary */}
                                                {bill.summary && bill.summary !== 'No summary available' && (
                                                    <div className="mb-6">
                                                        <div className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-5">
                                                            <div className="flex items-center justify-between mb-3">
                                                                <div className="flex items-center gap-2">
                                                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{bill.bill_number} AI Generated Summary</h3>
                                                                </div>
                                                                <div className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-purple-500 dark:to-indigo-500 text-white rounded-lg text-xs font-bold">
                                                                    AI
                                                                </div>
                                                            </div>
                                                            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                                                {bill.summary}
                                                            </div>
                                                            {bill.legiscan_url && (
                                                                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                                                                    <a 
                                                                        href={bill.legiscan_url} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200"
                                                                    >
                                                                        <ExternalLink size={14} />
                                                                        <span>View Original Bill Information</span>
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">No Legislation Found</h3>
                                <p className="text-gray-600 dark:text-gray-400 mb-4">
                                    No legislation data is currently available for {stateName}.
                                </p>
                            </div>
                        )}
                        
                        {/* Pagination */}
                        <PaginationControls
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            itemsPerPage={ITEMS_PER_PAGE}
                            onPageChange={handlePageChange}
                            itemType="bills"
                        />
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Status Helper Tooltip */}
            <StatusHelperTooltip
                status={selectedStatus}
                isOpen={statusTooltipOpen}
                onClose={closeStatusTooltip}
                position={tooltipPosition}
            />
        </div>
    );
};

export default StatePage;