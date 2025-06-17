import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  ChevronDown,
  Download,
  RotateCw as RefreshIcon,
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
  Wrench
} from 'lucide-react';

// Backend API URL
const API_URL = import.meta.env.VITE_API_URL || '';

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

const getOrderId = (order) => {
  if (!order) return `fallback-${Math.random().toString(36).substr(2, 9)}`;
  
  // Priority order for ID selection to ensure uniqueness for Executive Orders
  if (order.executive_order_number && typeof order.executive_order_number === 'string') {
    return `eo-${order.executive_order_number}`;
  }
  if (order.document_number && typeof order.document_number === 'string') {
    return `eo-doc-${order.document_number}`;
  }
  if (order.bill_id && typeof order.bill_id === 'string') return order.bill_id;
  if (order.id && typeof order.id === 'string') return order.id;
  if (order.bill_number) return `eo-${order.bill_number}`;
  if (order.eo_number) return `eo-${order.eo_number}`;
  
  // Fallback using title hash for consistency
  if (order.title) {
    const titleHash = order.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    return `eo-title-${titleHash}`;
  }
  
  // Last resort - use index if available, otherwise unique fallback
  if (order.index !== undefined) return `eo-index-${order.index}`;
  return `eo-fallback-${Math.random().toString(36).substr(2, 9)}`;
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

// AI Content Formatters (Updated to match StatePage)
const formatTalkingPoints = (content) => {
  if (!content) return null;

  // Remove HTML tags first
  let textContent = content.replace(/<[^>]*>/g, '');
  
  // Split by periods followed by numbers (e.g., "1. Point one. 2. Point two.")
  const points = [];
  
  // Try to split by numbered patterns first
  const numberedMatches = textContent.match(/\d+\.\s*[^.]+(?:\.[^0-9][^.]*)*\./g);
  
  if (numberedMatches && numberedMatches.length > 1) {
    // Found numbered points, extract them
    numberedMatches.forEach((match) => {
      const cleaned = match.replace(/^\d+\.\s*/, '').replace(/\.$/, '').trim();
      if (cleaned.length > 5) {
        points.push(cleaned);
      }
    });
  } else {
    // Fallback: split by sentence periods and look for patterns
    const sentences = textContent.split(/\.\s+/).map(s => s.trim()).filter(s => s.length > 5);
    
    sentences.forEach((sentence) => {
      // Remove leading numbers/bullets
      const cleaned = sentence.replace(/^(\d+[\.\)]?\s*|[•\-*→·]\s*)/, '').trim();
      if (cleaned.length > 5) {
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
  
  // Create a more flexible regex that handles both colons and periods after keywords
  const headerPattern = new RegExp(`\\*?(${sectionKeywords.join('|')})\\*?[:.]?`, 'gi');
  
  // Also look for inline mentions like "Market Opportunity: text" or "Summary: text"
  const inlinePattern = new RegExp(`(${sectionKeywords.join('|')})[:.]\\s*([^.]*(?:\\.[^A-Z][^.]*)*)\\.?`, 'gi');
  
  // First, try to extract inline sections (like "Summary: text within paragraph")
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
    
    inlineMatches.forEach(({ header, content, fullMatch }) => {
      if (header && content && content.length > 5) {
        // Clean up the header
        let cleanHeader = header.trim();
        if (!cleanHeader.endsWith(':')) {
          cleanHeader += ':';
        }
        
        // Split content into items but be more careful about sentence boundaries
        const items = [];
        
        // Check if content has bullet-like patterns or multiple sentences
        if (content.includes('•') || content.includes('-') || content.includes('*')) {
          // Handle explicit bullet points
          const contentLines = content
            .split(/[•\-*]\s*/)
            .map(line => line.trim())
            .filter(line => line.length > 10); // Increased minimum length
          
          contentLines.forEach(line => {
            const cleanLine = capitalizeFirstLetter(line.replace(/\.$/, ''));
            if (cleanLine.length > 10) { // Increased minimum length
              items.push(cleanLine);
            }
          });
        } else {
          // Handle as complete sentences - don't break them up
          const cleanContent = capitalizeFirstLetter(content.trim());
          items.push(cleanContent);
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
                  lineHeight: '1.5',
                  color: 'inherit',
                  paddingLeft: section.items.length === 1 ? '0px' : '12px'
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

  // Final fallback: display as single paragraph if no clear structure
  return <div className="universal-text-content" style={{ fontSize: '14px', lineHeight: '1.5' }}>{textContent}</div>;
};

const ExecutiveOrdersPage = ({ stableHandlers, copyToClipboard }) => {
  // State management
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter state
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Review status state
  const [reviewedOrders, setReviewedOrders] = useState(new Set());
  const [markingReviewed, setMarkingReviewed] = useState(new Set());
  
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

  // Refs
  const filterDropdownRef = useRef(null);

  // Load saved state from localStorage
  useEffect(() => {
    try {
      const savedReviewed = localStorage.getItem('reviewedExecutiveOrders');
      
      if (savedReviewed) {
        setReviewedOrders(new Set(JSON.parse(savedReviewed)));
      }
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('reviewedExecutiveOrders', JSON.stringify([...reviewedOrders]));
    } catch (error) {
      console.error('Error saving reviewed orders:', error);
    }
  }, [reviewedOrders]);

  // Load existing highlights on component mount
  useEffect(() => {
    const loadExistingHighlights = async () => {
      try {
        const response = await fetch(`${API_URL}/api/highlights?user_id=1`);
        if (response.ok) {
          const highlights = await response.json();
          const orderIds = new Set();
          
          highlights.forEach(highlight => {
            if (highlight.order_type === 'executive_order') {
              orderIds.add(highlight.order_id);
            }
          });
          
          setLocalHighlights(orderIds);
          console.log('🌟 Loaded existing highlights:', orderIds);
        }
      } catch (error) {
        console.error('Error loading existing highlights:', error);
      }
    };
    
    if (orders.length > 0) {
      loadExistingHighlights();
    }
  }, [orders.length]);

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
  }, [fetchFromDatabase]);

  // Filter helper functions
  const isFilterActive = (filterKey) => selectedFilters.includes(filterKey);

  const toggleFilter = (filterKey) => {
    setSelectedFilters(prev => {
      const newFilters = prev.includes(filterKey)
        ? prev.filter(f => f !== filterKey)
        : [...prev, filterKey];
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setSelectedFilters([]);
    setSearchTerm('');
  };

  // Filter and search logic
  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Apply category filters
    const categoryFilters = selectedFilters.filter(f => !['reviewed', 'not_reviewed'].includes(f));
    if (categoryFilters.length > 0) {
      filtered = filtered.filter(order => categoryFilters.includes(order.category));
    }

    // Apply review status filters
    const hasReviewedFilter = selectedFilters.includes('reviewed');
    const hasNotReviewedFilter = selectedFilters.includes('not_reviewed');
    
    if (hasReviewedFilter && hasNotReviewedFilter) {
      // Both selected, show all
    } else if (hasReviewedFilter) {
      filtered = filtered.filter(order => reviewedOrders.has(getOrderId(order)));
    } else if (hasNotReviewedFilter) {
      filtered = filtered.filter(order => !reviewedOrders.has(getOrderId(order)));
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.title.toLowerCase().includes(term) ||
        order.eo_number.toLowerCase().includes(term) ||
        order.summary.toLowerCase().includes(term) ||
        (order.ai_summary && order.ai_summary.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [orders, selectedFilters, reviewedOrders, searchTerm]);

  // ✅ FIXED PAGINATION: Event handlers
  const handleSearch = useCallback(() => {
    fetchFromDatabase(1); // Always start from page 1 on new search
  }, [fetchFromDatabase]);

  const handlePageChange = useCallback((newPage) => {
    console.log(`🔄 Changing to page ${newPage}`);
    fetchFromDatabase(newPage);
  }, [fetchFromDatabase]);

  // Toggle review status function
  const handleToggleReviewStatus = async (order) => {
    const orderId = getOrderId(order);
    if (!orderId) return;
    
    const isCurrentlyReviewed = reviewedOrders.has(orderId);
    setMarkingReviewed(prev => new Set([...prev, orderId]));
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (isCurrentlyReviewed) {
        setReviewedOrders(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
      } else {
        setReviewedOrders(prev => new Set([...prev, orderId]));
      }
      
    } catch (error) {
      console.error('Error toggling review status:', error);
    } finally {
      setMarkingReviewed(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

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
    const total = orders.length || 0;
    const reviewed = orders.filter(order => reviewedOrders.has(getOrderId(order))).length;
    const notReviewed = total - reviewed;
    return { total, reviewed, notReviewed };
  }, [orders, reviewedOrders]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    FILTERS.forEach(filter => {
      counts[filter.key] = orders.filter(order => order?.category === filter.key).length;
    });
    return counts;
  }, [orders]);

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
                            ? 'bg-blue-50 text-blue-700 font-medium'
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
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">({count})</span>
                          {isActive && (
                            <Check size={14} className="text-blue-600" />
                          )}
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
                        ? 'bg-green-50 text-green-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Check size={16} className="text-green-600" />
                      <span>Reviewed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">({reviewCounts.reviewed})</span>
                      {isFilterActive('reviewed') && (
                        <Check size={14} className="text-green-600" />
                      )}
                    </div>
                  </button>
                  <button
                    onClick={() => toggleFilter('not_reviewed')}
                    className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                      isFilterActive('not_reviewed')
                        ? 'bg-red-50 text-red-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle size={16} className="text-red-600" />
                      <span>Not Reviewed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">({reviewCounts.notReviewed})</span>
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
              placeholder="Search executive orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
            {searchTerm && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  {filteredOrders.length} found
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
                      <RefreshIcon size={16} className="animate-spin text-blue-600" />
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
                  {/* Fetch New Orders Button */}
                  <button
                    onClick={fetchExecutiveOrders}
                    disabled={fetchingData || loading}
                    className={`p-4 text-sm rounded-lg border transition-all duration-300 text-center transform hover:scale-104 ${
                      fetchingData || loading
                        ? 'opacity-50 cursor-not-allowed' 
                        : 'hover:shadow-lg hover:border-purple-300 hover:bg-purple-50'
                    } border-gray-200 bg-white text-gray-700`}
                  >
                    <div className="font-medium mb-2 text-purple-600 flex items-center justify-center gap-2">
                      <Sparkles size={16} />
                      Fetch New Executive Orders
                    </div>
                    <div className="text-xs text-gray-500">
                      Get latest from Federal Register with AI analysis
                    </div>
                  </button>

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
              <div className="w-16 h-16 mx-auto bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center animate-pulse mb-4">
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
          ) : filteredOrders.length === 0 ? (
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
              {filteredOrders.map((order, index) => {
                // Add index to order for unique ID generation
                const orderWithIndex = { ...order, index };
                const orderId = getOrderId(orderWithIndex);
                const isExpanded = expandedOrders.has(orderId);
                const isReviewed = reviewedOrders.has(orderId);
                
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
                            {index + 1}. {cleanOrderTitle(order.title)}
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
                              handleToggleReviewStatus(orderWithIndex);
                            }}
                            disabled={markingReviewed.has(orderId)}
                            className={`p-2 rounded-md transition-all duration-300 ${
                              markingReviewed.has(orderId)
                                ? 'text-gray-500 cursor-not-allowed'
                                : isReviewed
                                ? 'text-green-600 bg-green-100 hover:bg-green-200'
                                : 'text-gray-400 hover:bg-green-100 hover:text-green-600'
                            }`}
                            title={isReviewed ? "Mark as not reviewed" : "Mark as reviewed"}
                          >
                            {markingReviewed.has(orderId) ? (
                              <RefreshIcon size={16} className="animate-spin" />
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
                              <RefreshIcon size={16} className="animate-spin" />
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
                              <h4 className="font-semibold text-purple-800">Azure AI Executive Summary</h4>
                              <span className="text-purple-800">-</span>
                              <span className="inline-flex items-center justify-center px-2 py-1 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[11px] rounded-full leading-tight">
                                ✦ AI Generated
                              </span>
                            </div>
                            <div className="text-sm text-violet-800 leading-relaxed">
                              <div dangerouslySetInnerHTML={{ __html: order.ai_summary }} />
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
      {!loading && !error && orders.length > 0 && pagination.total_pages > 1 && (
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
              Page {pagination.page} of {pagination.total_pages} ({pagination.count} total orders)
            </div>
          </div>
        </div>
      )}

      {/* Universal CSS Styles - Same as StatePage */}
      <style>{`
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