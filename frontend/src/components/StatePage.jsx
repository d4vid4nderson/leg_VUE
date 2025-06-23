// Complete StatePage.jsx with all original functionality plus pagination and reverse chronological ordering

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
  RotateCw as RefreshIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUp
} from 'lucide-react';

import { FILTERS, SUPPORTED_STATES } from '../utils/constants';
import { 
  getApiUrl,
  stripHtmlTags,
  generateUniqueId
} from '../utils/helpers';

// Pagination configuration
const ITEMS_PER_PAGE = 25;

// =====================================
// SCROLL TO TOP COMPONENT
// =====================================
const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show button when user scrolls down 300px (when header typically disappears)
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setIsVisible(scrollTop > 300);
    };

    // Add scroll event listener
    window.addEventListener('scroll', handleScroll);
    
    // Cleanup
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
      className={`fixed right-6 bottom-6 z-50 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
      title="Scroll to top"
      aria-label="Scroll to top"
    >
      <ArrowUp size={20} />
    </button>
  );
};

// Create a custom CategoryTag component that handles not-applicable and uses FILTER icons
const CustomCategoryTag = ({ category }) => {
  const cleanedCategory = cleanCategory(category);
  
  // Find the matching filter to get the icon
  const matchingFilter = FILTERS.find(filter => filter.key === cleanedCategory);
  const IconComponent = matchingFilter?.icon || AlertTriangle; // Default to AlertTriangle for not-applicable
  
  const getCategoryStyle = (cat) => {
    switch (cat) {
      case 'civic':
        return 'bg-blue-100 text-blue-800';
      case 'education':
        return 'bg-orange-100 text-orange-800';
      case 'engineering':
        return 'bg-green-100 text-green-800';
      case 'healthcare':
        return 'bg-red-100 text-red-800';
      case 'not-applicable':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getCategoryLabel = (cat) => {
    // First try to get label from FILTERS
    const matchingFilter = FILTERS.find(filter => filter.key === cat);
    if (matchingFilter) {
      return matchingFilter.label;
    }
    
    // Fallback labels
    switch (cat) {
      case 'civic': return 'Civic';
      case 'education': return 'Education';
      case 'engineering': return 'Engineering';
      case 'healthcare': return 'Healthcare';
      case 'not-applicable': return 'Not Applicable';
      default: return 'General';
    }
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getCategoryStyle(cleanedCategory)}`}>
      <IconComponent size={12} />
      {getCategoryLabel(cleanedCategory)}
    </span>
  );
};

const API_URL = getApiUrl();

// Function to clean and validate status values - only allow specific statuses
const cleanStatus = (status) => {
  if (!status || typeof status !== 'string') return 'Active';
  
  const trimmedStatus = status.trim().toLowerCase();
  
  // Define the only allowed status values
  const validStatuses = ['active', 'inactive', 'fail', 'pass'];
  
  // Check if the trimmed status is already valid
  if (validStatuses.includes(trimmedStatus)) {
    // Capitalize first letter and return
    return trimmedStatus.charAt(0).toUpperCase() + trimmedStatus.slice(1);
  }
  
  // Check for any numbers in the status - if found, default to Active
  if (/\d/.test(trimmedStatus)) {
    return 'Active';
  }
  
  // Map common variations to valid statuses
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
  
  // Try to map the status, otherwise default to Active
  return statusMap[trimmedStatus] || 'Active';
};

// Function to clean and validate category values
const cleanCategory = (category) => {
  if (!category || typeof category !== 'string') return 'not-applicable';
  
  const trimmedCategory = category.trim().toLowerCase();
  
  // Handle specific cases - convert unknown to not-applicable
  if (trimmedCategory === 'unknown') {
    return 'not-applicable';
  }
  
  const unwantedValues = ['4', 'not reviewed', 'null', ''];
  
  if (unwantedValues.includes(trimmedCategory) || trimmedCategory.length === 0) {
    return 'not-applicable'; // Default fallback
  }
  
  // Keep "not-applicable" as is if it's already that
  if (trimmedCategory === 'not applicable' || trimmedCategory === 'not-applicable') {
    return 'not-applicable';
  }
  
  // Map common variations to standard categories - these should match your FILTERS exactly
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
  
  // Get the valid category keys from your existing FILTERS
  const validCategories = FILTERS.map(f => f.key);
  validCategories.push('not-applicable'); // Add not-applicable as valid
  
  return validCategories.includes(mappedCategory) ? mappedCategory : 'not-applicable';
};

