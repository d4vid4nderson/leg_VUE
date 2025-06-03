import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { DebugDashboard, MockDebugEndpoints } from './components/DebugDashboard'; // Adjust path as needed

import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation
} from "react-router-dom";
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
  Home
} from 'lucide-react';
import byMOREgroupLogo from './components/byMOREgroup.PNG';
import favicon from './favicon.png';


// Import your CSS file - CRITICAL for styling
import './index.css'; // Add this line if you have App.css
// OR if you have a different CSS file name, import it like:
// import './styles.css';
// import './index.css';

// If you're using Tailwind CSS, make sure you have:
// import './index.css'; // or wherever your Tailwind directives are

// ------------------------
// Loading Animation Components
// ------------------------

// Loading Component with Progress Bar and Dynamic Text
const LoadingAnimation = ({ type = "Executive Orders", onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);

  // Loading stages with dynamic text based on type
  const getLoadingStages = (type) => [
    `Fetching ${type}...`,
    `Sending ${type} to AI for Analysis...`,
    `AI Processing ${type}...`,
    `AI Getting ${type} ready to display...`,
    `Making final preparations and formatting...`
  ];

  const stages = getLoadingStages(type);

  // Pulsing Favicon Effect
  useEffect(() => {
    const favicon = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
    if (!favicon) return;

    const originalHref = favicon.href;
    
    // Create pulsing effect by alternating favicon opacity
    const createPulseEffect = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 32;
      canvas.height = 32;

      const img = new Image();
      img.onload = () => {
        let opacity = 1;
        let increasing = false;

        const pulse = () => {
          // Clear canvas
          ctx.clearRect(0, 0, 32, 32);
          
          // Draw favicon with current opacity
          ctx.globalAlpha = opacity;
          ctx.drawImage(img, 0, 0, 32, 32);
          
          // Draw pulsing rings
          for (let i = 0; i < 3; i++) {
            ctx.globalAlpha = (1 - opacity) * (1 - i * 0.3);
            ctx.strokeStyle = '#3B82F6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(16, 16, 12 + i * 6, 0, 2 * Math.PI);
            ctx.stroke();
          }
          
          // Update favicon
          favicon.href = canvas.toDataURL();
          
          // Update opacity for pulsing effect
          if (increasing) {
            opacity += 0.1;
            if (opacity >= 1) increasing = false;
          } else {
            opacity -= 0.1;
            if (opacity <= 0.3) increasing = true;
          }
        };

        // Start pulsing animation
        const pulseInterval = setInterval(pulse, 150);
        
        // Store cleanup function
        favicon._pulseCleanup = () => {
          clearInterval(pulseInterval);
          favicon.href = originalHref;
        };
      };
      
      img.src = originalHref;
    };

    createPulseEffect();

    // Cleanup on unmount
    return () => {
      if (favicon._pulseCleanup) {
        favicon._pulseCleanup();
      }
    };
  }, []);

  // Progress simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + Math.random() * 3 + 1; // Random increment 1-4%
        
        // Update stage based on progress
        if (newProgress >= 0 && newProgress < 21) setCurrentStage(0);
        else if (newProgress >= 21 && newProgress < 41) setCurrentStage(1);
        else if (newProgress >= 41 && newProgress < 61) setCurrentStage(2);
        else if (newProgress >= 61 && newProgress < 81) setCurrentStage(3);
        else if (newProgress >= 81) setCurrentStage(4);

        if (newProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 500);
          return 100;
        }
        
        return newProgress;
      });
    }, 200); // Update every 200ms

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-white bg-opacity-95 z-50 flex flex-col">
      {/* Main Loading Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          {/* Animated Logo/Icon */}
          <div className="mb-8 relative">
            <div className="w-20 h-20 mx-auto bg-gradient-to-r from-violet-600 to-blue-600 rounded-full flex items-center justify-center animate-pulse">
              <img
                src="/favicon.png"  // <-- Public path works regardless of where the JSX is
                alt="Loading"
                className="w-12 h-12 object-contain rounded-full drop-shadow-lg"
                style={{ background: 'white' }}
              />
            </div>

            
            {/* Pulsing Rings Around Logo */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 border-4 border-blue-400 rounded-full animate-ping opacity-30"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 border-4 border-violet-400 rounded-full animate-ping opacity-20" style={{ animationDelay: '0.5s' }}></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-44 h-44 border-4 border-blue-300 rounded-full animate-ping opacity-10" style={{ animationDelay: '1s' }}></div>
            </div>
          </div>

          {/* Loading Text */}
          <h3 className="text-2xl font-bold text-gray-800 mb-4 bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
            Processing Your Request
          </h3>
          
          {/* Dynamic Stage Text */}
          <div className="mb-8">
            <p className="text-lg text-gray-700 font-medium transition-all duration-300">
              {stages[currentStage]}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Please wait while we gather and analyze the data...
            </p>
          </div>

          {/* Progress Percentage */}
          <div className="text-3xl font-bold text-blue-600 mb-4">
            {Math.round(progress)}%
          </div>
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="w-full bg-gray-200 h-2">
        <div 
          className="h-2 bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      {/* Bottom Text */}
      <div className="p-4 text-center bg-gray-50">
        <p className="text-sm text-gray-600">
          <span className="font-medium">{stages[currentStage]}</span>
        </p>
      </div>
    </div>
  );
};

// Hook for managing loading state
const useLoadingAnimation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState("Executive Orders");

  const startLoading = (type = "Executive Orders") => {
    setLoadingType(type);
    setIsLoading(true);
  };

  const stopLoading = () => {
    setIsLoading(false);
  };

  return {
    isLoading,
    loadingType,
    startLoading,
    stopLoading,
    LoadingComponent: isLoading ? (
      <LoadingAnimation type={loadingType} onComplete={stopLoading} />
    ) : null
  };
};

// ------------------------
// API URL and Helpers
// ------------------------
const getApiUrl = () => {
  if (import.meta.env?.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof process !== 'undefined' && process.env?.VITE_API_URL) return process.env.VITE_API_URL;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:8000';
  return 'https://your-api-domain.com';
};
const API_URL = getApiUrl();

// ------------------------
// Constants
// ------------------------
const FILTERS = [
  { key: 'civic', icon: Building, label: 'Civic' },
  { key: 'education', icon: GraduationCap, label: 'Education' },
  { key: 'healthcare', icon: Heart, label: 'Healthcare' },
  { key: 'engineering', icon: Wrench, label: 'Engineering' },
  { key: 'not-applicable', icon: ScrollText, label: 'Not Applicable' },
];

const filterStyles = {
  civic: 'text-blue-700',
  education: 'text-yellow-700',
  healthcare: 'text-red-700',
  engineering: 'text-green-700',
  'not-applicable': 'text-gray-700'
};

const SUPPORTED_STATES = {
  'California': 'CA',
  'Colorado': 'CO',
  'Kentucky': 'KY', 
  'Nevada': 'NV',
  'South Carolina': 'SC',
  'Texas': 'TX',
};

// ------------------------
// Helper Functions
// ------------------------
const getOrderId = (order) => {
  if (!order) return null;
  return order.id || order.executive_order_number || `order-${order.title?.slice(0, 10)}`;
};

const stripHtmlTags = (html) => {
  if (!html) return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  let text = tempDiv.textContent || tempDiv.innerText || '';
  text = text.replace(/\s+/g, ' ').trim();
  return text;
};

const formatContent = (content) => {
  if (!content) return [];
  const cleanText = stripHtmlTags(content);
  // Try to split on numbers for lists
  const numberedPattern = /(\d+)\.\s*([^0-9]*?)(?=\d+\.|$)/g;
  const numberedMatches = [];
  let match;
  while ((match = numberedPattern.exec(cleanText)) !== null) {
    const item = match[2].trim();
    if (item.length > 5) {
      numberedMatches.push(item);
    }
  }
  if (numberedMatches.length > 1) return numberedMatches;
  return [cleanText];
};

const formatContentForCopy = (content, title = '') => {
  if (!content) return '';
  const cleanText = stripHtmlTags(content);
  const items = formatContent(cleanText);
  let formatted = '';
  if (title) {
    formatted += `${title}:\n`;
  }
  items.forEach((item) => {
    const cleanItem = item.replace(/^\d+\.\s*/, '').trim();
    formatted += `• ${cleanItem}\n`;
  });
  return formatted + '\n';
};

