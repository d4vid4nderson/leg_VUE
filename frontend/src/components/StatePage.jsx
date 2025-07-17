// StatePage.jsx - Updated with fetch button and sliding time period buttons

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    ChevronDown,
    FileText,
    Star,
    ExternalLink,
    GraduationCap,
    HeartPulse,
    Wrench,
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
    Download, // Added for fetch button
    MapPin,
    MoreVertical, // Added for mobile menu
    Flag,
    Bell,
    Clock,
    LayoutGrid,
    Sparkles
} from 'lucide-react';

import { FILTERS, SUPPORTED_STATES } from '../utils/constants';
import { stripHtmlTags } from '../utils/helpers';
import { calculateAllCounts } from '../utils/filterUtils';
import useReviewStatus from '../hooks/useReviewStatus';
import ShimmerLoader from '../components/ShimmerLoader';
import BillCardSkeleton from '../components/BillCardSkeleton';
import StateOutlineBackground from '../components/StateOutlineBackground';
import SessionNotification from '../components/SessionNotification';
import SessionFilter from '../components/SessionFilter';
import HighlightsFilter from '../components/HighlightsFilter';
import StatusFilter from '../components/StatusFilter';
import ManualRefresh from '../components/ManualRefresh';
import API_URL from '../config/api';
import { 
    getCurrentStatus, 
    mapLegiScanStatus, 
    getStatusColorClasses, 
    getStatusIcon, 
    getStatusDescription,
    debugBillStatus,
    validateStatusFields 
} from '../utils/statusUtils';

// Pagination configuration
const ITEMS_PER_PAGE = 25;

// Bill status filter options
const STATUS_FILTERS = [
    {
        key: 'introduced',
        label: 'Introduced',
        icon: Check,
        type: 'bill_status',
        description: 'Bills that have been introduced'
    },
    {
        key: 'engrossed',
        label: 'Engrossed',
        icon: Check,
        type: 'bill_status',
        description: 'Bills that have passed one chamber'
    },
    {
        key: 'enrolled',
        label: 'Enrolled',
        icon: Check,
        type: 'bill_status',
        description: 'Bills that have passed both chambers'
    },
    {
        key: 'passed',
        label: 'Passed',
        icon: Flag,
        type: 'bill_status',
        description: 'Bills that have been passed'
    },
    {
        key: 'final',
        label: 'Final',
        icon: Flag,
        type: 'bill_status',
        description: 'Bills at final stage (Passed/Enacted/Vetoed/Failed)'
    }
];

