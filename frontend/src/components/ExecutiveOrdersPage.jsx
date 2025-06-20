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
  RefreshCw
} from 'lucide-react';

// Backend API URL - Fixed for artifact environment
const API_URL = process.env.REACT_APP_API_URL || process.env.VITE_API_URL || 'http://localhost:8000';

// FIXED: Enhanced ID generation for Executive Orders - More robust and consistent
const getExecutiveOrderId = (order) => {
  if (!order) return null;
  
  // Use multiple fallbacks to ensure consistent ID generation
  const candidates = [
    order.executive_order_number,
    order.document_number,
    order.eo_number,
    order.bill_number,
    order.id,
    order.bill_id
  ];
  
  // Find the first valid candidate
  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'string' && candidate.trim()) {
      return `eo-${candidate.trim()}`;
    }
    if (candidate && typeof candidate === 'number') {
      return `eo-${candidate}`;
    }
  }
  
  // Fallback using title hash for absolute consistency
  if (order.title && typeof order.title === 'string') {
    const titleHash = order.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 30); // Increased length for uniqueness
    return `eo-title-${titleHash}`;
  }
  
  // Last resort
  console.warn('Could not generate stable ID for order:', order);
  return null;
};

// FIXED: In-memory storage for review status (replaced localStorage)
const ReviewStatusManager = {
  // In-memory storage instead of localStorage
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

// ENHANCED: Review status hook for Executive Orders
const useExecutiveOrderReviewStatus = () => {
  const STORAGE_KEY = 'reviewedExecutiveOrders';
  const [reviewedOrders, setReviewedOrders] = useState(new Set());
  const [markingReviewed, setMarkingReviewed] = useState(new Set());

  // Load from in-memory storage on mount
  useEffect(() => {
    console.log('🔄 Loading executive order review status from in-memory storage...');
    const loaded = ReviewStatusManager.loadReviewedItems(STORAGE_KEY);
    setReviewedOrders(loaded);
  }, []);

  // Save to in-memory storage whenever reviewedOrders changes
  useEffect(() => {
    ReviewStatusManager.saveReviewedItems(reviewedOrders, STORAGE_KEY);
  }, [reviewedOrders]);

  // Toggle review status function
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

  // Check if order is reviewed
  const isOrderReviewed = useCallback((order) => {
    const orderId = getExecutiveOrderId(order);
    return orderId ? reviewedOrders.has(orderId) : false;
  }, [reviewedOrders]);

  // Check if order is being marked
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

// Helper to extract executive order number from various fields
const getExecutiveOrderNumber = (order) => {
  // First check the direct executive_order_number field
  if (order.executive_order_number) return order.executive_order_number;
  if (order.document_number) return order.document_number;
  if (order.eo_number) return order.eo_number;
  if (order.bill_number) return order.bill_number;

  // Extract from title if EO number is present
  if (order.title) {
    const titleMatch = order.title.match(/Executive Order\s*#?\s*(\d+)/i);
    if (titleMatch) return titleMatch[1];
  }

  // Extract from ai_summary
  if (order.ai_summary) {
    const summaryMatch = order.ai_summary.match(/Executive Order\s*#?\s*(\d{4,5})/i);
    if (summaryMatch) return summaryMatch[1];
  }

  // Extract from ID if it's numeric
  if (order.id && /^\d+$/.test(order.id)) return order.id;
  if (order.bill_id && /^\d+$/.test(order.bill_id)) return order.bill_id;

  return 'Unknown';
};

// Simple category filters with icons
const FILTERS = [
  { key: 'civic', label: 'Civic', icon: Building },
  { key: 'education', label: 'Education', icon: GraduationCap },
  { key: 'engineering', label: 'Engineering', icon: Wrench },
  { key: 'healthcare', label: 'Healthcare', icon: Stethoscope }
];

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

// Helper functions
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

// FIXED: Use the enhanced ID generation function
const getOrderId = (order) => {
  return getExecutiveOrderId(order) || `fallback-${Math.random().toString(36).substr(2, 9)}`;
};

const stripHtmlTags = (content) => {
  if (!content) return '';
  return content.replace(/<[^>]*>/g, '');
};

const cleanOrderTitle = (title) => {
  if (!title) return 'Untitled Executive Order';
  
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
  
  // Remove trailing periods if they seem wrong
  if (cleaned.endsWith('.') && !cleaned.includes('etc.') && !cleaned.includes('Inc.')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  
  // Capitalize first letter if needed
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  
  return cleaned || 'Untitled Executive Order';
};

// Capitalize first letter helper
const capitalizeFirstLetter = (text) => {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (trimmed.length === 0) return text;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

// Category Tag Component with Icon
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
      <IconComponent size={12} />
      {tagInfo.label}
    </span>
  );
};

// Review Status Tag Component - FIXED COLORS
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

const ExecutiveOrdersPage = ({ stableHandlers, copyToClipboard }) => {
  // FIXED: Use the enhanced review status hook
  const {
    reviewedOrders,
    toggleReviewStatus,
    isOrderReviewed,
    isOrderMarking
  } = useExecutiveOrderReviewStatus();

  // State management
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter state
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Highlights state - Local state for immediate UI feedback
  const [localHighlights, setLocalHighlights] = useState(new Set());
  const [highlightLoading, setHighlightLoading] = useState(new Set());
  
  // Expanded orders state for showing AI content
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  
  // UI state
  const [isFetchExpanded, setIsFetchExpanded] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [fetchStatus, setFetchStatus] = useState(null);
  const [hasData, setHasData] = useState(false);
  
  // ✅ FIXED PAGINATION STATE
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total_pages: 1,
    count: 0
  });

  // 🔢 FILTER COUNTS STATE: Add new state for storing filter counts from entire database
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

  // Refs
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
        'Content-Type': 'application/json'
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

  // Enhanced fetch button component with notification
const FetchButtonWithNotification = () => {
  // FIXED: Only show notification when there are actually new orders
  const hasNewOrders = countCheckStatus.needsFetch && countCheckStatus.newOrdersAvailable > 0;
  
  return (
    <div className="relative h-full">
      <button
        onClick={fetchExecutiveOrders}
        disabled={fetchingData || loading}
        className={`w-full h-full p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-104 relative flex flex-col justify-center ${
          fetchingData || loading
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:shadow-lg hover:border-purple-300 hover:bg-purple-50 border-gray-200 bg-white'
        }`}
      >
        {/* FIXED: Only show notification badge when there are NEW orders */}
        {hasNewOrders && (
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg z-10">
            <Bell size={10} />
            {countCheckStatus.newOrdersAvailable}
          </div>
        )}
        
        <div className={`font-medium mb-2 flex items-center justify-center gap-2 ${
          hasNewOrders ? 'text-purple-600' : 'text-purple-600'
        }`}>
          <Sparkles size={16} />
          <span className="text-center leading-tight">
            {hasNewOrders ? 'New Orders Available!' : 'Fetch New Executive Orders'}
          </span>
        </div>
        
        <div className="text-xs text-gray-500 text-center leading-tight">
          {hasNewOrders 
            ? `${countCheckStatus.newOrdersAvailable} new orders from Federal Register`
            : 'Get latest from Federal Register with AI analysis'
          }
        </div>
        
        {/* Status indicator - only show if there's space and no new orders */}
        {countCheckStatus.lastChecked && !hasNewOrders && (
          <div className="text-xs mt-1 flex items-center justify-center gap-1 text-gray-400">
            <Clock size={10} />
            <span className="text-center leading-tight">
              Last: {countCheckStatus.lastChecked.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          </div>
        )}
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

  // Load existing highlights on component mount - FIXED
  useEffect(() => {
    const loadExistingHighlights = async () => {
      try {
        console.log('🔍 ExecutiveOrdersPage: Loading existing highlights...');
        const response = await fetch(`${API_URL}/api/highlights?user_id=1`);
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 ExecutiveOrdersPage: Raw highlights response:', data);
          
          // FIX: Ensure we have an array before calling forEach
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
    
    // Load highlights immediately on mount
    loadExistingHighlights();
  }, []); // Empty dependency array - run once on mount

  // ALSO load highlights when orders are loaded (keep existing functionality)
  useEffect(() => {
    const loadExistingHighlights = async () => {
      try {
        console.log('🔍 ExecutiveOrdersPage: Loading existing highlights...');
        const response = await fetch(`${API_URL}/api/highlights?user_id=1`);
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 ExecutiveOrdersPage: Raw highlights response:', data);
          
          // FIX: Extract highlights from the correct property
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
          console.log('🌟 ExecutiveOrdersPage: Loaded highlights:', Array.from(orderIds));
        }
      } catch (error) {
        console.error('Error loading existing highlights:', error);
      }
    };
    
    // Load highlights immediately on mount
    loadExistingHighlights();
  }, []);

  // ALSO load highlights when orders are loaded
  useEffect(() => {
    if (orders.length > 0) {
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
  }, [orders.length]);

  // 🚀 AUTO-LOAD: Auto-load data from database on component mount
  useEffect(() => {
    console.log('🚀 Component mounted - attempting auto-load...');
    
    const autoLoad = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log('📊 Auto-loading executive orders from database...');

        const url = `${API_URL}/api/executive-orders?page=1&per_page=25`;
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

        // Extract orders from response (same logic as your fetchFromDatabase)
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

        // Transform orders (same as your existing logic)
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

        setOrders(transformedOrders);
        setPagination({
          page: 1,
          per_page: 25,
          total_pages: data.total_pages || Math.ceil(totalCount / 25),
          count: totalCount
        });

        setHasData(transformedOrders.length > 0);
        console.log('✅ Auto-load completed successfully');

      } catch (err) {
        console.error('❌ Auto-load failed:', err);
        // Don't show error for auto-load failure, just log it
        setOrders([]);
        setHasData(false);
      } finally {
        setLoading(false);
      }
    };

    // Small delay to ensure component is fully mounted
    const timeoutId = setTimeout(autoLoad, 100);
    
    return () => clearTimeout(timeoutId);
  }, []); // Empty dependency array - runs once on mount

  // 🔢 FILTER COUNTS: Function to fetch filter counts from entire database
  const fetchFilterCounts = useCallback(async () => {
    try {
      console.log('📊 Fetching filter counts from entire database...');
      
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
          
          const sampleResponse = await fetch(`${API_URL}/api/executive-orders?page=1&per_page=${approach.per_page}`, {
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
            } else if (sampleData.executive_orders && Array.isArray(sampleData.executive_orders)) {
              sampleOrders = sampleData.executive_orders;
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
        categoryCounts[filter.key] = allOrders.filter(order => order?.category === filter.key).length;
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

      // Get reviewed counts from in-memory storage
      const reviewedCount = reviewedOrders.size;

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
        fallbackCounts[filter.key] = orders.filter(order => order?.category === filter.key).length;
      });
      
      const total = pagination.count || orders.length || 0; // Use pagination total if available
      const reviewed = orders.filter(order => isOrderReviewed(order)).length;
      
      console.log('📊 Using fallback counts with pagination total:', total);
      
      setAllFilterCounts({
        ...fallbackCounts,
        reviewed: reviewed,
        not_reviewed: Math.max(0, total - reviewed),
        total: total
      });
    }
  }, [orders, reviewedOrders, pagination.count, isOrderReviewed]);

  // 🔢 FILTER COUNTS: Dynamic filter counts based on current filtering state
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
        const response = await fetch(`${API_URL}/api/executive-orders?per_page=200`, {
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
          } else if (data.executive_orders && Array.isArray(data.executive_orders)) {
            allOrders = data.executive_orders;
          }

          // Apply base filters (search term, but not the specific category we're counting)
          let baseFilteredOrders = allOrders;
          
          // Apply search if present
          if (searchTerm && searchTerm.trim()) {
            const searchLower = searchTerm.toLowerCase();
            baseFilteredOrders = baseFilteredOrders.filter(order =>
              order.title?.toLowerCase().includes(searchLower) ||
              order.ai_summary?.toLowerCase().includes(searchLower) ||
              order.summary?.toLowerCase().includes(searchLower)
            );
          }

          // Count categories from ALL filtered results (not just the active filter)
          const newCategoryCounts = {};
          FILTERS.forEach(filter => {
            newCategoryCounts[filter.key] = baseFilteredOrders.filter(order => order?.category === filter.key).length;
          });

          // Count review status from filtered results
          const reviewedCount = baseFilteredOrders.filter(order => {
            const orderId = getOrderId(order);
            return reviewedOrders.has(orderId);
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
          fallbackCounts[filter.key] = orders.filter(order => order?.category === filter.key).length;
        });
        
        const reviewed = orders.filter(order => isOrderReviewed(order)).length;
        
        setAllFilterCounts({
          ...fallbackCounts,
          reviewed: reviewed,
          not_reviewed: Math.max(0, orders.length - reviewed),
          total: orders.length
        });
      }
    } catch (error) {
      console.error('❌ Error updating filter counts:', error);
    }
  }, [reviewedOrders, fetchFilterCounts, orders, isOrderReviewed]);

  // Update filter counts when filters or search changes
  useEffect(() => {
    if (orders.length > 0) {
      updateFilterCounts(selectedFilters, searchTerm);
    }
  }, [selectedFilters, searchTerm, orders.length, updateFilterCounts]);

  // ✅ FIXED PAGINATION: Fetch from database with proper pagination
  const fetchFromDatabase = useCallback(async (pageNum = 1) => {
    try {
      setLoading(true);
      setError(null);
      setFetchStatus('📊 Loading executive orders from database...');

      console.log(`🔍 Fetching page ${pageNum}...`);

      const perPage = 25;
      
      // Build URL with pagination parameters
      const url = `${API_URL}/api/executive-orders?page=${pageNum}&per_page=${perPage}`;
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

      // ✅ COMPREHENSIVE DATA EXTRACTION: Handle different response formats
      let ordersArray = [];
      let totalCount = 0;
      let currentPage = pageNum;
      
      if (Array.isArray(data)) {
        // Data is directly an array
        ordersArray = data;
        totalCount = data.length;
        console.log('🔍 Using data directly as array');
      } else if (data.results && Array.isArray(data.results)) {
        // Django REST Framework style - USE API's PAGINATION DATA
        ordersArray = data.results;
        totalCount = data.total || data.count || 0;  
        currentPage = data.page || pageNum;                           
        console.log('🔍 Using data.results - total:', totalCount, 'current page:', currentPage);
      } else if (data.data && Array.isArray(data.data)) {
        // Generic 'data' wrapper
        ordersArray = data.data;
        totalCount = data.total || data.count || 0;  
        currentPage = data.page || pageNum;
        console.log('🔍 Using data.data');
      } else if (data.executive_orders && Array.isArray(data.executive_orders)) {
        // Specific executive_orders field
        ordersArray = data.executive_orders;
        totalCount = data.total || data.count || 0;  
        currentPage = data.page || pageNum;
        console.log('🔍 Using data.executive_orders');
      } else {
        console.error('🔍 Could not find orders array in response!');
        console.error('🔍 Available fields:', Object.keys(data));
        throw new Error('No orders found in API response');
      }

      // Calculate totalPages after we have all the data
      const totalPages = data.total_pages || Math.ceil(totalCount / perPage);

      console.log(`🔍 Extracted ${ordersArray.length} orders from page ${currentPage}`);
      console.log(`🔍 Total count: ${totalCount}, Total pages: ${totalPages}`);

      // Transform the orders for display
      const transformedOrders = ordersArray.map((order, index) => {
        const uniqueId = order.executive_order_number || order.document_number || order.id || order.bill_id || `order-${pageNum}-${index}`;
        
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
          index: index // Add index for unique ID generation
        };
      });

      console.log(`🔍 Transformed ${transformedOrders.length} orders`);

      // ✅ SET STATE: Update orders and pagination
      setOrders(transformedOrders);
      setPagination({
        page: currentPage,
        per_page: perPage,
        total_pages: totalPages,
        count: totalCount
      });

      console.log(`✅ Updated state - Page: ${currentPage}/${totalPages}, Count: ${totalCount}`);

      setFetchStatus(`✅ Loaded ${transformedOrders.length} of ${totalCount} orders (Page ${currentPage}/${totalPages})`);
      setHasData(transformedOrders.length > 0);
      setTimeout(() => setFetchStatus(null), 4000);

    } catch (err) {
      console.error('❌ Error details:', err);
      setError(`Failed to load executive orders: ${err.message}`);
      setFetchStatus(`❌ Error: ${err.message}`);
      setTimeout(() => setFetchStatus(null), 5000);
      setOrders([]);
      setHasData(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ FETCH EXECUTIVE ORDERS: Includes Federal Register endpoint
  const fetchExecutiveOrders = useCallback(async () => {
    try {
      setFetchingData(true);
      console.log('🔄 Starting Executive Orders fetch from Federal Register...');

      const requestBody = {
        start_date: "2025-01-20",  // Trump inauguration date
        end_date: null,            // Current date
        with_ai: true,             // Enable AI processing
        save_to_db: true          // Save to database
      };

      // Try endpoints in order
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
        
        // Refresh data from database after fetch completes
        setTimeout(() => {
          fetchFromDatabase(1);
          // Also refresh count check
          checkForNewOrders(false);
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
        if (newFilters.length > 0 || searchTerm) {
          fetchFilteredData(newFilters, searchTerm, 1);
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
    setSearchTerm('');
    
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
    console.log(`🔄 Changing to page ${newPage} with filters:`, selectedFilters);
    
    if (selectedFilters.length > 0 || searchTerm) {
      fetchFilteredData(selectedFilters, searchTerm, newPage);
    } else {
      fetchFromDatabase(newPage);
    }
  }, [selectedFilters, searchTerm, fetchFromDatabase, fetchFilteredData]);

  // Handle search
  const handleSearch = useCallback(() => {
    console.log(`🔍 Searching for: "${searchTerm}"`);
    if (selectedFilters.length > 0 || searchTerm) {
      fetchFilteredData(selectedFilters, searchTerm, 1);
    }
  }, [searchTerm, selectedFilters, fetchFilteredData]);

  // Enhanced highlighting function
  const handleOrderHighlight = useCallback(async (order) => {
    console.log('🌟 ExecutiveOrders highlight handler called for:', order.title);
    
    const orderId = getOrderId(order);
    if (!orderId) {
      console.error('❌ No valid order ID found for highlighting');
      return;
    }
    
    const isCurrentlyHighlighted = localHighlights.has(orderId);
    console.log('🌟 Current highlight status:', isCurrentlyHighlighted, 'Order ID:', orderId);
    
    // Add to loading state
    setHighlightLoading(prev => new Set([...prev, orderId]));
    
    try {
      if (isCurrentlyHighlighted) {
        // REMOVE highlight
        console.log('🗑️ Attempting to remove highlight for:', orderId);
        
        // Optimistic UI update
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
          // Revert optimistic update
          setLocalHighlights(prev => new Set([...prev, orderId]));
        } else {
          console.log('✅ Successfully removed highlight from backend');
          if (stableHandlers?.handleItemHighlight) {
            stableHandlers.handleItemHighlight(order, 'executive_order');
          }
        }
      } else {
        // ADD highlight
        console.log('⭐ Attempting to add highlight for:', orderId);
        
        // Optimistic UI update
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
          if (response.status !== 409) { // 409 means already exists
            // Revert optimistic update
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
      // Revert optimistic update on error
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
      // Remove from loading state
      setHighlightLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  }, [localHighlights, stableHandlers]);

  // Enhanced check if order is highlighted (using local state)
  const isOrderHighlighted = useCallback((order) => {
    const orderId = getOrderId(order);
    if (!orderId) return false;
    
    // Check local state first for immediate UI feedback
    const localHighlighted = localHighlights.has(orderId);
    
    // Also check stable handlers as fallback
    const stableHighlighted = stableHandlers?.isItemHighlighted?.(order) || false;
    
    return localHighlighted || stableHighlighted;
  }, [localHighlights, stableHandlers]);

  // Check if order is currently being highlighted/unhighlighted
  const isOrderHighlightLoading = useCallback((order) => {
    const orderId = getOrderId(order);
    return orderId ? highlightLoading.has(orderId) : false;
  }, [highlightLoading]);

  // Count functions for filter display
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Count AI processed orders
  const aiStats = useMemo(() => {
    const total = orders.length;
    const processed = orders.filter(order => order.ai_processed).length;
    return { total, processed, remaining: total - processed };
  }, [orders]);

  return (
    <div className="pt-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Federal Executive Orders</h2>
        <p className="text-gray-600">
          Retrieving executive orders from official federal sources, leveraging state-of-the-art AI models to extract summaries, strategic talking points, and potential business implications.
        </p>
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
                    const count = categoryCounts[filter.key] || 0;
                    return (
                      <button
                        key={filter.key}
                        onClick={() => toggleFilter(filter.key)}
                        className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                          isActive
                            ? filter.key === 'civic' ? 'bg-blue-100 text-blue-700 font-medium' :
                              filter.key === 'education' ? 'bg-orange-100 text-orange-700 font-medium' :
                              filter.key === 'engineering' ? 'bg-green-100 text-green-700 font-medium' :
                              filter.key === 'healthcare' ? 'bg-red-100 text-red-700 font-medium' :
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
                    <span className="text-xs text-gray-500">({reviewCounts.reviewed})</span>
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
                    <span className="text-xs text-gray-500">({reviewCounts.notReviewed})</span>
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
              placeholder="Search executive orders..."
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

      {/* Fetch Executive Orders Section */}
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

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center gap-2">
                  <ScrollText size={16} className="text-purple-600" />
                  Executive Orders Management
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Enhanced Fetch Button with Notification */}
                  <FetchButtonWithNotification />

                  {/* Load from Database Button */}
                  <button
                    onClick={() => fetchFromDatabase(1)}
                    disabled={fetchingData || loading}
                    className={`p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-104 ${
                      fetchingData || loading
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg hover:border-blue-300 hover:bg-blue-50'
                    } border-gray-200 bg-white text-gray-700`}
                  >
                    <div className="font-medium mb-2 text-blue-600 flex items-center justify-center gap-2">
                      <Database size={16} />
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
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          {loading ? (
            <div className="py-12 text-center">
              <div className="w-16 h-16 mx-auto bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center animate-pulse mb-4">
                <Database size={32} className="text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-2">Loading from Database</h3>
              <p className="text-gray-600">Fetching processed executive orders...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
              <p className="font-semibold mb-2">Error loading executive orders:</p>
              <p className="text-sm mb-4">{error}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchFromDatabase(pagination.page)}
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
                {!orders.length && (
                  <button
                    onClick={fetchExecutiveOrders}
                    disabled={fetchingData}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-all duration-300 flex items-center gap-2"
                  >
                    <Sparkles size={16} />
                    Fetch Executive Orders
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
            {orders.map((order, index) => {
              // Add index to order for unique ID generation
              const orderWithIndex = { ...order, index };
              const orderId = getOrderId(orderWithIndex);
              const isExpanded = expandedOrders.has(orderId);
              const isReviewed = isOrderReviewed(order);
              
              // 🔢 CONTINUOUS NUMBERING: Calculate the actual order number across all pages
              const actualOrderNumber = pagination.count - ((pagination.page - 1) * pagination.per_page + index);
              
              return (
                <div key={`order-${orderId}-${index}`} className="border rounded-lg overflow-hidden transition-all duration-300 border-gray-200">
                  <div className="p-4">
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
                          {/* FIXED: Toggle Review Status Button */}
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

                          {/* Enhanced Highlight button with loading state */}
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

                      {/* Azure AI Summary (always visible if available) */}
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

                          {/* External Links */}
                          <div className="flex flex-wrap gap-2 pt-2">
                            {order.html_url && (
                              <a
                                href={order.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300 text-sm flex items-center gap-2"
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
                                className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all duration-300 text-sm flex items-center gap-2"
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
                                
                                // Create order report
                                const orderReport = [
                                  order.title,
                                  'EO #' + (order.eo_number || 'N/A'),
                                  'President: ' + (order.president || 'N/A'),
                                  'Signing Date: ' + (order.formatted_signing_date || 'N/A'),
                                  'Publication Date: ' + (order.formatted_publication_date || 'N/A'),
                                  'Category: ' + (order.category || 'N/A'),
                                  '',
                                  order.ai_summary ? 'AI Summary: ' + stripHtmlTags(order.ai_summary) : '',
                                  order.summary ? 'Basic Summary: ' + order.summary : '',
                                  order.ai_talking_points ? 'Key Talking Points: ' + stripHtmlTags(order.ai_talking_points) : '',
                                  order.ai_business_impact ? 'Business Impact: ' + stripHtmlTags(order.ai_business_impact) : '',
                                  order.html_url ? 'Federal Register URL: ' + order.html_url : '',
                                  order.pdf_url ? 'PDF URL: ' + order.pdf_url : ''
                                ].filter(line => line.length > 0).join('\n');
                                
                                // Try to copy to clipboard
                                if (copyToClipboard && typeof copyToClipboard === 'function') {
                                  copyToClipboard(orderReport);
                                  console.log('✅ Copied order report to clipboard');
                                } else if (navigator.clipboard) {
                                  navigator.clipboard.writeText(orderReport).catch(console.error);
                                  console.log('✅ Copied order report to clipboard (fallback)');
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
      </div>

      {/* ✅ FIXED PAGINATION: Always show if there are orders and multiple pages */}
      {!loading && !error && (
        <>
          {/* Show pagination if there are multiple pages */}
          {orders.length > 0 && pagination.total_pages > 1 && (
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
                  {selectedFilters.length > 0 || searchTerm ? (
                    <>
                      Showing {Math.min((pagination.page - 1) * pagination.per_page + 1, pagination.count)}-{Math.min(pagination.page * pagination.per_page, pagination.count)} of {pagination.count} filtered results
                      {pagination.total_pages > 1 && ` (Page ${pagination.page} of ${pagination.total_pages})`}
                    </>
                  ) : (
                    <>
                      Page {pagination.page} of {pagination.total_pages} ({pagination.count} total orders)
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Show filter summary when filtering */}
          {(selectedFilters.length > 0 || searchTerm) && (
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
          
        </>
      )}

      {/* Universal CSS Styles - Same as StatePage */}
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