const createFormattedReport = (order) => {
  let report = '';
  report += `EXECUTIVE ORDER #${order.executive_order_number}\n`;
  report += `${order.title}\n`;
  report += `Date: ${order.signing_date ? new Date(order.signing_date).toLocaleDateString() : 'N/A'}\n`;
  report += `Category: ${FILTERS.find(f => f.key === order.category)?.label || order.category || 'Uncategorized'}\n`;
  report += `${'='.repeat(60)}\n\n`;
  
  if (order.ai_summary) {
    report += `AI SUMMARY:\n`;
    report += `${stripHtmlTags(order.ai_summary)}\n\n`;
  }
  
  if (order.ai_talking_points) {
    report += formatContentForCopy(order.ai_talking_points, 'KEY TALKING POINTS');
  }
  
  if (order.ai_business_impact) {
    report += formatContentForCopy(order.ai_business_impact, 'BUSINESS IMPACT ANALYSIS');
  }
  
  if (order.ai_potential_impact) {
    report += formatContentForCopy(order.ai_potential_impact, 'LONG-TERM IMPACT');
  }
  
  if (order.abstract) {
    report += `ABSTRACT:\n`;
    report += `${stripHtmlTags(order.abstract)}\n\n`;
  }
  
  report += `LINKS:\n`;
  report += `• Federal Register: ${getFederalRegisterUrl(order)}\n`;
  if (order.pdf_url) report += `• PDF Document: ${order.pdf_url}\n`;
  if (order.html_url) report += `• HTML Version: ${order.html_url}\n`;
  
  return report;
};

const getFederalRegisterUrl = (order) => {
  if (order.html_url && order.html_url.includes('federalregister.gov')) return order.html_url;
  if (order.document_number) return `https://www.federalregister.gov/documents/${order.document_number}`;
  if (order.executive_order_number) return `https://www.federalregister.gov/presidential-documents/executive-orders?conditions%5Bterm%5D=${order.executive_order_number}`;
  return 'https://www.federalregister.gov/presidential-documents/executive-orders';
};

