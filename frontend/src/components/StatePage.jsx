// StatePage.jsx - Updated with fetch button and sliding time period buttons

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    ChevronDown,
    FileText,
    Star,
    ExternalLink,
    Building,
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
    Hash,
    X,
    Target,
    TrendingUp,
    Sparkles,
    Download, // Added for fetch button
    MapPin
} from 'lucide-react';

import { FILTERS, SUPPORTED_STATES } from '../utils/constants';
import { stripHtmlTags } from '../utils/helpers';
import { calculateAllCounts } from '../utils/filterUtils';
import useReviewStatus from '../hooks/useReviewStatus';
import ShimmerLoader from '../components/ShimmerLoader';
import BillCardSkeleton from '../components/BillCardSkeleton';
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
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[160px] w-max">
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

// Review Status Tag Component
const ReviewStatusTag = ({ isReviewed }) => {
    if (isReviewed) {
        return (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 text-xs font-medium rounded-md">
                <Check size={12} />
                Reviewed
            </span>
        );
    }
    
    return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-medium rounded-md">
            <AlertTriangle size={12} />
            Not Reviewed
        </span>
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
                <span>{isLoading ? 'Fetching...' : 'Fetch'}</span>
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
                                className={`w-full px-4 py-2.5 text-left text-sm transition-all duration-200 hover:bg-blue-50 hover:text-blue-700 ${
                                    selectedPeriod === period.key 
                                        ? 'bg-blue-100 text-blue-800 font-medium' 
                                        : 'text-gray-700'
                                }`}
                                style={{
                                    transitionDelay: `${index * 50}ms`
                                }}
                            >
                                {period.label}
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
            className="status-tooltip absolute bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-64 z-50"
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
const formatTalkingPoints = (content) => {
    if (!content) return null;
    
    let textContent = content.replace(/<[^>]*>/g, '');
    const numberedMatches = textContent.match(/\d+\.\s*[^.]*(?:\.[^0-9][^.]*)*(?=\s*\d+\.|$)/g);
    const points = [];
    
    if (numberedMatches && numberedMatches.length > 1) {
        numberedMatches.forEach((match) => {
            let cleaned = match.replace(/^\d+\.\s*/, '').trim();
            if (cleaned.length > 10) {
                points.push(cleaned);
            }
        });
    } else {
        const sentences = textContent.split(/(?=\d+\.\s)/).filter(s => s.trim().length > 0);
        sentences.forEach((sentence) => {
            const cleaned = sentence.replace(/^\d+\.\s*/, '').trim();
            if (cleaned.length > 10) {
                points.push(cleaned);
            }
        });
    }
    
    if (points.length > 0) {
        return (
            <div className="space-y-4">
                {points.slice(0, 5).map((point, idx) => (
                    <div key={idx} className="flex gap-4">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                            {idx + 1}
                        </div>
                        <p className="text-sm text-blue-800 leading-relaxed flex-1 pt-1">
                            {point}
                        </p>
                    </div>
                ))}
            </div>
        );
    }
    
    return <div className="text-sm text-gray-700 leading-relaxed">{textContent}</div>;
};

const formatUniversalContent = (content) => {
    if (!content) return null;
    
    let textContent = content.replace(/<(?!\/?(strong|b)\b)[^>]*>/g, '');
    textContent = textContent.replace(/<(strong|b)>(.*?)<\/(strong|b)>/g, '*$2*');
    
    const sectionKeywords = [
        'Risk Assessment', 'Market Opportunity', 'Implementation Requirements',
        'Financial Implications', 'Competitive Implications', 'Timeline Pressures', 'Summary'
    ];
    
    const inlinePattern = new RegExp(`(${sectionKeywords.join('|')})[:.]?\\s*([^]*?)(?=\\s*(?:${sectionKeywords.join('|')}|$))`, 'gi');
    const inlineMatches = [];
    let match;
    
    while ((match = inlinePattern.exec(textContent)) !== null) {
        inlineMatches.push({
            header: match[1].trim(),
            content: match[2].trim(),
            fullMatch: match[0]
        });
    }
    
    if (inlineMatches.length > 0) {
        const sections = [];
        
        inlineMatches.forEach(({ header, content }) => {
            if (header && content && content.length > 5) {
                let cleanHeader = header.trim();
                if (!cleanHeader.endsWith(':')) {
                    cleanHeader += ':';
                }
                
                const items = [];
                const sentences = content.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 5);
                
                if (sentences.length === 1 || content.length < 200) {
                    items.push(content.trim());
                } else {
                    sentences.forEach(sentence => {
                        if (sentence.length > 10) {
                            items.push(sentence);
                        }
                    });
                }
                
                if (items.length > 0) {
                    sections.push({ title: cleanHeader, items: items });
                }
            }
        });
        
        if (sections.length > 0) {
            return (
                <div>
                    {sections.map((section, idx) => (
                        <div key={idx} style={{ marginBottom: '16px' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '14px' }}>
                                {section.title}
                            </div>
                            {section.items.map((item, itemIdx) => (
                                <div key={itemIdx} style={{
                                    marginBottom: '6px',
                                    fontSize: '14px',
                                    lineHeight: '1.6',
                                    wordWrap: 'break-word',
                                    overflowWrap: 'break-word'
                                }}>
                                    {section.items.length === 1 ? item : `• ${item}`}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            );
        }
    }
    
    return <div className="universal-text-content" style={{
        fontSize: '14px',
        lineHeight: '1.6',
        wordWrap: 'break-word',
        overflowWrap: 'break-word'
    }}>{textContent}</div>;
};

// Main StatePage Component
const StatePage = ({ stateName, stableHandlers }) => {
    // Core state
    const [stateOrders, setStateOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [fetchLoading, setFetchLoading] = useState(false); // New state for fetch loading
    
    // Filter state (matching ExecutiveOrdersPage pattern)
    const [selectedFilters, setSelectedFilters] = useState([]);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    
    // Sort state
    const [sortOrder, setSortOrder] = useState('latest');
    
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
    
    // Expanded bills state
    const [expandedBills, setExpandedBills] = useState(new Set());
    
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
    
    // Expand/collapse functions
    const toggleBillExpansion = useCallback((bill) => {
        const billId = getStateBillId(bill);
        if (!billId) return;
        
        setExpandedBills(prev => {
            const newSet = new Set(prev);
            if (newSet.has(billId)) {
                newSet.delete(billId);
            } else {
                newSet.add(billId);
            }
            return newSet;
        });
    }, [getStateBillId]);
    
    const isBillExpanded = useCallback((bill) => {
        const billId = getStateBillId(bill);
        return billId ? expandedBills.has(billId) : false;
    }, [expandedBills, getStateBillId]);
    
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
                method: 'PUT',
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
            const newFilters = prev.includes(filterKey)
                ? prev.filter(f => f !== filterKey)
                : [...prev, filterKey];
            setCurrentPage(1);
            return newFilters;
        });
    };
    
    const clearAllFilters = () => {
        setSelectedFilters([]);
        setCurrentPage(1);
    };
    
    // New fetch handler for time periods
    const handleFetch = useCallback(async (period) => {
        setFetchLoading(true);
        
        try {
            // Calculate date range based on period
            const now = new Date();
            const daysAgo = period === '7days' ? 7 : period === '30days' ? 30 : 90;
            const startDate = new Date(now.getTime() - (daysAgo * 24 * 60 * 60 * 1000));
            
            console.log(`Fetching data for ${period} (last ${daysAgo} days)`);
            console.log(`Date range: ${startDate.toISOString()} to ${now.toISOString()}`);
            
            // Here you would implement your actual fetch logic
            // For now, we'll just simulate a fetch with the existing data
            await fetchFromDatabase(1);
            
            // You could add additional filtering logic here based on the date range
            // or modify the API call to include date parameters
            
        } catch (error) {
            console.error('Error fetching data for period:', period, error);
            setError(`Failed to fetch data for ${period}: ${error.message}`);
        } finally {
            setFetchLoading(false);
        }
    }, []);
    
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
                
                return {
                    id: uniqueId,
                    bill_id: uniqueId,
                    title: bill?.title || 'Untitled Bill',
                    category: cleanCategory(bill?.category),
                    description: bill?.description || bill?.ai_summary || 'No description available',
                    summary: bill?.ai_summary ? stripHtmlTags(bill.ai_summary) : 'No AI summary available',
                    bill_number: bill?.bill_number,
                    state: bill?.state || stateName,
                    legiscan_url: bill?.legiscan_url,
                    ai_talking_points: bill?.ai_talking_points,
                    ai_business_impact: bill?.ai_business_impact,
                    ai_potential_impact: bill?.ai_potential_impact,
                    introduced_date: bill?.introduced_date,
                    last_action_date: bill?.last_action_date,
                    reviewed: bill?.reviewed || false,
                    order_type: 'state_legislation'
                };
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
    
    // Filtered orders (simple filtering without fuzzy search)
    const filteredStateOrders = useMemo(() => {
        if (!Array.isArray(stateOrders)) return [];
        
        let filtered = stateOrders;
        
        // Apply category filters
        const categoryFilters = selectedFilters.filter(f => !['reviewed', 'not_reviewed'].includes(f));
        
        if (categoryFilters.length > 0) {
            filtered = filtered.filter(bill => categoryFilters.includes(cleanCategory(bill?.category)));
        }
        
        // Apply review status filters
        const hasReviewedFilter = selectedFilters.includes('reviewed');
        const hasNotReviewedFilter = selectedFilters.includes('not_reviewed');
        
        if (hasReviewedFilter && !hasNotReviewedFilter) {
            filtered = filtered.filter(bill => isItemReviewed(bill));
        } else if (hasNotReviewedFilter && !hasReviewedFilter) {
            filtered = filtered.filter(bill => !isItemReviewed(bill));
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
    }, [stateOrders, selectedFilters, isItemReviewed, sortOrder]);
    
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
        <div className="pt-6 min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
            <ScrollToTopButton />
            
            {/* Page Header */}
            <section className="relative overflow-hidden px-6 pt-12 pb-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
                            <MapPin size={16} />
                            {stateName} State Legislation
                        </div>
                        
                        <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                            <span className="block">{stateName}</span>
                            <span className="block bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent py-2">Legislation</span>
                        </h1>
                        
                        <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
                            Access the latest legislation and bills from {stateName} with comprehensive AI-powered analysis. Our advanced models provide executive summaries, key strategic insights, and business impact assessments to help you understand the implications of new legislation.
                        </p>
                    </div>
                </div>
            </section>
            
            {/* Results Section */}
            <div className="mb-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-6">
                        {/* Controls Bar - Fetch Button moved to left, sort/filter on right */}
                        <div className="flex items-center justify-between mb-6">
                            {/* Fetch Button Group - Moved to upper left */}
                            <FetchButtonGroup 
                                onFetch={handleFetch} 
                                isLoading={fetchLoading}
                            />
                            
                            <div className="flex gap-4 items-center">
                                {/* Sort Button */}
                                <button
                                    onClick={() => setSortOrder(sortOrder === 'latest' ? 'earliest' : 'latest')}
                                    className="flex items-center gap-3 px-4 py-2.5 border rounded-lg text-sm font-medium transition-all duration-300 bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
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
                                
                                {/* Filter Dropdown */}
                                <div className="relative" ref={filterDropdownRef}>
                                    <button
                                        type="button"
                                        onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                                        className="flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 transition-all duration-300 w-48"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="truncate">
                                                {selectedFilters.length === 0 
                                                    ? 'Filters'
                                                    : selectedFilters.length === 1
                                                    ? (() => {
                                                        const filter = FILTERS.find(f => f.key === selectedFilters[0]);
                                                        if (filter) return filter.label;
                                                        if (selectedFilters[0] === 'all_practice_areas') return 'All Practice Areas';
                                                        if (selectedFilters[0] === 'not-applicable') return 'Not Applicable';
                                                        if (selectedFilters[0] === 'reviewed') return 'Reviewed';
                                                        if (selectedFilters[0] === 'not_reviewed') return 'Not Reviewed';
                                                        return 'Filter';
                                                      })()
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

                                    {/* Dropdown content - Match HighlightsPage structure exactly */}
                                    {showFilterDropdown && (
                                        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
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
                                            
                                            {/* Practice Areas Section */}
                                            <div className="border-b border-gray-200 pb-2">
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                    Practice Areas
                                                </div>
                                                
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
                                                                    : 'text-gray-700 hover:bg-gray-100'
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

                                            {/* Review Status Section */}
                                            <div>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                    Review Status
                                                </div>
                                                
                                                {/* Reviewed */}
                                                <button
                                                    onClick={() => toggleFilter('reviewed')}
                                                    className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                                                        selectedFilters.includes('reviewed')
                                                            ? 'bg-green-100 text-green-700 font-medium'
                                                            : 'text-gray-700 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Check size={16} />
                                                        <span>Reviewed</span>
                                                    </div>
                                                    <span className="text-xs text-gray-500">({filterCounts.reviewed || 0})</span>
                                                </button>

                                                {/* Not Reviewed */}
                                                <button
                                                    onClick={() => toggleFilter('not_reviewed')}
                                                    className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                                                        selectedFilters.includes('not_reviewed')
                                                            ? 'bg-yellow-100 text-yellow-700 font-medium'
                                                            : 'text-gray-700 hover:bg-gray-100'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <AlertTriangle size={16} />
                                                        <span>Not Reviewed</span>
                                                    </div>
                                                    <span className="text-xs text-gray-500">({filterCounts.not_reviewed || 0})</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
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
                                    const billId = getStateBillId(bill);
                                    const isReviewed = isItemReviewed(bill);
                                    const isExpanded = isBillExpanded(bill);
                                    
                                    return (
                                        <div key={bill.id || index} className="bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-all duration-300">
                                            <div className="p-6">
                                                {/* Card Header */}
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex-1 min-w-0">
                                                        <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight">
                                                            {cleanBillTitle(bill.title)}
                                                        </h3>
                                                        
                                                        {/* Metadata Row */}
                                                        <div className="flex flex-wrap items-center gap-4 text-sm mb-3">
                                                            <div className="flex items-center gap-1.5 text-gray-700">
                                                                <Hash size={14} className="text-blue-600" />
                                                                <span className="font-medium">{bill.bill_number || 'Unknown'}</span>
                                                            </div>
                                                            {bill.introduced_date && (
                                                                <div className="flex items-center gap-1.5 text-gray-700">
                                                                    <Calendar size={14} className="text-green-600" />
                                                                    <span>
                                                                        {new Date(bill.introduced_date).toLocaleDateString('en-US', {
                                                                            month: 'numeric',
                                                                            day: 'numeric',
                                                                            year: 'numeric'
                                                                        })}
                                                                    </span>
                                                                </div>
                                                            )}
                                                            {/* Show status if available, otherwise don't show status pill */}
                                                            {getBillStatus(bill) && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openStatusTooltip(getBillStatus(bill), e, bill);
                                                                    }}
                                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 hover:shadow-sm cursor-pointer ${getStatusColorClasses(getBillStatus(bill))}`}
                                                                    title="Click to learn more about this status"
                                                                >
                                                                    {getStatusIcon(getBillStatus(bill))}
                                                                    <span>{mapLegiScanStatus(getBillStatus(bill)) || getBillStatus(bill)}</span>
                                                                </button>
                                                            )}
                                                            <EditableCategoryTag 
                                                                category={bill.category}
                                                                itemId={getStateBillId(bill)}
                                                                itemType="state_legislation"
                                                                onCategoryChange={handleCategoryUpdate}
                                                                disabled={loading || fetchLoading}
                                                            />
                                                            <ReviewStatusTag isReviewed={isReviewed} />
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Action Buttons */}
                                                    <div className="flex items-center gap-3 ml-6 flex-shrink-0">
                                                        {/* Review Button */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleReviewToggle(bill);
                                                            }}
                                                            disabled={isItemReviewLoading(bill)}
                                                            className={`p-2 rounded-md transition-all duration-300 ${
                                                                isItemReviewLoading(bill)
                                                                    ? 'text-gray-500 cursor-not-allowed'
                                                                    : isReviewed
                                                                        ? 'text-green-600 bg-green-50 border border-green-200 hover:bg-green-100'
                                                                        : 'text-gray-400 hover:bg-green-100 hover:text-green-600'
                                                            }`}
                                                            title={isReviewed ? "Mark as not reviewed" : "Mark as reviewed"}
                                                        >
                                                            {isItemReviewLoading(bill) ? (
                                                                <RefreshIcon size={16} className="animate-spin" />
                                                            ) : (
                                                                <Check size={16} />
                                                            )}
                                                        </button>
                                                        
                                                        {/* Highlight Button */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                if (!isBillHighlightLoading(bill)) {
                                                                    handleStateBillHighlight(bill);
                                                                }
                                                            }}
                                                            disabled={isBillHighlightLoading(bill)}
                                                            className={`p-2 rounded-md transition-all duration-300 ${
                                                                isStateBillHighlighted(bill)
                                                                    ? 'text-yellow-500 bg-yellow-50 border border-yellow-200 hover:bg-yellow-100'
                                                                    : 'text-gray-400 hover:bg-gray-100 hover:text-yellow-500'
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
                                                                <RefreshIcon size={16} className="animate-spin" />
                                                            ) : (
                                                                <Star size={16} className={isStateBillHighlighted(bill) ? "fill-current" : ""} />
                                                            )}
                                                        </button>
                                                        
                                                        {/* Expand Button */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                toggleBillExpansion(bill);
                                                            }}
                                                            className="p-2 hover:bg-gray-100 rounded-md transition-all duration-300"
                                                            title={isExpanded ? "Collapse details" : "Expand details"}
                                                        >
                                                            <ChevronDown
                                                                size={20}
                                                                className={`text-gray-500 transition-transform duration-200 ${
                                                                    isExpanded ? 'rotate-180' : ''
                                                                }`}
                                                            />
                                                        </button>
                                                    </div>
                                                </div>
                                                
                                                {/* AI Summary */}
                                                {bill.summary && bill.summary !== 'No AI summary available' && (
                                                    <div className="mb-6">
                                                        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-5">
                                                            <div className="flex items-center justify-between mb-4">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 bg-purple-600 rounded-full">
                                                                        <FileText size={20} className="text-white" />
                                                                    </div>
                                                                    <h3 className="text-lg font-semibold text-purple-900">Legislative Summary</h3>
                                                                </div>
                                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded-md">
                                                                    <Sparkles size={12} />
                                                                    AI Generated
                                                                </div>
                                                            </div>
                                                            <div className="text-sm text-purple-800 leading-relaxed">
                                                                {stripHtmlTags(bill.summary)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Expanded Content */}
                                                {isExpanded && (
                                                    <div className="space-y-6">
                                                        {/* AI Talking Points */}
                                                        {bill.ai_talking_points && (
                                                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-5">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 bg-blue-600 rounded-full">
                                                                            <Target size={20} className="text-white" />
                                                                        </div>
                                                                        <h3 className="text-lg font-semibold text-blue-900">Key Talking Points</h3>
                                                                    </div>
                                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-md">
                                                                        <Sparkles size={12} />
                                                                        AI Generated
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-4">
                                                                    {formatTalkingPoints(bill.ai_talking_points)}
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {/* AI Business Impact */}
                                                        {bill.ai_business_impact && (
                                                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-5">
                                                                <div className="flex items-center justify-between mb-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 bg-green-600 rounded-full">
                                                                            <TrendingUp size={20} className="text-white" />
                                                                        </div>
                                                                        <h3 className="text-lg font-semibold text-green-900">Business Impact Analysis</h3>
                                                                    </div>
                                                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-600 text-white text-xs font-medium rounded-md">
                                                                        <Sparkles size={12} />
                                                                        AI Generated
                                                                    </div>
                                                                </div>
                                                                <div className="text-sm text-green-800 leading-relaxed">
                                                                    {formatUniversalContent(bill.ai_business_impact)}
                                                                </div>
                                                            </div>
                                                        )}
                                                        
                                                        {/* Action Buttons */}
                                                        <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t border-gray-200">
                                                            {bill.legiscan_url && (
                                                                <a
                                                                    href={bill.legiscan_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-all duration-300"
                                                                >
                                                                    <ExternalLink size={14} />
                                                                    <span>View on LegiScan</span>
                                                                </a>
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
        </div>
    );
};

export default StatePage;