// Helper Functions
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
const EditableCategoryTag = ({ category, itemId, itemType, onCategoryChange, disabled }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(cleanCategory(category));
    const dropdownRef = useRef(null);
    
    const handleCategorySelect = async (newCategory) => {
        if (newCategory !== selectedCategory && onCategoryChange) {
            try {
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
            case 'civic': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'education': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'engineering': return 'bg-green-100 text-green-800 border-green-200';
            case 'healthcare': return 'bg-red-100 text-red-800 border-red-200';
            case 'all_practice_areas': return 'bg-teal-100 text-teal-800 border-teal-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
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
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[120] min-w-[160px] w-max">
                    <div className="py-1">
                        {FILTERS.map((filter) => {
                            const isSelected = filter.key === cleanedCategory;
                            return (
                                <button
                                    key={filter.key}
                                    onClick={() => handleCategorySelect(filter.key)}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${
                                        isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
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


// Horizontal Progress Indicator Component for Bill Status
const StatusProgressBar = ({ status, onStageClick }) => {
    const mappedStatus = mapLegiScanStatus(status);
    
    // Define the legislative process stages in order - dynamic last stage
    const getStatusStages = (currentStatus) => {
        const baseStages = [
            { key: 'introduced', label: 'Introduced', shortLabel: 'Intro' },
            { key: 'engrossed', label: 'Engrossed', shortLabel: 'Eng' },
            { key: 'enrolled', label: 'Enrolled', shortLabel: 'Enr' },
            { key: 'passed', label: 'Passed', shortLabel: 'Pass' }
        ];
        
        // Dynamic final stage based on actual LegiScan status
        if (currentStatus === 'Signed by Governor' || currentStatus === 'Effective') {
            baseStages.push({ key: 'enacted', label: 'Enacted', shortLabel: 'Law' });
        } else if (currentStatus === 'Vetoed') {
            baseStages.push({ key: 'vetoed', label: 'Vetoed', shortLabel: 'Veto' });
        } else if (currentStatus === 'Failed/Dead' || currentStatus === 'Indefinitely Postponed') {
            baseStages.push({ key: 'failed', label: 'Failed', shortLabel: 'Failed' });
        } else {
            // Default final stage
            baseStages.push({ key: 'final', label: 'Final', shortLabel: 'Final' });
        }
        
        return baseStages;
    };
    
    const statusStages = getStatusStages(mappedStatus);
    
    // Map current status to stage - based on actual LegiScan statuses
    const getStageIndex = (currentStatus) => {
        const mappedStatus = mapLegiScanStatus(currentStatus);
        
        // Map LegiScan statuses to progress bar stages
        if (mappedStatus === 'Introduced') return 0;
        if (mappedStatus === 'Engrossed') return 1; // Passed one chamber
        if (mappedStatus === 'Enrolled') return 2; // Passed both chambers
        if (mappedStatus === 'Passed') return 3; // Final passage
        if (mappedStatus === 'Signed by Governor' || mappedStatus === 'Effective') return 4; // Enacted into law
        if (mappedStatus === 'Vetoed') return 4; // Vetoed at final stage
        if (mappedStatus === 'Failed/Dead' || mappedStatus === 'Indefinitely Postponed') return 4; // Failed - show at end
        
        // Default to introduced for unknown statuses
        return 0;
    };
    
    const currentStageIndex = getStageIndex(status);
    const isFailed = mappedStatus === 'Failed/Dead' || mappedStatus === 'Indefinitely Postponed';
    const isVetoed = mappedStatus === 'Vetoed';
    
    const handleStageClick = (stage, index, e) => {
        e.stopPropagation();
        if (onStageClick) {
            onStageClick(stage, index, e);
        }
    };
    
    // Calculate circle color based on dynamic progression
    const getCircleColor = (index) => {
        const progress = index / (statusStages.length - 1);
        
        if (isFailed || isVetoed) {
            // Blue to red gradient for failed/vetoed bills
            const r = Math.round(59 + (239 - 59) * progress);   // 59 (blue) to 239 (red)
            const g = Math.round(130 + (68 - 130) * progress);  // 130 (blue) to 68 (red)
            const b = Math.round(246 + (68 - 246) * progress);  // 246 (blue) to 68 (red)
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            // Blue progression for successful bills
            const r = Math.round(59 + (29 - 59) * progress);    // 59 (light blue) to 29 (dark blue)
            const g = Math.round(130 + (78 - 130) * progress);  // 130 (light blue) to 78 (dark blue)
            const b = Math.round(246 + (216 - 246) * progress); // 246 (light blue) to 216 (dark blue)
            return `rgb(${r}, ${g}, ${b})`;
        }
    };

    // Get dynamic icon for each stage
    const getStageIcon = (stage, index) => {
        if (index < currentStageIndex) {
            // Completed stages - only show checkmarks if bill actually succeeded
            if (isFailed || isVetoed) {
                // For failed/vetoed bills, show X's for earlier stages (they didn't truly succeed)
                return <X size={12} className="text-white" strokeWidth={3} />;
            } else {
                // For successful bills, show checkmarks for completed stages
                return <Check size={12} className="text-white" strokeWidth={3} />;
            }
        } else if (index === currentStageIndex) {
            // Current stage depends on status
            if (isFailed || isVetoed) {
                return <X size={12} className="text-white" strokeWidth={3} />;
            } else if (index === statusStages.length - 1 && (mappedStatus === 'Signed by Governor' || mappedStatus === 'Effective')) {
                // Only show flag for truly enacted laws
                return <Flag size={12} className="text-white" strokeWidth={3} />;
            } else {
                // All other current stages get checkmark (including "Passed", "Introduced", etc.)
                return <Check size={12} className="text-white" strokeWidth={3} />;
            }
        } else {
            // Future stages are empty
            return null;
        }
    };
    
    return (
        <div className="w-full px-0 py-2">
            <div className="relative w-full">
                {/* Progress line background - positioned to align with circle centers */}
                <div className="absolute top-3 h-2 bg-gray-300" style={{ left: '16px', right: '16px' }}></div>
                
                {/* Progress line foreground - positioned to align with circle centers */}
                <div 
                    className="absolute top-3 h-2 transition-all duration-300"
                    style={{
                        left: '16px',
                        right: currentStageIndex === statusStages.length - 1 ? '16px' : 'auto',
                        width: currentStageIndex === statusStages.length - 1 ? 'auto' : `${((currentStageIndex) / (statusStages.length - 1)) * (100 - 32)}%`,
                        background: isFailed || isVetoed
                            ? 'linear-gradient(to right, #3b82f6, #ef4444)' // Blue to red for failed/vetoed
                            : 'linear-gradient(to right, #3b82f6, #1d4ed8)' // Blue progression for successful
                    }}
                ></div>
                
                {/* Circles positioned across full width */}
                <div className="flex w-full relative" style={{ justifyContent: 'space-between' }}>
                    {statusStages.map((stage, index) => (
                        <div key={stage.key} className="flex flex-col items-center relative">
                            <div
                                onClick={(e) => handleStageClick(stage, index, e)}
                                className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 relative z-10 cursor-pointer border-2"
                                style={{
                                    backgroundColor: index <= currentStageIndex ? getCircleColor(index) : 'white',
                                    borderColor: index <= currentStageIndex ? getCircleColor(index) : '#d1d5db'
                                }}
                                title={getStatusDescription(stage.key)}
                            >
                                {getStageIcon(stage, index)}
                            </div>
                            
                            {/* Label under circle */}
                            <span 
                                className="text-xs font-medium mt-1 text-center whitespace-nowrap"
                                style={{
                                    color: index <= currentStageIndex ? getCircleColor(index) : '#6b7280'
                                }}
                            >
                                {stage.shortLabel}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// Fetch Button Component with sliding time period buttons
const FetchButtonGroup = ({ onFetch, isLoading }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedPeriod, setSelectedPeriod] = useState(null);
    const fetchDropdownRef = useRef(null);
    
    const handleFetchClick = () => {
        setIsExpanded(!isExpanded);
    };
    
    const handlePeriodClick = (period) => {
        setSelectedPeriod(period);
        onFetch(period);
        setIsExpanded(false);
        
        // Reset selection after a moment
        setTimeout(() => setSelectedPeriod(null), 2000);
    };
    
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (fetchDropdownRef.current && !fetchDropdownRef.current.contains(event.target)) {
                setIsExpanded(false);
            }
        };
        
        if (isExpanded) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isExpanded]);
    
    return (
        <div className="relative" ref={fetchDropdownRef}>
            {/* Main Fetch Button */}
            <button
                onClick={handleFetchClick}
                disabled={isLoading}
                className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-all duration-300 ${
                    isLoading 
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700'
                }`}
            >
                {isLoading ? (
                    <RefreshIcon size={16} className="animate-spin" />
                ) : (
                    <Download size={16} />
                )}
                <span>{isLoading ? 'Fetching from LegiScan...' : 'Fetch Fresh Bills'}</span>
            </button>
            
            {/* Sliding Time Period Buttons */}
            <div className={`absolute top-full left-0 mt-2 transition-all duration-300 ease-out ${
                isExpanded 
                    ? 'opacity-100 translate-y-0 visible' 
                    : 'opacity-0 -translate-y-2 invisible'
            }`}>
                <div className="bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden min-w-[180px]">
                    <div className="py-2">
                        {[
                            { key: '7days', label: 'Last 7 Days' },
                            { key: '30days', label: 'Last 30 Days' },
                            { key: '90days', label: 'Last 90 Days' }
                        ].map((period, index) => (
                            <button
                                key={period.key}
                                onClick={() => handlePeriodClick(period.key)}
                                disabled={isLoading}
                                className={`w-full px-4 py-2.5 text-left text-sm transition-all duration-200 ${
                                    isLoading 
                                        ? 'text-gray-400 cursor-not-allowed'
                                        : 'hover:bg-blue-50 hover:text-blue-700'
                                } ${
                                    selectedPeriod === period.key 
                                        ? 'bg-blue-100 text-blue-800 font-medium' 
                                        : 'text-gray-700'
                                }`}
                                style={{
                                    transitionDelay: `${index * 50}ms`
                                }}
                            >
                                <div className="flex items-center justify-between">
                                    <span>{period.label}</span>
                                    {period.key === '7days' && <span className="text-xs text-gray-500">Recent</span>}
                                    {period.key === '30days' && <span className="text-xs text-gray-500">Standard</span>}
                                    {period.key === '90days' && <span className="text-xs text-gray-500">Extended</span>}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{startItem}</span> to{' '}
                <span className="font-medium">{endItem}</span> of{' '}
                <span className="font-medium">{totalItems}</span> {itemType}
            </div>
            
            <div className="flex items-center gap-2">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`p-2 rounded-md text-sm font-medium transition-all duration-200 ${
                            currentPage === 1 ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'
                        }`}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    
                    <div className="flex items-center gap-1">
                        {getPageNumbers().map((page, index) => (
                            <button
                                key={index}
                                onClick={() => typeof page === 'number' && onPageChange(page)}
                                disabled={page === '...'}
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 min-w-[40px] ${
                                    page === currentPage
                                        ? 'bg-blue-600 text-white'
                                        : page === '...'
                                            ? 'text-gray-400 cursor-default'
                                            : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                    </div>
                    
                    <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`p-2 rounded-md text-sm font-medium transition-all duration-200 ${
                            currentPage === totalPages ? 'text-gray-400 cursor-not-allowed' : 'text-gray-700 hover:bg-gray-100'
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
            className={`fixed right-6 bottom-6 z-50 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
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

    return (
        <div 
            className="status-tooltip absolute bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64 z-[120]"
            style={{
                top: position?.top || 0,
                left: position?.left || 0,
                transform: 'translate(-50%, 8px)',
            }}
        >
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2">
                <div className="w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-200"></div>
                <div className="w-0 h-0 border-l-3 border-r-3 border-b-3 border-transparent border-b-white absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-px"></div>
            </div>
            
            <div className="flex justify-between items-start mb-2">
                <h4 className="text-sm font-semibold text-gray-800 flex-1">
                    {statusText}
                </h4>
                <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 ml-2 flex-shrink-0"
                >
                    <X size={12} />
                </button>
            </div>
            
            <p className="text-xs text-gray-600 leading-relaxed">
                {statusDescription}
            </p>
        </div>
    );
};

// AI Content Formatting Functions

// Main StatePage Component
const StatePage = ({ stateName, stableHandlers }) => {
    // Core state
    const [stateOrders, setStateOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [fetchLoading, setFetchLoading] = useState(false); // New state for fetch loading
    const [fetchSuccess, setFetchSuccess] = useState(null); // Success message for fetch
    const [activeMobileMenu, setActiveMobileMenu] = useState(null); // Mobile menu state
    
    // Manual refresh state
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [headerVisible, setHeaderVisible] = useState(true);
    const [lastUpdateTime, setLastUpdateTime] = useState(null);
    
    // Filter state (matching ExecutiveOrdersPage pattern)
    const [selectedFilters, setSelectedFilters] = useState([]);
    const [selectedStatusFilter, setSelectedStatusFilter] = useState(null);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    
    // Sort state
    const [sortOrder, setSortOrder] = useState('latest');
    
    // Session filter state
    const [selectedSessions, setSelectedSessions] = useState([]);
    
    // Highlights filter state - persistent in localStorage
    const [isHighlightFilterActive, setIsHighlightFilterActive] = useState(() => {
        const saved = localStorage.getItem('highlightFilterActive');
        return saved === 'true';
    });
    
    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [pagination, setPagination] = useState({
        page: 1,
        per_page: 25,
        total_pages: 1,
        count: 0
    });
    
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
        reviewed: 0,
        not_reviewed: 0,
        total: 0
    });
    
    // Review status hook
    const { toggleReviewStatus, isItemReviewed, isItemReviewLoading } = useReviewStatus(stateOrders, 'state_legislation');
    
    // Highlights state
    const [localHighlights, setLocalHighlights] = useState(new Set());
    const [highlightLoading, setHighlightLoading] = useState(new Set());
    
    
    const filterDropdownRef = useRef(null);
    
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
        return `state-bill-${Math.random().toString(36).substr(2, 9)}`;
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
    
    // Handle review toggle with state update
    const handleReviewToggle = async (bill) => {
        const success = await toggleReviewStatus(bill);
        
        if (success !== null && success !== undefined) {
            // Update the main stateOrders state to persist the change
            const billId = getStateBillId(bill);
            setStateOrders(prevBills => 
                prevBills.map(b => {
                    const currentBillId = getStateBillId(b);
                    if (currentBillId === billId) {
                        console.log(`🔄 Updating bill ${currentBillId} reviewed status: ${b.reviewed} → ${success}`);
                        return { ...b, reviewed: success };
                    }
                    return b;
                })
            );
            console.log(`✅ Successfully updated reviewed status for bill ${billId}`);
        }
    };
    
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
            const response = await fetch(`${API_URL}/api/state-legislation/${itemId}/category`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    category: newCategory,
                    user_id: 1 // You might want to get this from authentication
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to update category: ${response.statusText}`);
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
    const openStatusTooltip = (status, event, bill = null) => {
        const rect = event.target.getBoundingClientRect();
        setTooltipPosition({
            top: rect.bottom + window.scrollY,
            left: rect.left + window.scrollX + rect.width * 0.5
        });
        setSelectedStatus(status);
        setStatusTooltipOpen(true);
    };

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
    
    const clearAllFilters = () => {
        setSelectedFilters([]);
        setSelectedStatusFilter(null);
        setSelectedSessions([]);
        setIsHighlightFilterActive(false);
        localStorage.setItem('highlightFilterActive', 'false');
        setCurrentPage(1);
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
    
    // New fetch handler for time periods - fetches fresh bills from LegiScan API
    const handleFetch = useCallback(async (period) => {
        setFetchLoading(true);
        setError(null); // Clear any existing errors
        setFetchSuccess(null); // Clear any existing success messages
        
        try {
            // Calculate date range based on period
            const now = new Date();
            const daysAgo = period === '7days' ? 7 : period === '30days' ? 30 : 90;
            const startDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
            
            console.log(`🔍 Fetching fresh bills from LegiScan for ${period} (last ${daysAgo} days)`);
            console.log(`📅 Date range: ${startDate.toISOString()} to ${now.toISOString()}`);
            console.log(`🎯 Target: Find bills from July 14, 2025 (HB47, HB36, HB69, etc.)`);
            
            const stateAbbr = SUPPORTED_STATES[stateName];
            
            // Determine search parameters based on period
            let limit = 100; // Increased default to get more bills
            let yearFilter = 'current'; // Default to current year for recent bills
            let maxPages = 10; // Increased to get more comprehensive results
            
            if (period === '7days') {
                limit = 50;
                yearFilter = 'current'; // Recent bills likely to be in current year
                maxPages = 5; // Should be enough for recent bills with smart query
            } else if (period === '30days') {
                limit = 100;
                yearFilter = 'current';
                maxPages = 8;
            } else { // 90days
                limit = 150;
                yearFilter = 'all'; // Wider search for longer periods
                maxPages = 12;
            }
            
            // FORCE USE OF ENHANCED SEARCH WITH SMART DATE QUERY FOR ALL PERIODS
            // This ensures we get the July 14, 2025 bills
            let fetchUrl, requestBody;
            
            // Use the enhanced search endpoint with specific date queries to get July 14 bills
            fetchUrl = `${API_URL}/api/legiscan/enhanced-search-and-analyze`;
            
            // Smart query strategy based on period
            let smartQuery;
            if (period === '7days') {
                smartQuery = '2025-07-14'; // Specific date for July 14 bills
            } else if (period === '30days') {
                smartQuery = '2025-07'; // July 2025 bills
            } else {
                smartQuery = 'introduced'; // Broader search for 90 days
            }
            
            requestBody = {
                query: smartQuery,
                state: stateAbbr,
                limit: limit,
                save_to_db: true,
                process_one_by_one: false,
                with_ai_analysis: true,
                enhanced_ai: true,
                year_filter: yearFilter,
                max_pages: maxPages
            };
            
            console.log(`🎯 Using smart query '${smartQuery}' for ${period} to find July 14 bills`);
            
            const response = await fetch(fetchUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                // Handle different response formats
                let newBills = [];
                if (result.bills) {
                    newBills = result.bills;
                } else if (result.results && Array.isArray(result.results)) {
                    // Bulk fetch format - flatten results from all states
                    newBills = result.results.reduce((acc, stateResult) => {
                        if (stateResult.bills) {
                            acc.push(...stateResult.bills);
                        }
                        return acc;
                    }, []);
                } else if (result.data && Array.isArray(result.data)) {
                    newBills = result.data;
                }
                
                console.log(`✅ Successfully fetched ${newBills.length} fresh bills from LegiScan`);
                
                // Show success message
                if (newBills.length > 0) {
                    console.log(`📊 Added ${newBills.length} new bills to the database`);
                    setFetchSuccess(`Successfully fetched ${newBills.length} fresh bills from LegiScan! These include the most recent bills available.`);
                    
                    // Refresh the page data to show new bills
                    await fetchFromDatabase(1);
                    
                    // Clear success message after 5 seconds
                    setTimeout(() => setFetchSuccess(null), 5000);
                } else {
                    console.log('ℹ️ No new bills found for the selected period');
                    setFetchSuccess('No new bills found for the selected period. Database is up to date.');
                    setTimeout(() => setFetchSuccess(null), 3000);
                }
            } else {
                throw new Error(result.error || 'Failed to fetch bills from LegiScan');
            }
            
        } catch (error) {
            console.error('❌ Error fetching fresh bills:', error);
            setError(`Failed to fetch fresh bills for ${period}: ${error.message}`);
        } finally {
            setFetchLoading(false);
        }
    }, [stateName]);
    
    // Fetch data from database
    const fetchFromDatabase = useCallback(async (pageNum = 1) => {
        try {
            setLoading(true);
            setError(null);
            
            const perPage = 25;
            const stateAbbr = SUPPORTED_STATES[stateName];
            const url = `${API_URL}/api/state-legislation?state=${stateAbbr}&page=${pageNum}&per_page=${perPage}`;
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
                    summary: bill?.summary ? stripHtmlTags(bill.summary) : 'No summary available',
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
            setPagination({
                page: currentPage,
                per_page: perPage,
                total_pages: totalPages,
                count: totalCount
            });
            
        } catch (err) {
            console.error('❌ Error fetching data:', err);
            setError(`Failed to load state legislation: ${err.message}`);
            setStateOrders([]);
        } finally {
            setLoading(false);
        }
    }, [stateName, getStateBillId]);
    
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
                
                const response = await fetch(`${API_URL}/api/highlights/${billId}?user_id=1`, {
                    method: 'DELETE',
                });
                
                if (!response.ok) {
                    setLocalHighlights(prev => new Set([...prev, billId]));
                }
            } else {
                setLocalHighlights(prev => new Set([...prev, billId]));
                
                const response = await fetch(`${API_URL}/api/highlights`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_id: 1,
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
                reviewed: 0,
                not_reviewed: 0,
                total: 0
            });
        }
    }, [stateOrders, isItemReviewed]);

    // Close mobile menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (activeMobileMenu && !event.target.closest('.mobile-menu-container')) {
                setActiveMobileMenu(null);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [activeMobileMenu]);
    
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
                const billStatus = (bill.status || '').toLowerCase();
                return billStatus.includes(selectedStatusFilter.toLowerCase());
            });
        }
        
        // Apply highlights filter
        if (isHighlightFilterActive) {
            filtered = filtered.filter(bill => isStateBillHighlighted(bill));
        }
        
        // Apply session filters
        if (selectedSessions.length > 0) {
            filtered = filtered.filter(bill => {
                const billSession = bill.session || bill.session_name;
                return billSession && selectedSessions.includes(billSession);
            });
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
            fetchFromDatabase(1);
        }
    }, [stateName, fetchFromDatabase]);
    
    // Manual refresh handlers
    const handleRefreshStart = useCallback(() => {
        setIsRefreshing(true);
        setError(null);
        setFetchSuccess(null);
    }, []);
    
    const handleRefreshComplete = useCallback(async (result) => {
        setIsRefreshing(false);
        setLastUpdateTime(new Date());
        
        if (result && (result.bills_updated > 0 || result.bills_added > 0)) {
            setFetchSuccess(
                `Successfully updated! ${result.bills_added || 0} new bills added, ${result.bills_updated || 0} bills updated.`
            );
            
            // Refresh the bills list
            await fetchFromDatabase(1);
            
            // Clear success message after 5 seconds
            setTimeout(() => setFetchSuccess(null), 5000);
        } else {
            setFetchSuccess('No new updates found. Your data is current.');
            setTimeout(() => setFetchSuccess(null), 3000);
        }
    }, [fetchFromDatabase]);
    
    const handleRefreshError = useCallback((error) => {
        setIsRefreshing(false);
        setError(`Failed to refresh: ${error.message}`);
        setTimeout(() => setError(null), 5000);
    }, []);
    
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
    
    // Scroll detection for mobile floating refresh
    useEffect(() => {
        const handleScroll = () => {
            const header = document.getElementById('page-header');
            if (header) {
                const headerRect = header.getBoundingClientRect();
                setHeaderVisible(headerRect.bottom > 0);
            }
        };
        
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    
    // Load highlights on mount
    useEffect(() => {
        const loadHighlights = async () => {
            try {
                const response = await fetch(`${API_URL}/api/highlights?user_id=1`);
                if (response.ok) {
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
        <div className="pt-6 min-h-screen bg-gradient-to-b from-green-50 to-white">
            <ScrollToTopButton />
            
            {/* Page Header */}
            <section id="page-header" className="relative overflow-hidden px-6 pt-12 pb-8">
                <div className="max-w-7xl mx-auto relative z-10">
                    {/* Centered Badge */}
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
                            <StateOutlineBackground 
                                stateName={stateName} 
                                className="w-4 h-4"
                                isIcon={true}
                            />
                            {stateName} State Legislation
                        </div>
                    </div>
                    
                    {/* Clean Header Layout */}
                    <div className="text-center mb-8">
                        {/* Main Title */}
                        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                            <span className="block">{stateName}</span>
                            <span className="block bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent py-2">Legislation</span>
                        </h1>
                        
                        {/* Description */}
                        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
                            Access the latest legislation and bills from {stateName} with simple, clear overviews. Stay informed about new legislation and track the status of important bills affecting your state.
                        </p>
                        
                        {/* Status Bar with Refresh Button */}
                        <div className="flex flex-col items-center justify-center gap-4 mb-6">
                            {/* Refresh Button */}
                            <div className="flex justify-center">
                                <ManualRefresh 
                                    id="main-refresh-button"
                                    stateCode={SUPPORTED_STATES[stateName]}
                                    size="medium"
                                    onRefreshStart={handleRefreshStart}
                                    onRefreshComplete={handleRefreshComplete}
                                    onRefreshError={handleRefreshError}
                                    className="transition-all duration-200"
                                />
                            </div>
                            
                            {/* Status Info */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
                                <span className="font-medium text-center">{stateOrders.length} bills loaded</span>
                                {lastUpdateTime && (
                                    <span className="flex items-center justify-center gap-1">
                                        <Clock size={14} />
                                        Last updated: {lastUpdateTime.toLocaleTimeString()}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
            
            {/* Single Smart Notification System */}
            <div className="max-w-7xl mx-auto px-6 mb-4">
                {/* Success Message */}
                {fetchSuccess && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3 mb-4">
                        <Check size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-green-800 font-medium">Update Successful</p>
                            <p className="text-green-700 text-sm mt-1">{fetchSuccess}</p>
                        </div>
                    </div>
                )}
                
                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3 mb-4">
                        <AlertTriangle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-red-800 font-medium">Update Failed</p>
                            <p className="text-red-700 text-sm mt-1">{error}</p>
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center space-x-3 mb-4">
                        <RefreshIcon size={20} className="text-blue-600 animate-spin flex-shrink-0" />
                        <div>
                            <p className="text-blue-800 font-medium">Refreshing Bills...</p>
                            <p className="text-blue-700 text-sm">Fetching the latest data from LegiScan</p>
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
            <div className="mb-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-6">
                        {/* Controls Bar - Sort/filter controls */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                            {/* Sort Button - Mobile Optimized */}
                            <button
                                onClick={() => setSortOrder(sortOrder === 'latest' ? 'earliest' : 'latest')}
                                className="flex items-center justify-center gap-3 px-4 py-3 border rounded-lg text-sm font-medium transition-all duration-300 bg-white text-gray-700 border-gray-300 hover:bg-gray-50 min-h-[44px]"
                            >
                                {sortOrder === 'latest' ? (
                                    <>
                                        <ArrowDown size={16} />
                                        <span>Latest Date</span>
                                    </>
                                ) : (
                                    <>
                                        <ArrowUpIcon size={16} />
                                        <span>Earliest Date</span>
                                    </>
                                )}
                            </button>
                            
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
                                
                                {/* Clear All Filters Button - Slides in when multiple filters are active */}
                                <div className={`relative overflow-hidden transition-all duration-300 ease-in-out ${
                                    (selectedFilters.length > 0 ? 1 : 0) + 
                                    (selectedStatusFilter ? 1 : 0) + 
                                    (selectedSessions.length > 0 ? 1 : 0) + 
                                    (isHighlightFilterActive ? 1 : 0) > 1
                                        ? 'w-full sm:w-32 opacity-100' 
                                        : 'w-0 opacity-0'
                                }`}>
                                    <button
                                        onClick={() => {
                                            clearAllFilters();
                                        }}
                                        className="flex items-center justify-center px-3 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 transition-all duration-200 w-full sm:w-32 min-h-[44px] text-gray-700"
                                        title="Clear all active filters"
                                    >
                                        <X size={16} className="mr-1" />
                                        <span className="whitespace-nowrap">Clear All</span>
                                    </button>
                                </div>
                                
                                {/* Highlights Filter */}
                                <HighlightsFilter 
                                    isHighlightFilterActive={isHighlightFilterActive}
                                    onHighlightFilterChange={(value) => {
                                        setIsHighlightFilterActive(value);
                                        localStorage.setItem('highlightFilterActive', value.toString());
                                    }}
                                    disabled={loading || fetchLoading}
                                    loading={loading}
                                    highlightCount={stateOrders.filter(bill => isStateBillHighlighted(bill)).length}
                                />
                                
                                {/* Session Filter */}
                                <SessionFilter 
                                    sessions={(() => {
                                        // Get unique sessions from bills with actual session data
                                        const sessionMap = new Map();
                                        stateOrders.forEach((bill) => {
                                            const sessionName = bill.session || bill.session_name;
                                            
                                            if (sessionName && sessionName.trim() && sessionName !== 'Unknown Session') {
                                                const sessionKey = sessionName;
                                                if (!sessionMap.has(sessionKey)) {
                                                    sessionMap.set(sessionKey, {
                                                        session_id: sessionKey,
                                                        session_name: sessionName,
                                                        year_start: extractYearFromSession(sessionName),
                                                        year_end: null,
                                                        is_active: sessionName.includes('2025') || sessionName.includes('2024'),
                                                        is_likely_active: sessionName.includes('2025')
                                                    });
                                                }
                                            }
                                        });
                                        return Array.from(sessionMap.values());
                                    })()}
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
                                                const billStatus = (bill.status || '').toLowerCase();
                                                return billStatus.includes(filter.key.toLowerCase());
                                            }).length;
                                        });
                                        return counts;
                                    })()}
                                />
                                
                                {/* Filter Dropdown */}
                                <div className="relative" ref={filterDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                                        className={`flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 transition-all duration-300 w-full sm:w-56 min-h-[44px] ${
                                            selectedFilters.length > 0 ? 'ring-2 ring-blue-500 border-blue-500' : ''
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            {(() => {
                                                if (selectedFilters.length > 0) {
                                                    const selectedFilter = FILTERS.find(f => f.key === selectedFilters[0]);
                                                    if (selectedFilter) {
                                                        const IconComponent = selectedFilter.icon;
                                                        return <IconComponent size={16} className="text-gray-500" />;
                                                    }
                                                }
                                                return <LayoutGrid size={16} className="text-gray-500" />;
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
                                            className={`transition-transform duration-200 flex-shrink-0 ${showFilterDropdown ? 'rotate-180' : ''}`}
                                        />
                                    </button>

                                    {/* Dropdown content - Match HighlightsPage structure exactly */}
                                    {showFilterDropdown && (
                                        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-[120]">
                                            {/* Header */}
                                            <div className="sticky top-0 bg-gray-50 px-4 py-2 border-b border-gray-200">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium text-gray-700">
                                                        Filter by Practice Area
                                                    </span>
                                                    {selectedFilters.length > 0 && (
                                                        <button
                                                            onClick={() => {
                                                                clearPracticeAreaFilters();
                                                                setShowFilterDropdown(false);
                                                            }}
                                                            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                                                        >
                                                            Clear
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div>
                                                {/* Practice Areas Section */}
                                                <div className="border-b border-gray-200 pb-2">
                                                
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
                                                                    ? filter.key === 'all_practice_areas' ? 'bg-teal-100 text-teal-700 font-medium' :
                                                                      filter.key === 'civic' ? 'bg-blue-100 text-blue-700 font-medium' :
                                                                      filter.key === 'education' ? 'bg-orange-100 text-orange-700 font-medium' :
                                                                      filter.key === 'engineering' ? 'bg-green-100 text-green-700 font-medium' :
                                                                      filter.key === 'healthcare' ? 'bg-red-100 text-red-700 font-medium' :
                                                                      filter.key === 'not-applicable' ? 'bg-gray-100 text-gray-700 font-medium' :
                                                                      'bg-gray-100 text-gray-700 font-medium'
                                                                    : 'text-gray-900 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <IconComponent size={16} />
                                                                <span>{filter.label}</span>
                                                            </div>
                                                            <span className="text-xs text-gray-500">({count})</span>
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
                                        <div key={bill.id || index} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300 relative">
                                            {/* Mobile Menu Button - Top Right Corner */}
                                            <div className="absolute top-4 right-4 lg:hidden">
                                                <div className="relative mobile-menu-container">
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setActiveMobileMenu(activeMobileMenu === bill.id ? null : bill.id);
                                                        }}
                                                        className="p-2 hover:bg-gray-100 rounded-lg transition-all duration-300 border border-gray-200"
                                                    >
                                                        <MoreVertical size={20} className="text-gray-600" />
                                                    </button>
                                                    
                                                    {/* Mobile Action Menu */}
                                                    {activeMobileMenu === bill.id && (
                                                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
                                                            
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    if (!isBillHighlightLoading(bill)) {
                                                                        handleStateBillHighlight(bill);
                                                                    }
                                                                    setActiveMobileMenu(null);
                                                                }}
                                                                disabled={isBillHighlightLoading(bill)}
                                                                className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                                                                    isStateBillHighlighted(bill) ? 'text-yellow-500' : 'text-gray-700'
                                                                }`}
                                                            >
                                                                <Star size={18} className={isStateBillHighlighted(bill) ? "fill-current" : ""} />
                                                                <span>{isStateBillHighlighted(bill) ? 'Highlighted' : 'Add Highlight'}</span>
                                                            </button>
                                                            
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="p-6">
                                                {/* Card Header - Mobile Responsive */}
                                                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-4 gap-4">
                                                    <div className="flex-1 min-w-0 pr-10 lg:pr-4">
                                                        <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 leading-tight pr-2">
                                                            {cleanBillTitle(bill.title)}
                                                        </h3>
                                                        
                                                        {/* Metadata Row - Mobile Optimized */}
                                                        <div className="space-y-3 mb-0">
                                                            {/* Top Row - Bill Number, Date, and Category */}
                                                            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 text-sm">
                                                                <div className="flex items-center gap-1.5 text-gray-700">
                                                                    <Hash size={16} className="text-blue-600" />
                                                                    <span className="font-medium">{bill.bill_number || 'Unknown'}</span>
                                                                </div>
                                                                {bill.introduced_date && (
                                                                    <div className="flex items-center gap-1.5 text-gray-700">
                                                                        <Calendar size={16} className="text-green-600" />
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
                                                                    <div className="flex items-center gap-1.5 text-gray-700">
                                                                        <CalendarDays size={16} className={
                                                                            (bill.session_name || bill.session || '').toLowerCase().includes('special') 
                                                                                ? 'text-purple-600' 
                                                                                : 'text-blue-600'
                                                                        } />
                                                                        <span className={`font-medium ${
                                                                            (bill.session_name || bill.session || '').toLowerCase().includes('special') 
                                                                                ? 'text-purple-700' 
                                                                                : 'text-blue-700'
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
                                                            className={`p-3 rounded-lg transition-all duration-300 min-w-[44px] min-h-[44px] flex items-center justify-center ${
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
                                                
                                                {/* Progress Bar - Full Width */}
                                                {getBillStatus(bill) && (
                                                    <div className="my-6">
                                                        <StatusProgressBar 
                                                            status={getBillStatus(bill)} 
                                                            onStageClick={(stage, index, e) => {
                                                                openStatusTooltip(stage.label, e, bill);
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                                
                                                {/* Simplified Summary */}
                                                {bill.summary && bill.summary !== 'No summary available' && (
                                                    <div className="mb-6">
                                                        <div className="bg-gradient-to-r from-slate-50 to-gray-50 border border-gray-200 rounded-lg p-5">
                                                            <div className="flex items-center gap-3 mb-3">
                                                                <div className="p-2 bg-purple-600 rounded-full">
                                                                    <Sparkles size={16} className="text-white" />
                                                                </div>
                                                                <h3 className="text-lg font-semibold text-gray-900">{bill.bill_number} AI Generated Summary</h3>
                                                            </div>
                                                            <div className="text-sm text-gray-700 leading-relaxed">
                                                                {bill.summary}
                                                            </div>
                                                            {bill.legiscan_url && (
                                                                <div className="mt-4 pt-4 border-t border-gray-200">
                                                                    <a 
                                                                        href={bill.legiscan_url} 
                                                                        target="_blank" 
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200"
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
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Legislation Found</h3>
                                <p className="text-gray-600 mb-4">
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
            
            {/* Status Helper Tooltip */}
            <StatusHelperTooltip
                status={selectedStatus}
                isOpen={statusTooltipOpen}
                onClose={closeStatusTooltip}
                position={tooltipPosition}
            />
            
            {/* Mobile Floating Refresh (only when header is not visible) */}
            {!headerVisible && (
                <div className="lg:hidden fixed bottom-4 right-4 z-50">
                    <ManualRefresh 
                        stateCode={SUPPORTED_STATES[stateName]}
                        size="large"
                        onRefreshStart={handleRefreshStart}
                        onRefreshComplete={handleRefreshComplete}
                        onRefreshError={handleRefreshError}
                        className="shadow-lg"
                    />
                </div>
            )}
        </div>
    );
};

export default StatePage;