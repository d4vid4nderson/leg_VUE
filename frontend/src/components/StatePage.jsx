// Updated StatePage.jsx with expand/collapse functionality for AI content

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
  RotateCw as RefreshIcon
} from 'lucide-react';

import { FILTERS, SUPPORTED_STATES } from '../utils/constants';
import { 
  getApiUrl,
  stripHtmlTags,
  generateUniqueId
} from '../utils/helpers';
import { CategoryTag } from './CommonComponents';

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

const StatePage = ({ stateName, stableHandlers, copyToClipboard, makeApiCall }) => {
  // Core state
  const [stateOrders, setStateOrders] = useState([]);
  const [stateLoading, setStateLoading] = useState(false);
  const [stateError, setStateError] = useState(null);
  const [stateSearchTerm, setStateSearchTerm] = useState('');
  
  // Filter state
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Review status state
  const [reviewedBills, setReviewedBills] = useState(new Set());
  const [markingReviewed, setMarkingReviewed] = useState(new Set());
  
  // Highlights state - Local state for immediate UI feedback
  const [localHighlights, setLocalHighlights] = useState(new Set());
  const [highlightLoading, setHighlightLoading] = useState(new Set());
  
  // ADDED: Expanded bills state for showing AI content
  const [expandedBills, setExpandedBills] = useState(new Set());
  
  // UI state
  const [isFetchExpanded, setIsFetchExpanded] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);
  const [fetchStatus, setFetchStatus] = useState(null);
  const [hasData, setHasData] = useState(false);
  
  // Track the last fetched category for styling
  const [lastFetchedCategory, setLastFetchedCategory] = useState('civic');
  
  const filterDropdownRef = useRef(null);

  // ADDED: Function to capitalize first letter of text
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
  const getStateBillId = useCallback((bill) => {
    if (!bill) return null;
    
    // Priority order for ID selection to ensure consistency
    if (bill.bill_id && typeof bill.bill_id === 'string') return bill.bill_id;
    if (bill.id && typeof bill.id === 'string') return bill.id;
    if (bill.bill_number) return `${bill.state || stateName || 'unknown'}-bill-${bill.bill_number}`;
    
    // Fallback using title hash for consistency
    if (bill.title) {
      const titleHash = bill.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
      return `state-bill-${titleHash}`;
    }
    
    // Last resort
    return `state-bill-${Math.random().toString(36).substr(2, 9)}`;
  }, [stateName]);

  // ADDED: Expand/collapse functions for AI content
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

  // ADDED: AI content formatting functions (similar to ExecutiveOrdersPage)
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
    'Summary'  // Added Summary to be treated as a section header
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
        
        // Split content into items if it contains multiple sentences or bullet indicators
        const items = [];
        
        // Check if content has bullet-like patterns
        if (content.includes('•') || content.includes('-') || content.includes('*')) {
          const contentLines = content
            .split(/[•\-*]\s*/)
            .map(line => line.trim())
            .filter(line => line.length > 3);
          
          contentLines.forEach(line => {
            const cleanLine = capitalizeFirstLetter(line.replace(/\.$/, ''));
            if (cleanLine.length > 5) {
              items.push(cleanLine);
            }
          });
        } else {
          // Treat as single content block
          const cleanContent = capitalizeFirstLetter(content.replace(/\.$/, ''));
          if (cleanContent.length > 5) {
            items.push(cleanContent);
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
                  marginBottom: '4px',
                  fontSize: '14px',
                  lineHeight: '1.5',
                  color: 'inherit',
                  paddingLeft: '0px' // No bullet point for single content blocks
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
  
  // Fallback to original section-based parsing
  const parts = textContent.split(headerPattern);
  
  if (parts.length > 1) {
    const sections = [];
    
    // Process parts: odd indices are headers, even indices are content
    for (let i = 1; i < parts.length; i += 2) {
      const header = parts[i];
      const content = parts[i + 1] || '';
      
      if (header && header.trim()) {
        // Clean up the header - remove asterisks and ensure colon
        let cleanHeader = header.trim().replace(/^\*+|\*+$/g, '');
        if (!cleanHeader.endsWith(':')) {
          cleanHeader += ':';
        }
        
        // Parse the content into bullet points
        const items = [];
        if (content.trim()) {
          // Split content by bullet indicators and clean up
          const contentLines = content
            .split(/[•\-*]\s*/)
            .map(line => line.trim())
            .filter(line => line.length > 3);
          
          contentLines.forEach(line => {
            // Remove any section headers that got mixed in
            const isNotHeader = !sectionKeywords.some(keyword => 
              line.toLowerCase().includes(keyword.toLowerCase()) && line.includes(':')
            );
            
            if (isNotHeader && line.length > 5) {
              // Clean up any remaining asterisks that aren't meant for bold formatting
              let cleanLine = line;
              
              // If the line starts with a potential header keyword followed by colon, skip it
              if (!/^(Risk Assessment|Market Opportunity|Implementation Requirements|Financial Implications|Competitive Implications|Timeline Pressures|Summary):/i.test(cleanLine)) {
                // Capitalize the first letter of the bullet point
                cleanLine = capitalizeFirstLetter(cleanLine);
                items.push(cleanLine);
              }
            }
          });
        }
        
        if (items.length > 0) {
          sections.push({
            title: cleanHeader,
            items: items
          });
        }
      }
    }
    
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
              {section.items.map((item, itemIdx) => {
                // Check if the item has bold formatting (preserve legitimate asterisks)
                const hasBoldParts = item.includes('*') && item.match(/\*[^*]+\*/);
                
                if (hasBoldParts) {
                  const parts = item.split(/(\*[^*]+\*)/);
                  return (
                    <div key={itemIdx} style={{ 
                      marginBottom: '4px',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      color: 'inherit'
                    }}>
                      • {parts.map((part, partIdx) => {
                        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
                          return (
                            <strong key={partIdx} style={{ fontWeight: 'bold' }}>
                              {part.slice(1, -1)}
                            </strong>
                          );
                        } else {
                          return part;
                        }
                      })}
                    </div>
                  );
                } else {
                  return (
                    <div key={itemIdx} style={{ 
                      marginBottom: '4px',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      color: 'inherit'
                    }}>
                      • {item}
                    </div>
                  );
                }
              })}
            </div>
          ))}
        </div>
      );
    }
  }

  // Final fallback: simple bullet list
  const sentences = textContent
    .split(/[.!?]\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
  
  if (sentences.length > 1) {
    return (
      <div>
        {sentences.map((sentence, idx) => (
          <div key={idx} style={{ 
            marginBottom: '4px',
            fontSize: '14px',
            lineHeight: '1.5',
            color: 'inherit'
          }}>
            • {sentence.replace(/^[•\-*]\s*/, '')}
          </div>
        ))}
      </div>
    );
  }

  return <div className="universal-text-content">{textContent}</div>;
};

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
    setStateSearchTerm('');
  };

  // Load existing highlights on component mount
  useEffect(() => {
    const loadExistingHighlights = async () => {
      try {
        const response = await fetch(`${API_URL}/api/highlights?user_id=1`);
        if (response.ok) {
          const highlights = await response.json();
          const stateBillIds = new Set();
          
          highlights.forEach(highlight => {
            // Check if this highlight matches any of our state bills
            if (highlight.order_type === 'state_legislation') {
              stateBillIds.add(highlight.order_id);
            }
          });
          
          setLocalHighlights(stateBillIds);
          console.log('🌟 Loaded existing highlights:', stateBillIds);
        }
      } catch (error) {
        console.error('Error loading existing highlights:', error);
      }
    };
    
    if (stateName && stateOrders.length > 0) {
      loadExistingHighlights();
    }
  }, [stateName, stateOrders.length]);

  // Load/save reviewed bills from localStorage
  useEffect(() => {
    try {
      const savedReviewed = localStorage.getItem('reviewedStateBills');
      if (savedReviewed) {
        setReviewedBills(new Set(JSON.parse(savedReviewed)));
      }
    } catch (error) {
      console.error('Error loading reviewed bills:', error);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('reviewedStateBills', JSON.stringify([...reviewedBills]));
    } catch (error) {
      console.error('Error saving reviewed bills:', error);
    }
  }, [reviewedBills]);

  // Toggle review status function
  const handleToggleReviewStatus = async (bill) => {
    const billId = getStateBillId(bill);
    if (!billId) return;
    
    const isCurrentlyReviewed = reviewedBills.has(billId);
    setMarkingReviewed(prev => new Set([...prev, billId]));
    
    try {
      await new Promise(resolve => setTimeout(resolve, 300));
      
      if (isCurrentlyReviewed) {
        setReviewedBills(prev => {
          const newSet = new Set(prev);
          newSet.delete(billId);
          return newSet;
        });
      } else {
        setReviewedBills(prev => new Set([...prev, billId]));
      }
      
    } catch (error) {
      console.error('Error toggling review status:', error);
    } finally {
      setMarkingReviewed(prev => {
        const newSet = new Set(prev);
        newSet.delete(billId);
        return newSet;
      });
    }
  };

  // Enhanced highlighting function with improved error handling and debugging
  const handleStateBillHighlight = useCallback(async (bill) => {
    console.log('🌟 StatePage highlight handler called for:', bill.title);
    
    const billId = getStateBillId(bill);
    if (!billId) {
      console.error('❌ No valid bill ID found for highlighting');
      return;
    }
    
    const isCurrentlyHighlighted = localHighlights.has(billId);
    console.log('🌟 Current highlight status:', isCurrentlyHighlighted, 'Bill ID:', billId);
    console.log('🌟 Current localHighlights set:', Array.from(localHighlights));
    
    // Add to loading state
    setHighlightLoading(prev => new Set([...prev, billId]));
    
    try {
      if (isCurrentlyHighlighted) {
        // REMOVE highlight
        console.log('🗑️ Attempting to remove highlight for:', billId);
        
        // Optimistic UI update - remove from local state immediately
        setLocalHighlights(prev => {
          const newSet = new Set(prev);
          const deleted = newSet.delete(billId);
          console.log('🔄 Optimistically removed from local state:', deleted, 'New size:', newSet.size);
          return newSet;
        });
        
        const response = await fetch(`${API_URL}/api/highlights/${billId}?user_id=1`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          console.error('❌ Failed to remove highlight from backend, status:', response.status);
          // Revert optimistic update on error - add back to local state
          setLocalHighlights(prev => {
            console.log('🔄 Reverting optimistic update - adding back to local state');
            return new Set([...prev, billId]);
          });
        } else {
          console.log('✅ Successfully removed highlight from backend');
          // Also call the stable handler to sync global state
          if (stableHandlers?.handleItemHighlight) {
            stableHandlers.handleItemHighlight(bill, 'state-legislation');
          }
        }
      } else {
        // ADD highlight
        console.log('⭐ Attempting to add highlight for:', billId);
        
        // Optimistic UI update - add to local state immediately
        setLocalHighlights(prev => {
          const newSet = new Set([...prev, billId]);
          console.log('🔄 Optimistically added to local state, New size:', newSet.size);
          return newSet;
        });
        
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
          const errorData = await response.json();
          console.error('❌ Failed to add highlight, status:', response.status, 'Error:', errorData);
          if (response.status !== 409) { // 409 means already exists, which is fine
            // Revert optimistic update on error - remove from local state
            setLocalHighlights(prev => {
              const newSet = new Set(prev);
              const deleted = newSet.delete(billId);
              console.log('🔄 Reverting optimistic update - removed from local state:', deleted);
              return newSet;
            });
          } else {
            console.log('ℹ️ Highlight already exists in backend (409 conflict)');
          }
        } else {
          console.log('✅ Successfully added highlight to backend');
          // Also call the stable handler to sync global state
          if (stableHandlers?.handleItemHighlight) {
            stableHandlers.handleItemHighlight(bill, 'state-legislation');
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error managing highlight:', error);
      // Revert optimistic update on error
      if (isCurrentlyHighlighted) {
        // Was trying to remove, add it back
        setLocalHighlights(prev => {
          console.log('🔄 Error recovery - adding back to local state');
          return new Set([...prev, billId]);
        });
      } else {
        // Was trying to add, remove it
        setLocalHighlights(prev => {
          const newSet = new Set(prev);
          const deleted = newSet.delete(billId);
          console.log('🔄 Error recovery - removed from local state:', deleted);
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
      
      // Debug final state
      console.log('🏁 Final highlight operation completed for:', billId);
    }
  }, [localHighlights, getStateBillId, stableHandlers]);

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

  // Count functions for filter display
  const reviewCounts = useMemo(() => {
    const total = stateOrders.length || 0;
    const reviewed = stateOrders.filter(bill => reviewedBills.has(getStateBillId(bill))).length;
    const notReviewed = total - reviewed;
    return { total, reviewed, notReviewed };
  }, [stateOrders, reviewedBills, getStateBillId]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    FILTERS.forEach(filter => {
      counts[filter.key] = stateOrders.filter(bill => bill?.category === filter.key).length;
    });
    return counts;
  }, [stateOrders]);

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
      
      // Transform bills with enhanced compatibility
      const transformedBills = results.map((bill, index) => {
        const uniqueId = getStateBillId(bill) || `fallback-${index}`;
        
        return {
          // Core identification
          id: uniqueId,
          bill_id: uniqueId,
          
          // Standard bill fields
          title: bill?.title || 'Untitled Bill',
          status: bill?.status || 'Active',
          category: bill?.category || 'not-applicable',
          description: bill?.description || bill?.ai_summary || 'No description available',
          tags: [bill?.category].filter(Boolean),
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
          limit: 15,
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
          fetchExistingData();
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

  // Filter the orders with multiple filter support
  const filteredStateOrders = useMemo(() => {
    if (!Array.isArray(stateOrders)) {
      return [];
    }

    let filtered = stateOrders;
    
    // Apply category filters
    const categoryFilters = selectedFilters.filter(f => !['reviewed', 'not_reviewed'].includes(f));
    if (categoryFilters.length > 0) {
      filtered = filtered.filter(bill => categoryFilters.includes(bill?.category));
    }

    // Apply review status filters
    const hasReviewedFilter = selectedFilters.includes('reviewed');
    const hasNotReviewedFilter = selectedFilters.includes('not_reviewed');
    
    if (hasReviewedFilter && hasNotReviewedFilter) {
      // Both selected, show all
    } else if (hasReviewedFilter) {
      filtered = filtered.filter(bill => reviewedBills.has(getStateBillId(bill)));
    } else if (hasNotReviewedFilter) {
      filtered = filtered.filter(bill => !reviewedBills.has(getStateBillId(bill)));
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
    
    return filtered;
  }, [stateOrders, selectedFilters, reviewedBills, stateSearchTerm, getStateBillId]);

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
              placeholder={`Search ${stateName} legislation...`}
              value={stateSearchTerm}
              onChange={(e) => setStateSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
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
            ) : filteredStateOrders.length > 0 ? (
              <div className="space-y-6">
                {filteredStateOrders.map((bill, index) => {
                  if (!bill || typeof bill !== 'object') {
                    console.warn('Invalid bill data at index', index, bill);
                    return null;
                  }

                  const billId = getStateBillId(bill);
                  const isReviewed = reviewedBills.has(billId);
                  const isExpanded = isBillExpanded(bill);

                  return (
                    <div key={bill.id || index} className={`bg-white rounded-lg shadow-sm border overflow-hidden transition-all duration-300 ${
                      isReviewed ? 'border-green-200 bg-green-50' : 'border-gray-200'
                    }`}>
                      {/* Bill Header */}
                      <div className="flex items-start justify-between px-6 pt-6 pb-3">
                        <div 
                          className="flex-1 pr-4 cursor-pointer hover:bg-gray-50 transition-all duration-300 rounded-md p-2 -ml-2 -mt-2 -mb-1"
                          onClick={() => toggleBillExpansion(bill)}
                        >
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">
                            {index + 1}. {cleanBillTitle(bill.title)}
                          </h3>
                          
                          {/* Bill Number and Dates */}
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mb-3">
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
                              {bill.status || 'Unknown Status'}
                            </span>
                            <span>-</span>
                            <CategoryTag category={bill.category} />
                            <span>-</span>
                            <ReviewStatusTag isReviewed={isReviewed} />
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {/* Toggle Review Status Button */}
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleToggleReviewStatus(bill);
                            }}
                            disabled={markingReviewed.has(billId)}
                            className={`p-2 rounded-md transition-all duration-300 ${
                              markingReviewed.has(billId)
                                ? 'text-gray-500 cursor-not-allowed'
                                : isReviewed
                                ? 'text-green-600 bg-green-100 hover:bg-green-200'
                                : 'text-gray-400 hover:bg-green-100 hover:text-green-600'
                            }`}
                            title={isReviewed ? "Mark as not reviewed" : "Mark as reviewed"}
                          >
                            {markingReviewed.has(billId) ? (
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

                          {/* ADDED: Expand/Collapse Button */}
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
                    {bill.summary && bill.summary !== 'No AI summary available' && (
                      <div className="mb-4 mt-4 mx-6">
                        <div className="bg-purple-50 p-4 rounded-md border border-purple-200">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-purple-800">Azure AI Executive Summary</h4>
                            <span className="text-purple-800">-</span>
                            <span className="inline-flex items-center justify-center px-2 py-1 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[11px] rounded-full leading-tight">
                              ✦ AI Generated
                            </span>
                          </div>
                          <p className="text-sm text-violet-800 leading-relaxed">{bill.summary}</p>
                        </div>
                      </div>
                    )}

                    {/* Description - Always show */}
                    <div className="px-6 pb-4">
                      <p className="text-gray-700">{bill.description || 'No description available'}</p>
                    </div>

                    {/* ADDED: Expanded AI Content Section */}
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
        </div>
      </div>

      {/* Universal CSS Styles - Same as ExecutiveOrdersPage */}
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

        .text-violet-800 .universal-ai-content,
        .text-violet-800 .universal-structured-content,
        .text-violet-800 .universal-text-content,
        .text-violet-800 .number-bullet,
        .text-violet-800 .numbered-text,
        .text-violet-800 .bullet-point,
        .text-violet-800 .bullet-text {
          color: #5b21b6;
        }
      `}</style>
    </div>
  );
};

export default StatePage;