// Create a custom CategoryTag component that handles not-applicable and uses FILTER icons
const CustomCategoryTag = ({ category }) => {
  const cleanedCategory = cleanCategory(category);
  
  // Find the matching filter to get the icon
  const matchingFilter = FILTERS.find(filter => filter.key === cleanedCategory);
  const IconComponent = matchingFilter?.icon || AlertTriangle; // Default to AlertTriangle for not-applicable
  
  const getCategoryStyle = (cat) => {
    switch (cat) {
      case 'civic':
        return 'bg-blue-100 text-blue-800';
      case 'education':
        return 'bg-orange-100 text-orange-800';
      case 'engineering':
        return 'bg-green-100 text-green-800';
      case 'healthcare':
        return 'bg-red-100 text-red-800';
      case 'not-applicable':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getCategoryLabel = (cat) => {
    // First try to get label from FILTERS
    const matchingFilter = FILTERS.find(filter => filter.key === cat);
    if (matchingFilter) {
      return matchingFilter.label;
    }
    
    // Fallback labels
    switch (cat) {
      case 'civic': return 'Civic';
      case 'education': return 'Education';
      case 'engineering': return 'Engineering';
      case 'healthcare': return 'Healthcare';
      case 'not-applicable': return 'Not Applicable';
      default: return 'General';
    }
  };
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getCategoryStyle(cleanedCategory)}`}>
      <IconComponent size={12} />
      {getCategoryLabel(cleanedCategory)}
    </span>
  );
};

const API_URL = getApiUrl();

// Category-specific styling for fetch status bar
const getCategoryStyles = (category) => {
  switch (category) {
    case 'civic':
      return {
        background: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800'
      };
    case 'education':
      return {
        background: 'bg-orange-50',
        border: 'border-orange-200',
        text: 'text-orange-800'
      };
    case 'engineering':
      return {
        background: 'bg-green-50',
        border: 'border-green-200',
        text: 'text-green-800'
      };
    case 'healthcare':
      return {
        background: 'bg-red-50',
        border: 'border-red-200',
        text: 'text-red-800'
      };
    default:
      return {
        background: 'bg-blue-50',
        border: 'border-blue-200',
        text: 'text-blue-800'
      };
  }
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

// Extended FILTERS array with review status options only
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

  // Calculate page range to show
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 7;
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show pages around current page
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
      {/* Results info */}
      <div className="text-sm text-gray-700">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{totalItems}</span> bills
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          {/* Previous button */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`p-2 rounded-md text-sm font-medium transition-all duration-200 ${
              currentPage === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChevronLeft size={16} />
          </button>

          {/* Page numbers */}
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

          {/* Next button */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`p-2 rounded-md text-sm font-medium transition-all duration-200 ${
              currentPage === totalPages
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
  const [stateOrders, setStateOrders] = useState([]);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState(null);
  const [stateSearchTerm, setStateSearchTerm] = useState('');
  
  // Filter state
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // ✅ NEW: PAGINATION STATE (copied from ExecutiveOrdersPage)
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total_pages: 1,
    count: 0
  });

  // 🔢 NEW: FILTER COUNTS STATE (copied from ExecutiveOrdersPage)
  const [allFilterCounts, setAllFilterCounts] = useState({
    civic: 0,
    education: 0,
    engineering: 0,
    healthcare: 0,
    reviewed: 0,
    not_reviewed: 0,
    total: 0
  });
  
  // NEW: Database-driven review status (replaces localStorage)
  const {
    toggleReviewStatus,
    isItemReviewed,
    isItemReviewLoading,
    reviewCounts
  } = useReviewStatus(stateOrders, 'state_legislation');
  
  // Highlights state - Local state for immediate UI feedback
  const [localHighlights, setLocalHighlights] = useState(new Set());
  const [highlightLoading, setHighlightLoading] = useState(new Set());
  
  // Expanded bills state for showing AI content
  const [expandedBills, setExpandedBills] = useState(new Set());
  
  // UI state
  const [isFetchExpanded, setIsFetchExpanded] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [fetchStatus, setFetchStatus] = useState(null);
  const [hasData, setHasData] = useState(false);
  
  // Track the last fetched category for styling
  const [lastFetchedCategory, setLastFetchedCategory] = useState('civic');
  
  const filterDropdownRef = useRef(null);

  // Function to capitalize first letter of text
  const capitalizeFirstLetter = (text) => {
    if (!text || typeof text !== 'string') return text;
    const trimmed = text.trim();
    if (trimmed.length === 0) return text;
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  };

  const cleanBillTitle = (title) => {
    if (!title) return 'Untitled Bill';
    
    // Remove common problematic characters and formatting
    let cleaned = title
      .replace(/^\s*["'"']|["'"']\s*$/g, '') // Remove leading/trailing quotes
      .replace(/&quot;/g, '"') // Replace HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\u2018|\u2019/g, "'") // Replace smart quotes with regular quotes
      .replace(/\u201C|\u201D/g, '"') // Replace smart double quotes
      .replace(/\u2013|\u2014/g, '-') // Replace em/en dashes with regular dash
      .replace(/\.\s*\.\s*\.+/g, '...') // Clean up multiple periods
      .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '') // Remove non-printable characters
      .trim();
    
    // Remove trailing periods if they seem wrong (like "Bill Title.")
    if (cleaned.endsWith('.') && !cleaned.includes('etc.') && !cleaned.includes('Inc.')) {
      cleaned = cleaned.slice(0, -1).trim();
    }
    
    // Capitalize first letter if needed
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    return cleaned || 'Untitled Bill';
  };

  // Helper function to parse date strings and handle various formats
  const parseDate = (dateString) => {
    if (!dateString) return new Date(0); // Very old date for null values
    
    // Try parsing the date string
    const date = new Date(dateString);
    
    // If parsing failed, return a very old date
    if (isNaN(date.getTime())) {
      return new Date(0);
    }
    
    return date;
  };

  // FIXED: Improved bill ID generation for consistency with highlights
  const getStateBillId = useCallback((bill) => {
    if (!bill) return null;
    
    // Priority order for ID selection to ensure consistency with highlights
    if (bill.bill_id && typeof bill.bill_id === 'string') return bill.bill_id;
    if (bill.id && typeof bill.id === 'string') return bill.id;
    
    // Create consistent ID format
    if (bill.bill_number && bill.state) {
      return `${bill.state}-${bill.bill_number}`;
    }
    if (bill.bill_number) {
      return `${stateName || 'unknown'}-${bill.bill_number}`;
    }
    
    // Fallback using title hash for consistency
    if (bill.title) {
      const titleHash = bill.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
      return `state-bill-${titleHash}`;
    }
    
    // Last resort
    return `state-bill-${Math.random().toString(36).substr(2, 9)}`;
  }, [stateName]);

  // Expand/collapse functions for AI content
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

  // AI content formatting functions (similar to ExecutiveOrdersPage)
  const formatTalkingPoints = (content) => {
    if (!content) return null;

    // Remove HTML tags first
    let textContent = content.replace(/<[^>]*>/g, '');
    
    // Split by periods followed by numbers, but be more careful about sentence boundaries
    const points = [];
    
    // Try to split by numbered patterns first - improved regex
    const numberedMatches = textContent.match(/\d+\.\s*[^.]*(?:\.[^0-9][^.]*)*(?=\s*\d+\.|$)/g);
    
    if (numberedMatches && numberedMatches.length > 1) {
      // Found numbered points, extract them
      numberedMatches.forEach((match) => {
        let cleaned = match.replace(/^\d+\.\s*/, '').trim();
        // Don't remove period if it's part of the sentence
        if (cleaned.length > 10) { // Only include substantial content
          points.push(cleaned);
        }
      });
    } else {
      // Fallback: split more intelligently by sentence patterns
      // Look for content that starts with numbers
      const sentences = textContent.split(/(?=\d+\.\s)/).filter(s => s.trim().length > 0);
      
      sentences.forEach((sentence) => {
        // Remove leading numbers/bullets but keep the content intact
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

    // If no points found, display as-is but cleaned
    return <div className="universal-text-content">{textContent}</div>;
  };

  const formatUniversalContent = (content) => {
    if (!content) return null;

    // Remove HTML tags but preserve formatting indicators
    let textContent = content.replace(/<(?!\/?(strong|b)\b)[^>]*>/g, '');
    textContent = textContent.replace(/<(strong|b)>(.*?)<\/(strong|b)>/g, '*$2*');
    
    // Updated section keywords to include Summary and Market Opportunity
    const sectionKeywords = [
      'Risk Assessment', 
      'Market Opportunity', 
      'Implementation Requirements', 
      'Financial Implications', 
      'Competitive Implications', 
      'Timeline Pressures',
      'Summary'
    ];
    
    // IMPROVED: Better regex that captures complete sentences until the next section
    const inlinePattern = new RegExp(`(${sectionKeywords.join('|')})[:.]?\\s*([^]*?)(?=\\s*(?:${sectionKeywords.join('|')}|$))`, 'gi');
    
    // First, try to extract inline sections
    const inlineMatches = [];
    let match;
    while ((match = inlinePattern.exec(textContent)) !== null) {
      inlineMatches.push({
        header: match[1].trim(),
        content: match[2].trim(),
        fullMatch: match[0]
      });
    }
    
    // If we found inline sections, process them
    if (inlineMatches.length > 0) {
      const sections = [];
      
      inlineMatches.forEach(({ header, content }) => {
        if (header && content && content.length > 5) {
          // Clean up the header
          let cleanHeader = header.trim();
          if (!cleanHeader.endsWith(':')) {
            cleanHeader += ':';
          }
          
          // IMPROVED: Better content processing that preserves complete sentences
          const items = [];
          
          // Check if content has explicit bullet patterns
          if (content.includes('•') || (content.includes('-') && content.match(/^\s*-/m)) || (content.includes('*') && content.match(/^\s*\*/m))) {
            // Split by explicit bullet indicators, but be more careful
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
              // Fallback: split by line breaks and look for bullet-like content
              const lines = content.split(/\n/).map(line => line.trim()).filter(line => line.length > 5);
              lines.forEach(line => {
                const cleanLine = line.replace(/^[•\-*]\s*/, '').trim();
                if (cleanLine.length > 5) {
                  items.push(capitalizeFirstLetter(cleanLine));
                }
              });
            }
          } else {
            // IMPROVED: For non-bulleted content, check if it's a single sentence or multiple sentences
            const sentences = content.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 5);
            
            if (sentences.length === 1 || content.length < 200) {
              // Single sentence or short content - treat as one item
              items.push(capitalizeFirstLetter(content.trim()));
            } else {
              // Multiple sentences - create bullet points
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

    // Fallback: display as simple text if no sections found
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
      
      // After updating filters, fetch filtered data from database
      setTimeout(() => {
        if (newFilters.length > 0 || stateSearchTerm) {
          fetchFilteredData(newFilters, stateSearchTerm, 1);
        } else {
          fetchFromDatabase(1);
        }
      }, 100);
      
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    console.log('🔄 Clearing all filters');
    setSelectedFilters([]);
    setStateSearchTerm('');
    setCurrentPage(1); // Reset to first page when clearing filters
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFilters, stateSearchTerm]);

  // ✅ FIXED: Fetch from database with proper pagination AND date sorting
  const fetchFromDatabase = useCallback(async (pageNum = 1) => {
    try {
      setStateLoading(true);
      setStateError(null);
      setFetchStatus('📊 Loading state legislation from database...');

      console.log(`🔍 Fetching page ${pageNum} for state: ${stateName}...`);

      const perPage = 25;
      const stateAbbr = SUPPORTED_STATES[stateName];
      
      // ✅ NEW: Add explicit date sorting parameters
      const url = `${API_URL}/api/state-legislation?state=${stateAbbr}&page=${pageNum}&per_page=${perPage}&order_by=introduced_date&order=desc`;
      console.log('🔍 Fetching from URL with date sorting:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // If date sorting isn't supported by backend, try without it
        console.log('🔄 Date sorting not supported, trying without sorting...');
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
        
        // ✅ CLIENT-SIDE SORTING: Sort by date if backend doesn't support it
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
        
        // ✅ IMPROVED SORTING: Better date sorting for display
        ordersArray.sort((a, b) => {
          const getDate = (bill) => {
            const dateStr = bill.introduced_date || bill.last_action_date || bill.signing_date || '1900-01-01';
            const parsedDate = new Date(dateStr);
            return isNaN(parsedDate.getTime()) ? new Date('1900-01-01') : parsedDate;
          };
          
          const dateA = getDate(a);
          const dateB = getDate(b);
          
          console.log(`📅 Main sort: ${a.title?.substring(0, 30)} (${dateA.toDateString()}) vs ${b.title?.substring(0, 30)} (${dateB.toDateString()})`);
          
          return dateB - dateA; // Newest first (descending)
        });
        
        // Use the display-sorted data with simple reverse numbering
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

        // ✅ SET STATE: Update orders and pagination with proper count
        setStateOrders(transformedBills);
        setPagination({
          page: pageNum,
          per_page: perPage,
          total_pages: totalPages,
          count: Math.max(totalCount, transformedBills.length) // Ensure count is never 0
        });

        console.log(`✅ Updated state - Page: ${pageNum}/${totalPages}, Count: ${Math.max(totalCount, transformedBills.length)}`);
        console.log(`🔢 First bill should be numbered: ${Math.max(totalCount, transformedBills.length) - ((pageNum - 1) * perPage + 0)}`);

        setFetchStatus(`✅ Loaded ${transformedBills.length} of ${Math.max(totalCount, transformedBills.length)} bills (Page ${pageNum}/${totalPages}) - Sorted by date`);
        setHasData(transformedBills.length > 0);
        setTimeout(() => setFetchStatus(null), 4000);
        return;
      }

      const data = await response.json();
      console.log('🔍 API Response:', data);

      // ✅ COMPREHENSIVE DATA EXTRACTION: Handle different response formats
      let ordersArray = [];
      let totalCount = 0;
      let currentPage = pageNum;
      
      if (Array.isArray(data)) {
        ordersArray = data;
        totalCount = data.length;
        console.log('🔍 Using data directly as array');
      } else if (data.results && Array.isArray(data.results)) {
        ordersArray = data.results;
        totalCount = data.total || data.count || 0;  
        currentPage = data.page || pageNum;                           
        console.log('🔍 Using data.results - total:', totalCount, 'current page:', currentPage);
      } else if (data.data && Array.isArray(data.data)) {
        ordersArray = data.data;
        totalCount = data.total || data.count || 0;  
        currentPage = data.page || pageNum;
        console.log('🔍 Using data.data');
      } else if (data.state_legislation && Array.isArray(data.state_legislation)) {
        ordersArray = data.state_legislation;
        totalCount = data.total || data.count || 0;  
        currentPage = data.page || pageNum;
        console.log('🔍 Using data.state_legislation');
      } else {
        console.error('🔍 Could not find bills array in response!');
        console.error('🔍 Available fields:', Object.keys(data));
        throw new Error('No bills found in API response');
      }

      // Calculate totalPages after we have all the data
      const totalPages = data.total_pages || Math.ceil(totalCount / perPage);

      console.log(`🔍 Extracted ${ordersArray.length} bills from page ${currentPage}`);
      console.log(`🔍 Total count: ${totalCount}, Total pages: ${totalPages}`);

      // Transform bills with enhanced compatibility and CLEANED META VALUES
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

      console.log(`🔍 Transformed ${transformedBills.length} bills`);

      // ✅ SET STATE: Update orders and pagination
      setStateOrders(transformedBills);
      setPagination({
        page: currentPage,
        per_page: perPage,
        total_pages: totalPages,
        count: totalCount
      });

      console.log(`✅ Updated state - Page: ${currentPage}/${totalPages}, Count: ${totalCount}`);

      setFetchStatus(`✅ Loaded ${transformedBills.length} of ${totalCount} bills (Page ${currentPage}/${totalPages})`);
      setHasData(transformedBills.length > 0);
      setTimeout(() => setFetchStatus(null), 4000);

    } catch (err) {
      console.error('❌ Error details:', err);
      setStateError(`Failed to load state legislation: ${err.message}`);
      setFetchStatus(`❌ Error: ${err.message}`);
      setTimeout(() => setFetchStatus(null), 5000);
      setStateOrders([]);
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
      let categoryCounts = { civic: 0, education: 0, engineering: 0, healthcare: 0 };
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
      const reviewedCount = stateOrders.filter(bill => isItemReviewed(bill)).length;

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
        fallbackCounts[filter.key] = stateOrders.filter(order => cleanCategory(order?.category) === filter.key).length;
      });
      
      const total = pagination.count || stateOrders.length || 0; // Use pagination total if available
      const reviewed = stateOrders.filter(order => isItemReviewed(order)).length;
      
      console.log('📊 Using fallback counts with pagination total:', total);
      
      setAllFilterCounts({
        ...fallbackCounts,
        reviewed: reviewed,
        not_reviewed: Math.max(0, total - reviewed),
        total: total
      });
    }
  }, [stateOrders, stateName, pagination.count, isItemReviewed]);

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
      setFetchStatus('🔍 Filtering state legislation...');

      console.log(`🔍 fetchFilteredData called with filters: ${filters}, search: "${search}", page: ${pageNum}`);

      // First, get ALL filtered results to show correct total count
      const allFilteredOrders = await fetchAllFilteredData(filters, search);
      const totalFilteredCount = allFilteredOrders.length;

      console.log(`🔍 Got ${totalFilteredCount} total filtered bills from fetchAllFilteredData`);

      if (totalFilteredCount === 0) {
        console.log('🔍 No filtered results found');
        setStateOrders([]);
        setPagination({
          page: 1,
          per_page: 25,
          total_pages: 0,
          count: 0
        });
        setFetchStatus(`❌ No results found for selected filters`);
        setHasData(false);
        setTimeout(() => setFetchStatus(null), 4000);
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
      setStateOrders(paginatedOrders);
      setPagination({
        page: pageNum,
        per_page: perPage,
        total_pages: totalPages,
        count: totalFilteredCount
      });

      console.log(`🔍 Set pagination: page ${pageNum}/${totalPages}, total count: ${totalFilteredCount}`);

      setFetchStatus(`✅ Found ${totalFilteredCount} filtered bills, showing page ${pageNum} of ${totalPages}`);
      setHasData(paginatedOrders.length > 0);
      setTimeout(() => setFetchStatus(null), 4000);

    } catch (err) {
      console.error('❌ Filtered fetch failed:', err);
      setStateError(`Failed to filter state legislation: ${err.message}`);
      setFetchStatus(`❌ Filter error: ${err.message}`);
      setTimeout(() => setFetchStatus(null), 5000);
      setStateOrders([]);
      setHasData(false);
    } finally {
      setStateLoading(false);
    }
  }, [fetchAllFilteredData]);

  // ✅ NEW: PAGE CHANGE HANDLER
  const handlePageChange = useCallback((newPage) => {
    console.log(`🔄 Changing to page ${newPage} with filters:`, selectedFilters);
    
    if (selectedFilters.length > 0 || stateSearchTerm) {
      fetchFilteredData(selectedFilters, stateSearchTerm, newPage);
    } else {
      fetchFromDatabase(newPage);
    }
  }, [selectedFilters, stateSearchTerm, fetchFromDatabase, fetchFilteredData]);

  // Handle search
  const handleSearch = useCallback(() => {
    console.log(`🔍 Searching for: "${stateSearchTerm}"`);
    if (selectedFilters.length > 0 || stateSearchTerm) {
      fetchFilteredData(selectedFilters, stateSearchTerm, 1);
    }
  }, [stateSearchTerm, selectedFilters, fetchFilteredData]);

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
          fallbackCounts[filter.key] = stateOrders.filter(bill => cleanCategory(bill?.category) === filter.key).length;
        });
        
        const reviewed = stateOrders.filter(bill => isItemReviewed(bill)).length;
        
        setAllFilterCounts({
          ...fallbackCounts,
          reviewed: reviewed,
          not_reviewed: Math.max(0, stateOrders.length - reviewed),
          total: stateOrders.length
        });
      }
    } catch (error) {
      console.error('❌ Error updating filter counts:', error);
    }
  }, [stateName, fetchFilterCounts, stateOrders, isItemReviewed]);

  // Update filter counts when filters or search changes
  useEffect(() => {
    if (stateOrders.length > 0) {
      updateFilterCounts(selectedFilters, stateSearchTerm);
    }
  }, [selectedFilters, stateSearchTerm, stateOrders.length, updateFilterCounts]);

  // UPDATED: Load existing highlights on component mount - using same pattern as ExecutiveOrdersPage
  useEffect(() => {
    const loadExistingHighlights = async () => {
      try {
        console.log('🔍 StatePage: Loading existing highlights...');
        const response = await fetch(`${API_URL}/api/highlights?user_id=1`);
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 StatePage: Raw highlights response:', data);
          
          // Handle different response formats (same as ExecutiveOrdersPage)
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
          console.log('🌟 StatePage: Loaded highlights:', Array.from(stateBillIds));
        }
      } catch (error) {
        console.error('Error loading existing highlights:', error);
      }
    };
    
    // Load highlights immediately on mount
    loadExistingHighlights();
  }, []); // Empty dependency array - run once on mount

  // ALSO load highlights when state orders are loaded
  useEffect(() => {
    if (stateOrders.length > 0) {
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
  }, [stateOrders.length]);

  // 🚀 NEW: AUTO-LOAD: Auto-load data from database on component mount
  useEffect(() => {
    if (stateName && SUPPORTED_STATES[stateName]) {
      console.log('🚀 Component mounted - attempting auto-load...');
      
      const autoLoad = async () => {
        try {
          console.log('📊 Auto-loading state legislation from database...');
          await fetchFromDatabase(1);
          console.log('✅ Auto-load completed successfully');
        } catch (err) {
          console.error('❌ Auto-load failed:', err);
          // Don't show error for auto-load failure, just log it
          setStateOrders([]);
          setHasData(false);
        }
      };

      // Small delay to ensure component is fully mounted
      const timeoutId = setTimeout(autoLoad, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [stateName, fetchFromDatabase]); // Depend on stateName and fetchFromDatabase

  // NEW: Enhanced review status handler using database
  const handleToggleReviewStatus = async (bill) => {
    try {
      console.log('🔍 Frontend: Bill object:', bill);
      console.log('🔍 Frontend: Available IDs:', {
        id: bill.id,
        bill_id: bill.bill_id,
        bill_number: bill.bill_number
      });
      
      // The ID being sent should be the database ID (bill.id), not bill_id
      const idToSend = bill.id || bill.bill_id;
      console.log('🔍 Frontend: ID being sent to API:', idToSend);
      const newStatus = await toggleReviewStatus(bill);
      
      // Update the local state to reflect the change immediately
      setStateOrders(prevOrders => 
        prevOrders.map(order => 
          (order.id === bill.id || order.bill_id === bill.bill_id) 
            ? { ...order, reviewed: newStatus }
            : order
        )
      );
    } catch (error) {
      console.error('Error toggling review status:', error);
      // Optionally show an error message to the user
    }
  };

  // FIXED: Enhanced highlighting function - exactly matching ExecutiveOrdersPage pattern
  const handleStateBillHighlight = useCallback(async (bill) => {
    console.log('🌟 StatePage highlight handler called for:', bill.title);
    
    const billId = getStateBillId(bill);
    if (!billId) {
      console.error('❌ No valid bill ID found for highlighting');
      return;
    }
    
    const isCurrentlyHighlighted = localHighlights.has(billId);
    console.log('🌟 Current highlight status:', isCurrentlyHighlighted, 'Bill ID:', billId);
    
    // Add to loading state
    setHighlightLoading(prev => new Set([...prev, billId]));
    
    try {
      if (isCurrentlyHighlighted) {
        // REMOVE highlight
        console.log('🗑️ Attempting to remove highlight for:', billId);
        
        // Optimistic UI update
        setLocalHighlights(prev => {
          const newSet = new Set(prev);
          newSet.delete(billId);
          return newSet;
        });
        
        const response = await fetch(`${API_URL}/api/highlights/${billId}?user_id=1`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          console.error('❌ Failed to remove highlight from backend');
          // Revert optimistic update
          setLocalHighlights(prev => new Set([...prev, billId]));
        } else {
          console.log('✅ Successfully removed highlight from backend');
          if (stableHandlers?.handleItemHighlight) {
            stableHandlers.handleItemHighlight(bill, 'state_legislation');
          }
        }
      } else {
        // ADD highlight
        console.log('⭐ Attempting to add highlight for:', billId);
        
        // Optimistic UI update
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
        
        if (!response.ok) {
          console.error('❌ Failed to add highlight');
          if (response.status !== 409) { // 409 means already exists
            // Revert optimistic update
            setLocalHighlights(prev => {
              const newSet = new Set(prev);
              newSet.delete(billId);
              return newSet;
            });
          }
        } else {
          console.log('✅ Successfully added highlight to backend');
          if (stableHandlers?.handleItemHighlight) {
            stableHandlers.handleItemHighlight(bill, 'state_legislation');
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error managing highlight:', error);
      // Revert optimistic update on error
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
      // Remove from loading state
      setHighlightLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(billId);
        return newSet;
      });
    }
  }, [localHighlights, stableHandlers, getStateBillId]);

  // Enhanced check if bill is highlighted (using local state)
  const isStateBillHighlighted = useCallback((bill) => {
    const billId = getStateBillId(bill);
    if (!billId) return false;
    
    // Check local state first for immediate UI feedback
    const localHighlighted = localHighlights.has(billId);
    
    // Also check stable handlers as fallback
    const stableHighlighted = stableHandlers?.isItemHighlighted?.(bill) || false;
    
    const isHighlighted = localHighlighted || stableHighlighted;
    
    return isHighlighted;
  }, [localHighlights, stableHandlers, getStateBillId]);

  // Check if bill is currently being highlighted/unhighlighted
  const isBillHighlightLoading = useCallback((bill) => {
    const billId = getStateBillId(bill);
    return billId ? highlightLoading.has(billId) : false;
  }, [highlightLoading, getStateBillId]);

  // ✅ NEW: Count functions for filter display (copied from ExecutiveOrdersPage)
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
      
      const results = data?.results || [];
      
      // Transform bills with enhanced compatibility and CLEANED META VALUES
      const transformedBills = results.map((bill, index) => {
        const uniqueId = getStateBillId(bill) || `fallback-${index}`;
        
        return {
          // Core identification
          id: uniqueId,
          bill_id: uniqueId,
          
          // Standard bill fields with CLEANED VALUES
          title: bill?.title || 'Untitled Bill',
          status: cleanStatus(bill?.status), // ✅ CLEANED STATUS
          category: cleanCategory(bill?.category), // ✅ CLEANED CATEGORY
          description: bill?.description || bill?.ai_summary || 'No description available',
          tags: [cleanCategory(bill?.category)].filter(Boolean), // ✅ CLEANED TAGS
          summary: bill?.ai_summary ? stripHtmlTags(bill.ai_summary) : 'No AI summary available',
          bill_number: bill?.bill_number,
          state: bill?.state || stateName,
          legiscan_url: bill?.legiscan_url,
          ai_talking_points: bill?.ai_talking_points,
          ai_business_impact: bill?.ai_business_impact,
          ai_potential_impact: bill?.ai_potential_impact,
          introduced_date: bill?.introduced_date,
          last_action_date: bill?.last_action_date,
          
          // Highlights page compatibility
          executive_order_number: bill?.bill_number || uniqueId,
          signing_date: bill?.introduced_date,
          ai_summary: bill?.ai_summary ? stripHtmlTags(bill.ai_summary) : bill?.description || 'No summary available',
          
          // Backend compatibility
          order_type: 'state_legislation',
          source_page: 'state-legislation'
        };
      });
      
      // Sort bills by date (newest first) for reverse chronological order
      transformedBills.sort((a, b) => {
        const dateA = parseDate(a.introduced_date || a.last_action_date);
        const dateB = parseDate(b.introduced_date || b.last_action_date);
        return dateB.getTime() - dateA.getTime(); // Newest first
      });
      
      console.log('🔍 Transformed bills:', transformedBills.length, 'bills');
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

  // Enhanced topic-based fetch function with category tracking
  const handleQuickFetchByTopic = async (topic, description) => {
    if (fetchingData) return;
    
    setFetchingData(true);
    setLastFetchedCategory(topic); // Track the category for styling
    setFetchStatus(`🔍 Searching for ${description} legislation in ${stateName}...`);
    
    try {
      const stateAbbr = SUPPORTED_STATES[stateName];
      const response = await fetch(`${API_URL}/api/legiscan/search-and-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: topic,
          state: stateAbbr,
          limit: 50,
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
          fetchFromDatabase(1);
        }, 1000);
      } else {
        setFetchStatus(`❌ Error: ${data.message || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Error fetching by topic:', error);
      setFetchStatus(`❌ Error: ${error.message}`);
    } finally {
      setFetchingData(false);
      setTimeout(() => {
        setFetchStatus(null);
        setLastFetchedCategory('civic'); // Reset to default
      }, 8000);
    }
  };

  // Filter the orders with multiple filter support and sort by date (newest first)
  const filteredStateOrders = useMemo(() => {
    if (!Array.isArray(stateOrders)) {
      return [];
    }

    let filtered = stateOrders;
    
    // Apply category filters
    const categoryFilters = selectedFilters.filter(f => !['reviewed', 'not_reviewed'].includes(f));
    if (categoryFilters.length > 0) {
      filtered = filtered.filter(bill => categoryFilters.includes(cleanCategory(bill?.category)));
    }

    // Apply review status filters - NOW USING DATABASE VALUES
    const hasReviewedFilter = selectedFilters.includes('reviewed');
    const hasNotReviewedFilter = selectedFilters.includes('not_reviewed');
    
    if (hasReviewedFilter && hasNotReviewedFilter) {
      // Both selected, show all
    } else if (hasReviewedFilter) {
      filtered = filtered.filter(bill => isItemReviewed(bill));
    } else if (hasNotReviewedFilter) {
      filtered = filtered.filter(bill => !isItemReviewed(bill));
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
    
    // Ensure the data is sorted newest first (this should already be done in fetchExistingData)
    filtered.sort((a, b) => {
      const dateA = parseDate(a.introduced_date || a.last_action_date);
      const dateB = parseDate(b.introduced_date || b.last_action_date);
      return dateB.getTime() - dateA.getTime(); // Newest first
    });
    
    return filtered;
  }, [stateOrders, selectedFilters, reviewedBills, stateSearchTerm, getStateBillId]);

  // Pagination calculations
  const totalItems = filteredStateOrders.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentPageItems = filteredStateOrders.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      // Scroll to top of results when changing pages
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Get dynamic styles for fetch status bar
  const fetchStatusStyles = getCategoryStyles(lastFetchedCategory);

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
                    return (
                      <button
                        key={filter.key}
                        onClick={() => toggleFilter(filter.key)}
                        className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center ${
                          isActive
                            ? filter.key === 'civic' ? 'bg-blue-100 text-blue-700 font-medium' :
                              filter.key === 'education' ? 'bg-orange-100 text-orange-700 font-medium' :
                              filter.key === 'engineering' ? 'bg-green-100 text-green-700 font-medium' :
                              filter.key === 'healthcare' ? 'bg-red-100 text-red-700 font-medium' :
                              filter.key === 'not-applicable' ? 'bg-gray-100 text-gray-700 font-medium' :
                              'bg-blue-100 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <IconComponent 
                            size={16} 
                            className={
                              filter.key === 'civic' ? 'text-blue-600' :
                              filter.key === 'education' ? 'text-orange-600' :
                              filter.key === 'engineering' ? 'text-green-600' :
                              filter.key === 'healthcare' ? 'text-red-600' :
                              filter.key === 'not-applicable' ? 'text-gray-600' :
                              'text-gray-600'
                            }
                          />
                          <span>{filter.label}</span>
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
                        ? 'bg-green-100 text-green-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Check size={16} className="text-green-600" />
                      <span>Reviewed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">({reviewCountsFromFilter.reviewed})</span>
                      {isFilterActive('reviewed') && (
                        <Check size={14} className="text-green-600" />
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => toggleFilter('not_reviewed')}
                    className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                      isFilterActive('not_reviewed')
                        ? 'bg-red-100 text-red-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={16} className="text-red-600" />
                      <span>Not Reviewed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">({reviewCountsFromFilter.notReviewed})</span>
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
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
            {stateSearchTerm && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  {stateOrders.length} found
                </span>
              </div>
            )}
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

      {/* Topic-Based Quick Pick Fetch Section */}
      <div className="mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
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

          {isFetchExpanded && (
            <div className="p-6">
              {/* Dynamic Fetch Status Bar with Category-Based Styling */}
              {fetchStatus && (
                <div className={`mb-6 p-4 ${fetchStatusStyles.background} ${fetchStatusStyles.border} border rounded-md`}>
                  <p className={`${fetchStatusStyles.text} text-sm font-medium`}>{fetchStatus}</p>
                </div>
              )}

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                  <BookOpen size={16} className="text-blue-600" />
                  Quick Fetch by Topic
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

                  <button
                    onClick={() => handleQuickFetchByTopic('education', 'Education')}
                    disabled={fetchingData}
                    className={`p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-105 ${
                      fetchingData 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg hover:border-orange-300 hover:bg-orange-50'
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

                  <button
                    onClick={() => handleQuickFetchByTopic('engineering', 'Engineering')}
                    disabled={fetchingData}
                    className={`p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-105 ${
                      fetchingData 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg hover:border-green-300 hover:bg-green-50'
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

                  <button
                    onClick={() => handleQuickFetchByTopic('healthcare', 'Healthcare')}
                    disabled={fetchingData}
                    className={`p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-105 ${
                      fetchingData 
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg hover:border-red-300 hover:bg-red-50'
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
                  
                  // Calculate the overall position for reverse numbering (highest to lowest)
                  const overallIndex = startIndex + index;
                  const reverseNumber = totalItems - overallIndex;

                  return (
                    <div key={bill.id || index} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">
                      {/* Bill Header */}
                      <div className="flex items-start justify-between px-6 pt-6 pb-2">
                        <div 
                          className="flex-1 pr-4 cursor-pointer hover:bg-gray-50 transition-all duration-300 rounded-md p-2 -ml-2 -mt-2"
                          onClick={() => toggleBillExpansion(bill)}
                        >
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
                            <CustomCategoryTag category={bill.category} />
                            <span>-</span>
                            <ReviewStatusTag isReviewed={isReviewed} />
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {/* NEW: Database-driven Review Status Button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleToggleReviewStatus(bill);
                            }}
                            disabled={isItemReviewLoading(bill)}
                            className={`p-2 rounded-md transition-all duration-300 ${
                              isItemReviewLoading(bill)
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

                          {/* Enhanced Highlight button with loading state */}
                          <button
                            type="button"
                            className={`p-2 rounded-md transition-all duration-300 ${
                              isStateBillHighlighted(bill)
                                ? 'text-yellow-500 bg-yellow-100 hover:bg-yellow-200'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-yellow-500'
                            } ${isBillHighlightLoading(bill) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!isBillHighlightLoading(bill)) {
                                console.log('🌟 Highlighting bill:', bill.title);
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
                              className={`text-gray-500 transition-transform duration-200 ${
                                isExpanded ? 'rotate-180' : ''
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* AI Summary - Always show if available */}
                      {bill.summary && bill.summary !== 'No AI summary available' && (
                        <div className="mb-4 mt-2 mx-6">
                        <div className="mb-4 mx-6">
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

                          {/* Action Buttons - Now in expanded section */}
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
                                    'Reviewed: ' + (isReviewed ? 'Yes' : 'No'),
                                    '',
                                    bill.summary && bill.summary !== 'No AI summary available' ? 'AI Summary: ' + bill.summary : '',
                                    bill.description ? 'Description: ' + bill.description : '',
                                    bill.ai_talking_points ? 'Key Talking Points: ' + stripHtmlTags(bill.ai_talking_points) : '',
                                    bill.ai_business_impact ? 'Business Impact: ' + stripHtmlTags(bill.ai_business_impact) : '',
                                    bill.ai_potential_impact ? 'Long-term Impact: ' + stripHtmlTags(bill.ai_potential_impact) : '',
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
                      )}
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

      {/* ✅ NEW: PAGINATION SECTION (copied from ExecutiveOrdersPage) */}
      {!stateLoading && !stateError && (
        <>
          {/* Show pagination if there are multiple pages */}
          {stateOrders.length > 0 && pagination.total_pages > 1 && (
            <div className="mt-6 flex justify-center">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(pagination.total_pages, 5) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`px-3 py-2 text-sm font-medium rounded-md ${
                          pagination.page === pageNum
                            ? 'text-blue-600 bg-blue-50 border border-blue-300'
                            : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  {/* Show more pages info if there are many pages */}
                  {pagination.total_pages > 5 && (
                    <>
                      <span className="px-2 text-gray-500">...</span>
                      <button
                        onClick={() => handlePageChange(pagination.total_pages)}
                        className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        {pagination.total_pages}
                      </button>
                    </>
                  )}
                </div>
                
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.total_pages}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
                
                {/* Page info */}
                <div className="ml-4 text-sm text-gray-600">
                  {selectedFilters.length > 0 || stateSearchTerm ? (
                    <>
                      Showing {Math.min((pagination.page - 1) * pagination.per_page + 1, pagination.count)}-{Math.min(pagination.page * pagination.per_page, pagination.count)} of {pagination.count} filtered results
                      {pagination.total_pages > 1 && ` (Page ${pagination.page} of ${pagination.total_pages})`}
                    </>
                  ) : (
                    <>
                      Page {pagination.page} of {pagination.total_pages} ({pagination.count} total bills)
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Show filter summary when filtering */}
          {(selectedFilters.length > 0 || stateSearchTerm) && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
                <span>
                  {stateOrders.length === 0 ? 'No results' : `${pagination.count} total results`} for: 
                  {selectedFilters.length > 0 && (
                    <span className="font-medium ml-1">
                      {selectedFilters.map(f => EXTENDED_FILTERS.find(ef => ef.key === f)?.label || f).join(', ')}
                    </span>
                  )}
                  {stateSearchTerm && (
                    <span className="font-medium ml-1">"{stateSearchTerm}"</span>
                  )}
                </span>
                {pagination.count > 25 && (
                  <span className="text-xs bg-blue-100 px-2 py-1 rounded">
                    {pagination.total_pages} pages
                  </span>
                )}
              </div>
            </div>
          )}
          
        </>
      )}

      {/* Universal CSS Styles - Same as ExecutiveOrdersPage */}
      <style>{`

          .bg-purple-50 .text-violet-800,
          .bg-blue-50 .text-blue-800, 
          .bg-green-50 .text-green-800 {
            word-break: normal;
            overflow-wrap: anywhere;
            white-space: pre-wrap;
            text-align: justify;
          }

          /* Ensure numbered items don't break awkwardly */
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
      `}</style>
    </div>
  );
};

export default StatePage;