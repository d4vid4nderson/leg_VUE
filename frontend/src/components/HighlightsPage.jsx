import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  Copy,
  ExternalLink,
  FileText,
  ScrollText,
  RefreshCw,
  ChevronDown,
  RotateCw,
  Building,
  GraduationCap,
  HeartPulse,
  Wrench,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  ArrowUp as ArrowUpIcon,
  Check,
  LayoutGrid,
  AlertTriangle,
  MapPin,
  Hash,
  Target,        // For talking points icon
  TrendingUp,    // For business impact icon
  Sparkles,      // For AI Generated badges
  Calendar,      // For date icon
  MoreVertical   // For mobile menu
} from 'lucide-react';
import { FILTERS } from '../utils/constants';
import API_URL from '../config/api';
import ShimmerLoader from '../components/ShimmerLoader';
import HighlightCardSkeleton from '../components/HighlightCardSkeleton';

// =====================================
// DEBUG FUNCTION FOR STATE LEGISLATION
// =====================================
const debugStateLegislationMapping = (bill, index) => {
  console.log(`🔍 State Bill Debug #${index}:`, {
    raw_bill: bill,
    bill_fields: Object.keys(bill),
    
    // ID generation options
    bill_id: bill.bill_id,
    id: bill.id,
    bill_number: bill.bill_number,
    state: bill.state,
    title: bill.title,
    
    // Generated IDs using different methods
    generated_id_method1: bill.bill_id && typeof bill.bill_id === 'string' ? bill.bill_id : null,
    generated_id_method2: bill.id && typeof bill.id === 'string' ? bill.id : null,
    generated_id_method3: bill.bill_number && bill.state ? `${bill.state}-${bill.bill_number}` : null,
    generated_id_method4: bill.bill_number ? `${bill.state || 'unknown'}-${bill.bill_number}` : null,
    
    // AI field mappings
    ai_summary_options: {
      ai_summary: bill.ai_summary,
      ai_executive_summary: bill.ai_executive_summary
    },
    ai_talking_points_options: {
      ai_talking_points: bill.ai_talking_points,
      ai_key_points: bill.ai_key_points
    },
    ai_business_impact_options: {
      ai_business_impact: bill.ai_business_impact,
      ai_potential_impact: bill.ai_potential_impact
    }
  });
};

