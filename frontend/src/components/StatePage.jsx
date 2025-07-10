// Complete StatePage.jsx with removed search functionality and fetch container, filter moved to left side below header

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
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
    RotateCw as RefreshIcon,
    ChevronLeft,
    ChevronRight,
    ArrowUp,
    Calendar,
    Clock
} from 'lucide-react';

import { FILTERS, SUPPORTED_STATES } from '../utils/constants';
import {
    stripHtmlTags,
    generateUniqueId
} from '../utils/helpers';

import useReviewStatus from '../hooks/useReviewStatus';
import FilterDropdown from '../components/FilterDropdown';
import ShimmerLoader from '../components/ShimmerLoader';
import EditableCategoryTag from './EditableCategoryTag';
import API_URL from '../config/api';

// Pagination configuration
const ITEMS_PER_PAGE = 25;

// Extended FILTERS array with review status options (matching ExecutiveOrdersPage)
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

// =====================================
// SCROLL TO TOP COMPONENT
// =====================================
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
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    if (!isVisible) return null;

    return (
        <button
            onClick={scrollToTop}
            className={`fixed right-6 bottom-6 z-50 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
                }`}
            title="Scroll to top"
            aria-label="Scroll to top"
        >
            <ArrowUp size={20} />
        </button>
    );
};

// Function to clean and validate status values
const cleanStatus = (status) => {
    if (!status || typeof status !== 'string') return 'Active';

    const trimmedStatus = status.trim().toLowerCase();
    const validStatuses = ['active', 'inactive', 'fail', 'pass'];

    if (validStatuses.includes(trimmedStatus)) {
        return trimmedStatus.charAt(0).toUpperCase() + trimmedStatus.slice(1);
    }

    if (/\d/.test(trimmedStatus)) {
        return 'Active';
    }

    const statusMap = {
        'pending': 'Active',
        'in progress': 'Active',
        'approved': 'Pass',
        'passed': 'Pass',
        'rejected': 'Fail',
        'failed': 'Fail',
        'denied': 'Fail',
        'completed': 'Pass',
        'cancelled': 'Inactive',
        'canceled': 'Inactive',
        'withdrawn': 'Inactive',
        'expired': 'Inactive',
        'unknown': 'Active',
        'not applicable': 'Active',
        'not reviewed': 'Active',
        'null': 'Active',
        '': 'Active'
    };

    return statusMap[trimmedStatus] || 'Active';
};

// Function to clean and validate category values
const cleanCategory = (category) => {
    if (!category || typeof category !== 'string') return 'not-applicable';

    const trimmedCategory = category.trim().toLowerCase();

    if (trimmedCategory === 'unknown') {
        return 'not-applicable';
    }

    const unwantedValues = ['4', 'not reviewed', 'null', ''];

    if (unwantedValues.includes(trimmedCategory) || trimmedCategory.length === 0) {
        return 'not-applicable';
    }

    if (trimmedCategory === 'not applicable' || trimmedCategory === 'not-applicable') {
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
        'hospital': 'healthcare',
        'all practice areas': 'all_practice_areas',
        'all-practice-areas': 'all_practice_areas'
    };

    const mappedCategory = categoryMap[trimmedCategory] || trimmedCategory;
    const validCategories = FILTERS.map(f => f.key);
    validCategories.push('not-applicable');
    validCategories.push('all_practice_areas');

    return validCategories.includes(mappedCategory) ? mappedCategory : 'not-applicable';
};

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

