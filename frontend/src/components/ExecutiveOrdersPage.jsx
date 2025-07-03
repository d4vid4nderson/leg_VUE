// =====================================
// IMPORTS AND DEPENDENCIES
// =====================================
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  ChevronDown,
  Download,
  RotateCw,
  ScrollText,
  Star,
  FileText,
  ExternalLink,
  Clock,
  Check,
  AlertTriangle,
  Sparkles,
  Zap,
  Database,
  Copy,
  Building,
  GraduationCap,
  Stethoscope,
  Wrench,
  Bell,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ArrowUp
} from 'lucide-react';

import { 
  FILTERS, 
  getFilterActiveClass, 
  getFilterIconClass,
  getCategoryTagClass 
} from '../utils/constants';
import { calculateAllCounts } from '../utils/filterUtils';
import FilterDropdown from '../components/FilterDropdown';
import API_URL from '../config/api';
import ShimmerLoader from '../components/ShimmerLoader';

// =====================================
// FUZZY SEARCH IMPLEMENTATION
// =====================================
class FuzzySearch {
  constructor() {
    this.threshold = 0.6; // Minimum score to be considered a match (0-1, higher = stricter)
    this.distance = 100; // Maximum distance for character matching
  }

  // Calculate similarity between two strings using Levenshtein distance
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Calculate similarity score (0-1, higher = more similar)
  calculateScore(query, target) {
    if (!query || !target) return 0;
    
    const queryLower = query.toLowerCase().trim();
    const targetLower = target.toLowerCase().trim();
    
    // Exact match gets highest score
    if (targetLower.includes(queryLower)) {
      return 1;
    }
    
    // Calculate fuzzy match score
    const distance = this.levenshteinDistance(queryLower, targetLower);
    const maxLength = Math.max(queryLower.length, targetLower.length);
    
    if (maxLength === 0) return 0;
    
    const score = 1 - (distance / maxLength);
    return Math.max(0, score);
  }

  // Search within a single field
  searchField(query, field, weight = 1) {
    if (!field) return 0;
    
    const score = this.calculateScore(query, field);
    return score * weight;
  }

  // Search across multiple fields of an order
  searchOrder(query, order) {
    if (!query || !order) return { score: 0, matches: [] };
    
    const queries = query.toLowerCase().split(/\s+/).filter(q => q.length > 0);
    const matches = [];
    let totalScore = 0;
    
    // Define searchable fields with weights
    const searchFields = [
      { field: order.title, name: 'title', weight: 3 },
      { field: getExecutiveOrderNumber(order), name: 'eo_number', weight: 2.5 },
      { field: order.formatted_signing_date, name: 'signing_date', weight: 2 },
      { field: order.formatted_publication_date, name: 'publication_date', weight: 2 },
      { field: order.ai_summary, name: 'ai_summary', weight: 2 },
      { field: order.ai_talking_points, name: 'talking_points', weight: 1.5 },
      { field: order.ai_business_impact, name: 'business_impact', weight: 1.5 },
      { field: order.summary, name: 'summary', weight: 1 },
      { field: order.category, name: 'category', weight: 1 }
    ];
    
    // For each query term, find the best matching field
    queries.forEach(queryTerm => {
      let bestScore = 0;
      let bestField = null;
      
      searchFields.forEach(({ field, name, weight }) => {
        if (field) {
          const score = this.searchField(queryTerm, String(field), weight);
          if (score > bestScore && score >= this.threshold) {
            bestScore = score;
            bestField = name;
          }
        }
      });
      
      if (bestScore > 0) {
        totalScore += bestScore;
        matches.push({
          query: queryTerm,
          field: bestField,
          score: bestScore
        });
      }
    });
    
    // Normalize score by number of query terms
    const normalizedScore = queries.length > 0 ? totalScore / queries.length : 0;
    
    return {
      score: normalizedScore,
      matches: matches
    };
  }

  // Main search function
  search(query, orders) {
    if (!query || !orders || orders.length === 0) {
      return orders || [];
    }
    
    const results = orders.map(order => {
      const searchResult = this.searchOrder(query, order);
      return {
        ...order,
        _searchScore: searchResult.score,
        _searchMatches: searchResult.matches
      };
    }).filter(order => order._searchScore >= this.threshold);
    
    // Sort by score (highest first)
    return results.sort((a, b) => b._searchScore - a._searchScore);
  }
}

// Create fuzzy search instance
const fuzzySearch = new FuzzySearch();

// =====================================
// CONFIGURATION AND CONSTANTS
// =====================================
//const API_URL = process.env.REACT_APP_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';

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
// UTILITY FUNCTIONS
// =====================================
const getExecutiveOrderId = (order) => {
  if (!order) return null;
  
  const candidates = [
    order.executive_order_number,
    order.document_number,
    order.eo_number,
    order.bill_number,
    order.id,
    order.bill_id
  ];
  
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'string' && candidate.trim()) {
      return `eo-${candidate.trim()}`;
    }
    if (candidate && typeof candidate === 'number') {
      return `eo-${candidate}`;
    }
  }
  
  if (order.title && typeof order.title === 'string') {
    const titleHash = order.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 30);
    return `eo-title-${titleHash}`;
  }
  
  console.warn('Could not generate stable ID for order:', order);
  return null;
};