// ------------------------
// Category Tag Component
// ------------------------
const CategoryTag = ({ category }) => {
  if (!category) return null;
  
  const filter = FILTERS.find(f => f.key === category);
  const style = filterStyles[category];
  
  if (!filter || !style) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-700">
        <ScrollText size={12} />
        <span>Unknown</span>
      </span>
    );
  }
  
  const IconComponent = filter.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium text-xs ${style}`}>
      <IconComponent size={12} />
      <span>{filter.label}</span>
    </span>
  );
};

// ------------------------
// Pagination Component
// ------------------------
const Pagination = ({
  paginationPage,
  totalPages,
  onPageChange,
  loading
}) => (
  <div className="flex items-center justify-between px-4 py-6 bg-white border-t border-gray-200 mt-6 rounded-lg shadow-sm">
    <div className="flex justify-between w-full">
      <button
        onClick={() => onPageChange(paginationPage - 1)}
        disabled={paginationPage <= 1 || loading}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
          paginationPage <= 1 || loading
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-600 hover:text-white hover:shadow-lg'
        }`}
      >
        Previous
      </button>
      <div className="flex items-center text-sm text-gray-700">
        <span>Page</span>
        <span className="mx-2 font-medium">{paginationPage}</span>
        <span>of</span>
        <span className="mx-2 font-medium">{totalPages || '?'}</span>
      </div>
      <button
        onClick={() => onPageChange(paginationPage + 1)}
        disabled={paginationPage >= totalPages || loading}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
          paginationPage >= totalPages || loading
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-600 hover:text-white hover:shadow-lg'
        }`}
      >
        Next
      </button>
    </div>
  </div>
);

// ------------------------
// AppContent Component
// ------------------------
const AppContent = () => {
  // ---- Loading Animation Hook ----
  const { isLoading, LoadingComponent, startLoading, stopLoading } = useLoadingAnimation();

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

  const [federalDateRange, setFederalDateRange] = useState({
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 20000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  
  const dropdownRef = useRef(null);
  const filterDropdownRef = useRef(null);

  // React Router hooks
  const navigate = useNavigate();
  const location = useLocation();

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
        return { label: 'Executive Orders', icon: ScrollText, color: 'text-purple-700' };
      case 'state-legislation':
        return { label: 'State Legislation', icon: FileText, color: 'text-indigo-700' };
      default:
        return { label: 'Unknown Source', icon: ScrollText, color: 'text-gray-700' };
    }
  };

  // ------------------------
  // Highlights Handlers
  // ------------------------
  const highlightsHandlers = useMemo(() => ({
    handleExpandOrder: (order) => {
      const orderId = getOrderId(order);
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
    isOrderExpanded: (order) => {
      const orderId = getOrderId(order);
      return highlightsExpandedItems.has(orderId);
    }
  }), [highlightsExpandedItems]);

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
  // Stable Handlers
  // ------------------------
  const stableHandlers = useMemo(() => ({
    handleOrderSelection: (orderNumber) => {
      setSelectedOrders(prev => {
        const newSet = new Set(prev);
        if (newSet.has(orderNumber)) {
          newSet.delete(orderNumber);
        } else {
          newSet.add(orderNumber);
        }
        return newSet;
      });
    },
    
    handlePageChange: (newPage) => {
      if (newPage < 1 || (totalPages && newPage > totalPages) || loading) return;
      setPaginationPage(newPage);
      setExpandedOrderId(null);
    },
    
    handleExpandOrder: (order) => {
      const orderId = getOrderId(order);
      setExpandedOrderId(prev => prev === orderId ? null : orderId);
    },
    
    handleItemHighlight: (order, sourcePage = null) => {
      const orderId = getOrderId(order);
      if (!orderId) return;
      
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
            let source = sourcePage;
            if (!source) {
              if (location.pathname === '/executive-orders') {
                source = 'executive-orders';
              } else if (Object.keys(SUPPORTED_STATES).some(state => 
                location.pathname === `/state/${state.toLowerCase().replace(' ', '-')}`
              )) {
                source = 'state-legislation';
              } else {
                source = 'executive-orders';
              }
            }
            newSources.set(orderId, source);
            return newSources;
          });
        }
        return newSet;
      });
    },
    
    isItemHighlighted: (order) => {
      const orderId = getOrderId(order);
      return !!orderId && highlightedItems.has(orderId);
    },
    
    isOrderExpanded: (order) => {
      const orderId = getOrderId(order);
      return expandedOrderId === orderId;
    }
  }), [totalPages, loading, expandedOrderId, highlightedItems, location.pathname]);

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
  // Data Fetching
  // ------------------------
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const url = `${API_URL}/api/executive-orders?page=${paginationPage}&per_page=${itemsPerPage}`;
      const data = await makeApiCall(url);
      setOrders(data.results || []); // Changed from data.orders to data.results
      setTotalPages(data.total_pages || 1);
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [paginationPage, itemsPerPage, makeApiCall]);

  // Fetch data on component mount and pagination change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ------------------------
  // Filtering Logic
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
  // Highlighted Orders Filtering
  // ------------------------
  const highlightedOrders = useMemo(() => {
    if (!highlightedItems || highlightedItems.size === 0) return [];
    
    return Array.from(highlightedItems)
      .map(id => orders.find(o => getOrderId(o) === id))
      .filter(Boolean);
  }, [highlightedItems, orders]);

  const filteredHighlightedOrders = useMemo(() => {
    let filtered = highlightedOrders;
    
    // Apply filters (both category and source filters)
    if (activeHighlightsFilters.size > 0) {
      console.log('🔍 Active filters:', Array.from(activeHighlightsFilters)); // Debug log
      
      filtered = filtered.filter(order => {
        const orderId = getOrderId(order);
        const source = highlightSources.get(orderId);
        
        console.log(`🔍 Checking order ${orderId}: category=${order.category}, source=${source}`); // Debug log
        
        // Check category filters
        const categoryMatch = order.category && activeHighlightsFilters.has(order.category);
        
        // Check source filters - need to match the exact source values
        let sourceMatch = false;
        if (source === 'executive-orders' && activeHighlightsFilters.has('executive-orders')) {
          sourceMatch = true;
        } else if (source === 'state-legislation' && activeHighlightsFilters.has('state-legislation')) {
          sourceMatch = true;
        }
        
        const shouldInclude = categoryMatch || sourceMatch;
        console.log(`🔍 Order ${orderId}: categoryMatch=${categoryMatch}, sourceMatch=${sourceMatch}, included=${shouldInclude}`); // Debug log
        
        return shouldInclude;
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
    
    console.log(`🔍 Final filtered count: ${filtered.length} out of ${highlightedOrders.length}`); // Debug log
    return filtered;
  }, [highlightedOrders, activeHighlightsFilters, searchTerm, highlightSources]);

  // ------------------------
  // Copy to Clipboard Helper
  // ------------------------
  const copyToClipboard = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here
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
  // Download Helper
  // ------------------------
  const downloadTextFile = useCallback((content, filename) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);


// ------------------------
// Complete Header Component - Structured Menu with Separators
// ------------------------
const Header = ({ showDropdown, setShowDropdown, dropdownRef, currentPage }) => {
  const navigate = useNavigate();
  const location = useLocation();

    return (
    <header className="bg-white shadow-sm z-10 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-12">
        <div className="flex items-center justify-between h-16 sm:h-24">
          
         {/* Logo Section - Clickable to Homepage */}
          <div 
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity duration-300"
            onClick={() => navigate('/')}
          >
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent leading-none">
                LegislativeVUE
              </h1>
              <div className="flex justify-end mb-1">
                <img 
                  src={byMOREgroupLogo} 
                  alt="byMOREgroup Logo" 
                  className="h-3 sm:h-4 w-auto"
                />
              </div>
            </div>
          </div>

          {/* Navigation Menu - Always shows "Menu" */}
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-300 border border-gray-200"
            >
              <HamburgerIcon size={20} />
              <span>Menu</span>
              <ChevronDown 
                size={14} 
                className={
                  "transition-transform duration-200 " + 
                  (showDropdown ? 'rotate-180' : '')
                }
              />
            </button>

            {showDropdown && (
              <div 
                ref={dropdownRef}
                className="absolute top-full right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 py-2 z-50"
              >
                
                {/* Highlighted Items */}
                <button
                  onClick={() => {
                    navigate('/');
                    setShowDropdown(false);
                  }}
                  className={
                    "w-full text-left px-4 py-3 text-sm font-bold transition-all duration-300 flex items-center gap-3 " +
                    (location.pathname === '/' || location.pathname === '/highlights'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-800 hover:bg-gray-100')
                  }
                >
                  <Star size={16} />
                  <span>Highlighted Items</span>
                </button>

                {/* Separator */}
                <div className="border-t border-gray-200 my-1"></div>

                {/* Executive Orders */}
                <button
                  onClick={() => {
                    navigate('/executive-orders');
                    setShowDropdown(false);
                  }}
                  className={
                    "w-full text-left px-4 py-3 text-sm font-bold transition-all duration-300 flex items-center gap-3 " +
                    (location.pathname === '/executive-orders'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-800 hover:bg-gray-100')
                  }
                >
                  <ScrollText size={16} />
                  <span>Executive Orders</span>
                </button>

                {/* Separator */}
                <div className="border-t border-gray-200 my-1"></div>

                {/* State Legislation Header */}
                <div className="px-4 py-2 text-sm font-bold text-gray-800 flex items-center gap-3">
                  <FileText size={16} />
                  <span>State Legislation</span>
                </div>

                {/* State Items */}
                {Object.keys(SUPPORTED_STATES).map(state => {
                  const isActive = location.pathname === `/state/${state.toLowerCase().replace(' ', '-')}`;
                  return (
                    <button
                      key={state}
                      onClick={() => {
                        navigate(`/state/${state.toLowerCase().replace(' ', '-')}`);
                        setShowDropdown(false);
                      }}
                      className={
                        "w-full text-left px-8 py-2 text-sm transition-all duration-300 " +
                        (isActive
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100')
                      }
                    >
                      {state} ({SUPPORTED_STATES[state]})
                    </button>
                  );
                })}

                {/* Separator */}
                <div className="border-t border-gray-200 my-1"></div>

                {/* Settings */}
                <button
                  onClick={() => {
                    navigate('/settings');
                    setShowDropdown(false);
                  }}
                  className={
                    "w-full text-left px-4 py-3 text-sm font-bold transition-all duration-300 flex items-center gap-3 " +
                    (location.pathname === '/settings'
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-800 hover:bg-gray-100')
                  }
                >
                  <Settings size={16} />
                  <span>Settings</span>
                </button>

              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};

// ------------------------
  // HighlightsPage Component
  // ------------------------
  const HighlightsPage = ({
    highlightedOrders,
    filteredHighlightedOrders,
    searchTerm,
    setSearchTerm,
    highlightsFilterHelpers,
    highlightsHandlers,
    stableHandlers,
    getHighlightSource,
    createFormattedReport,
    formatContent,
    stripHtmlTags,
    activeHighlightsFilters
  }) => {
    const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '');
    const [highlightsShowFilterDropdown, setHighlightsShowFilterDropdown] = useState(false);
    const highlightsFilterDropdownRef = useRef(null);
    const navigate = useNavigate();

    // Custom filters for Highlights page - includes source filters
    const HIGHLIGHTS_FILTERS = [
      { key: 'civic', icon: Building, label: 'Civic' },
      { key: 'education', icon: GraduationCap, label: 'Education' },
      { key: 'healthcare', icon: Heart, label: 'Healthcare' },
      { key: 'engineering', icon: Wrench, label: 'Engineering' },
      { key: 'executive-orders', icon: ScrollText, label: 'Executive Orders' },
      { key: 'state-legislation', icon: FileText, label: 'State Legislation' },
    ];

    const highlightsFilterStyles = {
      civic: 'text-blue-600',
      education: 'text-yellow-600',
      healthcare: 'text-red-600',
      engineering: 'text-green-600',
      'executive-orders': 'text-purple-600',
      'state-legislation': 'text-indigo-600'
    };

    // Update local search when prop changes
    useEffect(() => {
      setLocalSearchTerm(searchTerm || '');
    }, [searchTerm]);

    // Click outside to close dropdown
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (highlightsFilterDropdownRef.current && !highlightsFilterDropdownRef.current.contains(event.target)) {
          setHighlightsShowFilterDropdown(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearchSubmit = (e) => {
      e.preventDefault();
      if (setSearchTerm) {
        setSearchTerm(localSearchTerm);
      }
    };

    return (
      <div className="pt-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">Highlights</h2>
          <p className="text-gray-600">Your saved executive orders and legislation for quick access.</p>
        </div>

        {/* Search and Filter Bar - Always Show, Consistent Layout */}
        <div className="mb-8">
          <div className="flex gap-4 items-center">
            {/* Filter Dropdown - Left Side */}
            <div className="relative" ref={highlightsFilterDropdownRef}>
              <button
                onClick={() => setHighlightsShowFilterDropdown(!highlightsShowFilterDropdown)}
                className="flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 transition-all duration-300 w-48"
              >
                <div className="flex items-center gap-2">
                  {highlightsFilterHelpers.hasActiveFilters() && (
                    (() => {
                      const activeFilterKey = Array.from(activeHighlightsFilters)[0];
                      const selectedFilter = HIGHLIGHTS_FILTERS.find(f => f.key === activeFilterKey);
                      if (selectedFilter) {
                        const IconComponent = selectedFilter.icon;
                        const colorClass = highlightsFilterStyles[selectedFilter.key];
                        return (
                          <IconComponent 
                            size={16} 
                            className={colorClass}
                          />
                        );
                      }
                      return null;
                    })()
                  )}
                  <span className="truncate">
                    {highlightsFilterHelpers.hasActiveFilters()
                      ? activeHighlightsFilters.size === 1 
                        ? HIGHLIGHTS_FILTERS.find(f => f.key === Array.from(activeHighlightsFilters)[0])?.label || 'Filter'
                        : `${activeHighlightsFilters.size} Selected`
                      : 'Filter'
                    }
                  </span>
                </div>
                <ChevronDown 
                  size={16} 
                  className={`transition-transform duration-200 flex-shrink-0 ${highlightsShowFilterDropdown ? 'rotate-180' : ''}`}
                />
              </button>

              {highlightsShowFilterDropdown && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <button
                    onClick={() => {
                      highlightsFilterHelpers.clearAllFilters();
                      setHighlightsShowFilterDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 ${
                      !highlightsFilterHelpers.hasActiveFilters()
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                                      >
                    All Filters
                  </button>
                  {HIGHLIGHTS_FILTERS.map(filter => {
                    const IconComponent = filter.icon;
                    const isActive = activeHighlightsFilters.has(filter.key);
                    const colorClass = highlightsFilterStyles[filter.key];
                    return (
                      <button
                        key={filter.key}
                        onClick={() => {
                          highlightsFilterHelpers.toggleFilter(filter.key);
                          // Don't close dropdown for multi-select
                        }}
                        className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center gap-3 ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <IconComponent 
                          size={16} 
                          className={colorClass}
                        />
                        <span>{filter.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Search Bar - Right Side */}
            <div className="flex-1 relative">
              <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search highlighted items..."
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearchSubmit(e);
                  }
                }}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
              />
            </div>

            {(highlightsFilterHelpers.hasActiveFilters() || searchTerm) && (
              <button
                onClick={() => {
                  highlightsFilterHelpers.clearAllFilters();
                  setSearchTerm('');
                  setLocalSearchTerm('');
                }}
                className="px-4 py-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all duration-300 flex-shrink-0"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

          <div className="space-y-6">
            {filteredHighlightedOrders.map((order, index) => (
              <div key={getOrderId(order)} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex items-start justify-between px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
                  <div 
                    className="flex-1 cursor-pointer hover:bg-gray-50 transition-all duration-300 rounded-md p-2 -ml-2 -mt-2 -mb-1"
                    onClick={() => highlightsHandlers.handleExpandOrder(order)}
                  >
                    <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-1 leading-tight">
                      {index + 1}. {order?.title || 'Untitled'}
                    </h3>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
                      <span className="font-medium">Executive Order #{order?.executive_order_number}</span>
                      <span>{order?.signing_date ? new Date(order.signing_date).toLocaleDateString() : 'No date'}</span>
                      <CategoryTag category={order?.category} />
                      {(() => {
                        const source = getHighlightSource(order);
                        const SourceIcon = source.icon;
                        return (
                          <span className={`inline-flex items-center gap-1.5 font-medium text-xs ${source.color} bg-gray-100 px-2 py-1 rounded-full`}>
                            <SourceIcon size={12} />
                            <span>From: {source.label}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        stableHandlers.handleItemHighlight(order);
                      }}
                      className="p-2 hover:bg-red-100 hover:text-red-600 rounded-md transition-all duration-300"
                      title="Remove from highlights"
                    >
                      <Star size={16} className="fill-current text-yellow-500" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        highlightsHandlers.handleExpandOrder(order);
                      }}
                      className="p-2 hover:bg-gray-100 rounded-md transition-all duration-300"
                    >
                      <ChevronDown 
                        size={20} 
                        className={`text-gray-500 transition-transform duration-200 ${
                          highlightsHandlers.isOrderExpanded(order) ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {order?.ai_summary && (
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                    <div className="bg-violet-50 p-3 rounded-md border border-violet-200">
                      <p className="text-sm font-medium text-violet-800 mb-2 flex items-center gap-2">
                        <span>Azure AI Summary:</span>
                        <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                          ✦ AI Generated
                        </span>
                      </p>
                      <p className="text-sm text-violet-800 leading-relaxed">{stripHtmlTags(order.ai_summary)}</p>
                    </div>
                  </div>
                )}
                
                {highlightsHandlers.isOrderExpanded(order) && (
                  <div className="px-3 sm:px-4 pb-3 sm:pb-4 bg-gray-50">
                    {order.ai_talking_points && (
                      <div className="mb-4">
                        <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                          <p className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                            <span>🎯 Key Talking Points:</span>
                            <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                              ✦ AI Generated
                            </span>
                          </p>
                          <div className="text-blue-800">
                            {formatContent(order.ai_talking_points).map((point, idx) => (
                              <div key={idx} className="mb-2 last:mb-0 flex items-start gap-2">
                                <span className="text-blue-600 font-semibold text-sm mt-0.5">•</span>
                                <span className="text-blue-800 text-sm leading-relaxed flex-1">{point}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {order.ai_business_impact && (
                      <div className="mb-4">
                        <div className="bg-green-50 p-3 rounded-md border border-green-200">
                          <p className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
                            <span>📈 Business Impact Analysis:</span>
                            <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                              ✦ AI Generated
                            </span>
                          </p>
                          <div className="text-green-800">
                            {formatContent(order.ai_business_impact).map((impact, idx) => (
                              <div key={idx} className="mb-2 last:mb-0 flex items-start gap-2">
                                <span className="text-green-600 font-semibold text-sm mt-0.5">•</span>
                                <span className="text-green-800 text-sm leading-relaxed flex-1">{impact}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {order.ai_potential_impact && (
                      <div className="mb-4">
                        <div className="bg-orange-50 p-3 rounded-md border border-purple-200">
                          <p className="text-sm font-medium text-orange-600 mb-2 flex items-center gap-2">
                            <span>🔮 Long-term Impact:</span>
                            <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                              ✦ AI Generated
                            </span>
                          </p>
                          <div className="text-orange-800">
                            {formatContent(order.ai_potential_impact).map((impact, idx) => (
                              <div key={idx} className="mb-2 last:mb-0 flex items-start gap-2">
                                <span className="text-orange-600 font-semibold text-sm mt-0.5">•</span>
                                <span className="text-orange-600 text-sm leading-relaxed flex-1">{impact}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                      <button
                        onClick={() => copyToClipboard(createFormattedReport(order))}
                        className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300 text-sm flex items-center gap-2"
                      >
                        <Copy size={14} />
                        <span>Copy Report</span>
                      </button>
                      
                      <button
                        onClick={() => downloadTextFile(
                          createFormattedReport(order), 
                          `executive-order-${order.executive_order_number}.txt`
                        )}
                        className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-all duration-300 text-sm flex items-center gap-2"
                      >
                        <Download size={14} />
                        <span>Download</span>
                      </button>
                      
                      {order.html_url && (
                        <a
                          href={order.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-all duration-300 text-sm flex items-center gap-2"
                        >
                          <ExternalLink size={14} />
                          <span>View Original</span>
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
                          <span>View PDF</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        
      </div>
    );
  };


// Updated ExecutiveOrdersPage Component with improved fetch button and quick picks

const ExecutiveOrdersPage = ({
  orders,
  loading,
  error,
  searchTerm,
  setSearchTerm,
  activeFilter,
  setActiveFilter,
  filteredOrders,
  paginationPage,
  totalPages,
  stableHandlers,
  showFilterDropdown,
  setShowFilterDropdown,
  filterDropdownRef,
  fetchData
}) => {
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm || '');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState(0);
  
  // CONTRACT CONTROL STATES - DEFAULT CONTRACTED
  const [isFetchExpanded, setIsFetchExpanded] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [fetchStatus, setFetchStatus] = useState(null);
  const [federalDateRange, setFederalDateRange] = useState({
    startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 2000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    setLocalSearchTerm(searchTerm || '');
  }, [searchTerm]);

  // Advanced loading animation effect
  useEffect(() => {
    if (loading) {
      setLoadingProgress(0);
      setLoadingStage(0);

      // Pulsing favicon effect
      const favicon = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
      let originalHref = '';
      let pulseInterval = null;

      if (favicon) {
        originalHref = favicon.href;
        
        const createPulseEffect = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = 32;
          canvas.height = 32;

          const img = new Image();
          img.onload = () => {
            let opacity = 1;
            let increasing = false;

            const pulse = () => {
              ctx.clearRect(0, 0, 32, 32);
              ctx.globalAlpha = opacity;
              ctx.drawImage(img, 0, 0, 32, 32);
              
              for (let i = 0; i < 3; i++) {
                ctx.globalAlpha = (1 - opacity) * (1 - i * 0.3);
                ctx.strokeStyle = '#3B82F6';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(16, 16, 12 + i * 6, 0, 2 * Math.PI);
                ctx.stroke();
              }
              
              favicon.href = canvas.toDataURL();
              
              if (increasing) {
                opacity += 0.1;
                if (opacity >= 1) increasing = false;
              } else {
                opacity -= 0.1;
                if (opacity <= 0.3) increasing = true;
              }
            };

            pulseInterval = setInterval(pulse, 150);
          };
          
          img.src = originalHref;
        };

        createPulseEffect();
      }

      // Progress simulation
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          const newProgress = prev + Math.random() * 4 + 1;
          
          if (newProgress >= 0 && newProgress < 21) setLoadingStage(0);
          else if (newProgress >= 21 && newProgress < 41) setLoadingStage(1);
          else if (newProgress >= 41 && newProgress < 61) setLoadingStage(2);
          else if (newProgress >= 61 && newProgress < 81) setLoadingStage(3);
          else if (newProgress >= 81) setLoadingStage(4);

          if (newProgress >= 100) {
            clearInterval(progressInterval);
            if (pulseInterval) clearInterval(pulseInterval);
            if (favicon && originalHref) favicon.href = originalHref;
            return 100;
          }
          
          return newProgress;
        });
      }, 200);

      return () => {
        clearInterval(progressInterval);
        if (pulseInterval) clearInterval(pulseInterval);
        if (favicon && originalHref) favicon.href = originalHref;
      };
    }
  }, [loading]);

  // Quick pick handler that updates dates and executes fetch
  const handleQuickPick = async (startDate, endDate) => {
    // Update the date range
    setFederalDateRange({
      startDate: startDate,
      endDate: endDate
    });
    
    // Execute the fetch immediately
    await handleFetchExecutiveOrders(startDate, endDate);
  };

  // Fetch Executive Orders function - now accepts optional date parameters
  const handleFetchExecutiveOrders = async (customStartDate = null, customEndDate = null) => {
    if (fetchingData) return;
    
    setFetchingData(true);
    setFetchStatus('🔍 Fetching executive orders from Federal Register...');
    
    try {
      const startDate = customStartDate || federalDateRange.startDate;
      const endDate = customEndDate || federalDateRange.endDate;
      
      const response = await fetch(`${API_URL}/api/executive-orders/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          save_to_db: true
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setFetchStatus(`✅ Successfully fetched ${data.orders_fetched || 0} executive orders! Refreshing data...`);
        // Refresh the data
        setTimeout(() => {
          if (fetchData) fetchData();
        }, 1000);
      } else {
        setFetchStatus(`❌ Error: ${data.message || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Error fetching executive orders:', error);
      setFetchStatus(`❌ Error: ${error.message}`);
    } finally {
      setFetchingData(false);
      setTimeout(() => setFetchStatus(null), 8000);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (setSearchTerm) {
      setSearchTerm(localSearchTerm);
    }
  };

  const loadingStages = [
    "Fetching Executive Orders...",
    "Sending Executive Orders to AI for Analysis...",
    "AI Processing Executive Orders...",
    "AI Getting Executive Orders ready to display...",
    "Making final preparations and formatting..."
  ];

  return (
    <div className="pt-6">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Federal Executive Orders</h2>
        <p className="text-gray-600">Explore executive orders from the Federal Register with AI analysis.</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="mb-8">
        <div className="flex gap-4 items-center">
          {/* Filter Dropdown - Left Side */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 transition-all duration-300 w-48"
            >
              <div className="flex items-center gap-2">
                {activeFilter && (
                  (() => {
                    const selectedFilter = FILTERS.find(f => f.key === activeFilter);
                    if (selectedFilter) {
                      const IconComponent = selectedFilter.icon;
                      return (
                        <IconComponent 
                          size={16} 
                          className={
                            selectedFilter.key === 'civic' ? 'text-blue-600' :
                            selectedFilter.key === 'education' ? 'text-yellow-600' :
                            selectedFilter.key === 'healthcare' ? 'text-red-600' :
                            selectedFilter.key === 'engineering' ? 'text-green-600' :
                            'text-gray-600'
                          }
                        />
                      );
                    }
                    return null;
                  })()
                )}
                <span className="truncate">
                  {activeFilter 
                    ? FILTERS.find(f => f.key === activeFilter)?.label || 'Filter'
                    : 'Filter'
                  }
                </span>
              </div>
              <ChevronDown 
                size={16} 
                className={`transition-transform duration-200 flex-shrink-0 ${showFilterDropdown ? 'rotate-180' : ''}`}
              />
            </button>

            {showFilterDropdown && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <button
                  onClick={() => {
                    setActiveFilter(null);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 ${
                    !activeFilter
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  All Categories
                </button>
                {FILTERS.map(filter => {
                  const IconComponent = filter.icon;
                  const isActive = activeFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      onClick={() => {
                        setActiveFilter(filter.key);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center gap-3 ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <IconComponent 
                        size={16} 
                        className={
                          filter.key === 'civic' ? 'text-blue-600' :
                          filter.key === 'education' ? 'text-yellow-600' :
                          filter.key === 'healthcare' ? 'text-red-600' :
                          filter.key === 'engineering' ? 'text-green-600' :
                          'text-gray-600'
                        }
                      />
                      <span>{filter.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Search Bar - Right Side */}
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search executive orders..."
              value={localSearchTerm}
              onChange={(e) => setLocalSearchTerm(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearchSubmit(e);
                }
              }}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
          </div>

          {(activeFilter || searchTerm) && (
            <button
              onClick={() => {
                setActiveFilter(null);
                setSearchTerm('');
                setLocalSearchTerm('');
              }}
              className="px-4 py-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all duration-300 flex-shrink-0"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* CONTRACTED Fetch Fresh Data Section */}
      <div className="mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Fetch Header - Collapsible */}
          <div 
            className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
            onClick={() => setIsFetchExpanded(!isFetchExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download size={20} className="text-blue-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Fetch Fresh Executive Orders</h3>
                  <p className="text-sm text-gray-600">
                    {isFetchExpanded ? 'Click to collapse fetch controls' : 'Click to expand fetch controls'}
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
                  <RefreshIcon size={16} className="animate-spin text-blue-600" />
                )}
                <ChevronDown 
                  size={20} 
                  className={`text-gray-500 transition-transform duration-200 ${isFetchExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </div>
          </div>

          {/* Expandable Content */}
          {isFetchExpanded && (
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Fetch and analyze executive orders from the Federal Register within a specific date range.
              </p>

              {/* Date Range Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={federalDateRange.startDate}
                    onChange={(e) => setFederalDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={federalDateRange.endDate}
                    onChange={(e) => setFederalDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Quick Date Selection Buttons - Now Interactive */}
              <div className="mb-6">
                <p className="text-sm font-medium text-gray-700 mb-3">🚀 Quick picks:</p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => handleQuickPick('2025-01-20', new Date().toISOString().split('T')[0])}
                    disabled={fetchingData}
                    className={`px-4 py-2 text-sm rounded-md transform hover:scale-105 transition-all duration-300 shadow-sm hover:shadow-md font-medium ${
                      fetchingData
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-100 text-blue-600 hover:bg-blue-700 hover:text-white'
                    }`}
                  >
                    🏛️ Since Inauguration Day
                  </button>
                  <button
                    onClick={() => handleQuickPick(
                      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      new Date().toISOString().split('T')[0]
                    )}
                    disabled={fetchingData}
                    className={`px-4 py-2 text-sm rounded-md transform hover:scale-105 transition-all duration-300 shadow-sm hover:shadow-md font-medium ${
                      fetchingData
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-100 text-blue-600 hover:bg-blue-700 hover:text-white'
                    }`}
                  >
                    📅 Last 30 Days
                  </button>
                  <button
                    onClick={() => handleQuickPick(
                      new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                      new Date().toISOString().split('T')[0]
                    )}
                    disabled={fetchingData}
                    className={`px-4 py-2 text-sm rounded-md transform hover:scale-105 transition-all duration-300 shadow-sm hover:shadow-md font-medium ${
                      fetchingData
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-100 text-blue-600 hover:bg-blue-700 hover:text-white'
                    }`}
                  >
                    📊 Last 90 Days
                  </button>
                </div>
              </div>

              {/* Fetch Status - Expanded View */}
              {fetchStatus && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-blue-800 text-sm font-medium">{fetchStatus}</p>
                </div>
              )}

              {/* Fetch Button - Now Full Width to Match State Page */}
              <button
                onClick={() => handleFetchExecutiveOrders()}
                disabled={fetchingData}
                className={`w-full px-6 py-3 rounded-md font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  fetchingData
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
                }`}
              >
                {fetchingData ? (
                  <>
                    <RefreshIcon size={20} className="animate-spin" />
                    <span>Fetching & Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    <span>Fetch Executive Orders</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Results Section */}
          <div className="p-6">
            {loading ? (
              <div className="py-12 text-center">
                <div className="mb-6 relative">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-r from-violet-600 to-blue-600 rounded-full flex items-center justify-center animate-pulse">
                    <ScrollText size={32} className="text-white" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-blue-400 rounded-full animate-ping opacity-30"></div>
                  </div>
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Loading Executive Orders</h3>
                <p className="text-gray-600">{loadingStages[loadingStage]}</p>
                <div className="text-2xl font-bold text-blue-600 mt-4">
                  {Math.round(loadingProgress)}%
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-md">
                <p className="font-semibold mb-2">Error loading executive orders:</p>
                <p className="text-sm">{error}</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <ScrollText size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Executive Orders Found</h3>
                <p className="text-gray-600 mb-4">
                  {(activeFilter || searchTerm) 
                    ? "No executive orders match your current search criteria." 
                    : "No executive orders are currently loaded. Use the fetch section above to get the latest orders."
                  }
                </p>
                {(activeFilter || searchTerm) && (
                  <button
                    onClick={() => {
                      setActiveFilter(null);
                      setSearchTerm('');
                      setLocalSearchTerm('');
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300"
                  >
                    Clear Search & Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-6">

                {/* Your existing executive orders rendering code here */}

{filteredOrders.map((order, index) => (
  <div key={getOrderId(order)} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
    <div className="flex items-start justify-between px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
      <div 
        className="flex-1 cursor-pointer hover:bg-gray-50 transition-all duration-300 rounded-md p-2 -ml-2 -mt-2 -mb-1"
        onClick={() => stableHandlers.handleExpandOrder(order)}
      >
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-1 leading-tight">
          {index + 1}. {order?.title || 'Untitled'}
        </h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-gray-600">
          <span className="font-medium">Executive Order #{order?.executive_order_number}</span>
          <span>{order?.signing_date ? new Date(order.signing_date).toLocaleDateString() : 'No date'}</span>
          <CategoryTag category={order?.category} />
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            stableHandlers.handleItemHighlight(order, 'executive-orders');
          }}
          className={`p-2 rounded-md transition-all duration-300 ${
            stableHandlers.isItemHighlighted(order)
              ? 'text-yellow-500 hover:bg-yellow-100'
              : 'text-gray-400 hover:bg-gray-100 hover:text-yellow-500'
          }`}
          title={stableHandlers.isItemHighlighted(order) ? "Remove from highlights" : "Add to highlights"}
        >
          <Star size={16} className={stableHandlers.isItemHighlighted(order) ? "fill-current" : ""} />
        </button>
        
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            stableHandlers.handleExpandOrder(order);
          }}
          className="p-2 hover:bg-gray-100 rounded-md transition-all duration-300"
        >
          <ChevronDown 
            size={20} 
            className={`text-gray-500 transition-transform duration-200 ${
              stableHandlers.isOrderExpanded(order) ? 'rotate-180' : ''
            }`}
          />
        </button>
      </div>
    </div>

    {order?.ai_summary && (
      <div className="px-3 sm:px-4 pb-3 sm:pb-4">
        <div className="bg-violet-50 p-3 rounded-md border border-violet-200">
          <p className="text-sm font-medium text-violet-800 mb-2 flex items-center gap-2">
            <span>Azure AI Summary:</span>
            <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
              ✦ AI Generated
            </span>
          </p>
          <p className="text-sm text-violet-800 leading-relaxed">{stripHtmlTags(order.ai_summary)}</p>
        </div>
      </div>
    )}
    
    {stableHandlers.isOrderExpanded(order) && (
      <div className="px-3 sm:px-4 pb-3 sm:pb-4 bg-gray-50">
                            {order.ai_talking_points && (
                      <div className="mb-4">
                        <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
                          <p className="text-sm font-medium text-blue-800 mb-2 flex items-center gap-2">
                            <span>🎯 Key Talking Points:</span>
                            <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                              ✦ AI Generated
                            </span>
                          </p>
                          <div className="text-blue-800">
                            {formatContent(order.ai_talking_points).map((point, idx) => (
                              <div key={idx} className="mb-2 last:mb-0 flex items-start gap-2">
                                <span className="text-blue-600 font-semibold text-sm mt-0.5">•</span>
                                <span className="text-blue-800 text-sm leading-relaxed flex-1">{point}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {order.ai_business_impact && (
                      <div className="mb-4">
                        <div className="bg-green-50 p-3 rounded-md border border-green-200">
                          <p className="text-sm font-medium text-green-800 mb-2 flex items-center gap-2">
                            <span>📈 Business Impact Analysis:</span>
                            <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                              ✦ AI Generated
                            </span>
                          </p>
                          <div className="text-green-800">
                            {formatContent(order.ai_business_impact).map((impact, idx) => (
                              <div key={idx} className="mb-2 last:mb-0 flex items-start gap-2">
                                <span className="text-green-600 font-semibold text-sm mt-0.5">•</span>
                                <span className="text-green-800 text-sm leading-relaxed flex-1">{impact}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {order.ai_potential_impact && (
                      <div className="mb-4">
                        <div className="bg-orange-50 p-3 rounded-md border border-purple-200">
                          <p className="text-sm font-medium text-orange-600 mb-2 flex items-center gap-2">
                            <span>🔮 Long-term Impact:</span>
                            <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                              ✦ AI Generated
                            </span>
                          </p>
                          <div className="text-orange-800">
                            {formatContent(order.ai_potential_impact).map((impact, idx) => (
                              <div key={idx} className="mb-2 last:mb-0 flex items-start gap-2">
                                <span className="text-orange-600 font-semibold text-sm mt-0.5">•</span>
                                <span className="text-orange-600 text-sm leading-relaxed flex-1">{impact}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
          <button
            onClick={() => copyToClipboard(createFormattedReport(order))}
            className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300 text-sm flex items-center gap-2"
          >
            <Copy size={14} />
            <span>Copy Report</span>
          </button>
          
          <button
            onClick={() => downloadTextFile(
              createFormattedReport(order), 
              `executive-order-${order.executive_order_number}.txt`
            )}
            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-all duration-300 text-sm flex items-center gap-2"
          >
            <Download size={14} />
            <span>Download</span>
          </button>
          
          <a
            href={getFederalRegisterUrl(order)}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-all duration-300 text-sm flex items-center gap-2"
          >
            <ExternalLink size={14} />
            <span>Federal Register</span>
          </a>
          
          {order.pdf_url && (
            <a
              href={order.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all duration-300 text-sm flex items-center gap-2"
            >
              <FileText size={14} />
              <span>View PDF</span>
            </a>
          )}
        </div>
      </div>
    )}
  </div>
))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pagination - Only show if there are results and not in fetch container */}
      {!loading && !error && filteredOrders.length > 0 && (
        <Pagination
          paginationPage={paginationPage}
          totalPages={totalPages}
          onPageChange={stableHandlers.handlePageChange}
          loading={loading}
        />
      )}
    </div>
  );
};
  
// Simplified SettingsPage Component - Database Management Only
const SettingsPage = () => {
  const [showDatabaseSection, setShowDatabaseSection] = useState(false);
  const [clearingDatabase, setClearingDatabase] = useState(false);
  const [showClearWarning, setShowClearWarning] = useState(false);
  const [clearStatus, setClearStatus] = useState(null);

  // Database clear function
  const handleClearDatabase = async () => {
    if (clearingDatabase) return;
    
    setClearingDatabase(true);
    setClearStatus('🗑️ Clearing database...');
    
    try {
      const response = await fetch(`${API_URL}/api/database/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        setClearStatus('✅ Database cleared successfully!');
        setShowClearWarning(false);
      } else {
        const errorData = await response.json();
        setClearStatus(`❌ Error: ${errorData.message || 'Failed to clear database'}`);
      }
      
    } catch (error) {
      console.error('Error clearing database:', error);
      setClearStatus(`❌ Error: ${error.message}`);
    } finally {
      setClearingDatabase(false);
      setTimeout(() => setClearStatus(null), 5000);
    }
  };

  return (
    <div className="pt-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Settings</h2>
        <p className="text-gray-600">Manage your application settings and database</p>
      </div>

      {/* Clear Status */}
      {clearStatus && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800 text-sm font-medium">{clearStatus}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* Info Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-6">
          <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
            <ScrollText size={20} />
            💡 Data Fetching Information
          </h4>
          <div className="space-y-2 text-blue-700 text-sm">
            <p className="flex items-start gap-2">
              <span className="font-medium">• Executive Orders:</span>
              <span>Visit the Executive Orders page to fetch and analyze federal executive orders from any date range.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="font-medium">• State Legislation:</span>
              <span>Visit any state page (California, Texas, etc.) to fetch and analyze that state's legislation by topic or bulk.</span>
            </p>
            <p className="flex items-start gap-2">
              <span className="font-medium">• Highlights:</span>
              <span>Star any items to save them to your highlights for quick access across all pages.</span>
            </p>
          </div>
        </div>

        {/* Application Stats */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FileText size={20} />
            <span>Application Information</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">Supported States</h4>
              <p className="text-2xl font-bold text-blue-600 mb-2">{Object.keys(SUPPORTED_STATES).length}</p>
              <p className="text-sm text-blue-700">
                {Object.keys(SUPPORTED_STATES).join(', ')}
              </p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <h4 className="font-semibold text-green-800 mb-2">Data Sources</h4>
              <p className="text-2xl font-bold text-green-600 mb-2">2</p>
              <p className="text-sm text-green-700">
                Federal Register & LegiScan API
              </p>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <h4 className="font-semibold text-purple-800 mb-2">AI Analysis</h4>
              <p className="text-2xl font-bold text-purple-600 mb-2">✦</p>
              <p className="text-sm text-purple-700">
                Azure OpenAI Integration
              </p>
            </div>
          </div>
        </div>

        {/* Database Management Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <button
            onClick={() => setShowDatabaseSection(!showDatabaseSection)}
            className="w-full flex items-center justify-between text-left focus:outline-none"
          >
            <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Settings size={20} />
              <span>Database Management</span>
            </h3>
            <ChevronDown 
              size={20} 
              className={`text-gray-500 transition-transform duration-200 ${showDatabaseSection ? 'rotate-180' : ''}`}
            />
          </button>

          {showDatabaseSection && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                  <Trash2 size={16} />
                  <span>Clear Database</span>
                </h4>
                <p className="text-red-700 text-sm mb-3">
                  This will permanently delete all executive orders and legislation from the database. 
                  This action cannot be undone. Your highlights will also be cleared.
                </p>
                
                {!showClearWarning ? (
                  <button
                    onClick={() => setShowClearWarning(true)}
                    disabled={clearingDatabase}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                      clearingDatabase 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    Clear Database
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleClearDatabase}
                      disabled={clearingDatabase}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                        clearingDatabase
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      <Trash2 size={14} />
                      <span>{clearingDatabase ? 'Clearing...' : 'Confirm Clear'}</span>
                    </button>
                    <button
                      onClick={() => setShowClearWarning(false)}
                      disabled={clearingDatabase}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-400 transition-all duration-300"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Database Info */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Database Information</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• Executive orders and state legislation are stored locally</p>
                  <p>• Data includes AI analysis and summaries</p>
                  <p>• Clearing will require re-fetching all data</p>
                  <p>• Your highlighted items are stored separately but will also be cleared</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Star size={20} />
            <span>Quick Actions</span>
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => window.location.href = '/executive-orders'}
              className="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-all duration-300 text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <ScrollText size={20} className="text-blue-600" />
                <span className="font-semibold text-blue-800">Fetch Executive Orders</span>
              </div>
              <p className="text-sm text-blue-700">
                Go to Executive Orders page to fetch federal data
              </p>
            </button>
            
            <button
              onClick={() => window.location.href = '/state/california'}
              className="p-4 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-all duration-300 text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <FileText size={20} className="text-green-600" />
                <span className="font-semibold text-green-800">Fetch State Legislation</span>
              </div>
              <p className="text-sm text-green-700">
                Visit any state page to fetch legislation data
              </p>
            </button>
            
            <button
              onClick={() => window.location.href = '/'}
              className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition-all duration-300 text-left"
            >
              <div className="flex items-center gap-3 mb-2">
                <Star size={20} className="text-yellow-600" />
                <span className="font-semibold text-yellow-800">View Highlights</span>
              </div>
              <p className="text-sm text-yellow-700">
                See all your starred items in one place
              </p>
            </button>
            
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <div className="flex items-center gap-3 mb-2">
                <Settings size={20} className="text-purple-600" />
                <span className="font-semibold text-purple-800">Current Page</span>
              </div>
              <p className="text-sm text-purple-700">
                You're already in Settings!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

  
// StatePage Component with Contract Control
// This is a clean version to replace your existing StatePage component

const StatePage = ({ stateName }) => {
  const [stateOrders, setStateOrders] = useState([]);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState(null);
  const [stateSearchTerm, setStateSearchTerm] = useState('');
  const [stateActiveFilter, setStateActiveFilter] = useState(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // CONTRACT CONTROL STATES - DEFAULT CONTRACTED
  const [isFetchExpanded, setIsFetchExpanded] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [fetchMethod, setFetchMethod] = useState('search'); // 'search' or 'bulk'
  const [searchQuery, setSearchQuery] = useState('Education');
  const [fetchStatus, setFetchStatus] = useState(null);
  const [hasData, setHasData] = useState(false);
  
  const filterDropdownRef = useRef(null);
  const navigate = useNavigate();

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
      
      // Try both the abbreviation and full name
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
      
      // Transform the bills to match display format
      const transformedBills = (data.results || []).map(bill => ({
        id: bill.bill_id || `bill-${Math.random()}`,
        title: bill.title || 'Untitled Bill',
        status: bill.status || 'Active',
        category: bill.category || 'not-applicable',
        description: bill.description || bill.ai_summary || 'No description available',
        tags: [bill.category].filter(Boolean),
        summary: bill.ai_summary ? stripHtmlTags(bill.ai_summary) : 'No AI summary available',
        bill_number: bill.bill_number,
        state: bill.state,
        legiscan_url: bill.legiscan_url,
        ai_talking_points: bill.ai_talking_points,
        ai_business_impact: bill.ai_business_impact,
        ai_potential_impact: bill.ai_potential_impact,
        introduced_date: bill.introduced_date,
        last_action_date: bill.last_action_date
      }));
      
      console.log('🔍 Transformed bills:', transformedBills.length, 'bills');
      setStateOrders(transformedBills);
      setHasData(transformedBills.length > 0);
    } catch (error) {
      console.error('❌ Error fetching existing state legislation:', error);
      setStateError(error.message);
      setHasData(false);
    } finally {
      setStateLoading(false);
    }
  };

  // Fetch fresh data functions
  const handleFetchBySearch = async () => {
    if (fetchingData) return;
    
    setFetchingData(true);
    setFetchStatus('🔍 Searching and analyzing legislation...');
    
    try {
      const stateAbbr = SUPPORTED_STATES[stateName];
      const response = await fetch(`${API_URL}/api/legiscan/search-and-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          state: stateAbbr,
          limit: 15,
          save_to_db: true
        })
      });
      
      const data = await response.json();
      
      if (data.success !== false) {
        setFetchStatus(`✅ Successfully found and analyzed ${data.bills_analyzed || 0} bills! Refreshing data...`);
        // Refresh the data with longer delay and multiple attempts
        setTimeout(() => {
          fetchExistingData();
        }, 3000);
        setTimeout(() => {
          fetchExistingData();
        }, 6000);
      } else {
        setFetchStatus(`❌ Error: ${data.message || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Error fetching by search:', error);
      setFetchStatus(`❌ Error: ${error.message}`);
    } finally {
      setFetchingData(false);
      // Clear status after delay
      setTimeout(() => setFetchStatus(null), 8000);
    }
  };

  const handleFetchBulk = async () => {
    if (fetchingData) return;
    
    setFetchingData(true);
    setFetchStatus('📋 Fetching latest bills for this state...');
    
    try {
      const response = await fetch(`${API_URL}/api/state-legislation/fetch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          states: [stateName],
          bills_per_state: 25,
          save_to_db: true
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setFetchStatus(`✅ Successfully fetched ${data.bills_fetched || 0} bills! Refreshing data...`);
        // Refresh the data with longer delay and multiple attempts
        setTimeout(() => {
          fetchExistingData();
        }, 3000);
        setTimeout(() => {
          fetchExistingData();
        }, 6000);
      } else {
        setFetchStatus(`❌ Error: ${data.message || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Error fetching bulk data:', error);
      setFetchStatus(`❌ Error: ${error.message}`);
    } finally {
      setFetchingData(false);
      // Clear status after delay
      setTimeout(() => setFetchStatus(null), 8000);
    }
  };

  // Filter the orders based on search and filter
  const filteredStateOrders = useMemo(() => {
    let filtered = stateOrders;
    
    // Apply category filter
    if (stateActiveFilter) {
      filtered = filtered.filter(bill => bill.category === stateActiveFilter);
    }
    
    // Apply search filter
    if (stateSearchTerm.trim()) {
      const search = stateSearchTerm.toLowerCase().trim();
      filtered = filtered.filter(bill => {
        const title = (bill.title || '').toLowerCase();
        const description = (bill.description || '').toLowerCase();
        const summary = (bill.summary || '').toLowerCase();
        const billNumber = (bill.bill_number || '').toString().toLowerCase();
        
        return title.includes(search) || 
               description.includes(search) || 
               summary.includes(search) || 
               billNumber.includes(search);
      });
    }
    
    return filtered;
  }, [stateOrders, stateActiveFilter, stateSearchTerm]);

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
      {/* Page Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">{stateName} Legislation</h2>
        <p className="text-gray-600">Explore and fetch legislation for {stateName} with AI analysis.</p>
      </div>

      {/* Search Bar and Filter */}
      <div className="mb-8">
        <div className="flex gap-4 items-center">
          {/* Filter Dropdown */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 transition-all duration-300 w-48"
            >
              <div className="flex items-center gap-2">
                {stateActiveFilter && (
                  (() => {
                    const selectedFilter = FILTERS.find(f => f.key === stateActiveFilter);
                    if (selectedFilter) {
                      const IconComponent = selectedFilter.icon;
                      return (
                        <IconComponent 
                          size={16} 
                          className={
                            selectedFilter.key === 'civic' ? 'text-blue-600' :
                            selectedFilter.key === 'education' ? 'text-yellow-600' :
                            selectedFilter.key === 'healthcare' ? 'text-red-600' :
                            selectedFilter.key === 'engineering' ? 'text-green-600' :
                            'text-gray-600'
                          }
                        />
                      );
                    }
                    return null;
                  })()
                )}
                <span className="truncate">
                  {stateActiveFilter 
                    ? FILTERS.find(f => f.key === stateActiveFilter)?.label || 'Filter'
                    : 'Filter'
                  }
                </span>
              </div>
              <ChevronDown 
                size={16} 
                className={`transition-transform duration-200 flex-shrink-0 ${showFilterDropdown ? 'rotate-180' : ''}`}
              />
            </button>

            {showFilterDropdown && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                <button
                  onClick={() => {
                    setStateActiveFilter(null);
                    setShowFilterDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 ${
                    !stateActiveFilter
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  All Categories
                </button>
                {FILTERS.map(filter => {
                  const IconComponent = filter.icon;
                  const isActive = stateActiveFilter === filter.key;
                  return (
                    <button
                      key={filter.key}
                      onClick={() => {
                        setStateActiveFilter(filter.key);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center gap-3 ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <IconComponent 
                        size={16} 
                        className={
                          filter.key === 'civic' ? 'text-blue-600' :
                          filter.key === 'education' ? 'text-yellow-600' :
                          filter.key === 'healthcare' ? 'text-red-600' :
                          filter.key === 'engineering' ? 'text-green-600' :
                          'text-gray-600'
                        }
                      />
                      <span>{filter.label}</span>
                    </button>
                  );
                })}
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
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
          </div>

          {/* Clear Filters Button */}
          {(stateActiveFilter || stateSearchTerm) && (
            <button
              onClick={() => {
                setStateActiveFilter(null);
                setStateSearchTerm('');
              }}
              className="px-4 py-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all duration-300 flex-shrink-0"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* CONTRACTED Fetch Data Section */}
      <div className="mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {/* Fetch Header - Collapsible */}
          <div 
            className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors duration-200"
            onClick={() => setIsFetchExpanded(!isFetchExpanded)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download size={20} className="text-blue-600" />
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Fetch Fresh Data</h3>
                  <p className="text-sm text-gray-600">
                    {isFetchExpanded ? `Click to collapse fetch controls for ${stateName}` : `Click to expand fetch controls for ${stateName}`}
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
                  <RefreshIcon size={16} className="animate-spin text-blue-600" />
                )}
                <ChevronDown 
                  size={20} 
                  className={`text-gray-500 transition-transform duration-200 ${isFetchExpanded ? 'rotate-180' : ''}`}
                />
              </div>
            </div>
          </div>

          {/* Expandable Content */}
          {isFetchExpanded && (
            <div className="p-6">
              {/* Fetch Method Selection */}
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-700 mb-3">Choose fetch method:</p>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="fetchMethod"
                      value="search"
                      checked={fetchMethod === 'search'}
                      onChange={(e) => setFetchMethod(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">Search by Topic</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="fetchMethod"
                      value="bulk"
                      checked={fetchMethod === 'bulk'}
                      onChange={(e) => setFetchMethod(e.target.value)}
                      className="mr-2"
                    />
                    <span className="text-sm">Latest Bills (Bulk)</span>
                  </label>
                </div>
              </div>

              {/* Search Method Options */}
              {fetchMethod === 'search' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Topic</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  >
                    <option value="education">Education</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    This will search for {searchQuery} related bills in {stateName} and analyze them with AI. This may take a few minutes to complete.
                  </p>
                </div>
              )}

              {/* Bulk Method Info */}
              {fetchMethod === 'bulk' && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-sm text-green-800">
                    This will fetch the latest 25 bills from {stateName} and analyze them with AI. 
                    This may take a few minutes to complete.
                  </p>
                </div>
              )}

              {/* Fetch Status - Expanded View */}
              {fetchStatus && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                  <p className="text-green-800 text-sm font-medium">{fetchStatus}</p>
                </div>
              )}

              {/* Fetch Button */}
              <button
                onClick={fetchMethod === 'search' ? handleFetchBySearch : handleFetchBulk}
                disabled={fetchingData}
                className={`w-full px-6 py-3 rounded-md font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  fetchingData
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg'
                }`}
              >
                {fetchingData ? (
                  <>
                    <RefreshIcon size={20} className="animate-spin" />
                    <span>Fetching & Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Download size={20} />
                    <span>
                      {fetchMethod === 'search' 
                        ? `Search ${searchQuery} Bills` 
                        : `Fetch Latest Bills`
                      }
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Results Section */}
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
            ) : filteredStateOrders.length > 0 ? (
              <div className="space-y-6">

                {filteredStateOrders.map((bill, index) => (
                  <div key={bill.id || index} className="bg-gray-50 border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow duration-300">
                    {/* Bill Header */}
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="text-lg font-semibold text-gray-900 pr-4">{bill.title}</h3>
                      <button 
                        className="text-gray-400 hover:text-yellow-500 transition-colors duration-300 flex-shrink-0"
                        onClick={() => {
                          // Add highlight functionality here if needed
                          console.log('Highlight bill:', bill.id);
                        }}
                      >
                        <Star size={20} />
                      </button>
                    </div>

                    {/* Bill Number and Dates */}
                    {bill.bill_number && (
                      <div className="mb-3">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-200 text-gray-800">
                          Bill #{bill.bill_number}
                        </span>
                        {bill.introduced_date && (
                          <span className="ml-2 text-xs text-gray-600">
                            Introduced: {new Date(bill.introduced_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Status and Category */}
                    <div className="flex items-center gap-4 mb-3">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {bill.status}
                      </span>
                      <CategoryTag category={bill.category} />
                    </div>

                    {/* AI Summary */}
                    {bill.summary && (
                      <div className="mb-4 p-3 bg-violet-50 border border-violet-200 rounded-md">
                        <p className="text-sm font-medium text-violet-800 mb-2 flex items-center gap-2">
                          <span>AI Summary:</span>
                          <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-xs rounded-full">
                            ✦ AI Generated
                          </span>
                        </p>
                        <p className="text-sm text-violet-800 leading-relaxed">{bill.summary}</p>
                      </div>
                    )}

                    {/* Description */}
                    <p className="text-gray-700 mb-4">{bill.description}</p>

                    {/* Action Buttons */}
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
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-all duration-300"
                        onClick={() => {
                          // Add copy functionality here if needed
                          console.log('Copy bill details:', bill.id);
                        }}
                      >
                        <Copy size={16} />
                        <span>Copy Details</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : hasData ? (
              <div className="text-center py-12">
                <Search size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">No Results Found</h3>
                <p className="text-gray-600 mb-4">
                  No bills match your current search criteria.
                </p>
                <button
                  onClick={() => {
                    setStateActiveFilter(null);
                    setStateSearchTerm('');
                  }}
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
                  No legislation data is currently available for {stateName}. Use the fetch options above to get the latest bills.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

  // ------------------------
  // MAIN ROUTES RENDER
  // ------------------------
  return (
    <>
      {/* Loading Animation Overlay */}
      {LoadingComponent}
      
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header
          showDropdown={showDropdown}
          setShowDropdown={setShowDropdown}
          dropdownRef={dropdownRef}
          currentPage={location.pathname.substring(1).split('/')[0] || 'highlights'}
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
              />
            } />
            
            <Route path="/executive-orders" element={
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
              />
            } />
            
            <Route path="/settings" element={
              <SettingsPage
                federalDateRange={federalDateRange}
                setFederalDateRange={setFederalDateRange}
              />
            } />

            {/* Dynamic State Routes */}
            {Object.keys(SUPPORTED_STATES).map(state => (
              <Route 
                key={state}
                path={`/state/${state.toLowerCase().replace(' ', '-')}`} 
                element={<StatePage stateName={state} />} 
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