// =====================================
// FILTER DROPDOWN COMPONENT
// =====================================
const FilterDropdown = React.forwardRef(({ 
  selectedFilters, 
  showFilterDropdown, 
  onToggleDropdown, 
  onToggleFilter, 
  onClearAllFilters, 
  counts,
  showContentTypes = false
}, ref) => {
  // Category filters
  const CATEGORY_FILTERS = FILTERS.filter(filter => 
    ['civic', 'education', 'engineering', 'healthcare'].includes(filter.key)
  );

  // Extended filters for content types
  const EXTENDED_FILTERS = showContentTypes ? [
    ...CATEGORY_FILTERS,
    {
      key: 'executive_order',
      label: 'Executive Orders',
      icon: ScrollText,
      type: 'order_type'
    },
    {
      key: 'state_legislation',
      label: 'State Legislation',
      icon: FileText,
      type: 'order_type'
    }
  ] : CATEGORY_FILTERS;

  return (
    <div className="relative" ref={ref}>
      {/* Filter Button */}
      <button
        type="button"
        onClick={onToggleDropdown}
        className={`flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium transition-all duration-300 ${
          selectedFilters.length > 0
            ? 'bg-blue-100 text-blue-700 border-blue-300'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        <span>Filter Highlights</span>
        {selectedFilters.length > 0 && (
          <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
            {selectedFilters.length}
          </span>
        )}
        <ChevronDown 
          size={16} 
          className={`transition-transform duration-200 ${showFilterDropdown ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown Menu - Right aligned to open leftward */}
      {showFilterDropdown && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[120] min-w-[280px] max-w-[320px]">
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-800">Filter Options</h3>
              {selectedFilters.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAllFilters}
                  className="text-sm text-red-600 hover:text-red-700 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>

            {/* Practice Areas Section */}
            <div className="mb-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Practice Areas</h4>
              <div className="space-y-0.5">

                {/* Individual Categories */}
                {CATEGORY_FILTERS.map((filter) => {
                  const IconComponent = filter.icon;
                  const isActive = selectedFilters.includes(filter.key);
                  const count = counts?.[filter.key] || 0;
                  
                  // Get category-specific colors to match the category tags
                  const getCategoryColors = (categoryKey) => {
                    const colorMap = {
                      civic: {
                        bg: 'bg-blue-100',
                        text: 'text-blue-700',
                        icon: 'text-blue-600',
                        count: 'bg-blue-200 text-blue-700'
                      },
                      education: {
                        bg: 'bg-orange-100',
                        text: 'text-orange-700',
                        icon: 'text-orange-600',
                        count: 'bg-orange-200 text-orange-700'
                      },
                      engineering: {
                        bg: 'bg-green-100',
                        text: 'text-green-700',
                        icon: 'text-green-600',
                        count: 'bg-green-200 text-green-700'
                      },
                      healthcare: {
                        bg: 'bg-red-100',
                        text: 'text-red-700',
                        icon: 'text-red-600',
                        count: 'bg-red-200 text-red-700'
                      }
                    };
                    return colorMap[categoryKey] || {
                      bg: 'bg-gray-100',
                      text: 'text-gray-700',
                      icon: 'text-gray-600',
                      count: 'bg-gray-200 text-gray-700'
                    };
                  };
                  
                  const colors = getCategoryColors(filter.key);
                  
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => onToggleFilter(filter.key)}
                      className={`w-full flex items-center justify-between px-2 py-1 rounded-md transition-all duration-200 ${
                        isActive 
                          ? `${colors.bg} ${colors.text}` 
                          : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <IconComponent 
                          size={16} 
                          className={isActive ? colors.icon : 'text-gray-500'} 
                        />
                        <span className="text-sm">{filter.label}</span>
                      </div>
                      <span className="text-xs text-gray-500">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Content Types Section (if enabled) */}
            {showContentTypes && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Content Types</h4>
                <div className="space-y-0.5">
                  {/* Executive Orders Filter */}
                  <button
                    type="button"
                    onClick={() => onToggleFilter('executive_order')}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded-md transition-all duration-200 ${
                      selectedFilters.includes('executive_order')
                        ? 'bg-blue-100 text-blue-700' 
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ScrollText 
                        size={16} 
                        className={selectedFilters.includes('executive_order') ? 'text-blue-600' : 'text-gray-500'} 
                      />
                      <span className="text-sm">Executive Orders</span>
                    </div>
                    <span className="text-xs text-gray-500">({counts?.executive_order || 0})</span>
                  </button>

                  {/* State Legislation Filter */}
                  <button
                    type="button"
                    onClick={() => onToggleFilter('state_legislation')}
                    className={`w-full flex items-center justify-between px-2 py-1 rounded-md transition-all duration-200 ${
                      selectedFilters.includes('state_legislation')
                        ? 'bg-green-100 text-green-700' 
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FileText 
                        size={16} 
                        className={selectedFilters.includes('state_legislation') ? 'text-green-600' : 'text-gray-500'} 
                      />
                      <span className="text-sm">State Legislation</span>
                    </div>
                    <span className="text-xs text-gray-500">({counts?.state_legislation || 0})</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
});

// =====================================
// UTILITY FUNCTIONS
// =====================================
const getExecutiveOrderNumber = (order) => {
  // FIXED: Prioritize the actual EO number field over document numbers
  if (order.id && /^\d{4,5}$/.test(order.id.toString())) {
    return order.id; // This contains the actual EO number like "14147"
  }
  
  // Check other fields for traditional EO numbers
  const fieldsToCheck = [
    order.bill_id,
    order.executive_order_number,
    order.eo_number
  ];
  
  for (const field of fieldsToCheck) {
    if (field && /^\d{4,5}$/.test(field.toString())) {
      return field;
    }
  }
  
  // Fallback to document number only if no EO number found
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

// FIXED: Executive Order ID generation (consistent with backend)
const getExecutiveOrderId = (order) => {
  if (!order) return null;
  
  // Look for traditional 4-5 digit EO numbers in priority order
  const fieldsToCheck = [
    order.executive_order_number,
    order.eo_number,
    order.id,
    order.bill_id,
    order.document_number
  ];
  
  for (const field of fieldsToCheck) {
    if (field && /^\d{4,5}$/.test(field.toString())) {
      // Found a traditional EO number like "14147" - return as-is
      return field.toString();
    }
  }
  
  return null;
};

// FIXED: State Legislation ID generation (consistent with StatePage)
const getStateLegislationId = (order) => {
  if (!order) return null;
  
  console.log('🔍 getStateLegislationId called with:', {
    bill_id: order.bill_id,
    id: order.id,
    bill_number: order.bill_number,
    state: order.state,
    title: order.title
  });
  
  // EXACT StatePage logic - Priority order for ID selection
  if (order.bill_id && typeof order.bill_id === 'string') {
    console.log(`✅ Using bill_id: ${order.bill_id}`);
    return order.bill_id;
  }
  if (order.id && typeof order.id === 'string') {
    console.log(`✅ Using id: ${order.id}`);
    return order.id;
  }
  if (order.bill_number && order.state) {
    const generatedId = `${order.state}-${order.bill_number}`;
    console.log(`✅ Using state-bill_number: ${generatedId}`);
    return generatedId;
  }
  if (order.bill_number) {
    const generatedId = `${order.state || 'unknown'}-${order.bill_number}`;
    console.log(`✅ Using fallback state-bill_number: ${generatedId}`);
    return generatedId;
  }
  
  // Fallback using title hash for consistency
  if (order.title) {
    const titleHash = order.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    const generatedId = `state-bill-${titleHash}`;
    console.log(`⚠️ Using title hash fallback: ${generatedId}`);
    return generatedId;
  }
  
  // Last resort
  const fallbackId = `state-bill-${Math.random().toString(36).substr(2, 9)}`;
  console.log(`❌ Using random fallback: ${fallbackId}`);
  return fallbackId;
};

// FIXED: Universal ID function with proper type detection
const getUniversalOrderId = (order) => {
  if (!order) return null;
  
  // Better order type detection
  const hasExecutiveOrderFields = !!(
    order.executive_order_number || 
    order.eo_number || 
    (order.order_type === 'executive_order') ||
    (order.document_number && !order.bill_number)
  );
  
  const hasStateLegislationFields = !!(
    order.bill_number || 
    (order.order_type === 'state_legislation') ||
    (order.bill_id && !hasExecutiveOrderFields)
  );
  
  if (hasExecutiveOrderFields) {
    return getExecutiveOrderId(order);
  } else if (hasStateLegislationFields) {
    return getStateLegislationId(order);
  }
  
  // Fallback - try to detect from available fields
  if (order.executive_order_number || order.eo_number) {
    return getExecutiveOrderId(order);
  } else if (order.bill_number || order.bill_id) {
    return getStateLegislationId(order);
  }
  
  return null;
};

// FIXED: Handle Backend ID Format Conversion with better debugging
const normalizeBackendId = (orderId, orderType) => {
  if (!orderId) return orderId;
  
  console.log('🔍 normalizeBackendId input:', { orderId, orderType });
  
  if (orderType === 'executive_order') {
    // For executive orders, we need to check what format the backend expects
    // Based on backend logs, it seems to expect just the number without eo- prefix
    let normalizedId = orderId;
    
    if (typeof orderId === 'string' && orderId.startsWith('eo-')) {
      normalizedId = orderId.replace('eo-', '');
    }
    
    console.log('🔍 normalizeBackendId output for executive_order:', normalizedId);
    return normalizedId.toString();
  }
  
  // For state legislation, use as-is
  console.log('🔍 normalizeBackendId output for state_legislation:', orderId.toString());
  return orderId.toString();
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

// Date sorting helper
const getDateForSorting = (item) => {
  if (item.order_type === 'executive_order') {
    return item.signing_date || 
           item.publication_date || 
           item.formatted_signing_date || 
           item.formatted_publication_date || 
           '1900-01-01';
  } else {
    return item.last_action_date || 
           item.introduced_date || 
           item.formatted_signing_date || 
           '1900-01-01';
  }
};

// Category Tag Component - Fixed to handle "all_practice_areas" with teal color and LayoutGrid icon
const CategoryTag = ({ category }) => {
  if (!category) return null;
  
  // Handle "all_practice_areas" specifically - use teal color and LayoutGrid icon
  if (category === 'all_practice_areas') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 text-xs font-medium rounded-md">
        <LayoutGrid size={12} />
        <span>All Practice Areas</span>
      </span>
    );
  }
  
  const filter = FILTERS.find(f => f.key === category);
  
  if (!filter) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 text-xs font-medium rounded-md">
        <FileText size={12} />
        <span>Unknown</span>
      </span>
    );
  }
  
  // Use exact same category styles as StatePage
  const getCategoryStyle = (categoryKey) => {
    const styles = {
      civic: 'bg-blue-100 text-blue-800 border-blue-200',
      education: 'bg-orange-100 text-orange-800 border-orange-200',
      engineering: 'bg-green-100 text-green-800 border-green-200',
      healthcare: 'bg-red-100 text-red-800 border-red-200',
      all_practice_areas: 'bg-teal-100 text-teal-800 border-teal-200'
    };
    return styles[categoryKey] || 'bg-gray-100 text-gray-800 border-gray-200';
  };
  
  const IconComponent = filter.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${getCategoryStyle(filter.key)}`}>
      <IconComponent size={12} />
      <span>{filter.label}</span>
    </span>
  );
};

// Order Type Tag Component
const OrderTypeTag = ({ orderType }) => {
  if (orderType === 'executive_order') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium rounded-md">
        <ScrollText size={12} />
        Executive Order
      </span>
    );
  }
  
  if (orderType === 'state_legislation') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 text-xs font-medium rounded-md">
        <FileText size={12} />
        State Legislation
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 text-gray-700 border border-gray-200 text-xs font-medium rounded-md">
      <FileText size={12} />
      Unknown Type
    </span>
  );
};

// State Tag Component
const StateTag = ({ state }) => {
  if (!state || state === 'Unknown') return null;
  
  const stateAbbreviations = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
    'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
    'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
  };
  
  const stateAbbr = stateAbbreviations[state] || state.toUpperCase();
  
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 text-xs font-medium rounded-md">
      <MapPin size={12} />
      {stateAbbr}
    </span>
  );
};

// AI Content Formatting Functions (from StatePage)
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
                        <div className="flex-1 text-sm text-blue-700 leading-relaxed">{point}</div>
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

// Simplified and robust API service for highlights
class HighlightsAPI {
  static async getHighlights(userId = 1) {
    try {
      console.log('🔍 HighlightsAPI: Starting getHighlights...');
      
      const response = await fetch(`${API_URL}/api/highlights?user_id=${userId}`);
      
      if (!response.ok) {
        console.warn('⚠️ Highlights endpoint failed:', response.status);
        return [];
      }
      
      const data = await response.json();
      
      // ⚡ ADD DETAILED LOGGING
      console.log('📊 Raw highlights API response:', data);
      console.log('📊 Highlights array length:', data.highlights?.length || 0);
      console.log('🎯 Highlights by type:', data.highlights?.reduce((acc, h) => {
        acc[h.order_type] = (acc[h.order_type] || 0) + 1;
        return acc;
      }, {}) || {});
      
      // Log first few items for inspection
      if (data.highlights?.length > 0) {
        console.log('📋 First 3 highlights:', data.highlights.slice(0, 3));
      }
      
      let highlights = [];
      if (Array.isArray(data)) {
        highlights = data;
      } else if (data.highlights && Array.isArray(data.highlights)) {
        highlights = data.highlights;
      } else if (data.results && Array.isArray(data.results)) {
        highlights = data.results;
      }
      
      // DEBUG: Log what IDs are actually stored in the database
      console.log('✅ Found highlights:', highlights.length);
      if (highlights.length > 0) {
        console.log('🔍 DEBUG: Sample highlight IDs from database:');
        highlights.slice(0, 3).forEach((h, idx) => {
          console.log(`   ${idx + 1}. order_id: "${h.order_id}", order_type: "${h.order_type}"`);
        });
      }
      
      return highlights;
    } catch (error) {
      console.error('Error fetching highlights:', error);
      return [];
    }
  }

  static async getHighlightsWithContent(userId = 1) {
    try {
      console.log('🚀 Fetching highlights with full content for user:', userId);
      
      const response = await fetch(`${API_URL}/api/highlights-with-content?user_id=${userId}`);
      
      if (!response.ok) {
        console.warn('⚠️ Optimized highlights endpoint failed:', response.status);
        return [];
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
      
      console.log(`✅ Retrieved ${highlights.length} highlights with full content (optimized)`);
      if (highlights.length > 0) {
        console.log('🔍 Sample highlight with content:', highlights[0]);
      }
      
      return highlights;
    } catch (error) {
      console.error('Error fetching highlights with content:', error);
      return [];
    }
  }

  static async removeHighlight(orderId, userId = 1, orderType = null) {
    try {
      console.log('🗑️ Removing highlight:', orderId, 'Type:', orderType);
      
      // Apply ID normalization if order type is provided
      let finalOrderId = orderId;
      if (orderType) {
        finalOrderId = normalizeBackendId(orderId, orderType);
        console.log('🔍 Normalized ID for backend:', finalOrderId);
      }
      
      const response = await fetch(`${API_URL}/api/highlights/${finalOrderId}?user_id=${userId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to remove highlight');
      console.log('✅ Successfully removed highlight');
      return true;
    } catch (error) {
      console.error('Error removing highlight:', error);
      throw error;
    }
  }

  // Fixed API call to get ALL executive orders (no pagination limit)
  static async getAllExecutiveOrders() {
    try {
      console.log('🔍 Fetching ALL executive orders (no pagination limit)...');
      
      // First try with a very high per_page limit to get all orders
      const response = await fetch(`${API_URL}/api/executive-orders?per_page=1000`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`❌ Executive orders API failed: ${response.status}`);
        return [];
      }
      
      const data = await response.json();
      
      // ⚡ ADD DETAILED LOGGING
      console.log('📊 Executive orders API response:', {
        success: data.success,
        total_results: data.results?.length || 0,
        has_results_array: Array.isArray(data.results),
        sample_eo_numbers: data.results?.slice(0, 3).map(eo => eo.eo_number || eo.executive_order_number) || []
      });
      
      let orders = [];
      if (Array.isArray(data)) {
        orders = data;
      } else if (data.results && Array.isArray(data.results)) {
        orders = data.results;
      } else if (data.data && Array.isArray(data.data)) {
        orders = data.data;
      } else if (data.executive_orders && Array.isArray(data.executive_orders)) {
        orders = data.executive_orders;
      }
      
      if (!orders || orders.length === 0) {
        console.error('❌ Invalid executive orders response format:', data);
        return [];
      }
      
      // If we didn't get all orders, try pagination to get the rest
      if (data.total && orders.length < data.total) {
        console.log(`📄 Need to fetch more: got ${orders.length}, total is ${data.total}`);
        
        // Get remaining pages
        const totalPages = Math.ceil(data.total / 1000);
        for (let page = 2; page <= totalPages; page++) {
          try {
            const pageResponse = await fetch(`${API_URL}/api/executive-orders?per_page=1000&page=${page}`);
            if (pageResponse.ok) {
              const pageData = await pageResponse.json();
              let pageOrders = [];
              
              if (Array.isArray(pageData)) {
                pageOrders = pageData;
              } else if (pageData.results && Array.isArray(pageData.results)) {
                pageOrders = pageData.results;
              } else if (pageData.data && Array.isArray(pageData.data)) {
                pageOrders = pageData.data;
              }
              
              orders = orders.concat(pageOrders);
              console.log(`📄 Fetched page ${page}: ${pageOrders.length} orders, total now: ${orders.length}`);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to fetch page ${page}:`, error);
          }
        }
      }
      
      // Sort by date - newest first
      orders.sort((a, b) => {
        const dateA = new Date(getDateForSorting({ ...a, order_type: 'executive_order' }));
        const dateB = new Date(getDateForSorting({ ...b, order_type: 'executive_order' }));
        return dateB.getTime() - dateA.getTime();
      });
      
      console.log(`✅ Successfully fetched and sorted ${orders.length} executive orders`);
      return orders;
      
    } catch (error) {
      console.error('❌ Failed to fetch executive orders:', error);
      return [];
    }
  }

  static async getAllStateLegislation() {
    try {
      console.log('🔍 Fetching ALL state legislation (no pagination limit)...');
      
      // Try with limit parameter instead of per_page since backend seems to use different param
      let allBills = [];
      
      // Try different parameter formats - prioritize the working limit parameter
      const urlsToTry = [
        `${API_URL}/api/state-legislation?limit=1000`,
        `${API_URL}/api/state-legislation?per_page=1000`,
        `${API_URL}/api/state-legislation`
      ];
      
      for (const url of urlsToTry) {
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });

          if (response.ok) {
            const data = await response.json();
            console.log(`📊 State legislation API response from ${url}:`, {
              isArray: Array.isArray(data),
              length: Array.isArray(data) ? data.length : 'N/A',
              hasResults: !!(data.results),
              resultsLength: data.results ? data.results.length : 'N/A',
              hasData: !!(data.data),
              dataLength: data.data ? data.data.length : 'N/A',
              total: data.total || 'not specified'
            });

            let orders = [];
            if (Array.isArray(data)) {
              orders = data;
            } else if (data.results && Array.isArray(data.results)) {
              orders = data.results;
            } else if (data.data && Array.isArray(data.data)) {
              orders = data.data;
            }

            if (orders.length > allBills.length) {
              allBills = orders;
              console.log(`📊 Using response from ${url} with ${orders.length} items`);
            }
            
            // If we got more than 500 items, that's likely all of them, so we can break
            // Otherwise, try the next URL to see if we can get more
            if (orders.length > 500) {
              console.log(`📊 Got ${orders.length} items from ${url}, this seems complete`);
              break;
            }
          }
        } catch (error) {
          console.warn(`⚠️ Failed to fetch from ${url}:`, error);
          continue;
        }
      }

      // If we still only have 100 items and there might be more, try pagination
      if (allBills.length === 100) {
        console.log('🔍 Only got 100 items, trying pagination to get more...');
        
        for (let page = 2; page <= 10; page++) { // Try up to 10 pages
          try {
            const pageResponse = await fetch(`${API_URL}/api/state-legislation?page=${page}&per_page=100`);
            if (pageResponse.ok) {
              const pageData = await pageResponse.json();
              let pageOrders = [];
              
              if (Array.isArray(pageData)) {
                pageOrders = pageData;
              } else if (pageData.results && Array.isArray(pageData.results)) {
                pageOrders = pageData.results;
              } else if (pageData.data && Array.isArray(pageData.data)) {
                pageOrders = pageData.data;
              }
              
              if (pageOrders.length === 0) {
                console.log(`📄 No more items on page ${page}, stopping pagination`);
                break;
              }
              
              allBills = allBills.concat(pageOrders);
              console.log(`📄 Fetched state legislation page ${page}: ${pageOrders.length} orders, total now: ${allBills.length}`);
            } else {
              console.log(`📄 Page ${page} failed, stopping pagination`);
              break;
            }
          } catch (error) {
            console.warn(`⚠️ Failed to fetch state legislation page ${page}:`, error);
            break;
          }
        }
      }

      // Sort by date - newest first
      allBills.sort((a, b) => {
        const dateA = new Date(getDateForSorting({ ...a, order_type: 'state_legislation' }));
        const dateB = new Date(getDateForSorting({ ...b, order_type: 'state_legislation' }));
        return dateB.getTime() - dateA.getTime();
      });

      console.log(`✅ Successfully fetched and sorted ${allBills.length} state legislation items`);
      console.log(`📊 Sample bill IDs from state legislation:`, allBills.slice(0, 5).map(b => b.bill_id));
      console.log(`📊 Bill IDs 1892657, 1898370, 1978871 present?`, allBills.some(b => ['1892657', '1898370', '1978871'].includes(b.bill_id)));
      
      // ADD DEBUG LOGGING FOR EACH BILL (first 3 for debugging)
      console.log('🔍 DEBUG: Analyzing first 3 state legislation items for field mapping:');
      allBills.slice(0, 3).forEach((bill, index) => {
        debugStateLegislationMapping(bill, index);
      });
      
      return allBills;
    } catch (error) {
      console.error('❌ Error fetching state legislation:', error);
      return [];
    }
  }

  static async getAllOrders() {
    try {
      console.log('🔍 Fetching ALL orders (executive orders + state legislation)...');
      
      const [executiveOrders, stateLegislation] = await Promise.all([
        this.getAllExecutiveOrders(),
        this.getAllStateLegislation()
      ]);
      
      console.log(`📊 Got ${executiveOrders.length} executive orders`);
      console.log(`📊 Got ${stateLegislation.length} state bills`);
      
      const allOrders = [...executiveOrders, ...stateLegislation];
      console.log(`📊 Total combined orders: ${allOrders.length}`);
      
      return allOrders;
    } catch (error) {
      console.error('❌ Error fetching all orders:', error);
      return [];
    }
  }
}

// Enhanced hook for managing highlights
const useHighlights = (userId = 1) => {
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const loadHighlights = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 useHighlights: Starting highlights load process...');
      
      // Step 1: Get highlighted order IDs from backend
      const fetchedHighlights = await HighlightsAPI.getHighlights(userId);
      console.log('📋 useHighlights: Raw highlights from API:', fetchedHighlights);
      
      if (fetchedHighlights.length === 0) {
        console.log('📋 useHighlights: No highlights found in backend');
        setHighlights([]);
        setLastRefresh(Date.now());
        return;
      }
      
      // CRITICAL DEBUG: Show what highlighted IDs we got from backend
      const highlightedOrderIds = new Set();
      fetchedHighlights.forEach((highlight) => {
        if (highlight.order_id) {
          highlightedOrderIds.add(highlight.order_id);
        }
      });
      
      console.log('🚨 CRITICAL DEBUG - Highlighted order IDs from backend:', Array.from(highlightedOrderIds));
      console.log('🚨 CRITICAL DEBUG - Total highlighted IDs count:', highlightedOrderIds.size);
      
      // Step 2: Get ALL orders (executive orders + state legislation)
      const allOrders = await HighlightsAPI.getAllOrders();
      console.log(`📊 useHighlights: Got ${allOrders.length} total orders from database`);
      
      if (allOrders.length === 0) {
        console.log('⚠️ No orders found in database - this might be an API issue');
        setHighlights([]);
        setLastRefresh(Date.now());
        return;
      }
      
      // Step 3: Transform ALL orders using IMPROVED logic
      const allTransformedOrders = allOrders.map((order, index) => {
        // ⚡ IMPROVED ORDER TYPE DETECTION
        let orderType = 'unknown';
        
        // Check for executive order indicators
        const isExecutiveOrder = !!(
          order.executive_order_number || 
          order.document_number || 
          order.eo_number ||
          order.presidential_document_type ||
          (order.order_type === 'executive_order')
        );
        
        // Check for state legislation indicators
        const isStateLegislation = !!(
          order.bill_number || 
          order.bill_id ||
          order.state ||
          order.legiscan_url ||
          (order.order_type === 'state_legislation')
        );
        
        if (isExecutiveOrder && !isStateLegislation) {
          orderType = 'executive_order';
        } else if (isStateLegislation && !isExecutiveOrder) {
          orderType = 'state_legislation';
        } else if (order.order_type) {
          orderType = order.order_type; // Trust existing order_type if present
        }
        
        // ⚡ ADD LOGGING FOR PROBLEMATIC ITEMS
        if (orderType === 'unknown') {
          console.warn('⚠️ Unknown order type for item:', {
            index,
            title: order.title?.substring(0, 50),
            available_fields: Object.keys(order),
            executive_order_number: order.executive_order_number,
            eo_number: order.eo_number,
            bill_number: order.bill_number,
            order_type: order.order_type
          });
        }
        
        const transformedOrder = {
          // Use consistent ID generation
          id: getUniversalOrderId({ ...order, order_type: orderType, index }),
          bill_id: getUniversalOrderId({ ...order, order_type: orderType, index }),
          
          // Common fields
          title: order.title || order.bill_title || 'Untitled',
          category: order.category || 'civic',
          ai_summary: order.ai_summary || order.ai_executive_summary || '',
          ai_talking_points: order.ai_talking_points || order.ai_key_points || '',
          ai_business_impact: order.ai_business_impact || order.ai_potential_impact || '',
          ai_processed: !!(order.ai_summary || order.ai_executive_summary),
          
          // Order type specific fields
          order_type: orderType,
          
          // Executive Order specific
          ...(orderType === 'executive_order' && {
            eo_number: order.executive_order_number || order.document_number || 'Unknown',
            executive_order_number: order.executive_order_number || order.document_number || 'Unknown',
            summary: order.description || order.summary || '',
            signing_date: order.signing_date || order.introduced_date || '',
            publication_date: order.publication_date || order.last_action_date || '',
            html_url: order.html_url || order.legiscan_url || '',
            pdf_url: order.pdf_url || '',
            formatted_publication_date: formatDate(order.publication_date || order.last_action_date),
            formatted_signing_date: formatDate(order.signing_date || order.introduced_date),
            president: order.president || 'Donald Trump',
            source: 'Database (Federal Register + Azure AI)'
          }),
          
          // State Legislation specific
          ...(orderType === 'state_legislation' && {
            bill_number: order.bill_number,
            state: order.state || 'Unknown',
            status: order.status || 'Active',
            description: order.description || order.ai_summary || 'No description available',
            legiscan_url: order.legiscan_url || '',
            introduced_date: order.introduced_date,
            last_action_date: order.last_action_date,
            formatted_signing_date: formatDate(order.introduced_date),
            source: order.state ? `${order.state} Legislature` : 'State Legislature'
          }),
          
          is_highlighted: true,
          index: index
        };
        
        return transformedOrder;
      });
      
      console.log(`📊 useHighlights: Transformed ${allTransformedOrders.length} orders`);
      console.log('📊 Transformed orders by type:', allTransformedOrders.reduce((acc, order) => {
        acc[order.order_type] = (acc[order.order_type] || 0) + 1;
        return acc;
      }, {}));
      
      // Step 4: Use the highlightedOrderIds Set directly for comprehensive matching
      console.log('🎯 All highlighted order IDs to match:', Array.from(highlightedOrderIds));
      
      // Step 5: Match orders using COMPREHENSIVE matching logic (like the filtering logic)
      const matchedOrders = [];
      
      // DEBUG: Log all generated IDs for comparison
      console.log('🔍 DEBUG: Generated IDs for all orders:');
      allTransformedOrders.forEach((order, index) => {
        const orderId = getUniversalOrderId(order);
        console.log(`   Order ${index}: "${order.title}" -> ID: "${orderId}" (type: ${order.order_type})`);
      });

      console.log('🔍 DEBUG: Highlighted order IDs from backend:');
      Array.from(highlightedOrderIds).forEach(id => {
        console.log(`   Highlighted ID: "${id}"`);
      });
      
      allTransformedOrders.forEach((order) => {
        const orderId = getUniversalOrderId(order);
        
        // Create comprehensive list of possible IDs for this order
        const possibleIds = [
          orderId,
          order.order_id,
          order.bill_id,
          order.eo_number,
          order.document_number,
          order.bill_number,
          orderId?.toString(),
          order.order_id?.toString(),
          order.bill_id?.toString()
        ];
        
        // For executive orders, also add eo- prefixed versions
        if (order.order_type === 'executive_order') {
          possibleIds.push(`eo-${orderId}`);
          possibleIds.push(`eo-${order.eo_number}`);
          possibleIds.push(`eo-${order.executive_order_number}`);
        }
        
        // Clean up the array
        const cleanedIds = possibleIds.filter(Boolean).filter(id => id !== undefined && id !== null && id !== '' && id !== 'eo-undefined' && id !== 'eo-null');
        
        // Check if ANY of the possible IDs match ANY of the highlighted IDs
        const isHighlighted = cleanedIds.some(id => highlightedOrderIds.has(id));
        
        if (isHighlighted) {
          const matchedId = cleanedIds.find(id => highlightedOrderIds.has(id));
          console.log(`✅ MATCH FOUND: Order "${order.title}" with ID "${orderId}" (type: ${order.order_type})`);
          console.log(`    Matched ID: "${matchedId}"`);
          matchedOrders.push(order);
        } else {
          console.log(`❌ NO MATCH: Order "${order.title}" with ID "${orderId}" not in highlights set`);
          console.log(`    Tried IDs: [${cleanedIds.join(', ')}]`);
        }
      });
      
      console.log(`✅ useHighlights: Found ${matchedOrders.length} matching highlighted orders`);
      
      // Sort matched orders by date - newest first
      matchedOrders.sort((a, b) => {
        const dateA = new Date(getDateForSorting(a));
        const dateB = new Date(getDateForSorting(b));
        return dateB.getTime() - dateA.getTime();
      });
      
      setHighlights(matchedOrders);
      setLastRefresh(Date.now());
      
    } catch (error) {
      console.error('❌ Error loading highlights:', error);
      setHighlights([]);
      setLastRefresh(Date.now());
    } finally {
      setLoading(false);
    }
  };

  const removeHighlight = async (highlight) => {
    try {
      const orderId = getUniversalOrderId(highlight);
      console.log('🗑️ Removing highlight with ID:', orderId, 'Type:', highlight.order_type);
      
      await HighlightsAPI.removeHighlight(orderId, userId, highlight.order_type);
      setHighlights(prev => prev.filter(item => getUniversalOrderId(item) !== orderId));
      setLastRefresh(Date.now());
      
      console.log('✅ Successfully removed highlight');
    } catch (error) {
      console.error('❌ Failed to remove highlight:', error);
      throw error;
    }
  };

  const refreshHighlights = async () => {
    console.log('🔄 Refreshing highlights...');
    await loadHighlights();
  };

  useEffect(() => {
    loadHighlights();
  }, [userId]);

  return {
    highlights,
    loading,
    removeHighlight,
    refreshHighlights,
    lastRefresh
  };
};

// ⚡ OPTIMIZED useHighlights hook - single API call with full content
const useOptimizedHighlights = (userId = 1) => {
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const loadHighlights = async () => {
    try {
      setLoading(true);
      console.log('🚀 useOptimizedHighlights: Loading highlights with content...');
      
      // Single API call that returns highlights with full content
      const highlightsWithContent = await HighlightsAPI.getHighlightsWithContent(userId);
      
      console.log(`✅ useOptimizedHighlights: Got ${highlightsWithContent.length} highlights with full content`);
      setHighlights(highlightsWithContent);
      
    } catch (error) {
      console.error('❌ useOptimizedHighlights: Error loading highlights:', error);
      setHighlights([]);
    } finally {
      setLoading(false);
    }
  };

  const removeHighlight = async (orderId) => {
    try {
      const highlight = highlights.find(h => h.order_id === orderId);
      if (!highlight) {
        console.warn('❌ Highlight not found for removal:', orderId);
        return;
      }

      console.log('🗑️ useOptimizedHighlights: Removing highlight:', orderId);
      await HighlightsAPI.removeHighlight(orderId, userId, highlight.order_type);
      setHighlights(prev => prev.filter(item => item.order_id !== orderId));
      setLastRefresh(Date.now());
      
      console.log('✅ useOptimizedHighlights: Successfully removed highlight');
    } catch (error) {
      console.error('❌ useOptimizedHighlights: Error removing highlight:', error);
    }
  };

  const refreshHighlights = async () => {
    console.log('🔄 useOptimizedHighlights: Refreshing highlights...');
    await loadHighlights();
  };

  useEffect(() => {
    loadHighlights();
  }, [userId]);

  return {
    highlights,
    loading,
    removeHighlight,
    refreshHighlights,
    lastRefresh
  };
};

// Scroll to Top Button Component
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

// Pagination Controls Component
const PaginationControls = ({ 
  currentPage, 
  totalPages, 
  totalItems, 
  itemsPerPage, 
  onPageChange,
  itemType = 'highlights'
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
        <span className="font-medium">{totalItems}</span> {itemType}
      </div>

      <div className="flex items-center gap-2">
        {totalPages > 1 && (
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
        )}

        {totalPages > 1 && (
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
        )}

        {totalPages > 1 && (
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
        )}
      </div>
    </div>
  );
};

// Main HighlightsPage Component
const HighlightsPage = ({ makeApiCall, copyToClipboard, stableHandlers }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  
  // Filter state
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Sort state
  const [sortOrder, setSortOrder] = useState('latest');
  
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  
  // Highlight management
  const [localHighlights, setLocalHighlights] = useState(new Set());
  const [highlightLoading, setHighlightLoading] = useState(new Set());
  const [copiedHighlights, setCopiedHighlights] = useState(new Set());
  const [activeMobileMenu, setActiveMobileMenu] = useState(null); // Mobile menu state
  
  // Additional state for immediate UI updates
  const [displayHighlights, setDisplayHighlights] = useState([]);
  
  const navigate = useNavigate();
  const filterDropdownRef = useRef(null);

  // Use optimized highlights hook that gets content directly from backend
  const {
    highlights,
    loading,
    removeHighlight,
    refreshHighlights,
    lastRefresh
  } = useOptimizedHighlights(1);

  // Scroll to top when component mounts
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // Sync display highlights with hook highlights - PREVENT unhighlighted items from appearing
  useEffect(() => {
    // Only sync during initial load, never during active operations
    // And filter out any items that are not actually highlighted
    if (highlightLoading.size === 0) {
      console.log('🔄 Syncing displayHighlights with hook highlights:', highlights.length);
      console.log('🔍 LocalHighlights Set contains:', Array.from(localHighlights));
      console.log('🔍 Sample highlights data (first 3):', highlights.slice(0, 3).map(h => ({
        title: h.title?.substring(0, 30),
        order_id: h.order_id,
        eo_number: h.eo_number,
        order_type: h.order_type,
        universalId: getUniversalOrderId(h)
      })));
      
      // ⚡ SIMPLIFIED: If items are in the highlights array from the backend, they're already highlighted
      // The highlights array comes from the /api/highlights-with-content endpoint which only returns highlighted items
      const actuallyHighlightedItems = highlights.map(item => {
        const itemId = getUniversalOrderId(item);
        console.log(`✅ INCLUDING: "${item.title?.substring(0, 50)}..." | Order Type: ${item.order_type} | ID: ${itemId}`);
        return item;
      });
      
      console.log(`🔄 Filtered highlights: ${actuallyHighlightedItems.length} of ${highlights.length} items`);
      setDisplayHighlights(actuallyHighlightedItems);
    }
  }, [highlights, highlightLoading, localHighlights, stableHandlers]);

  // UPDATED: Sync local highlights with the main highlights array
  useEffect(() => {
    if (highlights.length > 0) {
      console.log('🔍 HighlightsPage: Syncing local highlights with main highlights array...');
      
      const orderIds = new Set();
      highlights.forEach((highlight, index) => {
        if (highlight && highlight.order_id) {
          const rawId = highlight.order_id;
          console.log(`🔍 DEBUG: Highlight ${index + 1}: order_id="${rawId}", order_type="${highlight.order_type}"`);
          
          orderIds.add(rawId);
          
          // For executive orders, handle both prefixed and non-prefixed versions
          if (highlight.order_type === 'executive_order') {
            if (typeof rawId === 'string' && rawId.startsWith('eo-')) {
              const numberOnly = rawId.replace('eo-', '');
              orderIds.add(numberOnly); // Add the number-only version
              console.log(`🔍 DEBUG: Added both "${rawId}" and "${numberOnly}" for EO`);
            } else if (/^\d{4,5}$/.test(rawId.toString())) {
              orderIds.add(`eo-${rawId}`); // Add the prefixed version
              console.log(`🔍 DEBUG: Added both "${rawId}" and "eo-${rawId}" for EO`);
            }
          }
          
          // Also add other possible ID variations
          if (highlight.eo_number) orderIds.add(highlight.eo_number);
          if (highlight.document_number) orderIds.add(highlight.document_number);
          if (highlight.bill_id) orderIds.add(highlight.bill_id);
          if (highlight.bill_number) orderIds.add(highlight.bill_number);
        }
      });
      
      setLocalHighlights(orderIds);
      console.log('🌟 HighlightsPage: Synced local highlights set:', Array.from(orderIds));
      console.log('🌟 Total highlights processed:', highlights.length);
    }
  }, [highlights]);

  // FIXED: Filter functions with proper "All Practice Areas" handling
  const toggleFilter = (filterKey) => {
    console.log('🔄 toggleFilter called with:', filterKey);
    setSelectedFilters(prev => {
      let newFilters;
      
      if (filterKey === 'all_practice_areas') {
        console.log('🔄 All practice areas clicked');
        // If "All Practice Areas" is clicked, toggle it and remove all category filters
        if (prev.includes('all_practice_areas')) {
          // If currently selected, deselect it
          newFilters = prev.filter(f => f !== 'all_practice_areas');
        } else {
          // If not selected, select it and remove all individual category filters
          newFilters = prev.filter(f => !['civic', 'healthcare', 'education', 'engineering'].includes(f));
          newFilters.push('all_practice_areas');
        }
      } else if (['civic', 'healthcare', 'education', 'engineering'].includes(filterKey)) {
        console.log('🔄 Category filter clicked:', filterKey);
        // If a specific category is clicked, remove "all_practice_areas" and toggle the category
        const withoutAllPracticeAreas = prev.filter(f => f !== 'all_practice_areas');
        if (withoutAllPracticeAreas.includes(filterKey)) {
          newFilters = withoutAllPracticeAreas.filter(f => f !== filterKey);
        } else {
          newFilters = [...withoutAllPracticeAreas, filterKey];
        }
      } else {
        console.log('🔄 Other filter clicked:', filterKey);
        // For other filters (content types), normal toggle behavior
        if (prev.includes(filterKey)) {
          newFilters = prev.filter(f => f !== filterKey);
        } else {
          newFilters = [...prev, filterKey];
        }
      }
      
      console.log('🔄 Filter toggled:', filterKey, 'Previous filters:', prev, 'New filters:', newFilters);
      setCurrentPage(1);
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    console.log('🔄 Clearing all filters');
    setSelectedFilters([]);
    setCurrentPage(1);
  };


  // FIXED: Filter counts calculation - properly counts items tagged as "all_practice_areas"
  const filterCounts = useMemo(() => {
    const counts = {
      civic: 0,
      healthcare: 0,
      education: 0,
      engineering: 0,
      all_practice_areas: 0, // Count items specifically tagged as "all_practice_areas"
      executive_order: 0,
      state_legislation: 0,
      total: 0
    };

    displayHighlights.forEach(highlight => {
      // Count individual categories including "all_practice_areas"
      if (highlight.category && counts.hasOwnProperty(highlight.category)) {
        counts[highlight.category]++;
      }
      
      // Count order types
      if (highlight.order_type === 'executive_order') {
        counts.executive_order++;
      } else if (highlight.order_type === 'state_legislation') {
        counts.state_legislation++;
      }
    });

    // Total should show all items for the "All Practice Areas" button display
    counts.total = displayHighlights.length;

    return counts;
  }, [displayHighlights]);

  // FIXED: Comprehensive filtering logic with proper "All Practice Areas" handling
  const filteredHighlights = useMemo(() => {
    let filtered = [...displayHighlights];
    

    // Apply category filters
    const categoryFilters = selectedFilters.filter(f => 
      ['civic', 'healthcare', 'education', 'engineering'].includes(f)
    );
    
    if (categoryFilters.length > 0) {
      filtered = filtered.filter(highlight => 
        categoryFilters.includes(highlight?.category)
      );
    }

    // Apply order type filters (these work independently of practice area filters)
    const hasExecutiveOrderFilter = selectedFilters.includes('executive_order');
    const hasStateLegislationFilter = selectedFilters.includes('state_legislation');
    
    if (hasExecutiveOrderFilter && !hasStateLegislationFilter) {
      filtered = filtered.filter(highlight => highlight.order_type === 'executive_order');
    } else if (hasStateLegislationFilter && !hasExecutiveOrderFilter) {
      filtered = filtered.filter(highlight => highlight.order_type === 'state_legislation');
    }

    // SORT BY DATE - RESPECTS sortOrder STATE
    filtered.sort((a, b) => {
      const dateA = new Date(getDateForSorting(a));
      const dateB = new Date(getDateForSorting(b));
      return sortOrder === 'latest' 
        ? dateB.getTime() - dateA.getTime()  // newest first
        : dateA.getTime() - dateB.getTime(); // oldest first
    });

    console.log(`🔍 Filtered and sorted highlights: ${filtered.length} of ${displayHighlights.length} total`);
    return filtered;
  }, [displayHighlights, selectedFilters, sortOrder]);

  // Pagination logic
  const totalItems = filteredHighlights.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedHighlights = filteredHighlights.slice(startIndex, endIndex);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      console.log('🔄 Starting manual refresh...');
      await refreshHighlights();
      
      // The useEffect will automatically sync displayHighlights with the refreshed highlights
      
      // Refresh local highlights as well
      const fetchedHighlights = await HighlightsAPI.getHighlights(1);
      const orderIds = new Set();
      fetchedHighlights.forEach((highlight) => {
        if (highlight && highlight.order_id && 
            (highlight.order_type === 'executive_order' || highlight.order_type === 'state_legislation')) {
          orderIds.add(highlight.order_id);
        }
      });
      setLocalHighlights(orderIds);
      
      console.log('🔄 Manual refresh completed');
    } catch (error) {
      console.error('Error during manual refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [totalPages]);

  // COMPREHENSIVE DEBUG: Enhanced highlighting function with extensive logging
  const handleOrderHighlight = useCallback(async (order) => {
    console.log('🌟 ========== UNHIGHLIGHT DEBUG START ==========');
    console.log('🌟 Order to unhighlight:', {
      title: order.title,
      order_type: order.order_type,
      id: order.id,
      bill_id: order.bill_id,
      executive_order_number: order.executive_order_number,
      eo_number: order.eo_number,
      document_number: order.document_number,
      bill_number: order.bill_number
    });
    
    const orderId = getUniversalOrderId(order);
    console.log('🔍 Frontend generated orderId:', orderId);
    
    if (!orderId) {
      console.error('❌ No valid order ID found for highlighting');
      return;
    }
    
    // Normalize the ID for backend operations
    const backendOrderId = normalizeBackendId(orderId, order.order_type);
    console.log('🔍 Normalized backend ID:', backendOrderId);
    console.log('🔍 ID Mapping Summary:', { 
      originalOrderId: orderId, 
      backendOrderId, 
      orderType: order.order_type 
    });
    
    // Check current highlight status
    const isCurrentlyHighlighted = localHighlights.has(orderId) || localHighlights.has(backendOrderId);
    console.log('🌟 Current highlight status:', isCurrentlyHighlighted);
    console.log('🌟 Local highlights set contains:', Array.from(localHighlights));
    
    // Add to loading state
    setHighlightLoading(prev => new Set([...prev, orderId]));
    
    try {
      if (isCurrentlyHighlighted) {
        console.log('🗑️ ========== STARTING UNHIGHLIGHT PROCESS ==========');
        console.log('🗑️ Attempting to remove highlight for backend ID:', backendOrderId);
        
        // IMMEDIATELY remove from display for instant UI feedback
        setDisplayHighlights(prev => {
          const filtered = prev.filter(item => getUniversalOrderId(item) !== orderId);
          console.log(`🗑️ IMMEDIATE UI UPDATE: Removed item from display. Count: ${prev.length} -> ${filtered.length}`);
          return filtered;
        });
        
        // Update local highlights state immediately
        setLocalHighlights(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          newSet.delete(backendOrderId);
          newSet.delete(`eo-${backendOrderId}`);
          console.log('🗑️ Updated local highlights, removed:', [orderId, backendOrderId, `eo-${backendOrderId}`]);
          console.log('🗑️ Local highlights now:', Array.from(newSet));
          return newSet;
        });
        
        // Try multiple ID formats to delete from backend
        let deleteSuccess = false;
        const idsToTry = [
          { id: backendOrderId, description: 'normalized backend ID' },
          { id: `eo-${backendOrderId}`, description: 'eo- prefixed ID' },
          { id: orderId, description: 'original frontend ID' }
        ];
        
        for (const { id, description } of idsToTry) {
          console.log(`🔍 Trying to delete with ${description}: "${id}"`);
          
          try {
            const response = await fetch(`${API_URL}/api/highlights/${id}?user_id=1`, {
              method: 'DELETE',
            });
            
            console.log(`🔍 DELETE attempt with ${description} - Status:`, response.status);
            
            if (response.ok) {
              console.log(`✅ Successfully deleted highlight using ${description}: "${id}"`);
              deleteSuccess = true;
              break;
            } else {
              const errorText = await response.text();
              console.log(`❌ Delete failed with ${description} - Error:`, errorText);
            }
          } catch (fetchError) {
            console.log(`❌ Network error with ${description}:`, fetchError);
          }
        }
        
        if (!deleteSuccess) {
          console.error('❌ ALL DELETE ATTEMPTS FAILED - REVERTING UI CHANGES');
          // REVERT: Add back to display and local highlights
          setDisplayHighlights(prev => {
            const exists = prev.some(item => getUniversalOrderId(item) === orderId);
            if (!exists) {
              console.log('🔄 REVERTING: Adding item back to display due to backend failure');
              return [...prev, order].sort((a, b) => {
                const dateA = new Date(getDateForSorting(a));
                const dateB = new Date(getDateForSorting(b));
                return dateB.getTime() - dateA.getTime();
              });
            }
            return prev;
          });
          setLocalHighlights(prev => new Set([...prev, orderId, backendOrderId]));
        } else {
          console.log('✅ Backend deletion successful - NOT calling additional cleanup functions');
          
          // DO NOT call removeHighlight hook as it might make another DELETE call
          // DO NOT call refreshGlobalHighlights as it might trigger more API calls
          
          console.log('✅ Unhighlight process completed successfully');
        }
      } else {
        console.log('⭐ Item is not currently highlighted - this should not happen on highlights page');
        // ADD highlight logic (shouldn't happen on highlights page but keeping for completeness)
        // ... existing add logic ...
      }
      
    } catch (error) {
      console.error('❌ MAJOR ERROR in handleOrderHighlight:', error);
      // Revert all optimistic updates on error
      setDisplayHighlights(prev => {
        const exists = prev.some(item => getUniversalOrderId(item) === orderId);
        if (!exists) {
          console.log('🔄 ERROR RECOVERY: Adding item back to display');
          return [...prev, order].sort((a, b) => {
            const dateA = new Date(getDateForSorting(a));
            const dateB = new Date(getDateForSorting(b));
            return dateB.getTime() - dateA.getTime();
          });
        }
        return prev;
      });
      setLocalHighlights(prev => new Set([...prev, orderId, backendOrderId]));
    } finally {
      setHighlightLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
      console.log('🌟 ========== UNHIGHLIGHT DEBUG END ==========');
    }
  }, [localHighlights, stableHandlers, removeHighlight]);

  // UPDATED: Improved highlight status check with better debugging
  const isOrderHighlighted = useCallback((order) => {
    const orderId = getUniversalOrderId(order);
    if (!orderId) {
      console.log('🔍 isOrderHighlighted: No orderId found');
      return false;
    }
    
    const backendOrderId = normalizeBackendId(orderId, order.order_type);
    
    // Check multiple ID variations in local highlights
    const localHighlighted = localHighlights.has(orderId) || 
                            localHighlights.has(backendOrderId) ||
                            localHighlights.has(`eo-${orderId}`) ||
                            localHighlights.has(`eo-${backendOrderId}`);
    
    // Also check stable handlers as fallback
    const stableHighlighted = stableHandlers?.isItemHighlighted?.(order) || false;
    
    const finalResult = localHighlighted || stableHighlighted;
    
    // Debug logging for unhighlighted items that are still showing
    if (!finalResult && order.title) {
      console.log(`🔍 isOrderHighlighted: Item "${order.title.substring(0, 30)}..." is NOT highlighted (orderId: ${orderId}, backendId: ${backendOrderId})`);
      console.log('🔍 Local highlights set:', Array.from(localHighlights));
    }
    
    return finalResult;
  }, [localHighlights, stableHandlers]);

  // Check if order is currently being highlighted/unhighlighted
  const isOrderHighlightLoading = useCallback((order) => {
    const orderId = getUniversalOrderId(order);
    return orderId ? highlightLoading.has(orderId) : false;
  }, [highlightLoading]);

  // Format last refresh time
  const formatLastRefresh = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ago`;
    } else if (seconds > 0) {
      return `${seconds}s ago`;
    } else {
      return 'just now';
    }
  };

  // Close dropdown effect
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target)) {
        setShowFilterDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Mobile menu click outside handler
  useEffect(() => {
    const handleMobileMenuClickOutside = (event) => {
      if (activeMobileMenu && !event.target.closest('.mobile-menu-container')) {
        setActiveMobileMenu(null);
      }
    };

    document.addEventListener('mousedown', handleMobileMenuClickOutside);
    return () => document.removeEventListener('mousedown', handleMobileMenuClickOutside);
  }, [activeMobileMenu]);

  const hasHighlights = displayHighlights && displayHighlights.length > 0;

  return (
    <div className="pt-6 min-h-screen bg-gradient-to-br from-yellow-50 via-white to-orange-50">
      {/* Scroll to Top Button */}
      <ScrollToTopButton />



      {/* Header */}


      {/* Header Section */}
      <section className="relative overflow-hidden px-6 pt-12 pb-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Star size={16} />
              All Highlighted Items
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              <span className="block">Highlighted</span>
              <span className="block bg-gradient-to-r from-yellow-700 to-yellow-600 bg-clip-text text-transparent py-2">Items</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Manage a collection of important legislation and executive orders. View, organize, and analyze your highlighted items with comprehensive AI insights including executive summaries, key talking points, and business impact assessments.
            </p>
          </div>
        </div>
      </section>

      {/* Enhanced Highlights Display */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          {/* Controls Section - Mobile Responsive */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            {/* Left side - Refresh Button (matching StatePage FetchButtonGroup style) */}
            <div className="relative w-full sm:w-auto">
              <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-all duration-300 w-full sm:w-auto ${
                  isRefreshing
                    ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                    : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700'
                }`}
                title="Refresh highlights from server"
              >
                {isRefreshing ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={16} />
                )}
                <span>{isRefreshing ? 'Refreshing highlights...' : 'Refresh Highlights'}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
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

              {/* Filter Dropdown - Match StatePage style */}
              <div className="relative" ref={filterDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                  className="flex items-center justify-between px-4 py-3 border border-gray-300 rounded-lg text-sm font-medium bg-white hover:bg-gray-50 transition-all duration-300 w-full sm:w-48 min-h-[44px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate">
                      {selectedFilters.length === 0 
                        ? 'Filters'
                        : selectedFilters.length === 1
                        ? (() => {
                            const filter = selectedFilters[0];
                            if (filter === 'executive_order') return 'Executive Orders';
                            if (filter === 'state_legislation') return 'State Legislation';
                            // Individual filters only
                            return FILTERS.find(f => f.key === filter)?.label || 'Filter';
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

                {/* Dropdown content - Match StatePage structure exactly */}
                {showFilterDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-[120]">
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
                          Clear All Filters
                        </button>
                      </div>
                    )}
                    
                    {/* Practice Areas Section - Match StatePage exactly */}
                    <div className="border-b border-gray-200 pb-2">
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Practice Areas
                      </div>
                      
                      {/* Only show individual categories - remove duplicate "All Practice Areas" */}
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
                                ? filter.key === 'civic' ? 'bg-blue-100 text-blue-700 font-medium' :
                                  filter.key === 'education' ? 'bg-orange-100 text-orange-700 font-medium' :
                                  filter.key === 'engineering' ? 'bg-green-100 text-green-700 font-medium' :
                                  filter.key === 'healthcare' ? 'bg-red-100 text-red-700 font-medium' :
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

                    {/* Content Types Section - Match StatePage structure */}
                    <div>
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Content Types
                      </div>
                      
                      {/* Executive Orders */}
                      <button
                        onClick={() => toggleFilter('executive_order')}
                        className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                          selectedFilters.includes('executive_order')
                            ? 'bg-purple-100 text-purple-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <ScrollText size={16} />
                          <span>Executive Orders</span>
                        </div>
                        <span className="text-xs text-gray-500">({filterCounts.executive_order || 0})</span>
                      </button>
                      
                      {/* State Legislation */}
                      <button
                        onClick={() => toggleFilter('state_legislation')}
                        className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                          selectedFilters.includes('state_legislation')
                            ? 'bg-green-100 text-green-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <FileText size={16} />
                          <span>State Legislation</span>
                        </div>
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Last updated text */}
          {lastRefresh && (
            <div className="mb-6 text-sm text-gray-500">
              Last updated: {formatLastRefresh(lastRefresh)}
            </div>
          )}

          {loading ? (
            <div className="space-y-6">
              {[...Array(5)].map((_, index) => (
                <HighlightCardSkeleton key={index} />
              ))}
            </div>
          ) : paginatedHighlights.length === 0 ? (
            <div className="text-center py-12">
              <Star size={48} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {hasHighlights ? 'No matching highlights found' : 'No Highlights Yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {hasHighlights 
                  ? selectedFilters.length > 0
                    ? `No highlights match your current filter criteria.`
                    : `No highlights match your current filters.`
                  : "Start by highlighting executive orders or legislation from other pages."
                }
              </p>
              {selectedFilters.length === 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <button 
                    onClick={() => navigate('/executive-orders')}
                    className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-left transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <ScrollText size={20} className="text-blue-600" />
                      <span className="font-semibold text-blue-800">Executive Orders</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      Browse and highlight federal executive orders
                    </p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/state/california')}
                    className="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-left transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <FileText size={20} className="text-green-600" />
                      <span className="font-semibold text-green-800">State Legislation</span>
                    </div>
                    <p className="text-sm text-green-700">
                      Find and highlight state bills and legislation
                    </p>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4 relative">
              {paginatedHighlights.map((highlight, index) => {
                const globalIndex = (currentPage - 1) * itemsPerPage + index;
                const highlightWithIndex = { ...highlight, index: globalIndex };
                const orderId = getUniversalOrderId(highlightWithIndex);
                const isExpanded = expandedOrders.has(orderId);
                
                return (
                  <div key={`highlight-${orderId}-${globalIndex}`} className="bg-white border rounded-lg transition-all duration-300 border-gray-200 hover:shadow-md relative" style={{ zIndex: 50 - index }}>
                    <div className="p-3">

                      {/* Compact Header with Title and Star */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-base font-semibold text-gray-800 leading-tight flex-1">
                          {cleanOrderTitle(highlight.title)}
                        </h3>
                        <button
                          type="button"
                          className={`p-1.5 rounded-md transition-all duration-300 flex-shrink-0 ${
                            isOrderHighlighted(highlightWithIndex)
                              ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                              : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-50'
                          } ${isOrderHighlightLoading(highlightWithIndex) ? 'opacity-50 cursor-not-allowed' : ''}`}
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (!isOrderHighlightLoading(highlightWithIndex)) {
                              await handleOrderHighlight(highlightWithIndex);
                            }
                          }}
                          disabled={isOrderHighlightLoading(highlightWithIndex)}
                          title={
                            isOrderHighlightLoading(highlightWithIndex) 
                              ? "Processing..." 
                              : isOrderHighlighted(highlightWithIndex) 
                                ? "Remove from highlights" 
                                : "Add to highlights"
                          }
                        >
                          {isOrderHighlightLoading(highlightWithIndex) ? (
                            <RotateCw size={16} className="animate-spin" />
                          ) : (
                            <Star 
                              size={16} 
                              className={isOrderHighlighted(highlightWithIndex) ? "fill-current" : ""} 
                            />
                          )}
                        </button>
                      </div>
                      
                      {/* Compact Metadata Row */}
                      <div className="flex flex-wrap items-center gap-2 text-xs mb-2">
                        {highlight.order_type === 'executive_order' ? (
                          <>
                            <div className="flex items-center gap-1 text-gray-600">
                              <Hash size={12} className="text-blue-600" />
                              <span className="font-medium">{getExecutiveOrderNumber(highlight)}</span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-600">
                              <Calendar size={12} className="text-green-600" />
                              <span className="font-medium">{formatDate(highlight.signing_date) || highlight.formatted_signing_date || highlight.formatted_publication_date || 'Unknown'}</span>
                            </div>
                            <CategoryTag category={highlight.category} />
                            <OrderTypeTag orderType={highlight.order_type} />
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-1 text-gray-600">
                              <Hash size={12} className="text-blue-600" />
                              <span className="font-medium">{highlight.bill_number || 'Unknown'}</span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-600">
                              <Calendar size={12} className="text-green-600" />
                              <span className="font-medium">{highlight.formatted_signing_date || formatDate(highlight.introduced_date) || formatDate(highlight.last_action_date) || 'Unknown'}</span>
                            </div>
                            <CategoryTag category={highlight.category} />
                            <OrderTypeTag orderType={highlight.order_type} />
                            {highlight.state && (
                              <StateTag state={highlight.state} />
                            )}
                          </>
                        )}
                      </div>

                      {/* Compact AI Summary Preview */}
                      {highlight.ai_processed && highlight.ai_summary && !isExpanded && (
                        <div className="mb-2 bg-purple-50 border border-purple-200 rounded-md p-3">
                          <div className="flex items-start gap-2">
                            <FileText size={14} className="text-purple-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs font-semibold text-purple-900">
                                  {highlight.order_type === 'executive_order' ? 'Executive Summary' : 'Legislative Summary'}
                                </span>
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-600 text-white text-xs rounded">
                                  <Sparkles size={10} />
                                  AI
                                </span>
                              </div>
                              <p className="text-xs text-purple-800 line-clamp-2">
                                {stripHtmlTags(highlight.ai_summary)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* External Links - Inline */}
                      <div className="flex flex-wrap items-center gap-2">
                        {highlight.html_url && (
                          <a
                            href={highlight.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-300 text-blue-600 rounded-md text-xs font-medium hover:bg-gray-100 transition-all duration-300"
                          >
                            <ExternalLink size={12} className="text-blue-600" />
                            View Source
                          </a>
                        )}
                        
                        {highlight.pdf_url && (
                          <a
                            href={highlight.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-300 text-red-600 rounded-md text-xs font-medium hover:bg-gray-100 transition-all duration-300"
                          >
                            <FileText size={12} className="text-red-600" />
                            PDF
                          </a>
                        )}
                        
                        {/* Read More Button */}
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
                          className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-all duration-200"
                        >
                          {isExpanded ? (
                            <>
                              Show Less
                              <ChevronDown size={12} className="rotate-180 transition-transform duration-200" />
                            </>
                          ) : (
                            <>
                              Read More
                              <ChevronDown size={12} className="transition-transform duration-200" />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          {/* Full AI Summary - Compact */}
                          {highlight.ai_processed && highlight.ai_summary && (
                            <div className="mb-3">
                              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <FileText size={14} className="text-purple-600" />
                                    <h3 className="text-sm font-semibold text-purple-900">
                                      {highlight.order_type === 'executive_order' ? 'Executive Summary' : 'Legislative Summary'}
                                    </h3>
                                  </div>
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-600 text-white text-xs rounded">
                                    <Sparkles size={10} />
                                    AI
                                  </div>
                                </div>
                                <div className="text-sm text-purple-800 leading-relaxed">
                                  {stripHtmlTags(highlight.ai_summary)}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Azure AI Talking Points - Compact */}
                          {highlight.ai_processed && highlight.ai_talking_points && (
                            <div className="mb-3">
                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Target size={14} className="text-blue-600" />
                                    <h3 className="text-sm font-semibold text-blue-800">Key Talking Points</h3>
                                  </div>
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded">
                                    <Sparkles size={10} />
                                    AI
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {formatTalkingPoints(highlight.ai_talking_points)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Azure AI Business Impact - Compact */}
                          {highlight.ai_processed && highlight.ai_business_impact && (
                            <div className="mb-3">
                              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <TrendingUp size={14} className="text-green-600" />
                                    <h3 className="text-sm font-semibold text-green-900">Business Impact Analysis</h3>
                                  </div>
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-600 text-white text-xs rounded">
                                    <Sparkles size={10} />
                                    AI
                                  </div>
                                </div>
                                <div className="text-sm text-green-800 leading-relaxed">
                                  {formatUniversalContent(highlight.ai_business_impact)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* No AI Analysis Message - Compact */}
                          {!highlight.ai_processed && (
                            <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200 mb-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="text-sm font-medium text-yellow-800">No AI Analysis Available</h4>
                                  <p className="text-yellow-700 text-xs">
                                    This item was highlighted before AI processing was available.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* External Links at Bottom of Expanded Content */}
                          <div className="flex flex-wrap gap-2 pt-4 mt-4 border-t border-gray-200">
                            {highlight.html_url && (
                              <a
                                href={highlight.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 transition-all duration-300"
                              >
                                <ExternalLink size={14} />
                                {highlight.order_type === 'executive_order' ? 'View on Federal Register' : 'Official Source'}
                              </a>
                            )}
                            
                            {highlight.pdf_url && (
                              <a
                                href={highlight.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 transition-all duration-300"
                              >
                                <FileText size={14} />
                                View PDF
                              </a>
                            )}

                            {highlight.legiscan_url && (
                              <a
                                href={highlight.legiscan_url}
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
          )}
        </div>
        
        {/* Pagination Controls */}
        {paginatedHighlights.length > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            itemType="highlights"
          />
        )}
      </div>

      {/* Filter Results Summary */}
      {!loading && selectedFilters.length > 0 && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
            <span>
              {paginatedHighlights.length === 0 ? 'No results' : `${totalItems} total results`} for: 
              <span className="font-medium ml-1">
                {selectedFilters.map(f => {
                  if (f === 'executive_order') return 'Executive Orders';
                  if (f === 'state_legislation') return 'State Legislation';
                  if (f === 'all_practice_areas') return 'All Practice Areas';
                  return FILTERS.find(cf => cf.key === f)?.label || f;
                }).join(', ')}
              </span>
            </span>
            {totalItems > 25 && (
              <span className="text-xs bg-blue-100 px-2 py-1 rounded">
                {totalPages} pages
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default HighlightsPage;
