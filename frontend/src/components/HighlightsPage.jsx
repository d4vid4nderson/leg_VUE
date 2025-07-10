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
  Stethoscope,
  Wrench,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  Check,
  LayoutGrid
} from 'lucide-react';
import HR1PolicyBanner from './HR1PolicyBanner';
import { FILTERS } from '../utils/constants';
import API_URL from '../config/api';
import ShimmerLoader from '../components/ShimmerLoader';

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
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[280px] max-w-[320px]">
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
                {/* All Practice Areas */}
                <button
                  type="button"
                  onClick={() => onToggleFilter('all_practice_areas')}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded-md transition-all duration-200 ${
                    selectedFilters.includes('all_practice_areas')
                      ? 'bg-teal-100 text-teal-700' 
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LayoutGrid 
                      size={16} 
                      className={selectedFilters.includes('all_practice_areas') ? 'text-teal-600' : 'text-gray-500'} 
                    />
                    <span className="text-sm">All Practice Areas</span>
                  </div>
                  <span className={`text-sm px-1.5 py-0.5 rounded-full ${
                    selectedFilters.includes('all_practice_areas')
                      ? 'bg-teal-200 text-teal-700' 
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {counts?.all_practice_areas || 0}
                  </span>
                </button>

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
                      <span className={`text-sm px-1.5 py-0.5 rounded-full ${
                        isActive 
                          ? colors.count 
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {count}
                      </span>
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
                    <span className={`text-sm px-1.5 py-0.5 rounded-full ${
                      selectedFilters.includes('executive_order')
                        ? 'bg-blue-200 text-blue-700' 
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {counts?.executive_order || 0}
                    </span>
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
                    <span className={`text-sm px-1.5 py-0.5 rounded-full ${
                      selectedFilters.includes('state_legislation')
                        ? 'bg-green-200 text-green-700' 
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {counts?.state_legislation || 0}
                    </span>
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
  // Prioritize the actual EO number field over document numbers
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

// Executive Order ID generation (consistent with backend)
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

// State Legislation ID generation (consistent with backend)
const getStateLegislationId = (order) => {
  if (!order) return null;
  
  // Priority order to match backend logic
  if (order.bill_id && typeof order.bill_id === 'string') return order.bill_id;
  if (order.id && typeof order.id === 'string') return order.id;
  
  // For bills without explicit IDs, create consistent format
  if (order.bill_number && order.state) {
    return `${order.state}-${order.bill_number}`;
  }
  if (order.bill_number) {
    return `${order.state || 'unknown'}-${order.bill_number}`;
  }
  
  return null;
};

// Universal ID function with proper type detection
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

// Handle Backend ID Format Conversion with better debugging
const normalizeBackendId = (orderId, orderType) => {
  if (!orderId) return orderId;
  
  if (orderType === 'executive_order') {
    // For executive orders, we need to check what format the backend expects
    // Based on backend logs, it seems to expect just the number without eo- prefix
    let normalizedId = orderId;
    
    if (typeof orderId === 'string' && orderId.startsWith('eo-')) {
      normalizedId = orderId.replace('eo-', '');
    }
    
    return normalizedId.toString();
  }
  
  // For state legislation, use as-is
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

// Category Tag Component
const CategoryTag = ({ category }) => {
  if (!category) return null;
  
  // Handle "all_practice_areas" specifically
  if (category === 'all_practice_areas') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-teal-100 text-teal-800 text-xs font-medium rounded-full">
        <LayoutGrid size={12} />
        <span>All Practice Areas</span>
      </span>
    );
  }
  
  const filter = FILTERS.find(f => f.key === category);
  
  if (!filter) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
        <FileText size={12} />
        <span>Unknown</span>
      </span>
    );
  }
  
  // Get pill-style backgrounds based on category
  const getPillStyles = (cat) => {
    switch (cat) {
      case 'civic':
        return 'bg-blue-100 text-blue-800';
      case 'education':
        return 'bg-orange-100 text-orange-800';
      case 'engineering':
        return 'bg-green-100 text-green-800';
      case 'healthcare':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const IconComponent = filter.icon;
  const pillStyles = getPillStyles(category);
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 ${pillStyles} text-xs font-medium rounded-full`}>
      <IconComponent size={12} />
      <span>{filter.label}</span>
    </span>
  );
};

// Order Type Tag Component
const OrderTypeTag = ({ orderType }) => {
  if (orderType === 'executive_order') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
        <ScrollText size={12} />
        Executive Order
      </span>
    );
  }
  
  if (orderType === 'state_legislation') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
        <FileText size={12} />
        State Legislation
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
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
    <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
      {stateAbbr}
    </span>
  );
};

// Format talking points
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

// Format universal content
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
// ENHANCED API SERVICE FOR HIGHLIGHTS
// =====================================
class HighlightsAPI {
  static async getHighlights(userId = 1) {
    try {
      console.log('🔍 Fetching highlights for user:', userId);
      
      const response = await fetch(`${API_URL}/api/highlights?user_id=${userId}`);
      
      if (!response.ok) {
        console.warn('⚠️ Highlights endpoint failed:', response.status);
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
      
      console.log('✅ Found highlights:', highlights.length);
      return highlights;
    } catch (error) {
      console.error('Error fetching highlights:', error);
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

  // Get ALL executive orders (no pagination limit)
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
      
      // Try different parameter formats
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
            
            // If we got a good response, break
            if (orders.length > 0) break;
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

// =====================================
// DEBUG FUNCTIONS
// =====================================
const debugHighlightMatching = async () => {
  console.log('🔍 ========== HIGHLIGHTS DEBUG SESSION ==========');
  
  try {
    // Step 1: Get raw highlights from backend
    const backendHighlights = await HighlightsAPI.getHighlights(1);
    console.log('📋 Backend highlights:', backendHighlights);
    
    // Step 2: Get all orders from database
    const [executiveOrders, stateLegislation] = await Promise.all([
      HighlightsAPI.getAllExecutiveOrders(),
      HighlightsAPI.getAllStateLegislation()
    ]);
    
    console.log(`📊 Database orders: ${executiveOrders.length} EOs, ${stateLegislation.length} state bills`);
    
    // Step 3: Show what IDs are stored in highlights database
    const storedHighlightIds = backendHighlights.map(h => ({
      order_id: h.order_id,
      order_type: h.order_type,
      stored_as: typeof h.order_id
    }));
    console.log('🏪 Stored highlight IDs:', storedHighlightIds);
    
    // Step 4: Show what IDs are generated by frontend for executive orders
    const frontendEOIds = executiveOrders.slice(0, 10).map(eo => ({
      title: eo.title?.substring(0, 30),
      generated_id: getUniversalOrderId({ ...eo, order_type: 'executive_order' }),
      eo_number: eo.executive_order_number,
      document_number: eo.document_number,
      id_field: eo.id
    }));
    console.log('🔧 Frontend EO IDs (sample):', frontendEOIds);
    
    // Step 5: Show what IDs are generated by frontend for state legislation
    const frontendStateIds = stateLegislation.slice(0, 10).map(bill => ({
      title: bill.title?.substring(0, 30),
      generated_id: getUniversalOrderId({ ...bill, order_type: 'state_legislation' }),
      bill_number: bill.bill_number,
      bill_id: bill.bill_id,
      id_field: bill.id
    }));
    console.log('🔧 Frontend State IDs (sample):', frontendStateIds);
    
    // Step 6: Attempt to match highlights with orders using ENHANCED MATCHING
    const matchResults = backendHighlights.map(highlight => {
      const orderId = highlight.order_id;
      const orderType = highlight.order_type;
      
      let foundMatch = null;
      
      if (orderType === 'executive_order') {
        foundMatch = executiveOrders.find(eo => {
          const strategies = [
            // Direct field matches
            eo.executive_order_number === orderId,
            eo.document_number === orderId,
            eo.id === orderId,
            eo.eo_number === orderId,
            
            // Generated ID matches
            getUniversalOrderId({ ...eo, order_type: 'executive_order' }) === orderId,
            
            // Normalized ID matches
            normalizeBackendId(getUniversalOrderId({ ...eo, order_type: 'executive_order' }), 'executive_order') === orderId,
            
            // Prefix variations
            `eo-${eo.executive_order_number}` === orderId,
            `eo-${eo.document_number}` === orderId,
            `eo-${eo.id}` === orderId,
            
            // Remove prefix variations
            eo.executive_order_number === orderId.replace('eo-', ''),
            eo.document_number === orderId.replace('eo-', ''),
            eo.id === orderId.replace('eo-', ''),
            
            // String/number type variations
            String(eo.executive_order_number) === String(orderId),
            String(eo.document_number) === String(orderId),
            String(eo.id) === String(orderId)
          ];
          
          return strategies.some(Boolean);
        });
      } else if (orderType === 'state_legislation') {
        foundMatch = stateLegislation.find(bill => {
          const strategies = [
            // Direct field matches
            bill.bill_id === orderId,
            bill.id === orderId,
            bill.bill_number === orderId,
            
            // Generated ID matches
            getUniversalOrderId({ ...bill, order_type: 'state_legislation' }) === orderId,
            
            // State-prefix variations
            `${bill.state}-${bill.bill_number}` === orderId,
            
            // String/number type variations
            String(bill.bill_id) === String(orderId),
            String(bill.id) === String(orderId),
            String(bill.bill_number) === String(orderId)
          ];
          
          return strategies.some(Boolean);
        });
      }
      
      return {
        highlight_id: orderId,
        highlight_type: orderType,
        found_match: !!foundMatch,
        match_title: foundMatch?.title?.substring(0, 40) || 'NO MATCH'
      };
    });
    
    console.log('🎯 Match Results:', matchResults);
    
    const matchedCount = matchResults.filter(r => r.found_match).length;
    const unmatchedCount = matchResults.filter(r => !r.found_match).length;
    
    console.log(`📊 SUMMARY: ${matchedCount} matched, ${unmatchedCount} unmatched highlights`);
    
    if (unmatchedCount > 0) {
      console.log('❌ UNMATCHED HIGHLIGHTS:');
      matchResults.filter(r => !r.found_match).forEach(r => {
        console.log(`   • ${r.highlight_id} (${r.highlight_type})`);
      });
    }
    
    return {
      backendHighlights: backendHighlights.length,
      databaseOrders: executiveOrders.length + stateLegislation.length,
      matched: matchedCount,
      unmatched: unmatchedCount,
      details: matchResults
    };
    
  } catch (error) {
    console.error('❌ Debug session failed:', error);
    return { error: error.message };
  }
};

// =====================================
// ENHANCED HIGHLIGHTS HOOK
// =====================================
const useHighlightsEnhanced = (userId = 1) => {
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const loadHighlights = async () => {
    try {
      setLoading(true);
      console.log('🔍 useHighlightsEnhanced: Starting enhanced highlights load...');
      
      // Step 1: Get highlighted order IDs from backend
      const fetchedHighlights = await HighlightsAPI.getHighlights(userId);
      console.log('📋 Raw highlights from backend:', fetchedHighlights.length);
      
      if (fetchedHighlights.length === 0) {
        setHighlights([]);
        setLastRefresh(Date.now());
        return;
      }
      
      // Step 2: Get ALL orders from database
      const [executiveOrders, stateLegislation] = await Promise.all([
        HighlightsAPI.getAllExecutiveOrders(),
        HighlightsAPI.getAllStateLegislation()
      ]);
      
      console.log(`📊 Database content: ${executiveOrders.length} EOs, ${stateLegislation.length} state bills`);
      
      // Step 3: Create comprehensive matching using multiple ID strategies
      const matchedOrders = [];
      
      fetchedHighlights.forEach((highlight, index) => {
        const orderId = highlight.order_id;
        const orderType = highlight.order_type;
        
        console.log(`🎯 Matching highlight ${index + 1}: ${orderId} (${orderType})`);
        
        let matchedOrder = null;
        
        if (orderType === 'executive_order') {
          // Try multiple matching strategies for executive orders
          matchedOrder = executiveOrders.find(eo => {
            const strategies = [
              // Direct field matches
              eo.executive_order_number === orderId,
              eo.document_number === orderId,
              eo.id === orderId,
              eo.eo_number === orderId,
              
              // Generated ID matches
              getUniversalOrderId({ ...eo, order_type: 'executive_order' }) === orderId,
              
              // Normalized ID matches
              normalizeBackendId(getUniversalOrderId({ ...eo, order_type: 'executive_order' }), 'executive_order') === orderId,
              
              // Prefix variations
              `eo-${eo.executive_order_number}` === orderId,
              `eo-${eo.document_number}` === orderId,
              `eo-${eo.id}` === orderId,
              
              // Remove prefix variations
              eo.executive_order_number === orderId.replace('eo-', ''),
              eo.document_number === orderId.replace('eo-', ''),
              eo.id === orderId.replace('eo-', ''),
              
              // String/number type variations
              String(eo.executive_order_number) === String(orderId),
              String(eo.document_number) === String(orderId),
              String(eo.id) === String(orderId)
            ];
            
            return strategies.some(Boolean);
          });
          
          if (matchedOrder) {
            console.log(`✅ EO Match found: "${matchedOrder.title?.substring(0, 40)}..."`);
            
            const transformedOrder = {
              ...matchedOrder,
              id: getUniversalOrderId({ ...matchedOrder, order_type: 'executive_order' }),
              order_type: 'executive_order',
              title: cleanOrderTitle(matchedOrder.title),
              ai_processed: !!(matchedOrder.ai_summary || matchedOrder.ai_executive_summary),
              ai_summary: matchedOrder.ai_summary || matchedOrder.ai_executive_summary || '',
              ai_talking_points: matchedOrder.ai_talking_points || matchedOrder.ai_key_points || '',
              ai_business_impact: matchedOrder.ai_business_impact || matchedOrder.ai_potential_impact || '',
              formatted_signing_date: formatDate(matchedOrder.signing_date || matchedOrder.introduced_date),
              formatted_publication_date: formatDate(matchedOrder.publication_date || matchedOrder.last_action_date),
              is_highlighted: true
            };
            
            matchedOrders.push(transformedOrder);
          }
          
        } else if (orderType === 'state_legislation') {
          // Try multiple matching strategies for state legislation
          matchedOrder = stateLegislation.find(bill => {
            const strategies = [
              // Direct field matches
              bill.bill_id === orderId,
              bill.id === orderId,
              bill.bill_number === orderId,
              
              // Generated ID matches
              getUniversalOrderId({ ...bill, order_type: 'state_legislation' }) === orderId,
              
              // State-prefix variations
              `${bill.state}-${bill.bill_number}` === orderId,
              
              // String/number type variations
              String(bill.bill_id) === String(orderId),
              String(bill.id) === String(orderId),
              String(bill.bill_number) === String(orderId)
            ];
            
            return strategies.some(Boolean);
          });
          
          if (matchedOrder) {
            console.log(`✅ State Match found: "${matchedOrder.title?.substring(0, 40)}..."`);
            
            const transformedOrder = {
              ...matchedOrder,
              id: getUniversalOrderId({ ...matchedOrder, order_type: 'state_legislation' }),
              order_type: 'state_legislation',
              title: cleanOrderTitle(matchedOrder.title || matchedOrder.bill_title),
              ai_processed: !!(matchedOrder.ai_summary || matchedOrder.ai_executive_summary),
              ai_summary: matchedOrder.ai_summary || matchedOrder.ai_executive_summary || '',
              ai_talking_points: matchedOrder.ai_talking_points || matchedOrder.ai_key_points || '',
              ai_business_impact: matchedOrder.ai_business_impact || matchedOrder.ai_potential_impact || '',
              formatted_signing_date: formatDate(matchedOrder.introduced_date || matchedOrder.last_action_date),
              source: matchedOrder.state ? `${matchedOrder.state} Legislature` : 'State Legislature',
              is_highlighted: true
            };
            
            matchedOrders.push(transformedOrder);
          }
        }
        
        if (!matchedOrder) {
          console.log(`❌ No match found for: ${orderId} (${orderType})`);
        }
      });
      
      console.log(`✅ Final matched orders: ${matchedOrders.length} of ${fetchedHighlights.length} highlights`);
      
      // Sort by date - newest first
      matchedOrders.sort((a, b) => {
        const dateA = new Date(getDateForSorting(a));
        const dateB = new Date(getDateForSorting(b));
        return dateB.getTime() - dateA.getTime();
      });
      
      setHighlights(matchedOrders);
      setLastRefresh(Date.now());
      
    } catch (error) {
      console.error('❌ Error in useHighlightsEnhanced:', error);
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
  
  // Local-only version for when API call has already been made
  const removeHighlightLocally = (highlight) => {
    const orderId = getUniversalOrderId(highlight);
    console.log('🗑️ Removing highlight locally (no API call):', orderId);
    setHighlights(prev => prev.filter(item => getUniversalOrderId(item) !== orderId));
    setLastRefresh(Date.now());
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
    removeHighlightLocally,
    refreshHighlights,
    lastRefresh,
    debugHighlightMatching // Add debug function
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

// =====================================
// MAIN HIGHLIGHTS PAGE COMPONENT
// =====================================
const HighlightsPage = ({ makeApiCall, copyToClipboard, stableHandlers }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  
  // Filter state
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  
  // Highlight management
  const [localHighlights, setLocalHighlights] = useState(new Set());
  const [highlightLoading, setHighlightLoading] = useState(new Set());
  const [copiedHighlights, setCopiedHighlights] = useState(new Set());
  
  // Additional state for immediate UI updates
  const [displayHighlights, setDisplayHighlights] = useState([]);
  
  const navigate = useNavigate();
  const filterDropdownRef = useRef(null);

  // Use enhanced highlights hook
  const {
    highlights,
    loading,
    removeHighlight,
    removeHighlightLocally,
    refreshHighlights,
    lastRefresh,
    debugHighlightMatching
  } = useHighlightsEnhanced(1);

  // Sync display highlights with hook highlights
  useEffect(() => {
    console.log('🔄 Syncing displayHighlights with hook highlights:', highlights.length);
    setDisplayHighlights(highlights);
  }, [highlights]);

  // Load existing highlights with proper ID handling
  useEffect(() => {
    const loadExistingHighlights = async () => {
      try {
        console.log('🔍 HighlightsPage: Loading existing highlights...');
        const fetchedHighlights = await HighlightsAPI.getHighlights(1);
        
        const orderIds = new Set();
        fetchedHighlights.forEach((highlight) => {
          if (highlight && highlight.order_id) {
            const rawId = highlight.order_id;
            orderIds.add(rawId);
            
            // For executive orders, handle both prefixed and non-prefixed versions
            if (highlight.order_type === 'executive_order') {
              if (typeof rawId === 'string' && rawId.startsWith('eo-')) {
                const numberOnly = rawId.replace('eo-', '');
                orderIds.add(numberOnly);
              } else if (/^\d{4,5}$/.test(rawId.toString())) {
                orderIds.add(`eo-${rawId}`);
              }
            }
          }
        });
        
        setLocalHighlights(orderIds);
        console.log('🌟 HighlightsPage: Final local highlights set:', Array.from(orderIds));
      } catch (error) {
        console.error('Error loading existing highlights:', error);
      }
    };
    
    loadExistingHighlights();
  }, []);

  // Filter functions with proper "All Practice Areas" handling
  const toggleFilter = (filterKey) => {
    console.log('🔄 toggleFilter called with:', filterKey);
    setSelectedFilters(prev => {
      let newFilters;
      
      if (filterKey === 'all_practice_areas') {
        console.log('🔄 All practice areas clicked');
        if (prev.includes('all_practice_areas')) {
          newFilters = prev.filter(f => f !== 'all_practice_areas');
        } else {
          newFilters = prev.filter(f => !['civic', 'healthcare', 'education', 'engineering'].includes(f));
          newFilters.push('all_practice_areas');
        }
      } else if (['civic', 'healthcare', 'education', 'engineering'].includes(filterKey)) {
        console.log('🔄 Category filter clicked:', filterKey);
        const withoutAllPracticeAreas = prev.filter(f => f !== 'all_practice_areas');
        if (withoutAllPracticeAreas.includes(filterKey)) {
          newFilters = withoutAllPracticeAreas.filter(f => f !== filterKey);
        } else {
          newFilters = [...withoutAllPracticeAreas, filterKey];
        }
      } else {
        console.log('🔄 Other filter clicked:', filterKey);
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

  // Filter counts calculation
  const filterCounts = useMemo(() => {
    const counts = {
      civic: 0,
      healthcare: 0,
      education: 0,
      engineering: 0,
      all_practice_areas: 0,
      executive_order: 0,
      state_legislation: 0,
      total: 0
    };

    displayHighlights.forEach(highlight => {
      if (highlight.category && counts.hasOwnProperty(highlight.category)) {
        counts[highlight.category]++;
      }
      
      if (highlight.order_type === 'executive_order') {
        counts.executive_order++;
      } else if (highlight.order_type === 'state_legislation') {
        counts.state_legislation++;
      }
    });

    counts.total = displayHighlights.length;
    return counts;
  }, [displayHighlights]);

  // Comprehensive filtering logic
  const filteredHighlights = useMemo(() => {
    let filtered = [...displayHighlights];

    const categoryFilters = selectedFilters.filter(f => 
      !['executive_order', 'state_legislation', 'all_practice_areas'].includes(f)
    );
    
    const hasAllPracticeAreas = selectedFilters.includes('all_practice_areas');
    
    if (!hasAllPracticeAreas && categoryFilters.length > 0) {
      filtered = filtered.filter(highlight => 
        categoryFilters.includes(highlight?.category)
      );
    }

    const hasExecutiveOrderFilter = selectedFilters.includes('executive_order');
    const hasStateLegislationFilter = selectedFilters.includes('state_legislation');
    
    if (hasExecutiveOrderFilter && !hasStateLegislationFilter) {
      filtered = filtered.filter(highlight => highlight.order_type === 'executive_order');
    } else if (hasStateLegislationFilter && !hasExecutiveOrderFilter) {
      filtered = filtered.filter(highlight => highlight.order_type === 'state_legislation');
    }

    filtered.sort((a, b) => {
      const dateA = new Date(getDateForSorting(a));
      const dateB = new Date(getDateForSorting(b));
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`🔍 Filtered and sorted highlights: ${filtered.length} of ${displayHighlights.length} total`);
    return filtered;
  }, [displayHighlights, selectedFilters]);

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

  // Enhanced highlighting function with extensive logging
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
    
    const backendOrderId = normalizeBackendId(orderId, order.order_type);
    console.log('🔍 Normalized backend ID:', backendOrderId);
    
    const isCurrentlyHighlighted = localHighlights.has(orderId) || localHighlights.has(backendOrderId);
    console.log('🌟 Current highlight status:', isCurrentlyHighlighted);
    
    setHighlightLoading(prev => new Set([...prev, orderId]));
    
    try {
      if (isCurrentlyHighlighted) {
        console.log('🗑️ ========== STARTING UNHIGHLIGHT PROCESS ==========');
        
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
          console.log('✅ Backend deletion successful');
          // Update the hook's state without making another API call
          removeHighlightLocally(order);
        }
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

  // Improved highlight status check
  const isOrderHighlighted = useCallback((order) => {
    const orderId = getUniversalOrderId(order);
    if (!orderId) {
      return false;
    }
    
    const backendOrderId = normalizeBackendId(orderId, order.order_type);
    
    const localHighlighted = localHighlights.has(orderId) || 
                            localHighlights.has(backendOrderId) ||
                            localHighlights.has(`eo-${orderId}`) ||
                            localHighlights.has(`eo-${backendOrderId}`);
    
    const stableHighlighted = stableHandlers?.isItemHighlighted?.(order) || false;
    
    return localHighlighted || stableHighlighted;
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

  const hasHighlights = displayHighlights && displayHighlights.length > 0;

  return (
    <div className="pt-6">
      
      {/* Scroll to Top Button */}
      <ScrollToTopButton />

      <HR1PolicyBanner 
        onClick={() => {
          navigate('/hr1');
        }}
        expirationDate="2025-08-01"
      />

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Star />
          <h2 className="text-2xl font-bold text-gray-800">Highlights</h2>
        </div>
        <p className="text-gray-600">
          Manage a collection of important legislation and executive orders. View, organize, and analyze your highlighted items with comprehensive AI insights including executive summaries, key talking points, and business impact assessments. Filter by practice area or jurisdiction, and keep track of the legislative developments most relevant to your interests and responsibilities.
        </p>
      </div>

      {/* Controls Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          {/* Left side - Refresh Button and Status */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className={`px-4 py-3 rounded-lg text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                isRefreshing
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200'
              }`}
              title="Refresh highlights from server"
            >
              <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            
            {/* Last updated text */}
            {lastRefresh && (
              <div className="text-sm text-gray-500">
                Last updated: {formatLastRefresh(lastRefresh)}
              </div>
            )}
          </div>

          {/* Right side - Filter Button and Clear Filters */}
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

            {/* Filter Button */}
            <div className="relative">
              <FilterDropdown
                ref={filterDropdownRef}
                selectedFilters={selectedFilters}
                showFilterDropdown={showFilterDropdown}
                onToggleDropdown={() => setShowFilterDropdown(!showFilterDropdown)}
                onToggleFilter={toggleFilter}
                onClearAllFilters={clearAllFilters}
                counts={filterCounts}
                showContentTypes={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Highlights Display */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          {loading ? (
            <ShimmerLoader 
              variant="highlights" 
              count={5} 
              showHeader={false} 
            />
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
              {selectedFilters.length > 0 ? (
                <button
                  onClick={clearAllFilters}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300"
                >
                  Clear Filters
                </button>
              ) : (
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
            <div className="space-y-4">
              {paginatedHighlights.map((highlight, index) => {
                const globalIndex = (currentPage - 1) * itemsPerPage + index;
                const highlightWithIndex = { ...highlight, index: globalIndex };
                const orderId = getUniversalOrderId(highlightWithIndex);
                const isExpanded = expandedOrders.has(orderId);
                
                return (
                  <div key={`highlight-${orderId}-${globalIndex}`} className="border rounded-lg overflow-hidden transition-all duration-300 border-gray-200">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            {globalIndex + 1}. {cleanOrderTitle(highlight.title)}
                          </h3>
                          
                          {/* Executive Order Style Header */}
                          {highlight.order_type === 'executive_order' ? (
                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mb-2">
                              <span className="font-medium">
                                Executive Order #: {getExecutiveOrderNumber(highlight)}
                              </span>
                              <span>-</span>
                              <span className="font-medium">
                                Signed Date: {highlight.formatted_signing_date || highlight.formatted_publication_date || 'Unknown'}
                              </span>
                              <span>-</span>
                              <span className="font-medium">
                                Published Date: {highlight.formatted_publication_date || highlight.formatted_signing_date || 'Unknown'}
                              </span>
                              <span>-</span>
                              <CategoryTag category={highlight.category} />
                              <span>-</span>
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                <ScrollText size={12} />
                                Executive Order
                              </span>
                            </div>
                          ) : (
                            /* State Legislation Style Header */
                            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mb-2">
                              <span className="font-medium">
                                Bill #: {highlight.bill_number || 'Unknown'}
                              </span>
                              <span>-</span>
                              <span className="font-medium">
                                Date: {highlight.formatted_signing_date || formatDate(highlight.introduced_date) || formatDate(highlight.last_action_date) || 'Unknown'}
                              </span>
                              <span>-</span>
                              <CategoryTag category={highlight.category} />
                              <span>-</span>
                              <OrderTypeTag orderType={highlight.order_type} />
                              {highlight.state && (
                                <>
                                  <span>-</span>
                                  <StateTag state={highlight.state} />
                                </>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 ml-4">
                          {/* Highlight toggle button */}
                          <button
                            type="button"
                            className={`p-2 rounded-md transition-all duration-300 ${
                              isOrderHighlighted(highlightWithIndex)
                                ? 'text-yellow-500 bg-yellow-100 hover:bg-yellow-200'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-yellow-500'
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
                          
                          {/* Expand/collapse button */}
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

                      {/* Executive Summary (always visible for Executive Orders) */}
                      {highlight.order_type === 'executive_order' && highlight.ai_processed && highlight.ai_summary && (
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
                                {stripHtmlTags(highlight.ai_summary)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* State Legislation Summary (always visible) */}
                      {highlight.order_type === 'state_legislation' && highlight.ai_processed && highlight.ai_summary && (
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
                              <div className="universal-text-content" style={{
                                fontSize: '14px',
                                lineHeight: '1.6',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word',
                                whiteSpace: 'normal'
                              }}>
                                {stripHtmlTags(highlight.ai_summary)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div>
                          {/* Azure AI Talking Points */}
                          {highlight.ai_processed && highlight.ai_talking_points && (
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
                                  {formatTalkingPoints(highlight.ai_talking_points)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Azure AI Business Impact */}
                          {highlight.ai_processed && highlight.ai_business_impact && (
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
                                  {formatUniversalContent(highlight.ai_business_impact)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* No AI Analysis Message */}
                          {!highlight.ai_processed && (
                            <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium text-yellow-800">No AI Analysis Available</h4>
                                  <p className="text-yellow-700 text-sm">
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
                                className="px-3 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-all duration-300 text-sm flex items-center gap-2"
                              >
                                <ExternalLink size={14} />
                                {highlight.order_type === 'executive_order' ? 'Federal Register' : 'Official Source'}
                              </a>
                            )}
                            
                            {highlight.pdf_url && (
                              <a
                                href={highlight.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-all duration-300 text-sm flex items-center gap-2"
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
                                className="px-3 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-all duration-300 text-sm flex items-center gap-2"
                              >
                                <ExternalLink size={14} />
                                View on LegiScan
                              </a>
                            )}

                            {/* Copy Details Button */}
                            <button 
                              type="button"
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                                copiedHighlights.has(orderId)
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Create comprehensive report
                                const orderReport = [
                                  highlight.title,
                                  highlight.order_type === 'executive_order' 
                                    ? `Executive Order #${getExecutiveOrderNumber(highlight)}`
                                    : `Bill #${highlight.bill_number || 'Unknown'}`,
                                  highlight.president ? `President: ${highlight.president}` : '',
                                  highlight.state ? `State: ${highlight.state}` : '',
                                  highlight.formatted_signing_date ? `Date: ${highlight.formatted_signing_date}` : '',
                                  highlight.category ? `Category: ${highlight.category}` : '',
                                  '',
                                  highlight.ai_summary ? `AI Summary: ${stripHtmlTags(highlight.ai_summary)}` : '',
                                  highlight.summary ? `Basic Summary: ${highlight.summary}` : '',
                                  highlight.ai_talking_points ? `Key Talking Points: ${stripHtmlTags(highlight.ai_talking_points)}` : '',
                                  highlight.ai_business_impact ? `Business Impact: ${stripHtmlTags(highlight.ai_business_impact)}` : '',
                                  highlight.html_url ? `Official URL: ${highlight.html_url}` : '',
                                  highlight.pdf_url ? `PDF URL: ${highlight.pdf_url}` : '',
                                  highlight.legiscan_url ? `LegiScan URL: ${highlight.legiscan_url}` : ''
                                ].filter(line => line.length > 0).join('\n');
                                
                                // Enhanced copy functionality with feedback
                                const copySuccess = async () => {
                                  try {
                                    if (copyToClipboard && typeof copyToClipboard === 'function') {
                                      copyToClipboard(orderReport);
                                    } else if (navigator.clipboard) {
                                      await navigator.clipboard.writeText(orderReport);
                                    } else {
                                      // Fallback for older browsers
                                      const textArea = document.createElement('textarea');
                                      textArea.value = orderReport;
                                      document.body.appendChild(textArea);
                                      textArea.select();
                                      document.execCommand('copy');
                                      document.body.removeChild(textArea);
                                    }
                                    
                                    // Show copied state
                                    setCopiedHighlights(prev => new Set([...prev, orderId]));
                                    console.log('✅ Copied highlight report to clipboard');
                                    
                                    // Reset after 2 seconds
                                    setTimeout(() => {
                                      setCopiedHighlights(prev => {
                                        const newSet = new Set(prev);
                                        newSet.delete(orderId);
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
                              {copiedHighlights.has(orderId) ? (
                                <>
                                  <Check size={14} />
                                  <span>Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy size={14} />
                                  <span>Copy Details</span>
                                </>
                              )}
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

      {/* Universal CSS Styles */}
      <style>{`
        /* Universal content styling */
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

        .text-purple-800 .universal-ai-content,
        .text-purple-800 .universal-structured-content,
        .text-purple-800 .universal-text-content,
        .text-purple-800 .number-bullet,
        .text-purple-800 .numbered-text {
          color: #5b21b6;
        }

        .text-blue-800 .universal-ai-content,
        .text-blue-800 .universal-structured-content,
        .text-blue-800 .universal-text-content,
        .text-blue-800 .number-bullet,
        .text-blue-800 .numbered-text {
          color: #1e40af;
        }

        .text-green-800 .universal-ai-content,
        .text-green-800 .universal-structured-content,
        .text-green-800 .universal-text-content,
        .text-green-800 .number-bullet,
        .text-green-800 .numbered-text {
          color: #166534;
        }
      `}</style>
    </div>
  );
};

export default HighlightsPage;