// Pagination component
const PaginationControls = ({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange
}) => {
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
                <span className="font-medium">{totalItems}</span> bills
            </div>

            {totalPages > 1 && (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`p-2 rounded-md text-sm font-medium transition-all duration-200 ${currentPage === 1
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-gray-700 hover:bg-gray-100'
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
                                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 min-w-[40px] ${page === currentPage
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
                        className={`p-2 rounded-md text-sm font-medium transition-all duration-200 ${currentPage === totalPages
                                ? 'text-gray-400 cursor-not-allowed'
                                : 'text-gray-700 hover:bg-gray-100'
                            }`}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
};

const StatePage = ({ stateName, stableHandlers, copyToClipboard, makeApiCall }) => {
    // Core state
    const [allBills, setAllBills] = useState([]);
    const [stateLoading, setStateLoading] = useState(false);
    const [stateError, setStateError] = useState(null);

    // Filter state
    const [selectedFilters, setSelectedFilters] = useState([]);
    const [showFilterDropdown, setShowFilterDropdown] = useState(false);
    
    // Fetch button state
    const [showFetchDropdown, setShowFetchDropdown] = useState(false);
    const [fetchLoading, setFetchLoading] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [copiedBills, setCopiedBills] = useState(new Set());

    const [pagination, setPagination] = useState({
        page: 1,
        per_page: 25,
        total_pages: 1,
        count: 0
    });

    const [allFilterCounts, setAllFilterCounts] = useState({
        civic: 0,
        education: 0,
        engineering: 0,
        healthcare: 0,
        reviewed: 0,
        not_reviewed: 0,
        total: 0
    });

    // Database-driven review status
    const {
        toggleReviewStatus,
        isItemReviewed,
        isItemReviewLoading,
        reviewCounts
    } = useReviewStatus(allBills, 'state_legislation');

    // Highlights state
    const [localHighlights, setLocalHighlights] = useState(new Set());
    const [highlightLoading, setHighlightLoading] = useState(new Set());

    // Expanded bills state
    const [expandedBills, setExpandedBills] = useState(new Set());

    // UI state
    const [hasData, setHasData] = useState(false);

    const filterDropdownRef = useRef(null);
    const fetchDropdownRef = useRef(null);

    // Helper functions
    const capitalizeFirstLetter = (text) => {
        if (!text || typeof text !== 'string') return text;
        const trimmed = text.trim();
        if (trimmed.length === 0) return text;
        return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
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
            .replace(/\u2018|\u2019/g, "'")
            .replace(/\u201C|\u201D/g, '"')
            .replace(/\u2013|\u2014/g, '-')
            .replace(/\.\s*\.\s*\.+/g, '...')
            .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '')
            .trim();

        if (cleaned.endsWith('.') && !cleaned.includes('etc.') && !cleaned.includes('Inc.')) {
            cleaned = cleaned.slice(0, -1).trim();
        }

        if (cleaned.length > 0) {
            cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
        }

        return cleaned || 'Untitled Bill';
    };

    const parseDate = (dateString) => {
        if (!dateString) return new Date(0);
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return new Date(0);
        }
        return date;
    };

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

        if (bill.title) {
            const titleHash = bill.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
            return `state-bill-${titleHash}`;
        }

        return `state-bill-${Math.random().toString(36).substr(2, 9)}`;
    }, [stateName]);

    // Category Update Handler
    const handleCategoryUpdate = useCallback(async (itemId, newCategory, itemType) => {
        try {
            console.log(`🔄 Updating category for ${itemType} ${itemId} to ${newCategory}`);
            
            setAllBills(prevBills => 
                prevBills.map(bill => {
                    const currentBillId = getStateBillId(bill);
                    if (currentBillId === itemId) {
                        return { ...bill, category: newCategory };
                    }
                    return bill;
                })
            );

            const endpoint = `${API_URL}/api/state-legislation/${itemId}/category`;

            const response = await fetch(endpoint, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    category: newCategory
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                console.log(`✅ Category successfully updated in database`);
                fetchExistingData();
            } else {
                throw new Error(result.message || 'Update failed');
            }

        } catch (error) {
            console.error('❌ Failed to update category:', error);
            
            setAllBills(prevBills => 
                prevBills.map(bill => {
                    const currentBillId = getStateBillId(bill);
                    if (currentBillId === itemId) {
                        return { ...bill, category: bill.originalCategory || 'civic' };
                    }
                    return bill;
                })
            );
            
            setStateError(`Failed to update category: ${error.message}`);
            setTimeout(() => setStateError(null), 5000);
            
            throw error;
        }
    }, [getStateBillId]);

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

    // AI content formatting functions
    const formatTalkingPoints = (content) => {
        if (!content) return null;

        let textContent = content.replace(/<[^>]*>/g, '');
        const points = [];
        const numberedMatches = textContent.match(/\d+\.\s*[^.]*(?:\.[^0-9][^.]*)*(?=\s*\d+\.|$)/g);

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
                <div className="universal-numbered-content">
                    {points.slice(0, 5).map((point, idx) => (
                        <div key={idx} className="numbered-item">
                            <span className="number-bullet">{idx + 1}.</span>
                            <span className="numbered-text">{point}</span>
                        </div>
                    ))}
                </div>
            );
        }

        return <div className="universal-text-content">{textContent}</div>;
    };

    const formatUniversalContent = (content) => {
        if (!content) return null;

        let textContent = content.replace(/<(?!\/?(strong|b)\b)[^>]*>/g, '');
        textContent = textContent.replace(/<(strong|b)>(.*?)<\/(strong|b)>/g, '*$2*');

        const sectionKeywords = [
            'Risk Assessment',
            'Market Opportunity',
            'Implementation Requirements',
            'Financial Implications',
            'Competitive Implications',
            'Timeline Pressures',
            'Summary'
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

                    if (content.includes('•') || (content.includes('-') && content.match(/^\s*-/m)) || (content.includes('*') && content.match(/^\s*\*/m))) {
                        const bulletPattern = /(?:^|\n)\s*[•\-*]\s*(.+?)(?=(?:\n\s*[•\-*]|\n\s*$|$))/gs;
                        const bulletMatches = [...content.matchAll(bulletPattern)];

                        if (bulletMatches.length > 0) {
                            bulletMatches.forEach(bulletMatch => {
                                const bulletContent = bulletMatch[1].trim();
                                if (bulletContent.length > 5) {
                                    items.push(capitalizeFirstLetter(bulletContent));
                                }
                            });
                        } else {
                            const lines = content.split(/\n/).map(line => line.trim()).filter(line => line.length > 5);
                            lines.forEach(line => {
                                const cleanLine = line.replace(/^[•\-*]\s*/, '').trim();
                                if (cleanLine.length > 5) {
                                    items.push(capitalizeFirstLetter(cleanLine));
                                }
                            });
                        }
                    } else {
                        const sentences = content.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 5);

                        if (sentences.length === 1 || content.length < 200) {
                            items.push(capitalizeFirstLetter(content.trim()));
                        } else {
                            sentences.forEach(sentence => {
                                if (sentence.length > 10) {
                                    items.push(capitalizeFirstLetter(sentence));
                                }
                            });
                        }
                    }

                    if (items.length > 0) {
                        sections.push({
                            title: cleanHeader,
                            items: items
                        });
                    }
                }
            });

            if (sections.length > 0) {
                return (
                    <div>
                        {sections.map((section, idx) => (
                            <div key={idx} style={{ marginBottom: '16px' }}>
                                <div style={{
                                    fontWeight: 'bold',
                                    marginBottom: '8px',
                                    fontSize: '14px',
                                    color: 'inherit'
                                }}>
                                    {section.title}
                                </div>
                                {section.items.map((item, itemIdx) => (
                                    <div key={itemIdx} style={{
                                        marginBottom: '6px',
                                        fontSize: '14px',
                                        lineHeight: '1.6',
                                        color: 'inherit',
                                        paddingLeft: section.items.length === 1 ? '0px' : '0px',
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

    // Filter helper functions
    const isFilterActive = (filterKey) => selectedFilters.includes(filterKey);

    const toggleFilter = (filterKey) => {
        setSelectedFilters(prev => {
            const newFilters = prev.includes(filterKey)
                ? prev.filter(f => f !== filterKey)
                : [...prev, filterKey];

            console.log('🔄 Filter toggled:', filterKey, 'New filters:', newFilters);
            setPagination(prev => ({ ...prev, page: 1 }));
            return newFilters;
        });
    };

    const clearAllFilters = () => {
        console.log('🔄 Clearing all filters');
        setSelectedFilters([]);
        setPagination(prev => ({ ...prev, page: 1 }));
    };

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedFilters]);

    // Fetch from database function
    const fetchFromDatabase = useCallback(async (pageNum = 1) => {
        try {
            setStateLoading(true);
            setStateError(null);

            console.log(`🔍 Fetching page ${pageNum} for state: ${stateName}...`);

            const perPage = 25;
            const stateAbbr = SUPPORTED_STATES[stateName];
            const url = `${API_URL}/api/state-legislation?state=${stateAbbr}&page=${pageNum}&per_page=${perPage}&order_by=introduced_date&order=desc`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const fallbackUrl = `${API_URL}/api/state-legislation?state=${stateAbbr}&page=${pageNum}&per_page=${perPage}`;
                const fallbackResponse = await fetch(fallbackUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });

                if (!fallbackResponse.ok) {
                    throw new Error(`HTTP ${fallbackResponse.status}: ${fallbackResponse.statusText}`);
                }

                const fallbackData = await fallbackResponse.json();

                let ordersArray = [];
                if (Array.isArray(fallbackData)) {
                    ordersArray = fallbackData;
                } else if (fallbackData.results && Array.isArray(fallbackData.results)) {
                    ordersArray = fallbackData.results;
                } else if (fallbackData.data && Array.isArray(fallbackData.data)) {
                    ordersArray = fallbackData.data;
                } else if (fallbackData.state_legislation && Array.isArray(fallbackData.state_legislation)) {
                    ordersArray = fallbackData.state_legislation;
                }

                ordersArray.sort((a, b) => {
                    const getDate = (bill) => {
                        const dateStr = bill.introduced_date || bill.last_action_date || bill.signing_date || '1900-01-01';
                        const parsedDate = new Date(dateStr);
                        return isNaN(parsedDate.getTime()) ? new Date('1900-01-01') : parsedDate;
                    };

                    const dateA = getDate(a);
                    const dateB = getDate(b);
                    return dateB - dateA;
                });

                const totalCount = fallbackData.total || fallbackData.count || ordersArray.length;
                const totalPages = fallbackData.total_pages || Math.ceil(totalCount / perPage);

                const transformedBills = ordersArray.map((bill, index) => {
                    const uniqueId = getStateBillId(bill) || `fallback-${pageNum}-${index}`;

                    return {
                        id: uniqueId,
                        bill_id: uniqueId,
                        title: bill?.title || 'Untitled Bill',
                        status: cleanStatus(bill?.status),
                        category: cleanCategory(bill?.category),
                        description: bill?.description || bill?.ai_summary || 'No description available',
                        tags: [cleanCategory(bill?.category)].filter(Boolean),
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
                        executive_order_number: bill?.bill_number || uniqueId,
                        signing_date: bill?.introduced_date,
                        ai_summary: bill?.ai_summary ? stripHtmlTags(bill.ai_summary) : bill?.description || 'No summary available',
                        order_type: 'state_legislation',
                        source_page: 'state-legislation',
                        index: index
                    };
                });

                setAllBills(transformedBills);
                setPagination({
                    page: pageNum,
                    per_page: perPage,
                    total_pages: totalPages,
                    count: Math.max(totalCount, transformedBills.length)
                });

                setHasData(transformedBills.length > 0);
                return;
            }

            const data = await response.json();
            console.log('🔍 API Response:', data);

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
            } else if (data.state_legislation && Array.isArray(data.state_legislation)) {
                ordersArray = data.state_legislation;
                totalCount = data.total || data.count || 0;
                currentPage = data.page || pageNum;
            } else {
                throw new Error('No bills found in API response');
            }

            const totalPages = data.total_pages || Math.ceil(totalCount / perPage);

            const transformedBills = ordersArray.map((bill, index) => {
                const uniqueId = getStateBillId(bill) || `fallback-${pageNum}-${index}`;

                return {
                    id: uniqueId,
                    bill_id: uniqueId,
                    title: bill?.title || 'Untitled Bill',
                    status: cleanStatus(bill?.status),
                    category: cleanCategory(bill?.category),
                    description: bill?.description || bill?.ai_summary || 'No description available',
                    tags: [cleanCategory(bill?.category)].filter(Boolean),
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
                    executive_order_number: bill?.bill_number || uniqueId,
                    signing_date: bill?.introduced_date,
                    ai_summary: bill?.ai_summary ? stripHtmlTags(bill.ai_summary) : bill?.description || 'No summary available',
                    order_type: 'state_legislation',
                    source_page: 'state-legislation',
                    index: index
                };
            });

            setAllBills(transformedBills);
            setPagination({
                page: currentPage,
                per_page: perPage,
                total_pages: totalPages,
                count: totalCount
            });

            setHasData(transformedBills.length > 0);

        } catch (err) {
            console.error('❌ Error details:', err);
            setStateError(`Failed to load state legislation: ${err.message}`);
            setAllBills([]);
            setHasData(false);
        } finally {
            setStateLoading(false);
        }
    }, [stateName, getStateBillId]);

    // 🔢 NEW: Function to fetch filter counts from entire database
    const fetchFilterCounts = useCallback(async () => {
        try {
            console.log('📊 Fetching filter counts from entire database...');

            const stateAbbr = SUPPORTED_STATES[stateName];

            // Start with smaller sample sizes that your API can handle
            let totalCount = 0;
            let categoryCounts = { civic: 0, education: 0, engineering: 0, healthcare: 0, all_practice_areas: 0 };
            let allOrders = [];

            // Try different approaches in order of preference
            const approaches = [
                { per_page: 100, description: '100 items' },
                { per_page: 50, description: '50 items' },
                { per_page: 25, description: '25 items (fallback)' }
            ];

            let successfulApproach = null;

            for (const approach of approaches) {
                try {
                    console.log(`📊 Trying to fetch ${approach.description}...`);

                    const sampleResponse = await fetch(`${API_URL}/api/state-legislation?state=${stateAbbr}&page=1&per_page=${approach.per_page}`, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    });

                    if (sampleResponse.ok) {
                        const sampleData = await sampleResponse.json();
                        let sampleOrders = [];

                        if (Array.isArray(sampleData)) {
                            sampleOrders = sampleData;
                            totalCount = sampleData.length;
                        } else if (sampleData.results && Array.isArray(sampleData.results)) {
                            sampleOrders = sampleData.results;
                            totalCount = sampleData.total || sampleData.count || 0;
                        } else if (sampleData.data && Array.isArray(sampleData.data)) {
                            sampleOrders = sampleData.data;
                            totalCount = sampleData.total || sampleData.count || 0;
                        } else if (sampleData.state_legislation && Array.isArray(sampleData.state_legislation)) {
                            sampleOrders = sampleData.state_legislation;
                            totalCount = sampleData.total || sampleData.count || 0;
                        }

                        allOrders = sampleOrders;
                        successfulApproach = approach;
                        console.log(`✅ Successfully fetched ${sampleOrders.length} orders using ${approach.description}`);
                        console.log(`📊 Total count from API: ${totalCount}`);
                        break;
                    }
                } catch (err) {
                    console.log(`❌ Failed to fetch ${approach.description}:`, err.message);
                    continue;
                }
            }

            if (!successfulApproach) {
                throw new Error('All fetch approaches failed');
            }

            // Count categories from the sample we got
            FILTERS.forEach(filter => {
                categoryCounts[filter.key] = allOrders.filter(order => cleanCategory(order?.category) === filter.key).length;
            });
            
            // Also count all_practice_areas separately
            categoryCounts.all_practice_areas = allOrders.filter(order => cleanCategory(order?.category) === 'all_practice_areas').length;

            console.log('📊 Category counts from sample:', categoryCounts);

            // If we only got a small sample but the total is larger, estimate the full counts
            if (allOrders.length < totalCount && totalCount > 0) {
                const scaleFactor = totalCount / allOrders.length;
                console.log(`📊 Scaling factor: ${scaleFactor} (${totalCount} total / ${allOrders.length} sample)`);

                // Scale up the category counts proportionally
                Object.keys(categoryCounts).forEach(key => {
                    categoryCounts[key] = Math.round(categoryCounts[key] * scaleFactor);
                });

                console.log('📊 Scaled category counts:', categoryCounts);
            }

            // Get reviewed counts from current data
            const reviewedCount = allBills.filter(bill => isItemReviewed(bill)).length;

            const newFilterCounts = {
                ...categoryCounts,
                reviewed: reviewedCount,
                not_reviewed: Math.max(0, totalCount - reviewedCount),
                total: totalCount
            };

            console.log('📊 Final filter counts:', newFilterCounts);
            setAllFilterCounts(newFilterCounts);

        } catch (error) {
            console.error('❌ Error fetching filter counts:', error);

            // Enhanced fallback using current page data
            const fallbackCounts = {};
            FILTERS.forEach(filter => {
                fallbackCounts[filter.key] = allBills.filter(order => cleanCategory(order?.category) === filter.key).length;
            });
            
            // Also count all_practice_areas separately in fallback
            fallbackCounts.all_practice_areas = allBills.filter(order => cleanCategory(order?.category) === 'all_practice_areas').length;

            const total = pagination.count || allBills.length || 0; // Use pagination total if available
            const reviewed = allBills.filter(order => isItemReviewed(order)).length;

            console.log('📊 Using fallback counts with pagination total:', total);

            setAllFilterCounts({
                ...fallbackCounts,
                reviewed: reviewed,
                not_reviewed: Math.max(0, total - reviewed),
                total: total
            });
        }
    }, [allBills, stateName, pagination.count, isItemReviewed]);

    // 🔍 NEW: Get ALL filtered data, not just paginated results
    const fetchAllFilteredData = useCallback(async (filters, search) => {
        try {
            console.log(`🔍 Fetching ALL filtered data - Filters: ${filters.join(',')}, Search: "${search}"`);

            const stateAbbr = SUPPORTED_STATES[stateName];

            // Build URL to get ALL results (use reasonable page size)
            let url = `${API_URL}/api/state-legislation?state=${stateAbbr}&per_page=100`;

            // Add category filters
            const categoryFilters = filters.filter(f => !['reviewed', 'not_reviewed'].includes(f));
            if (categoryFilters.length > 0) {
                if (categoryFilters.length === 1) {
                    url += `&category=${categoryFilters[0]}`;
                } else {
                    url += `&category=${categoryFilters.join(',')}`;
                }
            }

            // Add search parameter
            if (search && search.trim()) {
                url += `&search=${encodeURIComponent(search.trim())}`;
            }

            console.log('🔍 All Filtered URL:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            // Better error handling for 422
            if (!response.ok) {
                if (response.status === 422) {
                    console.error('❌ 422 Error - Backend rejected parameters. Trying without filters...');

                    // Try fallback without category filter
                    const fallbackUrl = `${API_URL}/api/state-legislation?state=${stateAbbr}&per_page=100`;
                    const fallbackResponse = await fetch(fallbackUrl, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json'
                        }
                    });

                    if (fallbackResponse.ok) {
                        const fallbackData = await fallbackResponse.json();
                        console.log('✅ Fallback request successful, applying client-side filters');

                        // Apply client-side filtering
                        let allOrdersArray = [];
                        if (Array.isArray(fallbackData)) {
                            allOrdersArray = fallbackData;
                        } else if (fallbackData.results && Array.isArray(fallbackData.results)) {
                            allOrdersArray = fallbackData.results;
                        } else if (fallbackData.data && Array.isArray(fallbackData.data)) {
                            allOrdersArray = fallbackData.data;
                        } else if (fallbackData.state_legislation && Array.isArray(fallbackData.state_legislation)) {
                            allOrdersArray = fallbackData.state_legislation;
                        }

                        console.log(`🔍 Fallback got ${allOrdersArray.length} total bills from backend`);

                        // Filter client-side by category
                        if (categoryFilters.length > 0) {
                            console.log(`🔍 Filtering for categories: ${categoryFilters.join(', ')}`);
                            const beforeFilter = allOrdersArray.length;
                            allOrdersArray = allOrdersArray.filter(bill => {
                                const cleanedCategory = cleanCategory(bill?.category);
                                const hasCategory = categoryFilters.includes(cleanedCategory);
                                if (hasCategory) {
                                    console.log(`✅ Bill "${bill.title}" matches category "${cleanedCategory}"`);
                                } else {
                                    console.log(`❌ Bill "${bill.title}" has category "${cleanedCategory}" (not in ${categoryFilters.join(', ')})`);
                                }
                                return hasCategory;
                            });
                            console.log(`🔍 Category filtering: ${beforeFilter} -> ${allOrdersArray.length} bills`);
                        }

                        // Filter by search term
                        if (search && search.trim()) {
                            const searchLower = search.toLowerCase();
                            const beforeSearch = allOrdersArray.length;
                            allOrdersArray = allOrdersArray.filter(bill =>
                                bill.title?.toLowerCase().includes(searchLower) ||
                                bill.ai_summary?.toLowerCase().includes(searchLower) ||
                                bill.description?.toLowerCase().includes(searchLower)
                            );
                            console.log(`🔍 Search filtering: ${beforeSearch} -> ${allOrdersArray.length} bills`);
                        }

                        // Transform the filtered orders
                        const allTransformedOrders = allOrdersArray.map((bill, index) => {
                            const uniqueId = getStateBillId(bill) || `bill-all-${index}`;

                            return {
                                id: uniqueId,
                                bill_id: uniqueId,
                                title: bill?.title || 'Untitled Bill',
                                status: cleanStatus(bill?.status),
                                category: cleanCategory(bill?.category),
                                description: bill?.description || bill?.ai_summary || 'No description available',
                                tags: [cleanCategory(bill?.category)].filter(Boolean),
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
                                executive_order_number: bill?.bill_number || uniqueId,
                                signing_date: bill?.introduced_date,
                                ai_summary: bill?.ai_summary ? stripHtmlTags(bill.ai_summary) : bill?.description || 'No summary available',
                                order_type: 'state_legislation',
                                source_page: 'state-legislation',
                                index: index
                            };
                        });

                        // Apply review status filtering
                        let finalAllOrders = allTransformedOrders;
                        const hasReviewedFilter = filters.includes('reviewed');
                        const hasNotReviewedFilter = filters.includes('not_reviewed');

                        if (hasReviewedFilter && !hasNotReviewedFilter) {
                            finalAllOrders = allTransformedOrders.filter(bill => isItemReviewed(bill));
                        } else if (hasNotReviewedFilter && !hasReviewedFilter) {
                            finalAllOrders = allTransformedOrders.filter(bill => !isItemReviewed(bill));
                        }

                        console.log(`🔍 Client-side filtered results: ${finalAllOrders.length} bills`);
                        return finalAllOrders;
                    }
                }

                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('🔍 All Filtered API Response:', data);

            // Extract ALL orders from response
            let allOrdersArray = [];

            if (Array.isArray(data)) {
                allOrdersArray = data;
            } else if (data.results && Array.isArray(data.results)) {
                allOrdersArray = data.results;
            } else if (data.data && Array.isArray(data.data)) {
                allOrdersArray = data.data;
            } else if (data.state_legislation && Array.isArray(data.state_legislation)) {
                allOrdersArray = data.state_legislation;
            }

            // Transform ALL orders
            const allTransformedOrders = allOrdersArray.map((bill, index) => {
                const uniqueId = getStateBillId(bill) || `bill-all-${index}`;

                return {
                    id: uniqueId,
                    bill_id: uniqueId,
                    title: bill?.title || 'Untitled Bill',
                    status: cleanStatus(bill?.status),
                    category: cleanCategory(bill?.category),
                    description: bill?.description || bill?.ai_summary || 'No description available',
                    tags: [cleanCategory(bill?.category)].filter(Boolean),
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
                    executive_order_number: bill?.bill_number || uniqueId,
                    signing_date: bill?.introduced_date,
                    ai_summary: bill?.ai_summary ? stripHtmlTags(bill.ai_summary) : bill?.description || 'No summary available',
                    order_type: 'state_legislation',
                    source_page: 'state-legislation',
                    index: index
                };
            });

            // Apply client-side review status filtering
            let finalAllOrders = allTransformedOrders;
            const hasReviewedFilter = filters.includes('reviewed');
            const hasNotReviewedFilter = filters.includes('not_reviewed');

            if (hasReviewedFilter && !hasNotReviewedFilter) {
                finalAllOrders = allTransformedOrders.filter(bill => isItemReviewed(bill));
            } else if (hasNotReviewedFilter && !hasReviewedFilter) {
                finalAllOrders = allTransformedOrders.filter(bill => !isItemReviewed(bill));
            }

            console.log(`🔍 All Filtered Results: ${finalAllOrders.length} bills`);
            return finalAllOrders;

        } catch (err) {
            console.error('❌ All filtered fetch failed:', err);
            console.log('🔄 Falling back to client-side filtering only');

            // Ultimate fallback - try to get all data without any parameters
            try {
                const stateAbbr = SUPPORTED_STATES[stateName];
                const basicResponse = await fetch(`${API_URL}/api/state-legislation?state=${stateAbbr}`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });

                if (basicResponse.ok) {
                    const basicData = await basicResponse.json();
                    let basicOrders = [];

                    if (Array.isArray(basicData)) {
                        basicOrders = basicData;
                    } else if (basicData.results && Array.isArray(basicData.results)) {
                        basicOrders = basicData.results;
                    } else if (basicData.data && Array.isArray(basicData.data)) {
                        basicOrders = basicData.data;
                    } else if (basicData.state_legislation && Array.isArray(basicData.state_legislation)) {
                        basicOrders = basicData.state_legislation;
                    }

                    // Apply all filtering client-side
                    const categoryFilters = filters.filter(f => !['reviewed', 'not_reviewed'].includes(f));

                    let filteredOrders = basicOrders;

                    // Filter by category
                    if (categoryFilters.length > 0) {
                        filteredOrders = filteredOrders.filter(bill =>
                            categoryFilters.includes(cleanCategory(bill?.category))
                        );
                    }

                    // Filter by search
                    if (search && search.trim()) {
                        const searchLower = search.toLowerCase();
                        filteredOrders = filteredOrders.filter(bill =>
                            bill.title?.toLowerCase().includes(searchLower) ||
                            bill.ai_summary?.toLowerCase().includes(searchLower) ||
                            bill.description?.toLowerCase().includes(searchLower)
                        );
                    }

                    console.log(`🔄 Ultimate fallback: ${filteredOrders.length} filtered bills`);

                    // Transform and return
                    return filteredOrders.map((bill, index) => ({
                        id: getStateBillId(bill) || `bill-all-${index}`,
                        bill_id: getStateBillId(bill) || `bill-all-${index}`,
                        title: bill?.title || 'Untitled Bill',
                        status: cleanStatus(bill?.status),
                        category: cleanCategory(bill?.category),
                        description: bill?.description || bill?.ai_summary || 'No description available',
                        tags: [cleanCategory(bill?.category)].filter(Boolean),
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
                        executive_order_number: bill?.bill_number || (getStateBillId(bill) || `bill-all-${index}`),
                        signing_date: bill?.introduced_date,
                        ai_summary: bill?.ai_summary ? stripHtmlTags(bill.ai_summary) : bill?.description || 'No summary available',
                        order_type: 'state_legislation',
                        source_page: 'state-legislation',
                        index: index
                    }));
                }
            } catch (ultimateError) {
                console.error('❌ Ultimate fallback also failed:', ultimateError);
            }

            return [];
        }
    }, [stateName, getStateBillId, isItemReviewed]);

    // 🔍 NEW: Database-level filtering function with proper pagination
    const fetchFilteredData = useCallback(async (filters, search, pageNum = 1) => {
        try {
            setStateLoading(true);
            setStateError(null);

            console.log(`🔍 fetchFilteredData called with filters: ${filters}, search: "${search}", page: ${pageNum}`);

            // First, get ALL filtered results to show correct total count
            const allFilteredOrders = await fetchAllFilteredData(filters, search);
            const totalFilteredCount = allFilteredOrders.length;

            console.log(`🔍 Got ${totalFilteredCount} total filtered bills from fetchAllFilteredData`);

            if (totalFilteredCount === 0) {
                console.log('🔍 No filtered results found');
                setAllBills([]);
                setPagination({
                    page: 1,
                    per_page: 25,
                    total_pages: 0,
                    count: 0
                });
                setHasData(false);
                return;
            }

            // Now paginate the results client-side for correct display
            const perPage = 25;
            const startIndex = (pageNum - 1) * perPage;
            const endIndex = startIndex + perPage;
            const paginatedOrders = allFilteredOrders.slice(startIndex, endIndex);

            console.log(`🔍 Paginating: showing items ${startIndex + 1}-${Math.min(endIndex, totalFilteredCount)} of ${totalFilteredCount} total`);
            console.log(`🔍 Paginated bills count: ${paginatedOrders.length}`);

            // Calculate correct pagination
            const totalPages = Math.ceil(totalFilteredCount / perPage);

            // Update state with paginated results but correct total count
            setAllBills(paginatedOrders);
            setPagination({
                page: pageNum,
                per_page: perPage,
                total_pages: totalPages,
                count: totalFilteredCount
            });

            console.log(`🔍 Set pagination: page ${pageNum}/${totalPages}, total count: ${totalFilteredCount}`);

            setHasData(paginatedOrders.length > 0);

        } catch (err) {
            console.error('❌ Filtered fetch failed:', err);
            setStateError(`Failed to filter state legislation: ${err.message}`);
            setAllBills([]);
            setHasData(false);
        } finally {
            setStateLoading(false);
        }
    }, [fetchAllFilteredData]);

    // 🔢 NEW: Dynamic filter counts based on current filtering state
    const updateFilterCounts = useCallback(async (activeFilters, searchTerm) => {
        try {
            if (activeFilters.length === 0 && !searchTerm) {
                // No filters active - show total database counts
                await fetchFilterCounts();
                return;
            }

            console.log('📊 Updating filter counts for active filters:', activeFilters);

            // For filtered state, get ALL data and count client-side
            try {
                const stateAbbr = SUPPORTED_STATES[stateName];
                const response = await fetch(`${API_URL}/api/state-legislation?state=${stateAbbr}&per_page=200`, {
                    method: 'GET',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    let allOrders = [];

                    if (Array.isArray(data)) {
                        allOrders = data;
                    } else if (data.results && Array.isArray(data.results)) {
                        allOrders = data.results;
                    } else if (data.data && Array.isArray(data.data)) {
                        allOrders = data.data;
                    } else if (data.state_legislation && Array.isArray(data.state_legislation)) {
                        allOrders = data.state_legislation;
                    }

                    // Apply base filters (search term, but not the specific category we're counting)
                    let baseFilteredOrders = allOrders;

                    // Apply search if present
                    if (searchTerm && searchTerm.trim()) {
                        const searchLower = searchTerm.toLowerCase();
                        baseFilteredOrders = baseFilteredOrders.filter(bill =>
                            bill.title?.toLowerCase().includes(searchLower) ||
                            bill.ai_summary?.toLowerCase().includes(searchLower) ||
                            bill.description?.toLowerCase().includes(searchLower)
                        );
                    }

                    // Count categories from ALL filtered results (not just the active filter)
                    const newCategoryCounts = {};
                    FILTERS.forEach(filter => {
                        newCategoryCounts[filter.key] = baseFilteredOrders.filter(bill => cleanCategory(bill?.category) === filter.key).length;
                    });

                    // Count review status from filtered results
                    const reviewedCount = baseFilteredOrders.filter(bill => {
                        return bill.reviewed === true || bill.reviewed === 1;
                    }).length;

                    const totalFiltered = baseFilteredOrders.length;

                    const updatedCounts = {
                        ...newCategoryCounts,
                        reviewed: reviewedCount,
                        not_reviewed: totalFiltered - reviewedCount,
                        total: totalFiltered
                    };

                    console.log('📊 Updated filter counts:', updatedCounts);
                    setAllFilterCounts(updatedCounts);
                }
            } catch (countError) {
                console.error('❌ Error updating filter counts, using fallback');
                // Fallback to current data
                const fallbackCounts = {};
                FILTERS.forEach(filter => {
                    fallbackCounts[filter.key] = allBills.filter(bill => cleanCategory(bill?.category) === filter.key).length;
                });

                const reviewed = allBills.filter(bill => isItemReviewed(bill)).length;

                setAllFilterCounts({
                    ...fallbackCounts,
                    reviewed: reviewed,
                    not_reviewed: Math.max(0, allBills.length - reviewed),
                    total: allBills.length
                });
            }
        } catch (error) {
            console.error('❌ Error updating filter counts:', error);
        }
    }, [stateName, fetchFilterCounts, allBills, isItemReviewed]);

    // Update filter counts when filters or search changes
    useEffect(() => {
        if (allBills.length > 0) {
            updateFilterCounts(selectedFilters, '');
        }
    }, [selectedFilters, allBills.length, updateFilterCounts]);

    // ✅ NEW: PAGE CHANGE HANDLER
    const handlePageChange = useCallback((newPage) => {
        console.log(`🔄 Changing to page ${newPage} with filters:`, selectedFilters);

        if (selectedFilters.length > 0) {
            fetchFilteredData(selectedFilters, '', newPage);
        } else {
            fetchFromDatabase(newPage);
        }
    }, [selectedFilters, fetchFromDatabase, fetchFilteredData]);

    // ALSO load highlights when state orders are loaded
    useEffect(() => {
        if (allBills.length > 0) {
            const loadExistingHighlights = async () => {
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
                    console.error('Error loading highlights after state orders loaded:', error);
                }
            };

            loadExistingHighlights();
        }
    }, [allBills.length]);

    // Load existing highlights
    useEffect(() => {
        const loadExistingHighlights = async () => {
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
                console.error('Error loading existing highlights:', error);
            }
        };

        loadExistingHighlights();
    }, []);

    // Auto-load data
    useEffect(() => {
        if (stateName && SUPPORTED_STATES[stateName]) {
            const autoLoad = async () => {
                try {
                    await fetchFromDatabase(1);
                } catch (err) {
                    console.error('❌ Auto-load failed:', err);
                    setAllBills([]);
                    setHasData(false);
                }
            };

            const timeoutId = setTimeout(autoLoad, 100);
            return () => clearTimeout(timeoutId);
        }
    }, [stateName, fetchFromDatabase]);

    // Review status handler
    const handleToggleReviewStatus = async (bill) => {
        try {
            const newStatus = await toggleReviewStatus(bill);
            setAllBills(prevOrders =>
                prevOrders.map(order =>
                    (order.id === bill.id || order.bill_id === bill.bill_id)
                        ? { ...order, reviewed: newStatus }
                        : order
                )
            );
        } catch (error) {
            console.error('Error toggling review status:', error);
        }
    };

    // Highlighting function
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
                } else {
                    if (stableHandlers?.handleItemHighlight) {
                        stableHandlers.handleItemHighlight(bill, 'state_legislation');
                    }
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
                } else {
                    if (stableHandlers?.handleItemHighlight) {
                        stableHandlers.handleItemHighlight(bill, 'state_legislation');
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error managing highlight:', error);
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
    }, [localHighlights, stableHandlers, getStateBillId]);

    // Check if bill is highlighted
    const isStateBillHighlighted = useCallback((bill) => {
        const billId = getStateBillId(bill);
        if (!billId) return false;

        const localHighlighted = localHighlights.has(billId);
        const stableHighlighted = stableHandlers?.isItemHighlighted?.(bill) || false;

        return localHighlighted || stableHighlighted;
    }, [localHighlights, stableHandlers, getStateBillId]);

    // Check if bill highlight is loading
    const isBillHighlightLoading = useCallback((bill) => {
        const billId = getStateBillId(bill);
        return billId ? highlightLoading.has(billId) : false;
    }, [highlightLoading, getStateBillId]);

    // ✅ NEW: Count functions for filter display (copied from ExecutiveOrdersPage)
    const filterCounts = useMemo(() => {
        return {
            civic: allFilterCounts.civic || 0,
            education: allFilterCounts.education || 0,
            engineering: allFilterCounts.engineering || 0,
            healthcare: allFilterCounts.healthcare || 0,
            all_practice_areas: allFilterCounts.all_practice_areas || 0, // Actual count of all_practice_areas category
            reviewed: allFilterCounts.reviewed || 0,
            not_reviewed: allFilterCounts.not_reviewed || 0,
            total: allFilterCounts.total || 0
        };
    }, [allFilterCounts]);

    const reviewCountsFromFilter = useMemo(() => {
        return {
            total: allFilterCounts.total || 0,
            reviewed: allFilterCounts.reviewed || 0,
            notReviewed: allFilterCounts.not_reviewed || 0
        };
    }, [allFilterCounts]);

    const categoryCounts = useMemo(() => {
        return {
            civic: allFilterCounts.civic || 0,
            education: allFilterCounts.education || 0,
            engineering: allFilterCounts.engineering || 0,
            healthcare: allFilterCounts.healthcare || 0
        };
    }, [allFilterCounts]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
                setShowFilterDropdown(false);
            }
            if (fetchDropdownRef.current && !fetchDropdownRef.current.contains(event.target)) {
                setShowFetchDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch existing data
    const fetchExistingData = useCallback(async () => {
        setStateLoading(true);
        setStateError(null);

        try {
            const stateAbbr = SUPPORTED_STATES[stateName];
            const urls = [
                `${API_URL}/api/state-legislation?state=${stateAbbr}`,
                `${API_URL}/api/state-legislation?state=${stateName}`
            ];

            let response;
            let data;

            for (const url of urls) {
                response = await fetch(url);
                if (response.ok) {
                    data = await response.json();
                    if (data.results && data.results.length > 0) {
                        break;
                    }
                }
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const results = data?.results || [];

            const transformedBills = results.map((bill, index) => {
                const uniqueId = getStateBillId(bill) || `fallback-${index}`;

                return {
                    id: uniqueId,
                    bill_id: uniqueId,
                    title: bill?.title || 'Untitled Bill',
                    status: cleanStatus(bill?.status),
                    category: cleanCategory(bill?.category),
                    description: bill?.description || bill?.ai_summary || 'No description available',
                    tags: [cleanCategory(bill?.category)].filter(Boolean),
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
                    executive_order_number: bill?.bill_number || uniqueId,
                    signing_date: bill?.introduced_date,
                    ai_summary: bill?.ai_summary ? stripHtmlTags(bill.ai_summary) : bill?.description || 'No summary available',
                    order_type: 'state_legislation',
                    source_page: 'state-legislation'
                };
            });

            transformedBills.sort((a, b) => {
                const dateA = parseDate(a.introduced_date || a.last_action_date);
                const dateB = parseDate(b.introduced_date || b.last_action_date);
                return dateB.getTime() - dateA.getTime();
            });

            setAllBills(transformedBills);
            setHasData(transformedBills.length > 0);
        } catch (error) {
            console.error('❌ Error fetching existing state legislation:', error);
            setStateError(error.message);
            setHasData(false);
            setAllBills([]);
        } finally {
            setStateLoading(false);
        }
    }, [stateName, getStateBillId]);

    // Filtered orders
    const filteredStateOrders = useMemo(() => {
        if (!Array.isArray(allBills)) {
            return [];
        }

        let filtered = allBills;

        const categoryFilters = selectedFilters.filter(f => !['reviewed', 'not_reviewed'].includes(f));
        
        if (categoryFilters.length > 0) {
            // Show only items matching selected categories (including all_practice_areas as its own category)
            filtered = filtered.filter(bill => categoryFilters.includes(cleanCategory(bill?.category)));
        }

        const hasReviewedFilter = selectedFilters.includes('reviewed');
        const hasNotReviewedFilter = selectedFilters.includes('not_reviewed');

        if (hasReviewedFilter && hasNotReviewedFilter) {
            // Both selected, show all
        } else if (hasReviewedFilter) {
            filtered = filtered.filter(bill => isItemReviewed(bill));
        } else if (hasNotReviewedFilter) {
            filtered = filtered.filter(bill => !isItemReviewed(bill));
        }

        filtered.sort((a, b) => {
            const dateA = parseDate(a.introduced_date || a.last_action_date);
            const dateB = parseDate(b.introduced_date || b.last_action_date);
            return dateB.getTime() - dateA.getTime();
        });

        return filtered;
    }, [allBills, selectedFilters, getStateBillId, isItemReviewed]);

    // Fetch functions for different time periods
    const fetchStateLegislation = useCallback(async (days) => {
        try {
            setFetchLoading(true);
            setShowFetchDropdown(false);
            
            const stateAbbr = SUPPORTED_STATES[stateName];
            if (!stateAbbr) {
                console.error('❌ No state abbreviation found for:', stateName);
                return;
            }
            
            console.log(`🔄 Fetching ${stateName} legislation for last ${days} days...`);
            
            // Create a query string for the time period
            const queryString = days === 7 ? "recent bills" : 
                               days === 30 ? "bills last month" : 
                               "bills last 3 months";
            
            // Call LegiScan API through backend with correct payload
            const response = await fetch(`${API_URL}/api/legiscan/search-and-analyze`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    query: queryString,
                    state: stateAbbr,
                    limit: days === 7 ? 100 : days === 30 ? 300 : 500,
                    save_to_db: true,
                    process_one_by_one: true,
                    with_ai_analysis: true,
                    enhanced_ai: true
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch legislation: ${response.status}`);
            }
            
            const data = await response.json();
            console.log(`✅ Fetched ${data.bills?.length || 0} bills from LegiScan`);
            
            // Refresh the data from database to show new items
            await fetchFromDatabase(1);
            
        } catch (error) {
            console.error('❌ Error fetching legislation:', error);
            setStateError(`Failed to fetch legislation: ${error.message}`);
        } finally {
            setFetchLoading(false);
        }
    }, [stateName, fetchFromDatabase]);

    // Pagination calculations
    const totalItems = filteredStateOrders.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentPageItems = filteredStateOrders.slice(startIndex, endIndex);

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
            {/* Scroll to Top Button */}
            <ScrollToTopButton />

            {/* ===================================== */}
            {/* HEADER SECTION - TITLE AND DESCRIPTION ONLY */}
            {/* ===================================== */}
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                    <FileText/>
                    <h2 className="text-2xl font-bold text-gray-800">{stateName} Legislation</h2>
                </div>
                <p className="text-gray-600">
                    Access the latest legislation and bills from {stateName} with comprehensive AI-powered analysis. Our advanced models provide executive summaries, key strategic insights, and business impact assessments to help you understand the implications of new legislation. Direct links to official source documents are included for detailed review.
                </p> 
            </div>

            {/* ===================================== */}
            {/* FETCH AND FILTER SECTION */}
            {/* ===================================== */}
            <div className="mb-6">
                <div className="flex items-start gap-4">
                    {/* Fetch Button with Sliding Options */}
                    <div className="relative flex-shrink-0" ref={fetchDropdownRef}>
                        <button
                            type="button"
                            onClick={() => setShowFetchDropdown(!showFetchDropdown)}
                            disabled={fetchLoading}
                            className={`flex items-center gap-2 px-6 py-3 border rounded-lg font-medium transition-all duration-300 ${
                                fetchLoading
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                                    : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
                            }`}
                        >
                            {fetchLoading ? (
                                <>
                                    <RefreshIcon size={16} className="animate-spin" />
                                    <span>Fetching...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={16} />
                                    <span>Fetch State Legislation</span>
                                </>
                            )}
                        </button>

                        {/* Sliding Dropdown Options */}
                        {showFetchDropdown && (
                            <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden animate-in slide-in-from-top-2 duration-200">
                                <div className="py-1">
                                    <button
                                        onClick={() => fetchStateLegislation(7)}
                                        className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 flex items-center gap-2"
                                    >
                                        <Clock size={16} />
                                        <span>Last 7 Days</span>
                                    </button>
                                    <button
                                        onClick={() => fetchStateLegislation(30)}
                                        className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 flex items-center gap-2"
                                    >
                                        <Calendar size={16} />
                                        <span>Last 30 Days</span>
                                    </button>
                                    <button
                                        onClick={() => fetchStateLegislation(90)}
                                        className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors duration-200 flex items-center gap-2"
                                    >
                                        <Calendar size={16} />
                                        <span>Last 90 Days</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Spacer to push filters to the right */}
                    <div className="flex-grow"></div>

                    {/* Right side - Clear Filters and Filter Button */}
                    <div className="flex gap-4 items-center">
                        {/* Clear Filters Button */}
                        {selectedFilters.length > 0 && (
                            <button
                                type="button"
                                onClick={clearAllFilters}
                                className="px-4 py-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all duration-300 flex-shrink-0"
                            >
                                Clear Filters
                            </button>
                        )}

                        {/* Filter Dropdown */}
                        <FilterDropdown
                            ref={filterDropdownRef}
                            selectedFilters={selectedFilters}
                            showFilterDropdown={showFilterDropdown}
                            onToggleDropdown={() => setShowFilterDropdown(!showFilterDropdown)}
                            onToggleFilter={toggleFilter}
                            onClearAllFilters={clearAllFilters}
                            counts={filterCounts}
                            showReviewStatus={true}
                            className="relative"
                        />
                    </div>
                </div>
            </div>

            {/* Results Section */}
            <div className="mb-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="p-6">
                        {stateLoading ? (
                            <ShimmerLoader 
                                count={4}
                                variant="state-legislation"
                                className="space-y-4"
                            />
                        ) : stateError ? (
                            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
                                <p className="font-semibold mb-2">Error loading {stateName} legislation:</p>
                                <p className="text-sm">{stateError}</p>
                            </div>
                        ) : currentPageItems.length > 0 ? (
                            <div className="space-y-6">
                                {currentPageItems.map((bill, index) => {
                                    if (!bill || typeof bill !== 'object') {
                                        console.warn('Invalid bill data at index', index, bill);
                                        return null;
                                    }

                                    const billId = getStateBillId(bill);
                                    const isReviewed = isItemReviewed(bill);
                                    const isExpanded = isBillExpanded(bill);

                                    const overallIndex = startIndex + index;
                                    const reverseNumber = totalItems - overallIndex;

                                    return (
                                        <div key={bill.id || index} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">
                                            {/* Bill Header */}
                                            <div className="flex items-start justify-between px-6 pt-6 pb-2">
                                                <div className="flex-1">
                                                    <h3 className="text-lg font-semibold text-gray-900 mb-3">
                                                        {reverseNumber}. {cleanBillTitle(bill.title)}
                                                    </h3>

                                                    {/* Bill Number and Dates */}
                                                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
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
                                                            {bill.status}
                                                        </span>
                                                        <span>-</span>
                                                        <EditableCategoryTag 
                                                            category={bill.category}
                                                            itemId={getStateBillId(bill)}
                                                            itemType="state_legislation"
                                                            onCategoryChange={handleCategoryUpdate}
                                                            disabled={stateLoading}
                                                            isUpdating={false}
                                                        />
                                                        <span>-</span>
                                                        <ReviewStatusTag isReviewed={isReviewed} />
                                                    </div>
                                                </div>

                                                {/* Action Buttons */}
                                                <div className="flex items-center gap-2">
                                                    {/* Review Status Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleToggleReviewStatus(bill);
                                                        }}
                                                        disabled={isItemReviewLoading(bill)}
                                                        className={`p-2 rounded-md transition-all duration-300 ${isItemReviewLoading(bill)
                                                                ? 'text-gray-500 cursor-not-allowed'
                                                                : isReviewed
                                                                    ? 'text-green-600 bg-green-100 hover:bg-green-200'
                                                                    : 'text-gray-400 hover:bg-green-100 hover:text-green-600'
                                                            }`}
                                                        title={isReviewed ? "Mark as not reviewed" : "Mark as reviewed"}
                                                    >
                                                        {isItemReviewLoading(bill) ? (
                                                            <RefreshIcon size={16} className="animate-spin" />
                                                        ) : (
                                                            <Check size={16} className={isReviewed ? "text-green-600" : ""} />
                                                        )}
                                                    </button>

                                                    {/* Highlight button */}
                                                    <button
                                                        type="button"
                                                        className={`p-2 rounded-md transition-all duration-300 ${isStateBillHighlighted(bill)
                                                                ? 'text-yellow-500 bg-yellow-100 hover:bg-yellow-200'
                                                                : 'text-gray-400 hover:bg-gray-100 hover:text-yellow-500'
                                                            } ${isBillHighlightLoading(bill) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        onClick={async (e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if (!isBillHighlightLoading(bill)) {
                                                                await handleStateBillHighlight(bill);
                                                            }
                                                        }}
                                                        disabled={isBillHighlightLoading(bill)}
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
                                                            <Star
                                                                size={16}
                                                                className={isStateBillHighlighted(bill) ? "fill-current" : ""}
                                                            />
                                                        )}
                                                    </button>

                                                    {/* Expand/Collapse Button */}
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
                                                            className={`text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''
                                                                }`}
                                                        />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* AI Summary - Always show if available */}
                                            {bill.summary && bill.summary !== 'No AI summary available' && (
                                                <div className="mb-4 mt-2 mx-6">
                                                        <div className="bg-purple-50 p-4 rounded-md border border-purple-200">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <h4 className="font-semibold text-purple-800">Azure AI Executive Summary</h4>
                                                                <span className="text-purple-800">-</span>
                                                                <span className="inline-flex items-center justify-center px-2 py-1 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[11px] rounded-full leading-tight">
                                                                    ✦ AI Generated
                                                                </span>
                                                            </div>
                                                            <div className="text-sm text-violet-800 leading-relaxed">
                                                                <div className="universal-text-content" style={{
                                                                    fontSize: '14px',
                                                                    lineHeight: '1.6',
                                                                    wordWrap: 'break-word',
                                                                    overflowWrap: 'break-word',
                                                                    whiteSpace: 'normal'
                                                                }}>
                                                                    {stripHtmlTags(bill.summary)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                </div>

                                            )}

                                            {/* Expanded Content Section */}
                                            {isExpanded && (
                                                <div>
                                                    {/* AI Talking Points */}
                                                    {bill.ai_talking_points && (
                                                        <div className="mb-4 mt-4 mx-6">
                                                            <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <h4 className="font-semibold text-blue-800">Key Talking Points</h4>
                                                                    <span className="text-blue-800">-</span>
                                                                    <span className="inline-flex items-center justify-center px-2 py-1 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[11px] rounded-full leading-tight">
                                                                        ✦ AI Generated
                                                                    </span>
                                                                </div>
                                                                <div className="text-sm text-blue-800 leading-relaxed">
                                                                    {formatTalkingPoints(bill.ai_talking_points)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* AI Business Impact */}
                                                    {bill.ai_business_impact && (
                                                        <div className="mb-4 mt-4 mx-6">
                                                            <div className="bg-green-50 p-4 rounded-md border border-green-200">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <h4 className="font-semibold text-green-800">Business Impact Analysis</h4>
                                                                    <span className="text-green-800">-</span>
                                                                    <span className="inline-flex items-center justify-center px-2 py-1 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[11px] rounded-full leading-tight">
                                                                        ✦ AI Generated
                                                                    </span>
                                                                </div>
                                                                <div className="text-sm text-green-800 leading-relaxed">
                                                                    {formatUniversalContent(bill.ai_business_impact)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Action Buttons */}
                                                    <div className="px-6 pb-6">
                                                        <div className="flex gap-2">
                                                            {bill.legiscan_url && (
                                                                <a
                                                                    href={bill.legiscan_url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-md text-sm font-medium hover:bg-blue-100 transition-all duration-300"
                                                                >
                                                                    <ExternalLink size={16} />
                                                                    <span>View on LegiScan</span>
                                                                </a>
                                                            )}
                                                            <button
                                                                type="button"
                                                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                                                                    copiedBills.has(billId) 
                                                                        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                                }`}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();

                                                                    const billReport = [
                                                                        bill.title,
                                                                        'Bill #' + (bill.bill_number || 'N/A'),
                                                                        'State: ' + (bill.state || 'N/A'),
                                                                        'Status: ' + (bill.status || 'Unknown'),
                                                                        'Category: ' + (bill.category || 'N/A'),
                                                                        'Reviewed: ' + (isReviewed ? 'Yes' : 'No'),
                                                                        '',
                                                                        bill.summary && bill.summary !== 'No AI summary available' ? 'AI Summary: ' + bill.summary : '',
                                                                        bill.description ? 'Description: ' + bill.description : '',
                                                                        bill.ai_talking_points ? 'Key Talking Points: ' + stripHtmlTags(bill.ai_talking_points) : '',
                                                                        bill.ai_business_impact ? 'Business Impact: ' + stripHtmlTags(bill.ai_business_impact) : '',
                                                                        bill.ai_potential_impact ? 'Long-term Impact: ' + stripHtmlTags(bill.ai_potential_impact) : '',
                                                                        bill.legiscan_url ? 'LegiScan URL: ' + bill.legiscan_url : ''
                                                                    ].filter(line => line.length > 0).join('\n');

                                                                    const copySuccess = async () => {
                                                                        try {
                                                                            if (copyToClipboard && typeof copyToClipboard === 'function') {
                                                                                copyToClipboard(billReport);
                                                                            } else if (navigator.clipboard) {
                                                                                await navigator.clipboard.writeText(billReport);
                                                                            } else {
                                                                                const textArea = document.createElement('textarea');
                                                                                textArea.value = billReport;
                                                                                document.body.appendChild(textArea);
                                                                                textArea.select();
                                                                                document.execCommand('copy');
                                                                                document.body.removeChild(textArea);
                                                                            }
                                                                            
                                                                            setCopiedBills(prev => new Set([...prev, billId]));
                                                                            
                                                                            setTimeout(() => {
                                                                                setCopiedBills(prev => {
                                                                                    const newSet = new Set(prev);
                                                                                    newSet.delete(billId);
                                                                                    return newSet;
                                                                                });
                                                                            }, 2000);
                                                                            
                                                                        } catch (error) {
                                                                            console.error('❌ Failed to copy to clipboard:', error);
                                                                        }
                                                                    };

                                                                    copySuccess();
                                                                }}
                                                            >
                                                                {copiedBills.has(billId) ? (
                                                                    <>
                                                                        <Check size={16} />
                                                                        <span>Copied</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Copy size={16} />
                                                                        <span>Copy Details</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : hasData ? (
                            <div className="text-center py-12">
                                <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Results Found</h3>
                                <p className="text-gray-600 mb-4">
                                    No bills match your current filter criteria.
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
                                    No legislation data is currently available for {stateName}.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Pagination Controls */}
                    {totalItems > 0 && (
                        <PaginationControls
                            currentPage={currentPage}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            itemsPerPage={ITEMS_PER_PAGE}
                            onPageChange={handlePageChange}
                        />
                    )}
                </div>
            </div>

            {/* Filter Results Summary */}
            {!stateLoading && !stateError && selectedFilters.length > 0 && (
                <div className="mt-4 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
                        <span>
                            {allBills.length === 0 ? 'No results' : `${totalItems} total results`} for:
                            {selectedFilters.length > 0 && (
                                <span className="font-medium ml-1">
                                    {selectedFilters.map(f => EXTENDED_FILTERS.find(ef => ef.key === f)?.label || f).join(', ')}
                                </span>
                            )}
                        </span>
                        {totalItems > 25 && (
                            <span className="text-xs bg-blue-100 px-2 py-1 rounded">
                                {totalPages} pages
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Universal CSS Styles */}
            <style>{`
                .bg-purple-50 .text-violet-800,
                .bg-blue-50 .text-blue-800, 
                .bg-green-50 .text-green-800 {
                    word-break: normal;
                    overflow-wrap: anywhere;
                    white-space: pre-wrap;
                    text-align: justify;
                }

                .numbered-item {
                    page-break-inside: avoid;
                    break-inside: avoid;
                }

                .numbered-text {
                    word-break: normal;
                    overflow-wrap: anywhere;
                }

                .universal-ai-content,
                .universal-structured-content,
                .universal-text-content {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 14px;
                    line-height: 1.5;
                    color: inherit;
                }

                .universal-numbered-content {
                    margin: 8px 0;
                }

                .numbered-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    margin-bottom: 6px;
                    font-size: 14px;
                    line-height: 1.5;
                }

                .numbered-item:last-child {
                    margin-bottom: 0;
                }

                .number-bullet {
                    font-weight: 600;
                    font-size: 14px;
                    color: currentColor;
                    min-width: 20px;
                    flex-shrink: 0;
                }

                .numbered-text {
                    flex: 1;
                    font-size: 14px;
                    line-height: 1.5;
                    color: inherit;
                }

                .universal-bullet-content {
                    margin: 8px 0;
                }

                .bullet-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 8px;
                    margin-bottom: 6px;
                    font-size: 14px;
                    line-height: 1.5;
                }

                .bullet-item:last-child {
                    margin-bottom: 0;
                }

                .bullet-point {
                    font-weight: 600;
                    font-size: 16px;
                    color: currentColor;
                    min-width: 12px;
                    flex-shrink: 0;
                    margin-top: 1px;
                }

                .bullet-text {
                    flex: 1;
                    font-size: 14px;
                    line-height: 1.5;
                    color: inherit;
                }

                .numbered-list-content ol {
                    margin: 8px 0;
                    padding-left: 0;
                    list-style: none;
                    counter-reset: talking-points;
                }

                .numbered-list-content li {
                    position: relative;
                    padding-left: 24px;
                    margin-bottom: 6px;
                    font-size: 14px;
                    line-height: 1.5;
                    color: inherit;
                    counter-increment: talking-points;
                }

                .numbered-list-content li:before {
                    content: counter(talking-points) ".";
                    position: absolute;
                    left: 0;
                    top: 0;
                    font-weight: 600;
                    font-size: 14px;
                    color: currentColor;
                    min-width: 20px;
                }

                .numbered-list-content li:last-child {
                    margin-bottom: 0;
                }

                .universal-ai-content p {
                    margin: 0 0 8px 0;
                    font-size: 14px;
                    line-height: 1.5;
                }

                .universal-ai-content p:last-child {
                    margin-bottom: 0;
                }

                .universal-ai-content ol,
                .universal-ai-content ul {
                    margin: 8px 0;
                    padding-left: 20px;
                    font-size: 14px;
                }

                .universal-ai-content li {
                    margin-bottom: 4px;
                    font-size: 14px;
                    line-height: 1.5;
                    color: inherit;
                }

                .universal-ai-content li:last-child {
                    margin-bottom: 0;
                }

                .universal-ai-content strong {
                    font-weight: 600;
                    font-size: 14px;
                }

                .business-impact-sections {
                    margin: 8px 0;
                }

                .business-impact-section {
                    margin-bottom: 12px;
                }

                .business-impact-section:last-child {
                    margin-bottom: 0;
                }

                .section-header {
                    margin-bottom: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    color: inherit;
                }

                .section-items {
                    margin: 0;
                    padding: 0;
                    list-style: none;
                }

                .section-item {
                    margin-bottom: 4px;
                    font-size: 14px;
                    line-height: 1.5;
                    color: inherit;
                }

                .section-item:last-child {
                    margin-bottom: 0;
                }

                .text-purple-800 .universal-ai-content,
                .text-purple-800 .universal-structured-content,
                .text-purple-800 .universal-text-content,
                .text-purple-800 .number-bullet,
                .text-purple-800 .numbered-text,
                .text-purple-800 .bullet-point,
                .text-purple-800 .bullet-text {
                    color: #5b21b6;
                }

                .text-blue-800 .universal-ai-content,
                .text-blue-800 .universal-structured-content,
                .text-blue-800 .universal-text-content,
                .text-blue-800 .number-bullet,
                .text-blue-800 .numbered-text,
                .text-blue-800 .bullet-point,
                .text-blue-800 .bullet-text {
                    color: #1e40af;
                }

                .text-green-800 .universal-ai-content,
                .text-green-800 .universal-structured-content,
                .text-green-800 .universal-text-content,
                .text-green-800 .number-bullet,
                .text-green-800 .numbered-text,
                .text-green-800 .bullet-point,
                .text-green-800 .bullet-text {
                    color: #166534;
                }

                .text-violet-800 .universal-ai-content,
                .text-violet-800 .universal-structured-content,
                .text-violet-800 .universal-text-content,
                .text-violet-800 .number-bullet,
                .text-violet-800 .numbered-text,
                .text-violet-800 .bullet-point,
                .text-violet-800 .bullet-text {
                    color: #5b21b6;
                }

                .section-header {
                    margin-bottom: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    color: inherit;
                }

                .section-item {
                    margin-bottom: 4px;
                    font-size: 14px;
                    line-height: 1.5;
                    color: inherit;
                }

                /* Custom CSS to force dropdown to open to the left */
                .filter-dropdown-right .absolute {
                    right: 0 !important;
                    left: auto !important;
                }

                .filter-dropdown-right .origin-top-right {
                    transform-origin: top right !important;
                }

                /* Target the specific dropdown structure */
                .filter-dropdown-right > div[class*="absolute"] {
                    right: 0 !important;
                    left: auto !important;
                }

                /* If the FilterDropdown uses specific classes, override them */
                .filter-dropdown-right [role="menu"],
                .filter-dropdown-right .dropdown-menu {
                    right: 0 !important;
                    left: auto !important;
                }
            `}</style>
        </div>
    );
};

export default StatePage;