const getExecutiveOrderNumber = (order) => {
  if (order.executive_order_number) return order.executive_order_number;
  if (order.document_number) return order.document_number;
  if (order.eo_number) return order.eo_number;
  if (order.bill_number) return order.bill_number;

  if (order.title) {
    const titleMatch = order.title.match(/Executive Order\s*#?\s*(\d+)/i);
    if (titleMatch) return titleMatch[1];
  }

  if (order.ai_summary) {
    const summaryMatch = order.ai_summary.match(/Executive Order\s*#?\s*(\d{4,5})/i);
    if (summaryMatch) return summaryMatch[1];
  }

  if (order.id && /^\d+$/.test(order.id)) return order.id;
  if (order.bill_id && /^\d+$/.test(order.bill_id)) return order.bill_id;

  return 'Unknown';
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const getOrderId = (order) => {
  return getExecutiveOrderId(order) || `fallback-${Math.random().toString(36).substr(2, 9)}`;
};

const stripHtmlTags = (content) => {
  if (!content) return '';
  return content.replace(/<[^>]*>/g, '');
};

const cleanOrderTitle = (title) => {
  if (!title) return 'Untitled Executive Order';
  
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
  
  return cleaned || 'Untitled Executive Order';
};

const capitalizeFirstLetter = (text) => {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (trimmed.length === 0) return text;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

// =====================================
// IN-MEMORY STORAGE MANAGER
// =====================================
const ReviewStatusManager = {
  _storage: new Map(),
  
  saveReviewedItems: (reviewedSet, storageKey) => {
    try {
      if (!reviewedSet || typeof reviewedSet.has !== 'function') {
        console.error('Invalid reviewedSet provided to saveReviewedItems');
        return false;
      }
      
      const itemsArray = Array.from(reviewedSet).filter(id => id && id.trim());
      ReviewStatusManager._storage.set(storageKey, itemsArray);
      console.log(`✅ Saved ${itemsArray.length} reviewed items to ${storageKey} (in-memory)`);
      return true;
    } catch (error) {
      console.error(`❌ Error saving reviewed items to ${storageKey}:`, error);
      return false;
    }
  },

  loadReviewedItems: (storageKey) => {
    try {
      const saved = ReviewStatusManager._storage.get(storageKey);
      if (!saved) {
        console.log(`📋 No saved reviewed items found for ${storageKey}`);
        return new Set();
      }
      
      if (!Array.isArray(saved)) {
        console.error(`❌ Invalid data format in ${storageKey}, expected array`);
        return new Set();
      }
      
      const validItems = saved.filter(id => id && typeof id === 'string' && id.trim());
      console.log(`✅ Loaded ${validItems.length} reviewed items from ${storageKey} (in-memory)`);
      return new Set(validItems);
    } catch (error) {
      console.error(`❌ Error loading reviewed items from ${storageKey}:`, error);
      return new Set();
    }
  }
};

// =====================================
// CONTENT FORMATTING FUNCTIONS
// =====================================
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

// =====================================
// COMPONENT DEFINITIONS
// =====================================
const CategoryTag = ({ category }) => {
  const getTagInfo = (cat) => {
    const filter = FILTERS.find(f => f.key === cat);
    if (!filter) return { color: 'bg-gray-100 text-gray-800', icon: FileText, label: cat };
    
    const colors = {
      civic: 'bg-blue-100 text-blue-800',
      healthcare: 'bg-red-100 text-red-800',
      education: 'bg-orange-100 text-orange-800',
      engineering: 'bg-green-100 text-green-800'
    };
    
    return {
      color: colors[cat] || 'bg-gray-100 text-gray-800',
      icon: filter.icon,
      label: filter.label
    };
  };

  const tagInfo = getTagInfo(category);
  const IconComponent = tagInfo.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${tagInfo.color}`}>
      <IconComponent
          size={16}
          className={
              category === 'civic' ? 'text-blue-600' :
              category === 'education' ? 'text-orange-600' :
              category === 'engineering' ? 'text-green-600' :
              category === 'healthcare' ? 'text-red-600' :
              category === 'not-applicable' ? 'text-gray-600' :
              'text-gray-600'
          }
      />
      {tagInfo.label}
    </span>
  );
};

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

// =====================================
// PAGINATION COMPONENT
// =====================================
const PaginationControls = ({ 
  currentPage, 
  totalPages, 
  totalItems, 
  itemsPerPage, 
  onPageChange,
  itemType = 'items'
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

  if (totalPages <= 1) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-gray-50 border-t border-gray-200">
      {/* Results info */}
      <div className="text-sm text-gray-700">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{totalItems}</span> {itemType}
      </div>

      {/* Pagination controls */}
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
    </div>
  );
};

// =====================================
// SEARCH RESULT HIGHLIGHT COMPONENT
// =====================================
const SearchResultHighlight = ({ order }) => {
  if (!order._searchMatches || order._searchMatches.length === 0) {
    return null;
  }

  return (
    <div className="mb-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
      <span className="font-medium">Matches:</span>{' '}
      {order._searchMatches.map((match, idx) => (
        <span key={idx} className="ml-1">
          {match.field}
          {idx < order._searchMatches.length - 1 && ', '}
        </span>
      ))}
      <span className="ml-2 text-blue-500">
        (Score: {(order._searchScore * 100).toFixed(0)}%)
      </span>
    </div>
  );
};

// =====================================
// CUSTOM HOOKS
// =====================================
const useExecutiveOrderReviewStatus = () => {
  const STORAGE_KEY = 'reviewedExecutiveOrders';
  const [reviewedOrders, setReviewedOrders] = useState(new Set());
  const [markingReviewed, setMarkingReviewed] = useState(new Set());

  useEffect(() => {
    console.log('🔄 Loading executive order review status from in-memory storage...');
    const loaded = ReviewStatusManager.loadReviewedItems(STORAGE_KEY);
    setReviewedOrders(loaded);
  }, []);

  useEffect(() => {
    ReviewStatusManager.saveReviewedItems(reviewedOrders, STORAGE_KEY);
  }, [reviewedOrders]);

  const toggleReviewStatus = useCallback(async (order) => {
    const orderId = getExecutiveOrderId(order);
    if (!orderId) {
      console.error('❌ Cannot toggle review status: invalid order ID');
      return false;
    }
    
    console.log(`🔄 Toggling review status for order: ${orderId}`);
    
    const isCurrentlyReviewed = reviewedOrders.has(orderId);
    setMarkingReviewed(prev => new Set([...prev, orderId]));
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setReviewedOrders(prev => {
        const newSet = new Set(prev);
        if (isCurrentlyReviewed) {
          newSet.delete(orderId);
          console.log(`✅ Marked order ${orderId} as NOT reviewed`);
        } else {
          newSet.add(orderId);
          console.log(`✅ Marked order ${orderId} as reviewed`);
        }
        return newSet;
      });
      
      return true;
    } catch (error) {
      console.error('❌ Error toggling review status:', error);
      return false;
    } finally {
      setMarkingReviewed(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  }, [reviewedOrders]);

  const isOrderReviewed = useCallback((order) => {
    const orderId = getExecutiveOrderId(order);
    return orderId ? reviewedOrders.has(orderId) : false;
  }, [reviewedOrders]);

  const isOrderMarking = useCallback((order) => {
    const orderId = getExecutiveOrderId(order);
    return orderId ? markingReviewed.has(orderId) : false;
  }, [markingReviewed]);

  return {
    reviewedOrders,
    toggleReviewStatus,
    isOrderReviewed,
    isOrderMarking
  };
};

// =====================================
// MAIN COMPONENT
// =====================================
  const ExecutiveOrdersPage = ({ stableHandlers, copyToClipboard }) => {
  // =====================================
  // STATE MANAGEMENT
  // =====================================
  const {
    reviewedOrders,
    toggleReviewStatus,
    isOrderReviewed,
    isOrderMarking
  } = useExecutiveOrderReviewStatus();

  const [allOrders, setAllOrders] = useState([]); // Store all loaded orders
  const [orders, setOrders] = useState([]); // Currently displayed orders
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  const [localHighlights, setLocalHighlights] = useState(new Set());
  const [highlightLoading, setHighlightLoading] = useState(new Set());
  
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  
  const [isFetchExpanded, setIsFetchExpanded] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [fetchStatus, setFetchStatus] = useState(null);
  const [hasData, setHasData] = useState(false);
  
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

  // NEW: Count check state - MOVED TO THE CORRECT LOCATION
  const [countCheckStatus, setCountCheckStatus] = useState({
    checking: false,
    needsFetch: false,
    newOrdersAvailable: 0,
    federalRegisterCount: 0,
    databaseCount: 0,
    lastChecked: null,
    error: null
  });

  const filterDropdownRef = useRef(null);

  // NEW: Function to check for new orders
const checkForNewOrders = useCallback(async (showLoading = false) => {
  try {
    if (showLoading) {
      setCountCheckStatus(prev => ({ ...prev, checking: true, error: null }));
    }

    console.log('🔍 Checking for new executive orders...');
    
    const response = await fetch(`${API_URL}/api/executive-orders/check-count`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📊 Count check result:', data);

    if (data.success) {
      // FIXED: Only set needsFetch to true if there are actually NEW orders
      const hasNewOrders = data.new_orders_available > 0;
      
      setCountCheckStatus({
        checking: false,
        needsFetch: hasNewOrders,  // Only true if new orders exist
        newOrdersAvailable: data.new_orders_available,
        federalRegisterCount: data.federal_register_count,
        databaseCount: data.database_count,
        lastChecked: new Date(data.last_checked),
        error: null
      });

      // Enhanced logging for debugging
      console.log(`📊 Count comparison:`);
      console.log(`   Federal Register: ${data.federal_register_count}`);
      console.log(`   Database: ${data.database_count}`);
      console.log(`   New orders: ${data.new_orders_available}`);
      console.log(`   Show notification: ${hasNewOrders}`);

      if (hasNewOrders && showLoading) {
        console.log(`🔔 ${data.new_orders_available} new orders available for fetch!`);
      } else if (!hasNewOrders) {
        console.log(`✅ Database is up to date - no new orders`);
      }
    } else {
      throw new Error(data.error || 'Count check failed');
    }

  } catch (error) {
    console.error('❌ Error checking for new orders:', error);
    setCountCheckStatus(prev => ({
      ...prev,
      checking: false,
      error: error.message,
      needsFetch: false,  // Don't show notification on error
      newOrdersAvailable: 0
    }));
  }
}, []);

  // NEW: Auto-check for new orders on page load
  useEffect(() => {
    // Check immediately when component mounts
    const initialCheck = async () => {
      // Wait a bit for the component to settle
      await new Promise(resolve => setTimeout(resolve, 2000));
      await checkForNewOrders(false); // Silent check
    };

    initialCheck();

    // Set up periodic checking every 5 minutes
    const interval = setInterval(() => {
      checkForNewOrders(false); // Silent periodic check
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [checkForNewOrders]);

  // NEW: Manual refresh button for count check
  const handleManualCountCheck = useCallback(async () => {
    await checkForNewOrders(true); // Show loading for manual check
  }, [checkForNewOrders]);

const FetchButtonWithNotification = () => {
  return (
    <div className="relative h-full">
      <button
        onClick={fetchExecutiveOrders}
        disabled={fetchingData || loading}
        className={`w-full h-full p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-104 relative flex flex-col justify-center ${
          fetchingData || loading
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:shadow-lg hover:border-blue-300 hover:bg-blue-50 border-gray-200 bg-white'
        }`}
      >
        <div className="font-medium mb-2 flex items-center justify-center gap-2 text-blue-600">
          <ScrollText size={16} />
          <span className="text-center leading-tight">
            Fetch New Executive Orders
          </span>
        </div>
        
        <div className="text-xs text-gray-500 text-center leading-tight">
          Get latest from Federal Register with AI analysis
        </div>
      </button>
    </div>
  );
};

  // Count status component
 const CountStatusComponent = () => {
  if (countCheckStatus.checking) {
    return (
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="flex items-center gap-2">
          <RotateCw size={16} className="animate-spin text-blue-600" />
          <span className="text-sm text-blue-700 font-medium">
            Checking for new executive orders...
          </span>
        </div>
      </div>
    );
  }

  if (countCheckStatus.error) {
    return (
      <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={16} className="text-yellow-600" />
            <span className="text-sm text-yellow-700">
              Unable to check for updates: {countCheckStatus.error}
            </span>
          </div>
          <button
            onClick={handleManualCountCheck}
            className="text-yellow-700 hover:text-yellow-800 text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // FIXED: Only show this notification when there are actually NEW orders
  if (countCheckStatus.needsFetch && countCheckStatus.newOrdersAvailable > 0) {
    return (
      <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-orange-600" />
            <span className="text-sm text-orange-700 font-medium">
              {countCheckStatus.newOrdersAvailable} new executive orders available!
            </span>
          </div>
          <div className="text-xs text-orange-600">
            Federal Register: {countCheckStatus.federalRegisterCount} | Database: {countCheckStatus.databaseCount}
          </div>
        </div>
      </div>
    );
  }

  // OPTIONAL: Show a "up to date" message when database is synchronized
  if (countCheckStatus.lastChecked && 
      countCheckStatus.federalRegisterCount > 0 && 
      countCheckStatus.databaseCount > 0 && 
      countCheckStatus.newOrdersAvailable === 0) {
    return (
      <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-green-600" />
            <span className="text-sm text-green-700 font-medium">
              Database is up to date
            </span>
          </div>
          <div className="text-xs text-green-600">
            {countCheckStatus.databaseCount} orders synchronized
          </div>
        </div>
      </div>
    );
  }

  return null;
};

  // =====================================
  // FUZZY SEARCH LOGIC
  // =====================================
  const filteredAndSearchedOrders = useMemo(() => {
    console.log('🔍 Running search and filters...', {
      searchTerm,
      selectedFilters,
      allOrdersCount: allOrders.length
    });

    let result = [...allOrders];

    // Apply category filters first
    const categoryFilters = selectedFilters.filter(f => !['reviewed', 'not_reviewed'].includes(f));
    if (categoryFilters.length > 0) {
      result = result.filter(order => categoryFilters.includes(order?.category));
      console.log(`🔍 After category filter: ${result.length} orders`);
    }

    // Apply review status filters
    const hasReviewedFilter = selectedFilters.includes('reviewed');
    const hasNotReviewedFilter = selectedFilters.includes('not_reviewed');
    
    if (hasReviewedFilter && !hasNotReviewedFilter) {
      result = result.filter(order => isOrderReviewed(order));
      console.log(`🔍 After reviewed filter: ${result.length} orders`);
    } else if (hasNotReviewedFilter && !hasReviewedFilter) {
      result = result.filter(order => !isOrderReviewed(order));
      console.log(`🔍 After not-reviewed filter: ${result.length} orders`);
    }

    // Apply fuzzy search
    if (searchTerm && searchTerm.trim()) {
      result = fuzzySearch.search(searchTerm.trim(), result);
      console.log(`🔍 After search: ${result.length} orders`);
    }

    return result;
  }, [allOrders, searchTerm, selectedFilters, isOrderReviewed]);

  // Paginate the filtered results
  const paginatedOrders = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.per_page;
    const endIndex = startIndex + pagination.per_page;
    return filteredAndSearchedOrders.slice(startIndex, endIndex);
  }, [filteredAndSearchedOrders, pagination.page, pagination.per_page]);

  // Update orders and pagination when filtered results change
  useEffect(() => {
    const totalFiltered = filteredAndSearchedOrders.length;
    const totalPages = Math.ceil(totalFiltered / pagination.per_page);
    
    // Reset to page 1 if current page is beyond available pages
    const currentPage = pagination.page > totalPages ? 1 : pagination.page;
    
    setOrders(paginatedOrders);
    setPagination(prev => ({
      ...prev,
      page: currentPage,
      total_pages: totalPages,
      count: totalFiltered
    }));

    console.log(`🔍 Pagination updated: ${totalFiltered} total, ${totalPages} pages, showing page ${currentPage}`);
  }, [filteredAndSearchedOrders, paginatedOrders, pagination.per_page, pagination.page]);

  // =====================================
  // HIGHLIGHT MANAGEMENT
  // =====================================
  useEffect(() => {
    const loadExistingHighlights = async () => {
      try {
        console.log('🔍 ExecutiveOrdersPage: Loading existing highlights...');
        const response = await fetch(`${API_URL}/api/highlights?user_id=1`);
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 ExecutiveOrdersPage: Raw highlights response:', data);
          
          const highlights = Array.isArray(data) ? data : [];
          const orderIds = new Set();
          
          highlights.forEach(highlight => {
            if (highlight.order_type === 'executive_order' && highlight.order_id) {
              orderIds.add(highlight.order_id);
            }
          });
          
          setLocalHighlights(orderIds);
          console.log('🌟 ExecutiveOrdersPage: Loaded highlights:', Array.from(orderIds));
        }
      } catch (error) {
        console.error('Error loading existing highlights:', error);
      }
    };
    
    loadExistingHighlights();
  }, []);

  useEffect(() => {
    if (allOrders.length > 0) {
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
            
            const orderIds = new Set();
            highlights.forEach(highlight => {
              if (highlight.order_type === 'executive_order' && highlight.order_id) {
                orderIds.add(highlight.order_id);
              }
            });
            
            setLocalHighlights(orderIds);
          }
        } catch (error) {
          console.error('Error loading highlights after orders loaded:', error);
        }
      };
      
      loadExistingHighlights();
    }
  }, [allOrders.length]);

  // =====================================
  // AUTO-LOAD DATA ON MOUNT
  // =====================================
  useEffect(() => {
    console.log('🚀 Component mounted - attempting auto-load...');
    
    const autoLoad = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('📊 Auto-loading executive orders from database...');

        const url = `${API_URL}/api/executive-orders?page=1&per_page=100`;
        console.log('🔍 Auto-load fetching from URL:', url);
        
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
        console.log('🔍 Auto-load API Response:', data);

        let ordersArray = [];
        let totalCount = 0;
        
        if (Array.isArray(data)) {
          ordersArray = data;
          totalCount = data.length;
        } else if (data.results && Array.isArray(data.results)) {
          ordersArray = data.results;
          totalCount = data.total || data.count || 0;
        } else if (data.data && Array.isArray(data.data)) {
          ordersArray = data.data;
          totalCount = data.total || data.count || 0;
        } else if (data.executive_orders && Array.isArray(data.executive_orders)) {
          ordersArray = data.executive_orders;
          totalCount = data.total || data.count || 0;
        }

        const transformedOrders = ordersArray.map((order, index) => {
          const uniqueId = order.executive_order_number || order.document_number || order.id || order.bill_id || `order-1-${index}`;
          
          return {
            id: uniqueId,
            bill_id: uniqueId,
            eo_number: order.executive_order_number || order.document_number || 'Unknown',
            executive_order_number: order.executive_order_number || order.document_number || 'Unknown',
            title: order.title || order.bill_title || 'Untitled Executive Order',
            summary: order.description || order.summary || '',
            signing_date: order.signing_date || order.introduced_date || '',
            publication_date: order.publication_date || order.last_action_date || '',
            html_url: order.html_url || order.legiscan_url || '',
            pdf_url: order.pdf_url || '',
            category: order.category || 'civic',
            formatted_publication_date: formatDate(order.publication_date || order.last_action_date),
            formatted_signing_date: formatDate(order.signing_date || order.introduced_date),
            ai_summary: order.ai_summary || order.ai_executive_summary || '',
            ai_talking_points: order.ai_talking_points || order.ai_key_points || '',
            ai_business_impact: order.ai_business_impact || order.ai_potential_impact || '',
            ai_processed: !!(order.ai_summary || order.ai_executive_summary),
            president: order.president || 'Donald Trump',
            source: 'Database (Federal Register + Azure AI)',
            is_highlighted: false,
            index: index
          };
        });

        console.log(`🔍 Auto-load transformed ${transformedOrders.length} orders`);

        setAllOrders(transformedOrders);
        setHasData(transformedOrders.length > 0);
        console.log('✅ Auto-load completed successfully');

      } catch (err) {
        console.error('❌ Auto-load failed:', err);
        setAllOrders([]);
        setHasData(false);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(autoLoad, 100);
    return () => clearTimeout(timeoutId);
  }, []);

const filterCounts = useMemo(() => {
  return calculateAllCounts(allOrders, {
    getCategoryFn: (order) => order?.category,
    reviewStatusFn: (order) => isOrderReviewed(order),
    includeOrderTypes: false
  });
}, [allOrders, isOrderReviewed]);

  // =====================================
  // API FUNCTIONS
  // =====================================
  const fetchFromDatabase = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setFetchStatus('📊 Loading executive orders from database...');

      const url = `${API_URL}/api/executive-orders?per_page=100`;
      console.log('🔍 Fetching from URL:', url);
      
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
      console.log('🔍 API Response:', data);

      let ordersArray = [];
      
      if (Array.isArray(data)) {
        ordersArray = data;
      } else if (data.results && Array.isArray(data.results)) {
        ordersArray = data.results;
      } else if (data.data && Array.isArray(data.data)) {
        ordersArray = data.data;
      } else if (data.executive_orders && Array.isArray(data.executive_orders)) {
        ordersArray = data.executive_orders;
      }

      const transformedOrders = ordersArray.map((order, index) => {
        const uniqueId = order.executive_order_number || order.document_number || order.id || order.bill_id || `order-db-${index}`;
        
        return {
          id: uniqueId,
          bill_id: uniqueId,
          eo_number: order.executive_order_number || order.document_number || 'Unknown',
          executive_order_number: order.executive_order_number || order.document_number || 'Unknown',
          title: order.title || order.bill_title || 'Untitled Executive Order',
          summary: order.description || order.summary || '',
          signing_date: order.signing_date || order.introduced_date || '',
          publication_date: order.publication_date || order.last_action_date || '',
          html_url: order.html_url || order.legiscan_url || '',
          pdf_url: order.pdf_url || '',
          category: order.category || 'civic',
          formatted_publication_date: formatDate(order.publication_date || order.last_action_date),
          formatted_signing_date: formatDate(order.signing_date || order.introduced_date),
          ai_summary: order.ai_summary || order.ai_executive_summary || '',
          ai_talking_points: order.ai_talking_points || order.ai_key_points || '',
          ai_business_impact: order.ai_business_impact || order.ai_potential_impact || '',
          ai_processed: !!(order.ai_summary || order.ai_executive_summary),
          president: order.president || 'Donald Trump',
          source: 'Database (Federal Register + Azure AI)',
          is_highlighted: false,
          index: index
        };
      });

      console.log(`🔍 Transformed ${transformedOrders.length} orders`);

      setAllOrders(transformedOrders);
      setFetchStatus(`✅ Loaded ${transformedOrders.length} orders from database`);
      setHasData(transformedOrders.length > 0);
      
      // Reset to page 1 when loading new data
      setPagination(prev => ({ ...prev, page: 1 }));
      
      setTimeout(() => setFetchStatus(null), 4000);

    } catch (err) {
      console.error('❌ Error details:', err);
      setError(`Failed to load executive orders: ${err.message}`);
      setFetchStatus(`❌ Error: ${err.message}`);
      setTimeout(() => setFetchStatus(null), 5000);
      setAllOrders([]);
      setHasData(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchExecutiveOrders = useCallback(async () => {
    try {
      setFetchingData(true);
      console.log('🔄 Starting Executive Orders fetch from Federal Register...');

      const requestBody = {
        start_date: "2025-01-20",
        end_date: null,
        with_ai: true,
        save_to_db: true
      };

      const endpoints = [
        `${API_URL}/api/fetch-executive-orders-simple`,
        `${API_URL}/api/executive-orders/run-pipeline`,
        `${API_URL}/api/executive-orders/fetch`,
        `${API_URL}/api/fetch-executive-orders`
      ];

      let response;
      let successfulEndpoint = null;

      for (const endpoint of endpoints) {
        try {
          console.log('🔍 Trying endpoint:', endpoint);
          
          setFetchStatus(`🔄 Connecting to ${endpoint.split('/').pop()}...`);
          
          response = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
          });

          if (response.ok) {
            successfulEndpoint = endpoint;
            console.log('✅ Successfully connected to:', endpoint);
            
            if (endpoint.includes('fetch-executive-orders-simple')) {
              setFetchStatus(`✅ Connected to Federal Register API - Processing with AI...`);
            }
            
            break;
          } else {
            console.log(`❌ Endpoint ${endpoint} failed with status:`, response.status);
          }
        } catch (err) {
          console.log(`❌ Endpoint ${endpoint} error:`, err.message);
          continue;
        }
      }

      if (!response || !response.ok) {
        throw new Error(`All endpoints failed. Last status: ${response?.status || 'Network Error'}`);
      }

      const result = await response.json();
      console.log('📥 Fetch Result:', result);

      if (result.success !== false) {
        const count = result.orders_saved || result.count || result.bills_analyzed || 0;
        const method = result.method || 'unknown';
        
        if (method === 'federal_register_api_direct') {
          setFetchStatus(`✅ Federal Register: ${count} executive orders fetched and analyzed with Azure AI!`);
        } else {
          setFetchStatus(`✅ Fetch completed: ${count} orders processed with Azure AI!`);
        }
        
        setTimeout(() => {
          fetchFromDatabase(1);
          // Also refresh count check
          checkForNewOrders(false);
          fetchFromDatabase();
        }, 2000);
        
        setTimeout(() => setFetchStatus(null), 5000);
      } else {
        throw new Error(result.message || result.error || 'Fetch failed');
      }

    } catch (err) {
      console.error('❌ Fetch failed:', err);
      setFetchStatus(`❌ Fetch failed: ${err.message}`);
      setTimeout(() => setFetchStatus(null), 8000);
    } finally {
      setFetchingData(false);
    }
  }, [fetchFromDatabase, checkForNewOrders]);

  // =====================================
  // EVENT HANDLERS
  // =====================================
  const isFilterActive = (filterKey) => selectedFilters.includes(filterKey);

  const toggleFilter = (filterKey) => {
    setSelectedFilters(prev => {
      const newFilters = prev.includes(filterKey)
        ? prev.filter(f => f !== filterKey)
        : [...prev, filterKey];
      
      console.log('🔄 Filter toggled:', filterKey, 'New filters:', newFilters);
      
      // Reset to page 1 when filters change
      setPagination(prev => ({ ...prev, page: 1 }));
      
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    console.log('🔄 Clearing all filters');
    setSelectedFilters([]);
    setSearchTerm('');
    setPagination(prev => ({ ...prev, page: 1 }));

    
    // Fetch all data without filters
    setTimeout(() => {
      fetchFromDatabase(1);
    }, 100);
  };

  // 🔍 FIXED: Get ALL filtered data, not just paginated results
  const fetchAllFilteredData = useCallback(async (filters, search) => {
    try {
      console.log(`🔍 Fetching ALL filtered data - Filters: ${filters.join(',')}, Search: "${search}"`);

      // Build URL to get ALL results (use reasonable page size instead of 1000)
      let url = `${API_URL}/api/executive-orders?per_page=100`; // FIXED: Changed from 1000 to 100
      
      // Add category filters - try different parameter formats
      const categoryFilters = filters.filter(f => !['reviewed', 'not_reviewed'].includes(f));
      if (categoryFilters.length > 0) {
        // Try multiple possible parameter formats your backend might expect
        if (categoryFilters.length === 1) {
          // Single category - try different formats
          url += `&category=${categoryFilters[0]}`;
          // Alternative formats your backend might expect:
          // url += `&categories=${categoryFilters[0]}`;
          // url += `&filter[category]=${categoryFilters[0]}`;
        } else {
          // Multiple categories
          url += `&category=${categoryFilters.join(',')}`;
          // Alternative: url += categoryFilters.map(cat => `&category=${cat}`).join('');
        }
      }
      
      // Add search parameter
      if (search && search.trim()) {
        url += `&search=${encodeURIComponent(search.trim())}`;
        // Alternative: url += `&q=${encodeURIComponent(search.trim())}`;
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
          const fallbackUrl = `${API_URL}/api/executive-orders?per_page=100`; // FIXED: Changed from 1000 to 100
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
            } else if (fallbackData.executive_orders && Array.isArray(fallbackData.executive_orders)) {
              allOrdersArray = fallbackData.executive_orders;
            }
            
            console.log(`🔍 Fallback got ${allOrdersArray.length} total orders from backend`);
            
            // Filter client-side by category
            if (categoryFilters.length > 0) {
              console.log(`🔍 Filtering for categories: ${categoryFilters.join(', ')}`);
              const beforeFilter = allOrdersArray.length;
              allOrdersArray = allOrdersArray.filter(order => {
                const hasCategory = categoryFilters.includes(order?.category);
                return hasCategory;
              });
              console.log(`🔍 Category filtering: ${beforeFilter} -> ${allOrdersArray.length} orders`);
            }
            
            // Filter by search term
            if (search && search.trim()) {
              const searchLower = search.toLowerCase();
              const beforeSearch = allOrdersArray.length;
              allOrdersArray = allOrdersArray.filter(order =>
                order.title?.toLowerCase().includes(searchLower) ||
                order.ai_summary?.toLowerCase().includes(searchLower) ||
                order.summary?.toLowerCase().includes(searchLower)
              );
              console.log(`🔍 Search filtering: ${beforeSearch} -> ${allOrdersArray.length} orders`);
            }
            
            // Transform the filtered orders
            const allTransformedOrders = allOrdersArray.map((order, index) => {
              const uniqueId = order.executive_order_number || order.document_number || order.id || order.bill_id || `order-all-${index}`;
              
              return {
                id: uniqueId,
                bill_id: uniqueId,
                eo_number: order.executive_order_number || order.document_number || 'Unknown',
                executive_order_number: order.executive_order_number || order.document_number || 'Unknown',
                title: order.title || order.bill_title || 'Untitled Executive Order',
                summary: order.description || order.summary || '',
                signing_date: order.signing_date || order.introduced_date || '',
                publication_date: order.publication_date || order.last_action_date || '',
                html_url: order.html_url || order.legiscan_url || '',
                pdf_url: order.pdf_url || '',
                category: order.category || 'civic',
                formatted_publication_date: formatDate(order.publication_date || order.last_action_date),
                formatted_signing_date: formatDate(order.signing_date || order.introduced_date),
                ai_summary: order.ai_summary || order.ai_executive_summary || '',
                ai_talking_points: order.ai_talking_points || order.ai_key_points || '',
                ai_business_impact: order.ai_business_impact || order.ai_potential_impact || '',
                ai_processed: !!(order.ai_summary || order.ai_executive_summary),
                president: order.president || 'Donald Trump',
                source: 'Database (Federal Register + Azure AI)',
                is_highlighted: false,
                index: index
              };
            });

            // Apply review status filtering
            let finalAllOrders = allTransformedOrders;
            const hasReviewedFilter = filters.includes('reviewed');
            const hasNotReviewedFilter = filters.includes('not_reviewed');
            
            if (hasReviewedFilter && !hasNotReviewedFilter) {
              finalAllOrders = allTransformedOrders.filter(order => isOrderReviewed(order));
            } else if (hasNotReviewedFilter && !hasReviewedFilter) {
              finalAllOrders = allTransformedOrders.filter(order => !isOrderReviewed(order));
            }

            console.log(`🔍 Client-side filtered results: ${finalAllOrders.length} orders`);
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
      } else if (data.executive_orders && Array.isArray(data.executive_orders)) {
        allOrdersArray = data.executive_orders;
      }

      // Transform ALL orders
      const allTransformedOrders = allOrdersArray.map((order, index) => {
        const uniqueId = order.executive_order_number || order.document_number || order.id || order.bill_id || `order-all-${index}`;
        
        return {
          id: uniqueId,
          bill_id: uniqueId,
          eo_number: order.executive_order_number || order.document_number || 'Unknown',
          executive_order_number: order.executive_order_number || order.document_number || 'Unknown',
          title: order.title || order.bill_title || 'Untitled Executive Order',
          summary: order.description || order.summary || '',
          signing_date: order.signing_date || order.introduced_date || '',
          publication_date: order.publication_date || order.last_action_date || '',
          html_url: order.html_url || order.legiscan_url || '',
          pdf_url: order.pdf_url || '',
          category: order.category || 'civic',
          formatted_publication_date: formatDate(order.publication_date || order.last_action_date),
          formatted_signing_date: formatDate(order.signing_date || order.introduced_date),
          ai_summary: order.ai_summary || order.ai_executive_summary || '',
          ai_talking_points: order.ai_talking_points || order.ai_key_points || '',
          ai_business_impact: order.ai_business_impact || order.ai_potential_impact || '',
          ai_processed: !!(order.ai_summary || order.ai_executive_summary),
          president: order.president || 'Donald Trump',
          source: 'Database (Federal Register + Azure AI)',
          is_highlighted: false,
          index: index
        };
      });

      // Apply client-side review status filtering
      let finalAllOrders = allTransformedOrders;
      const hasReviewedFilter = filters.includes('reviewed');
      const hasNotReviewedFilter = filters.includes('not_reviewed');
      
      if (hasReviewedFilter && !hasNotReviewedFilter) {
        finalAllOrders = allTransformedOrders.filter(order => isOrderReviewed(order));
      } else if (hasNotReviewedFilter && !hasReviewedFilter) {
        finalAllOrders = allTransformedOrders.filter(order => !isOrderReviewed(order));
      }

      console.log(`🔍 All Filtered Results: ${finalAllOrders.length} orders`);
      return finalAllOrders;

    } catch (err) {
      console.error('❌ All filtered fetch failed:', err);
      return [];
    }
  }, [isOrderReviewed]);

  // 🔍 NEW: Database-level filtering function with proper pagination
  const fetchFilteredData = useCallback(async (filters, search, pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);
      setFetchStatus('🔍 Filtering executive orders...');

      console.log(`🔍 fetchFilteredData called with filters: ${filters}, search: "${search}", page: ${pageNum}`);

      // First, get ALL filtered results to show correct total count
      const allFilteredOrders = await fetchAllFilteredData(filters, search);
      const totalFilteredCount = allFilteredOrders.length;

      console.log(`🔍 Got ${totalFilteredCount} total filtered orders from fetchAllFilteredData`);

      if (totalFilteredCount === 0) {
        console.log('🔍 No filtered results found');
        setOrders([]);
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
      console.log(`🔍 Paginated orders count: ${paginatedOrders.length}`);

      // Calculate correct pagination
      const totalPages = Math.ceil(totalFilteredCount / perPage);

      // Update state with paginated results but correct total count
      setOrders(paginatedOrders);
      setPagination({
        page: pageNum,
        per_page: perPage,
        total_pages: totalPages,
        count: totalFilteredCount
      });

      console.log(`🔍 Set pagination: page ${pageNum}/${totalPages}, total count: ${totalFilteredCount}`);

      setFetchStatus(`✅ Found ${totalFilteredCount} filtered orders, showing page ${pageNum} of ${totalPages}`);
      setHasData(paginatedOrders.length > 0);
      setTimeout(() => setFetchStatus(null), 4000);

    } catch (err) {
      console.error('❌ Filtered fetch failed:', err);
      setError(`Failed to filter executive orders: ${err.message}`);
      setFetchStatus(`❌ Filter error: ${err.message}`);
      setTimeout(() => setFetchStatus(null), 5000);
      setOrders([]);
      setHasData(false);
    } finally {
      setLoading(false);
    }
  }, [fetchAllFilteredData]);

  const handlePageChange = useCallback((newPage) => {
    console.log(`🔄 Changing to page ${newPage}`);
    setPagination(prev => ({ ...prev, page: newPage }));
  }, []);

  const handleSearch = useCallback(() => {
    console.log(`🔍 Performing search for: "${searchTerm}"`);
    // Reset to page 1 when search changes
    setPagination(prev => ({ ...prev, page: 1 }));
  }, [searchTerm]);

  const handleOrderHighlight = useCallback(async (order) => {
    console.log('🌟 ExecutiveOrders highlight handler called for:', order.title);
    
    const orderId = getOrderId(order);
    if (!orderId) {
      console.error('❌ No valid order ID found for highlighting');
      return;
    }
    
    const isCurrentlyHighlighted = localHighlights.has(orderId);
    console.log('🌟 Current highlight status:', isCurrentlyHighlighted, 'Order ID:', orderId);
    
    setHighlightLoading(prev => new Set([...prev, orderId]));
    
    try {
      if (isCurrentlyHighlighted) {
        console.log('🗑️ Attempting to remove highlight for:', orderId);
        
        setLocalHighlights(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
        
        const response = await fetch(`${API_URL}/api/highlights/${orderId}?user_id=1`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          console.error('❌ Failed to remove highlight from backend');
          setLocalHighlights(prev => new Set([...prev, orderId]));
        } else {
          console.log('✅ Successfully removed highlight from backend');
          if (stableHandlers?.handleItemHighlight) {
            stableHandlers.handleItemHighlight(order, 'executive_order');
          }
        }
      } else {
        console.log('⭐ Attempting to add highlight for:', orderId);
        
        setLocalHighlights(prev => new Set([...prev, orderId]));
        
        const response = await fetch(`${API_URL}/api/highlights`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: 1,
            order_id: orderId,
            order_type: 'executive_order',
            notes: null,
            priority_level: 1,
            tags: null,
            is_archived: false
          })
        });
        
        if (!response.ok) {
          console.error('❌ Failed to add highlight');
          if (response.status !== 409) {
            setLocalHighlights(prev => {
              const newSet = new Set(prev);
              newSet.delete(orderId);
              return newSet;
            });
          }
        } else {
          console.log('✅ Successfully added highlight to backend');
          if (stableHandlers?.handleItemHighlight) {
            stableHandlers.handleItemHighlight(order, 'executive_order');
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error managing highlight:', error);
      if (isCurrentlyHighlighted) {
        setLocalHighlights(prev => new Set([...prev, orderId]));
      } else {
        setLocalHighlights(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
      }
    } finally {
      setHighlightLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  }, [localHighlights, stableHandlers]);

  const isOrderHighlighted = useCallback((order) => {
    const orderId = getOrderId(order);
    if (!orderId) return false;
    
    const localHighlighted = localHighlights.has(orderId);
    const stableHighlighted = stableHandlers?.isItemHighlighted?.(order) || false;
    
    return localHighlighted || stableHighlighted;
  }, [localHighlights, stableHandlers]);

  const isOrderHighlightLoading = useCallback((order) => {
    const orderId = getOrderId(order);
    return orderId ? highlightLoading.has(orderId) : false;
  }, [highlightLoading]);

  // =====================================
  // COMPUTED VALUES
  // =====================================
  const reviewCounts = useMemo(() => {
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

  const aiStats = useMemo(() => {
    const total = allOrders.length;
    const processed = allOrders.filter(order => order.ai_processed).length;
    return { total, processed, remaining: total - processed };
  }, [allOrders]);

  // =====================================
  // CLOSE DROPDOWN EFFECT
  // =====================================
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // =====================================
  // RENDER COMPONENT
  // =====================================
  return (
    <div className="pt-6">
      {/* Scroll to Top Button */}
      <ScrollToTopButton />
      
      {/* ===================================== */}
      {/* HEADER SECTION */}
      {/* ===================================== */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ScrollText/>
          <h2 className="text-2xl font-bold text-gray-800">Executive Orders</h2>
        </div>
        <p className="text-gray-600">
          Access the latest federal executive orders with comprehensive AI-powered analysis. Our advanced models provide executive summaries, key strategic insights, and business impact assessments to help you understand the implications of presidential directives. Direct links to the Federal Register and official documents are included for detailed review.
        </p> 
      </div>

      {/* ===================================== */}
      {/* SEARCH AND FILTER SECTION */}
      {/* ===================================== */}
      <div className="mb-8">
        <div className="flex gap-4 items-center">
          <FilterDropdown
            ref={filterDropdownRef}
            selectedFilters={selectedFilters}
            showFilterDropdown={showFilterDropdown}
            onToggleDropdown={() => setShowFilterDropdown(!showFilterDropdown)}
            onToggleFilter={toggleFilter}
            onClearAllFilters={clearAllFilters}
            counts={filterCounts}
            additionalFilters={[
              {
                title: "Review Status",
                filters: [
                  {
                    key: 'reviewed',
                    label: 'Reviewed',
                    icon: Check,
                    activeClass: 'bg-green-100 text-green-700 font-medium',
                    iconClass: 'text-green-600'
                  },
                  {
                    key: 'not_reviewed',
                    label: 'Not Reviewed',
                    icon: AlertTriangle,
                    activeClass: 'bg-red-100 text-red-700 font-medium',
                    iconClass: 'text-red-600'
                  }
                ]
              }
            ]}
          />

          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search titles, EO numbers, dates, AI summaries, talking points, business analysis..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
            {searchTerm && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  {orders.length} found
                </span>
              </div>
            )}
          </div>

          {/* Clear Filters Button */}
          {(selectedFilters.length > 0 || searchTerm) && (
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

      {/* ===================================== */}
      {/* COUNT CHECK STATUS NOTIFICATION */}
      {/* ===================================== */}
      <CountStatusComponent />

      {/* ===================================== */}
      {/* FETCH EXECUTIVE ORDERS SECTION */}
      {/* ===================================== */}
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
                  <h3 className="text-lg font-semibold text-gray-800">Executive Orders Management</h3>
                  <p className="text-sm text-gray-600">
                    {isFetchExpanded ? 'Fetch new orders or load from database' : 'Click to expand management controls'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {/* Manual refresh button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleManualCountCheck();
                  }}
                  disabled={countCheckStatus.checking}
                  className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-all duration-200"
                  title="Check for new orders"
                >
                  <RefreshCw size={16} className={countCheckStatus.checking ? 'animate-spin' : ''} />
                </button>
                
                <ChevronDown 
                  size={20} 
                  className={`text-gray-500 transition-transform duration-200 ${isFetchExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </div>
          </div>

          {isFetchExpanded && (
            <div className="p-6">
              {/* Status Display */}
              {(fetchStatus || fetchingData || loading) && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    {(fetchingData || loading) && (
                      <RotateCw size={16} className="animate-spin text-blue-600" />
                    )}
                    <span className="text-sm text-blue-700 font-medium">
                      {fetchStatus || (fetchingData ? 'Fetching and analyzing...' : 'Loading...')}
                    </span>
                  </div>
                </div>
              )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Enhanced Fetch Button with Notification */}
                  <FetchButtonWithNotification />

                  {/* Load from Database Button */}
                  <button
                    onClick={fetchFromDatabase}
                    disabled={fetchingData || loading}
                    className={`p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-104 ${
                      fetchingData || loading
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg hover:border-gray-300 hover:bg-gray-100'
                    } border-gray-200 bg-white text-gray-700`}
                  >
                    <div className="font-medium mb-2 text-gray-600 flex items-center justify-center gap-2">
                      <Database size={18} />
                      Load from Database
                    </div>
                    <div className="text-xs text-gray-500">
                      Load processed orders from local database
                    </div>
                    
                    {/* Show count if available */}
                    {countCheckStatus.databaseCount > 0 && (
                      <div className="text-xs mt-2 text-blue-600 font-medium">
                        {countCheckStatus.databaseCount} orders in database
                      </div>
                    )}
                  </button>
                </div>
            </div>
          )}
        </div>
      </div>

      {/* ===================================== */}
      {/* RESULTS SECTION */}
      {/* ===================================== */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
            {loading ? (
              <ShimmerLoader 
                count={4}
                variant="executive-order"
                className="space-y-4"
              />
            ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
              <p className="font-semibold mb-2">Error loading executive orders:</p>
              <p className="text-sm mb-4">{error}</p>
              <div className="flex gap-2">
                <button
                  onClick={fetchFromDatabase}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all duration-300"
                >
                  Try Again
                </button>
                <button
                  onClick={fetchExecutiveOrders}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-all duration-300"
                >
                  Fetch Executive Orders
                </button>
              </div>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-12">
              <Database size={48} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No Executive Orders Found</h3>
              <p className="text-gray-600 mb-4">
                {(selectedFilters.length > 0 || searchTerm) 
                  ? `No executive orders match your current search criteria.` 
                  : "No executive orders are loaded in the database yet."
                }
              </p>
              <div className="flex gap-2 justify-center">
                {(selectedFilters.length > 0 || searchTerm) && (
                  <button
                    onClick={clearAllFilters}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300"
                  >
                    Clear Search & Filters
                  </button>
                )}
                {!allOrders.length && (
                  <button
                    onClick={fetchExecutiveOrders}
                    disabled={fetchingData}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300 flex items-center gap-2"
                  >
                    <Sparkles size={16} />
                    Fetch Executive Orders
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search Results Summary */}
              {searchTerm && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-sm text-blue-800">
                    <span className="font-medium">Fuzzy Search Results:</span> Found {filteredAndSearchedOrders.length} matches for "{searchTerm}"
                    {filteredAndSearchedOrders.length > 0 && (
                      <span className="ml-2 text-blue-600">
                        (Showing page {pagination.page} of {pagination.total_pages})
                      </span>
                    )}
                  </div>
                </div>
              )}

              {orders.map((order, index) => {
                const orderWithIndex = { ...order, index };
                const orderId = getOrderId(orderWithIndex);
                const isExpanded = expandedOrders.has(orderId);
                const isReviewed = isOrderReviewed(order);
                
                const actualOrderNumber = filteredAndSearchedOrders.length - ((pagination.page - 1) * pagination.per_page + index);
                
                return (
                  <div key={`order-${orderId}-${index}`} className="border rounded-lg overflow-hidden transition-all duration-300 border-gray-200">
                    <div className="p-4">
                      {/* Search Result Highlight */}
                      <SearchResultHighlight order={order} />

                      <div className="flex items-start justify-between">
                        <div 
                          className="flex-1 cursor-pointer hover:bg-gray-50 transition-all duration-300 rounded-md p-2 -ml-2 -mt-2 -mb-1"
                          onClick={() => {
                            setExpandedOrders(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(orderId)) {
                                newSet.delete(orderId);
                              } else {
                                newSet.add(orderId);
                              }
                              return newSet;
                            });
                          }}
                        >
                          <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            {actualOrderNumber}. {cleanOrderTitle(order.title)}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mb-2">
                            <span className="font-medium">Executive Order #: {getExecutiveOrderNumber(order)}</span>
                            <span>-</span>
                            <span className="font-medium">Signed Date: {order.formatted_signing_date || order.formatted_publication_date}</span>
                            <span>-</span>
                            <CategoryTag category={order.category} />
                            {order.ai_processed && (
                              <span className="">-</span>
                            )}
                            <ReviewStatusTag isReviewed={isReviewed} />
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          {/* Toggle Review Status Button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleReviewStatus(orderWithIndex);
                            }}
                            disabled={isOrderMarking(orderWithIndex)}
                            className={`p-2 rounded-md transition-all duration-300 ${
                              isOrderMarking(orderWithIndex)
                                ? 'text-gray-500 cursor-not-allowed'
                                : isReviewed
                                ? 'text-green-600 bg-green-100 hover:bg-green-200'
                                : 'text-gray-400 hover:bg-green-100 hover:text-green-600'
                            }`}
                            title={isReviewed ? "Mark as not reviewed" : "Mark as reviewed"}
                          >
                            {isOrderMarking(orderWithIndex) ? (
                              <RotateCw size={16} className="animate-spin" />
                            ) : (
                              <Check size={16} className={isReviewed ? "text-green-600" : ""} />
                            )}
                          </button>

                          {/* Highlight button */}
                          <button
                            type="button"
                            className={`p-2 rounded-md transition-all duration-300 ${
                              isOrderHighlighted(orderWithIndex)
                                ? 'text-yellow-500 bg-yellow-100 hover:bg-yellow-200'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-yellow-500'
                            } ${isOrderHighlightLoading(orderWithIndex) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!isOrderHighlightLoading(orderWithIndex)) {
                                await handleOrderHighlight(orderWithIndex);
                              }
                            }}
                            disabled={isOrderHighlightLoading(orderWithIndex)}
                            title={
                              isOrderHighlightLoading(orderWithIndex) 
                                ? "Processing..." 
                                : isOrderHighlighted(orderWithIndex) 
                                  ? "Remove from highlights" 
                                  : "Add to highlights"
                            }
                          >
                            {isOrderHighlightLoading(orderWithIndex) ? (
                              <RotateCw size={16} className="animate-spin" />
                            ) : (
                              <Star 
                                size={16} 
                                className={isOrderHighlighted(orderWithIndex) ? "fill-current" : ""} 
                              />
                            )}
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setExpandedOrders(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(orderId)) {
                                  newSet.delete(orderId);
                                } else {
                                  newSet.add(orderId);
                                }
                                return newSet;
                              });
                            }}
                            className="p-2 hover:bg-gray-100 rounded-md transition-all duration-300"
                            title={isExpanded ? "Collapse details" : "Expand details"}
                          >
                            <ChevronDown 
                              size={20} 
                              className={`text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Azure AI Summary */}
                      {order.ai_processed && order.ai_summary && (
                        <div className="mb-4 mt-4">
                          <div className="bg-purple-50 p-4 rounded-md border border-purple-200">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-purple-800">Executive Summary</h4>
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
                                {stripHtmlTags(order.ai_summary)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* External Links - Show when contracted */}
                      {!isExpanded && (
                        <div className="flex flex-wrap gap-2 pt-1 mb-2">
                          {order.html_url && (
                            <a
                              href={order.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-all duration-300 text-sm flex items-center gap-2"
                            >
                              <ExternalLink size={14} />
                              Federal Register
                            </a>
                          )}
                          
                          {order.pdf_url && (
                            <a
                              href={order.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-all duration-300 text-sm flex items-center gap-2"
                            >
                              <FileText size={14} />
                              View PDF
                            </a>
                          )}
                        </div>
                      )}

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div>
                          {/* Azure AI Talking Points */}
                          {order.ai_processed && order.ai_talking_points && (
                            <div className="mb-4 mt-4">
                              <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold text-blue-800">Key Talking Points</h4>
                                  <span className="text-blue-800">-</span>
                                  <span className="inline-flex items-center justify-center px-2 py-1 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[11px] rounded-full leading-tight">
                                    ✦ AI Generated
                                  </span>
                                </div>
                                <div className="text-sm text-blue-800 leading-relaxed">
                                  {formatTalkingPoints(order.ai_talking_points)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Azure AI Business Impact */}
                          {order.ai_processed && order.ai_business_impact && (
                            <div className="mb-4 mt-4">
                              <div className="bg-green-50 p-4 rounded-md border border-green-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold text-green-800">Business Impact Analysis</h4>
                                  <span className="text-green-800">-</span>
                                  <span className="inline-flex items-center justify-center px-2 py-1 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[11px] rounded-full leading-tight">
                                    ✦ AI Generated
                                  </span>
                                </div>
                                <div className="text-sm text-green-800 leading-relaxed">
                                  {formatUniversalContent(order.ai_business_impact)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* No AI Analysis Message */}
                          {!order.ai_processed && (
                            <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium text-yellow-800">No AI Analysis Available</h4>
                                  <p className="text-yellow-700 text-sm">
                                    Fetch executive orders to get Azure AI analysis for this order.
                                  </p>
                                </div>
                                <button
                                  onClick={fetchExecutiveOrders}
                                  disabled={fetchingData}
                                  className="px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-all duration-300 flex items-center gap-2"
                                >
                                  <Sparkles size={14} />
                                  Fetch Orders
                                </button>
                              </div>
                            </div>
                          )}

                          {/* External Links and Copy Details - Moved to bottom of expanded content */}
                          <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-gray-200">
                            {order.html_url && (
                              <a
                                href={order.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-all duration-300 text-sm flex items-center gap-2"
                              >
                                <ExternalLink size={14} />
                                Federal Register
                              </a>
                            )}
                            
                            {order.pdf_url && (
                              <a
                                href={order.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-all duration-300 text-sm flex items-center gap-2"
                              >
                                <FileText size={14} />
                                View PDF
                              </a>
                            )}

                            <button 
                              type="button"
                              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-all duration-300"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Create formatted report matching the specified format
                                const reportSections = [];
                                
                                // Header with title in bold
                                reportSections.push(`**${cleanOrderTitle(order.title)}**`);
                                reportSections.push(`EO #${getExecutiveOrderNumber(order)}`);
                                reportSections.push(`President: ${order.president || 'Donald Trump'}`);
                                reportSections.push(`Signing Date: ${order.formatted_signing_date || 'N/A'}`);
                                reportSections.push(`Publication Date: ${order.formatted_publication_date || 'N/A'}`);
                                reportSections.push(`Category: ${order.category || 'civic'}`);
                                reportSections.push(''); // Empty line
                                
                                // AI Summary section
                                if (order.ai_summary) {
                                  reportSections.push(`**AI Summary: Executive Order ${getExecutiveOrderNumber(order)}**`);
                                  reportSections.push(`${stripHtmlTags(order.ai_summary)}`);
                                  reportSections.push(''); // Empty line
                                }
                                
                                // Key Talking Points section
                                if (order.ai_talking_points) {
                                  reportSections.push('**Key Talking Points:**');
                                  const talkingPointsText = stripHtmlTags(order.ai_talking_points);
                                  
                                  // Extract numbered points or create them
                                  const numberedMatches = talkingPointsText.match(/\d+\.\s*[^.]*(?:\.[^0-9][^.]*)*(?=\s*\d+\.|$)/g);
                                  
                                  if (numberedMatches && numberedMatches.length > 1) {
                                    numberedMatches.slice(0, 5).forEach((point) => {
                                      const cleanedPoint = point.replace(/^\d+\.\s*/, '').trim();
                                      if (cleanedPoint.length > 10) {
                                        const pointIndex = numberedMatches.indexOf(point) + 1;
                                        reportSections.push(`${pointIndex}. ${cleanedPoint}`);
                                      }
                                    });
                                  } else {
                                    // Fallback: split by sentences and number them
                                    const sentences = talkingPointsText.split(/(?=\d+\.\s)/).filter(s => s.trim().length > 0);
                                    sentences.slice(0, 5).forEach((sentence, index) => {
                                      const cleaned = sentence.replace(/^\d+\.\s*/, '').trim();
                                      if (cleaned.length > 10) {
                                        reportSections.push(`${index + 1}. ${cleaned}`);
                                      }
                                    });
                                  }
                                  reportSections.push(''); // Empty line
                                }
                                
                                // Business Impact section
                                if (order.ai_business_impact) {
                                  reportSections.push('**Business Impact:**');
                                  const businessImpactText = stripHtmlTags(order.ai_business_impact);
                                  
                                  // Look for section keywords and format accordingly
                                  const sectionKeywords = [
                                    'Risk Assessment', 'Market Opportunity', 'Implementation Requirements', 
                                    'Financial Implications', 'Competitive Implications', 'Timeline Pressures', 'Summary'
                                  ];
                                  
                                  const inlinePattern = new RegExp(`(${sectionKeywords.join('|')})[:.]?\\s*([^]*?)(?=\\s*(?:${sectionKeywords.join('|')}|$))`, 'gi');
                                  const inlineMatches = [];
                                  let match;
                                  
                                  while ((match = inlinePattern.exec(businessImpactText)) !== null) {
                                    inlineMatches.push({
                                      header: match[1].trim(),
                                      content: match[2].trim()
                                    });
                                  }
                                  
                                  if (inlineMatches.length > 0) {
                                    inlineMatches.forEach(({ header, content }) => {
                                      if (content && content.length > 5) {
                                        // Format as: **Section Header•** Content
                                        const cleanContent = content
                                          .replace(/^[•\-*]\s*/, '') // Remove leading bullets
                                          .replace(/\s+/g, ' ') // Normalize whitespace
                                          .trim();
                                        reportSections.push(`**${header}•** ${cleanContent}`);
                                      }
                                    });
                                  } else {
                                    // Fallback: just add the content as-is
                                    reportSections.push(businessImpactText);
                                  }
                                  reportSections.push(''); // Empty line
                                }
                                
                                // URLs section
                                if (order.html_url) {
                                  reportSections.push(`Federal Register URL: ${order.html_url}`);
                                  reportSections.push(''); // Empty line
                                }
                                
                                if (order.pdf_url) {
                                  reportSections.push(`PDF URL: ${order.pdf_url}`);
                                }
                                
                                const orderReport = reportSections.filter(line => line !== null && line !== undefined).join('\n');
                                
                                if (copyToClipboard && typeof copyToClipboard === 'function') {
                                  copyToClipboard(orderReport);
                                  console.log('✅ Copied formatted order report to clipboard');
                                } else if (navigator.clipboard) {
                                  navigator.clipboard.writeText(orderReport).catch(console.error);
                                  console.log('✅ Copied formatted order report to clipboard (fallback)');
                                } else {
                                  console.log('❌ Copy to clipboard not available');
                                }
                              }}
                            >
                              <Copy size={14} />
                              Copy Details
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Pagination Controls - Attached directly to the container */}
        {!loading && !error && orders.length > 0 && (
          <PaginationControls
            currentPage={pagination.page}
            totalPages={pagination.total_pages}
            totalItems={pagination.count}
            itemsPerPage={pagination.per_page}
            onPageChange={handlePageChange}
            itemType="executive orders"
          />
        )}
      </div>

      {/* Search/Filter Results Summary */}
      {!loading && !error && (selectedFilters.length > 0 || searchTerm) && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
            <span>
              {orders.length === 0 ? 'No results' : `${pagination.count} total results`} for: 
              {selectedFilters.length > 0 && (
                <span className="font-medium ml-1">
                  {selectedFilters.map(f => EXTENDED_FILTERS.find(ef => ef.key === f)?.label || f).join(', ')}
                </span>
              )}
              {searchTerm && (
                <span className="font-medium ml-1">"{searchTerm}"</span>
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

      {/* ===================================== */}
      {/* CSS STYLES */}
      {/* ===================================== */}
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

export default ExecutiveOrdersPage;