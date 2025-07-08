// =====================================
// IMPORTS AND DEPENDENCIES
// =====================================
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ChevronDown,
  RotateCw,
  ScrollText,
  Star,
  FileText,
  ExternalLink,
  Check,
  AlertTriangle,
  Sparkles,
  Database,
  Copy,
  Building,
  GraduationCap,
  Stethoscope,
  Wrench,
  Bell,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  LayoutGrid
} from 'lucide-react';

import { 
  FILTERS, 
  getFilterActiveClass, 
  getFilterIconClass,
  getCategoryTagClass 
} from '../utils/constants';
import { calculateAllCounts } from '../utils/filterUtils';
import API_URL from '../config/api';
import ShimmerLoader from '../components/ShimmerLoader';
import useReviewStatus from '../hooks/useReviewStatus';

// =====================================
// CONFIGURATION AND CONSTANTS
// =====================================
const CATEGORY_FILTERS = FILTERS.filter(filter => 
  ['civic', 'education', 'engineering', 'healthcare'].includes(filter.key)
);

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
// SUB-COMPONENTS
// =====================================
const AnimatedStatusBanner = ({ children, show, delay = 10000 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (show) {
      setShouldRender(true);
      setTimeout(() => setIsVisible(true), 10);
      
      const hideTimer = setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => setShouldRender(false), 500);
      }, delay);

      return () => clearTimeout(hideTimer);
    } else {
      setIsVisible(false);
      setTimeout(() => setShouldRender(false), 500);
    }
  }, [show, delay]);

  if (!shouldRender) return null;

  return (
    <div
      className={`absolute top-24 left-1/2 transform -translate-x-1/2 z-[5] transition-all duration-500 ease-in-out ${
        isVisible 
          ? 'translate-y-0 opacity-100' 
          : '-translate-y-full opacity-0'
      }`}
      style={{
        width: 'calc(100vw - 96px)',
        maxWidth: '1200px',
      }}
    >
      {children}
    </div>
  );
};

const FilterDropdown = React.forwardRef(({ 
  selectedFilters, 
  showFilterDropdown, 
  onToggleDropdown, 
  onToggleFilter, 
  onClearAllFilters, 
  counts, 
  buttonText = "Filters"
}, ref) => {

  const isFilterActive = (filterKey) => selectedFilters.includes(filterKey);

  const handleFilterToggle = (filterKey) => {
    if (filterKey === 'all_practice_areas') {
      onToggleFilter(filterKey);
    } else if (['civic', 'education', 'engineering', 'healthcare'].includes(filterKey)) {
      if (selectedFilters.includes('all_practice_areas')) {
        onToggleFilter('all_practice_areas');
      }
      onToggleFilter(filterKey);
    } else {
      onToggleFilter(filterKey);
    }
  };

  const isAllPracticeAreasActive = () => {
    return selectedFilters.includes('all_practice_areas');
  };

  const getFilterButtonText = () => {
    if (selectedFilters.length === 0) return 'Filters';
    if (selectedFilters.length === 1) {
      if (selectedFilters[0] === 'all_practice_areas') {
        return 'All Practice Areas';
      }
      const filter = CATEGORY_FILTERS.find(f => f.key === selectedFilters[0]);
      return filter?.label || 'Filter';
    }
    return `${selectedFilters.length} Filters`;
  };

  const getAllPracticeAreasCount = () => {
    return counts?.all_practice_areas || 0;
  };

  const getFilterStyles = (filterKey, isActive) => {
    if (!isActive) return 'hover:bg-gray-50 text-gray-700';
    
    const styleMap = {
      'civic': 'bg-blue-100 text-blue-700',
      'education': 'bg-orange-100 text-orange-700',
      'engineering': 'bg-green-100 text-green-700',
      'healthcare': 'bg-red-100 text-red-700',
      'reviewed': 'bg-green-100 text-green-700',
      'not_reviewed': 'bg-red-100 text-red-700',
      'all_practice_areas': 'bg-teal-100 text-teal-700'
    };
    
    return styleMap[filterKey] || 'bg-gray-100 text-gray-700';
  };

  const getIconColor = (filterKey, isActive) => {
    if (!isActive) return 'text-gray-500';
    
    const colorMap = {
      'civic': 'text-blue-600',
      'education': 'text-orange-600',
      'engineering': 'text-green-600',
      'healthcare': 'text-red-600',
      'reviewed': 'text-green-600',
      'not_reviewed': 'text-red-600',
      'all_practice_areas': 'text-teal-600'
    };
    
    return colorMap[filterKey] || 'text-gray-600';
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={onToggleDropdown}
        className={`flex items-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium transition-all duration-300 ${
          selectedFilters.length > 0
            ? 'bg-blue-100 text-blue-700 border-blue-300'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
      >
        <span>{getFilterButtonText()}</span>
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

      {showFilterDropdown && (
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[320px] max-w-[400px]">
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

            <div className="mb-3">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Practice Areas</h4>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => handleFilterToggle('all_practice_areas')}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-all duration-200 ${
                    getFilterStyles('all_practice_areas', isAllPracticeAreasActive())
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <LayoutGrid 
                      size={14} 
                      className={getIconColor('all_practice_areas', isAllPracticeAreasActive())} 
                    />
                    <span className="text-sm">All Practice Areas</span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    isAllPracticeAreasActive()
                      ? 'bg-white bg-opacity-50' 
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {getAllPracticeAreasCount()}
                  </span>
                </button>

                {CATEGORY_FILTERS.map((filter) => {
                  const IconComponent = filter.icon;
                  const isActive = selectedFilters.includes(filter.key);
                  const count = counts?.[filter.key] || 0;
                  
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => handleFilterToggle(filter.key)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-all duration-200 ${
                        getFilterStyles(filter.key, isActive)
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <IconComponent 
                          size={14} 
                          className={getIconColor(filter.key, isActive)} 
                        />
                        <span className="text-sm">{filter.label}</span>
                      </div>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        isActive 
                          ? 'bg-white bg-opacity-50' 
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Review Status</h4>
              <div className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => handleFilterToggle('reviewed')}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-all duration-200 ${
                    getFilterStyles('reviewed', selectedFilters.includes('reviewed'))
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Check 
                      size={14} 
                      className={getIconColor('reviewed', selectedFilters.includes('reviewed'))} 
                    />
                    <span className="text-sm">Reviewed</span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    selectedFilters.includes('reviewed')
                      ? 'bg-white bg-opacity-50' 
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {counts?.reviewed || 0}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFilterToggle('not_reviewed')}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md transition-all duration-200 ${
                    getFilterStyles('not_reviewed', selectedFilters.includes('not_reviewed'))
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <AlertTriangle 
                      size={14} 
                      className={getIconColor('not_reviewed', selectedFilters.includes('not_reviewed'))} 
                    />
                    <span className="text-sm">Not Reviewed</span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    selectedFilters.includes('not_reviewed')
                      ? 'bg-white bg-opacity-50' 
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {counts?.not_reviewed || 0}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

const EditableCategoryTag = ({ 
  category, 
  orderId, 
  onCategoryChange, 
  disabled = false,
  isUpdating = false 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);

  const availableCategories = [
    { key: 'all_practice_areas', label: 'All Practice Areas', color: 'bg-teal-100 text-teal-800', icon: LayoutGrid },
    { key: 'civic', label: 'Civic', color: 'bg-blue-100 text-blue-800', icon: Building },
    { key: 'healthcare', label: 'Healthcare', color: 'bg-red-100 text-red-800', icon: Stethoscope },
    { key: 'education', label: 'Education', color: 'bg-orange-100 text-orange-800', icon: GraduationCap },
    { key: 'engineering', label: 'Engineering', color: 'bg-green-100 text-green-800', icon: Wrench },
    { key: 'not_applicable', label: 'Not Applicable', color: 'bg-gray-100 text-gray-800', icon: FileText }
  ];

  const getCurrentCategory = () => {
    const foundCategory = availableCategories.find(cat => cat.key === category);
    if (foundCategory) {
      return foundCategory;
    }
    
    console.warn(`Category "${category}" not found in available categories, falling back to first option`);
    return availableCategories[1];
  };

  const handleCategorySelect = async (newCategory) => {
    if (newCategory === category || disabled || isLoading) {
      console.log(`🚫 Category selection blocked: newCategory=${newCategory}, currentCategory=${category}, disabled=${disabled}, isLoading=${isLoading}`);
      return;
    }
    
    console.log(`🎯 Category selection initiated: ${category} → ${newCategory} for order ${orderId}`);
    setIsLoading(true);
    
    try {
      if (onCategoryChange) {
        await onCategoryChange(orderId, newCategory);
        console.log(`✅ Category successfully changed: ${category} → ${newCategory}`);
      } else {
        console.warn('⚠️ onCategoryChange function not provided');
      }
    } catch (error) {
      console.error('❌ Failed to update category:', error);
    } finally {
      setIsLoading(false);
      setIsEditing(false);
    }
  };

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

  const currentCategory = getCurrentCategory();
  const IconComponent = currentCategory.icon;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <span 
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 ${
          currentCategory.color
        } ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm hover:ring-1 hover:ring-gray-300'
        } ${
          isUpdating || isLoading ? 'animate-pulse' : ''
        }`}
        onClick={() => !disabled && !isLoading && setIsEditing(!isEditing)}
        title={disabled ? 'Category editing disabled' : 'Click to change category'}
      >
        <IconComponent
          size={12}
          className={
            category === 'all_practice_areas' ? 'text-teal-600' :
            category === 'civic' ? 'text-blue-600' :
            category === 'education' ? 'text-orange-600' :
            category === 'engineering' ? 'text-green-600' :
            category === 'healthcare' ? 'text-red-600' :
            'text-gray-600'
          }
        />
        <span>{currentCategory.label}</span>
        {!disabled && !isLoading && (
          <ChevronDown 
            size={10} 
            className={`transition-transform duration-200 ml-1 ${isEditing ? 'rotate-180' : ''}`}
          />
        )}
        {(isUpdating || isLoading) && (
          <RotateCw size={10} className="animate-spin ml-1" />
        )}
      </span>

      {isEditing && !disabled && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[160px] max-h-48 overflow-y-auto">
          <div className="py-1">
            <div className="px-3 py-1 text-xs font-medium text-gray-500 border-b border-gray-100">
              Select Category
            </div>
            {availableCategories.map((cat) => {
              const CatIcon = cat.icon;
              const isSelected = cat.key === category;
              
              return (
                <button
                  key={cat.key}
                  onClick={() => handleCategorySelect(cat.key)}
                  disabled={isSelected || isLoading}
                  className={`w-full px-3 py-2 text-left text-xs transition-colors duration-150 flex items-center gap-2 ${
                    isSelected 
                      ? 'bg-blue-50 text-blue-700 cursor-not-allowed' 
                      : 'hover:bg-gray-50 cursor-pointer text-gray-700'
                  } ${isLoading ? 'opacity-50' : ''}`}
                >
                  <CatIcon size={12} className="flex-shrink-0" />
                  <span className="truncate flex-1">{cat.label}</span>
                  {isSelected && (
                    <Check size={10} className="text-blue-600 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
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

  if (totalPages <= 1) return null;

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
            currentPage === 1
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
// MAIN COMPONENT
// =====================================
const ExecutiveOrdersPage = ({ stableHandlers, copyToClipboard }) => {
  // =====================================
  // STATE MANAGEMENT
  // =====================================
  
  const [allOrders, setAllOrders] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Database-driven review status using useReviewStatus hook
  const {
    toggleReviewStatus,
    isItemReviewed,
    isItemReviewLoading,
    reviewedItems,
    reviewCounts
  } = useReviewStatus(allOrders, 'executive_order');

  // Debug logging for review status initialization
  useEffect(() => {
    if (allOrders.length > 0) {
      console.log('🔍 DEBUG: Review status initialization');
      allOrders.forEach((order, index) => {
        if (index < 5) {
          const orderId = getExecutiveOrderId(order);
          console.log(`Order ${orderId}: reviewed=${order.reviewed}, type=${typeof order.reviewed}`);
        }
      });
      console.log(`Total orders with reviewed=true: ${allOrders.filter(o => o.reviewed === true).length}`);
    }
  }, [allOrders]);
  
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  const [localHighlights, setLocalHighlights] = useState(new Set());
  const [highlightLoading, setHighlightLoading] = useState(new Set());
  
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  
  const [fetchingData, setFetchingData] = useState(false);
  const [fetchStatus, setFetchStatus] = useState(null);
  const [hasData, setHasData] = useState(false);
  
  const [copiedOrders, setCopiedOrders] = useState(new Set());
  
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total_pages: 1,
    count: 0
  });

  const [countCheckStatus, setCountCheckStatus] = useState({
    checking: false,
    needsFetch: false,
    newOrdersAvailable: 0,
    federalRegisterCount: 0,
    databaseCount: 0,
    lastChecked: null,
    error: null
  });

  const [categoryUpdateTrigger, setCategoryUpdateTrigger] = useState(0);
  const filterDropdownRef = useRef(null);

  // =====================================
  // COMPUTED VALUES
  // =====================================
  const filterCounts = useMemo(() => {
    console.log('🔢 Recalculating filter counts...', {
      totalOrders: allOrders.length,
      updateTrigger: categoryUpdateTrigger
    });
    
    const counts = {
      civic: 0,
      education: 0,
      engineering: 0,
      healthcare: 0,
      all_practice_areas: 0,
      reviewed: 0,
      not_reviewed: 0,
      total: allOrders.length
    };

    allOrders.forEach(order => {
      const category = order?.category;
      const isReviewed = isItemReviewed(order);
      
      if (category && counts.hasOwnProperty(category)) {
        counts[category]++;
      }
      
      if (isReviewed) {
        counts.reviewed++;
      } else {
        counts.not_reviewed++;
      }
    });

    console.log('🔢 Manual filter counts:', counts);
    return counts;
  }, [allOrders, isItemReviewed, categoryUpdateTrigger]);

  const filteredOrders = useMemo(() => {
    console.log('🔍 Running filters...', {
      selectedFilters,
      allOrdersCount: allOrders.length
    });

    let result = [...allOrders];

    const categoryFilters = selectedFilters.filter(f => 
      ['civic', 'education', 'engineering', 'healthcare', 'all_practice_areas'].includes(f)
    );
    
    if (categoryFilters.length > 0) {
      result = result.filter(order => categoryFilters.includes(order?.category));
      console.log(`🔍 After category filter: ${result.length} orders`);
    }

    const hasReviewedFilter = selectedFilters.includes('reviewed');
    const hasNotReviewedFilter = selectedFilters.includes('not_reviewed');
    
    if (hasReviewedFilter && !hasNotReviewedFilter) {
      result = result.filter(order => isItemReviewed(order));
      console.log(`🔍 After reviewed filter: ${result.length} orders`);
    } else if (hasNotReviewedFilter && !hasReviewedFilter) {
      result = result.filter(order => !isItemReviewed(order));
      console.log(`🔍 After not-reviewed filter: ${result.length} orders`);
    }

    return result;
  }, [allOrders, selectedFilters, isItemReviewed]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.per_page;
    const endIndex = startIndex + pagination.per_page;
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, pagination.page, pagination.per_page]);

  // =====================================
  // FETCH FUNCTIONS
  // =====================================
  const checkForNewExecutiveOrders = useCallback(async () => {
    try {
      setCountCheckStatus(prev => ({ ...prev, checking: true, error: null }));
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
        const hasNewOrders = data.new_orders_available > 0;
        
        setCountCheckStatus({
          checking: false,
          needsFetch: hasNewOrders,
          newOrdersAvailable: data.new_orders_available,
          federalRegisterCount: data.federal_register_count,
          databaseCount: data.database_count,
          lastChecked: new Date(data.last_checked),
          error: null
        });

      } else {
        throw new Error(data.error || 'Count check failed');
      }

    } catch (error) {
      console.error('❌ Error checking for new orders:', error);
      setCountCheckStatus(prev => ({
        ...prev,
        checking: false,
        error: error.message,
        needsFetch: false,
        newOrdersAvailable: 0
      }));
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
        save_to_db: true,
        force_fetch: true,
        fetch_only_new: false,
        max_concurrent: 3
      };

      setFetchStatus('🔄 Fetching executive orders from Federal Register with AI analysis...');

      const response = await fetch(`${API_URL}/api/executive-orders/run-pipeline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('📥 Fetch Result:', result);

      if (result.success !== false) {
        const totalOrdersProcessed = result.orders_saved || result.orders_fetched || result.total_processed || 0;
        const totalOrdersFetched = result.orders_fetched || result.total_orders || 0;
        
        setFetchStatus(
          `✅ Successfully fetched ${totalOrdersFetched} orders from Federal Register, processed ${totalOrdersProcessed} with AI analysis!`
        );
        
        setCountCheckStatus(prev => ({
          ...prev,
          databaseCount: totalOrdersProcessed,
          federalRegisterCount: totalOrdersFetched,
          needsFetch: false,
          newOrdersAvailable: 0
        }));

        setTimeout(async () => {
          await fetchFromDatabase();
          setFetchStatus(null);
        }, 2000);
        
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
  }, []);

  const fetchFromDatabase = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setFetchStatus('📊 Loading executive orders from database...');

      let allOrdersArray = [];
      let currentPage = 1;
      const perPage = 1000;

      while (true) {
        const url = `${API_URL}/api/executive-orders?page=${currentPage}&per_page=${perPage}`;
        console.log(`🔍 Database fetch page ${currentPage} from URL:`, url);
        
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
        console.log(`🔍 Database API Response page ${currentPage}:`, data);

        let pageOrders = [];
        let totalCount = 0;
        
        if (Array.isArray(data)) {
          pageOrders = data;
          totalCount = data.length;
        } else if (data.results && Array.isArray(data.results)) {
          pageOrders = data.results;
          totalCount = data.total || data.count || 0;
        }

        console.log(`📊 Page ${currentPage}: Got ${pageOrders.length} orders, total available: ${totalCount}`);

        allOrdersArray = [...allOrdersArray, ...pageOrders];

        if (pageOrders.length < perPage || allOrdersArray.length >= totalCount) {
          console.log(`✅ Database load complete: ${allOrdersArray.length} total orders collected`);
          break;
        }

        currentPage++;
      }

      const transformedOrders = allOrdersArray.map((order, index) => {
        const uniqueId = order.executive_order_number || order.document_number || order.id || order.bill_id || `order-db-${index}`;
        
        console.log(`🔍 Order ${uniqueId} - Database reviewed status:`, order.reviewed, typeof order.reviewed);
        
        return {
          id: uniqueId,
          bill_id: uniqueId,
          eo_number: order.eo_number || order.executive_order_number || 'Unknown',
          executive_order_number: order.eo_number || order.executive_order_number || 'Unknown',
          document_number: order.document_number || '',
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
          reviewed: order.reviewed === true || order.reviewed === 1 || order.reviewed === '1' || order.reviewed === 'true',
          index: index
        };
      });

      console.log(`✅ FINAL Database load: Loaded ${transformedOrders.length} total executive orders`);
      
      setAllOrders(transformedOrders);
      setFetchStatus(`✅ Loaded ${transformedOrders.length} orders from database`);
      setHasData(transformedOrders.length > 0);
      
      setPagination(prev => ({ ...prev, page: 1 }));
      
      setTimeout(() => setFetchStatus(null), 4000);

    } catch (err) {
      console.error('❌ Database load failed:', err);
      setError(`Failed to load executive orders: ${err.message}`);
      setFetchStatus(`❌ Error: ${err.message}`);
      setTimeout(() => setFetchStatus(null), 5000);
      setAllOrders([]);
      setHasData(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCategoryUpdate = useCallback(async (orderId, newCategory) => {
    try {
      console.log(`🔄 Updating category for order ${orderId} to ${newCategory}`);
      
      // Update local state immediately for better UX
      setAllOrders(prevOrders => 
        prevOrders.map(order => {
          const currentOrderId = getOrderId(order);
          if (currentOrderId === orderId) {
            console.log(`🔄 Updating order ${currentOrderId} category: ${order.category} → ${newCategory}`);
            return { ...order, category: newCategory };
          }
          return order;
        })
      );

      setOrders(prevOrders => 
        prevOrders.map(order => {
          const currentOrderId = getOrderId(order);
          if (currentOrderId === orderId) {
            console.log(`🔄 Updating displayed order ${currentOrderId} category: ${order.category} → ${newCategory}`);
            return { ...order, category: newCategory };
          }
          return order;
        })
      );

      // Trigger filter counts recalculation immediately
      setCategoryUpdateTrigger(prev => prev + 1);

      // Send update to backend
      const response = await fetch(`${API_URL}/api/executive-orders/${orderId}/category`, {
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
        console.log(`✅ Category successfully updated in database to: ${newCategory}`);
        setFetchStatus(`✅ Category updated to ${newCategory === 'all_practice_areas' ? 'All Practice Areas' : newCategory}`);
        setTimeout(() => setFetchStatus(null), 3000);
        
        setCategoryUpdateTrigger(prev => prev + 1);
      } else {
        throw new Error(result.message || 'Update failed');
      }

    } catch (error) {
      console.error('❌ Failed to update category:', error);
      
      // Revert local state changes on error
      const originalCategory = allOrders.find(o => getOrderId(o) === orderId)?.category || 'civic';
      
      setAllOrders(prevOrders => 
        prevOrders.map(order => {
          const currentOrderId = getOrderId(order);
          if (currentOrderId === orderId) {
            console.log(`🔄 Reverting order ${currentOrderId} category back to: ${originalCategory}`);
            return { ...order, category: originalCategory };
          }
          return order;
        })
      );

      setOrders(prevOrders => 
        prevOrders.map(order => {
          const currentOrderId = getOrderId(order);
          if (currentOrderId === orderId) {
            console.log(`🔄 Reverting displayed order ${currentOrderId} category back to: ${originalCategory}`);
            return { ...order, category: originalCategory };
          }
          return order;
        })
      );
      
      setCategoryUpdateTrigger(prev => prev + 1);
      
      setFetchStatus(`❌ Failed to update category: ${error.message}`);
      setTimeout(() => setFetchStatus(null), 5000);
      
      throw error;
    }
  }, [allOrders]);

  // =====================================
  // EVENT HANDLERS
  // =====================================
  const toggleFilter = (filterKey) => {
    setSelectedFilters(prev => {
      let newFilters;
      
      if (prev.includes(filterKey)) {
        newFilters = prev.filter(f => f !== filterKey);
      } else {
        newFilters = [...prev, filterKey];
      }
      
      console.log('🔄 Filter toggled:', filterKey, 'Previous filters:', prev, 'New filters:', newFilters);
      
      setPagination(prev => ({ ...prev, page: 1 }));
      
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    setSelectedFilters([]);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = useCallback((newPage) => {
    console.log(`🔄 Changing to page ${newPage}`);
    setPagination(prev => ({ ...prev, page: newPage }));
  }, []);

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
  // EFFECTS
  // =====================================
  useEffect(() => {
    const totalFiltered = filteredOrders.length;
    const totalPages = Math.ceil(totalFiltered / pagination.per_page);
    
    const currentPage = pagination.page > totalPages ? 1 : pagination.page;
    
    setOrders(paginatedOrders);
    setPagination(prev => ({
      ...prev,
      page: currentPage,
      total_pages: totalPages,
      count: totalFiltered
    }));

    console.log(`🔍 Pagination updated: ${totalFiltered} total, ${totalPages} pages, showing page ${currentPage}`);
  }, [filteredOrders, paginatedOrders, pagination.per_page, pagination.page]);

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

  useEffect(() => {
    console.log('🚀 Component mounted - attempting auto-load...');
    
    const autoLoad = async () => {
      try {
        await fetchFromDatabase();
        setTimeout(() => {
          checkForNewExecutiveOrders();
        }, 1000);
      } catch (err) {
        console.error('❌ Auto-load failed:', err);
      }
    };

    const timeoutId = setTimeout(autoLoad, 100);
    return () => clearTimeout(timeoutId);
  }, [fetchFromDatabase, checkForNewExecutiveOrders]);

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
  // COUNT STATUS COMPONENT
  // =====================================
  const CountStatusComponent = () => {
    if (countCheckStatus.checking) {
      return (
        <AnimatedStatusBanner show={true} delay={8000}>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2">
              <RotateCw size={16} className="animate-spin text-blue-600" />
              <span className="text-sm text-blue-700 font-medium">
                Checking for new executive orders...
              </span>
            </div>
          </div>
        </AnimatedStatusBanner>
      );
    }

    if (countCheckStatus.error) {
      return (
        <AnimatedStatusBanner show={true} delay={12000}>
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-yellow-600" />
                <span className="text-sm text-yellow-700">
                  Unable to check for updates: {countCheckStatus.error}
                </span>
              </div>
              <button
                onClick={checkForNewExecutiveOrders}
                className="text-yellow-700 hover:text-yellow-800 text-sm font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        </AnimatedStatusBanner>
      );
    }

    if (countCheckStatus.needsFetch && countCheckStatus.newOrdersAvailable > 0) {
      return (
        <AnimatedStatusBanner show={true} delay={15000}>
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
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
        </AnimatedStatusBanner>
      );
    }

    if (countCheckStatus.lastChecked && 
        countCheckStatus.federalRegisterCount > 0 && 
        countCheckStatus.databaseCount > 0 && 
        countCheckStatus.newOrdersAvailable === 0) {
      return (
        <AnimatedStatusBanner show={true} delay={8000}>
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
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
        </AnimatedStatusBanner>
      );
    }

    return null;
  };

  // =====================================
  // RENDER COMPONENT
  // =====================================
  return (
    <div className="pt-6">
      <ScrollToTopButton />
      
      {/* Status Banners */}
      <AnimatedStatusBanner show={fetchStatus || fetchingData || loading} delay={10000}>
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg shadow-sm">
          <div className="flex items-center gap-2">
            {(fetchingData || loading) && (
              <RotateCw size={16} className="animate-spin text-blue-600" />
            )}
            <span className="text-sm text-blue-700 font-medium">
              {fetchStatus || (fetchingData ? 'Processing...' : 'Loading...')}
            </span>
          </div>
        </div>
      </AnimatedStatusBanner>

      <CountStatusComponent />
      
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <ScrollText/>
          <h2 className="text-2xl font-bold text-gray-800">Executive Orders</h2>
        </div>
        <p className="text-gray-600">
          Access the latest federal executive orders with comprehensive AI-powered analysis. Our advanced models provide executive summaries, key strategic insights, and business impact assessments to help you understand the implications of presidential directives. Direct links to the Federal Register and official documents are included for detailed review.
        </p> 
      </div>

      {/* Filter and Fetch Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center">
          {/* Left side - Fetch Executive Orders Button */}
          <div className="relative">
            <button
              onClick={fetchExecutiveOrders}
              disabled={fetchingData || loading}
              className={`px-6 py-3 rounded-lg border transition-all duration-300 text-center transform hover:scale-104 relative flex items-center gap-2 ${
                fetchingData || loading
                  ? 'opacity-50 cursor-not-allowed' 
                  : countCheckStatus.needsFetch && countCheckStatus.newOrdersAvailable > 0
                  ? 'hover:shadow-lg hover:border-blue-300 hover:bg-blue-50 border-blue-200 bg-blue-50'
                  : 'hover:shadow-lg hover:border-blue-300 hover:bg-blue-50 border-gray-200 bg-white'
              }`}
            >
              {/* Notification badge if new orders available */}
              {countCheckStatus.needsFetch && countCheckStatus.newOrdersAvailable > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-lg z-10">
                  <Bell size={10} />
                  {countCheckStatus.newOrdersAvailable}
                </div>
              )}
              
              <Sparkles size={16} className="text-blue-600" />
              <span className={`font-medium ${
                countCheckStatus.needsFetch && countCheckStatus.newOrdersAvailable > 0 ? 'text-blue-600' : 'text-blue-600'
              }`}>
                {countCheckStatus.needsFetch && countCheckStatus.newOrdersAvailable > 0 
                  ? 'Fetch New Executive Orders' 
                  : 'Fetch Executive Orders'
                }
              </span>
              
              {countCheckStatus.needsFetch && countCheckStatus.newOrdersAvailable > 0 && (
                <span className="text-xs text-blue-600 font-medium ml-2">
                  ({countCheckStatus.newOrdersAvailable} new)
                </span>
              )}
            </button>
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
                buttonText="Filter Orders by Category"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Results Section */}
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
                {selectedFilters.length > 0 
                  ? `No executive orders match your current filter criteria.` 
                  : "No executive orders are loaded in the database yet."
                }
              </p>
              <div className="flex gap-2 justify-center">
                {selectedFilters.length > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300"
                  >
                    Clear Filters
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
              {orders.map((order, index) => {
                const orderWithIndex = { ...order, index };
                const orderId = getOrderId(orderWithIndex);
                const isExpanded = expandedOrders.has(orderId);
                const isReviewed = isItemReviewed(order);
                
                const actualOrderNumber = filteredOrders.length - ((pagination.page - 1) * pagination.per_page + index);
                
                return (
                  <div key={`order-${orderId}-${index}`} className="border rounded-lg overflow-hidden transition-all duration-300 border-gray-200">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            {actualOrderNumber}. {cleanOrderTitle(order.title)}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mb-2">
                            <span className="font-medium">Executive Order #: {getExecutiveOrderNumber(order)}</span>
                            <span>-</span>
                            <span className="font-medium">Signed Date: {order.formatted_signing_date || 'N/A'}</span>
                            {order.formatted_publication_date && order.formatted_publication_date !== order.formatted_signing_date && (
                              <>
                                <span>-</span>
                                <span className="font-medium">Published Date: {order.formatted_publication_date}</span>
                              </>
                            )}
                            <span>-</span>
                            <EditableCategoryTag 
                              category={order.category}
                              orderId={getOrderId(orderWithIndex)}
                              onCategoryChange={handleCategoryUpdate}
                              disabled={fetchingData || loading}
                              isUpdating={false}
                            />
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
                            disabled={isItemReviewLoading(orderWithIndex)}
                            className={`p-2 rounded-md transition-all duration-300 ${
                              isItemReviewLoading(orderWithIndex)
                                ? 'text-gray-500 cursor-not-allowed'
                                : isReviewed
                                ? 'text-green-600 bg-green-100 hover:bg-green-200'
                                : 'text-gray-400 hover:bg-green-100 hover:text-green-600'
                            }`}
                            title={isReviewed ? "Mark as not reviewed" : "Mark as reviewed"}
                          >
                            {isItemReviewLoading(orderWithIndex) ? (
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

                          {/* External Links and Copy Details */}
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
                              className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                                copiedOrders.has(orderId) 
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                              }`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                const reportSections = [];
                                
                                reportSections.push(`**${cleanOrderTitle(order.title)}**`);
                                reportSections.push(`EO #${getExecutiveOrderNumber(order)}`);
                                reportSections.push(`President: ${order.president || 'Donald Trump'}`);
                                reportSections.push(`Signing Date: ${order.formatted_signing_date || 'N/A'}`);
                                reportSections.push(`Publication Date: ${order.formatted_publication_date || 'N/A'}`);
                                reportSections.push(`Category: ${order.category || 'civic'}`);
                                reportSections.push('');
                                
                                if (order.ai_summary) {
                                  reportSections.push(`**AI Summary: Executive Order ${getExecutiveOrderNumber(order)}**`);
                                  reportSections.push(`${stripHtmlTags(order.ai_summary)}`);
                                  reportSections.push('');
                                }
                                
                                if (order.ai_talking_points) {
                                  reportSections.push('**Key Talking Points:**');
                                  const talkingPointsText = stripHtmlTags(order.ai_talking_points);
                                  
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
                                    const sentences = talkingPointsText.split(/(?=\d+\.\s)/).filter(s => s.trim().length > 0);
                                    sentences.slice(0, 5).forEach((sentence, index) => {
                                      const cleaned = sentence.replace(/^\d+\.\s*/, '').trim();
                                      if (cleaned.length > 10) {
                                        reportSections.push(`${index + 1}. ${cleaned}`);
                                      }
                                    });
                                  }
                                  reportSections.push('');
                                }
                                
                                if (order.ai_business_impact) {
                                  reportSections.push('**Business Impact:**');
                                  const businessImpactText = stripHtmlTags(order.ai_business_impact);
                                  
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
                                        const cleanContent = content
                                          .replace(/^[•\-*]\s*/, '')
                                          .replace(/\s+/g, ' ')
                                          .trim();
                                        reportSections.push(`**${header}•** ${cleanContent}`);
                                      }
                                    });
                                  } else {
                                    reportSections.push(businessImpactText);
                                  }
                                  reportSections.push('');
                                }
                                
                                if (order.html_url) {
                                  reportSections.push(`Federal Register URL: ${order.html_url}`);
                                  reportSections.push('');
                                }
                                
                                if (order.pdf_url) {
                                  reportSections.push(`PDF URL: ${order.pdf_url}`);
                                }
                                
                                const orderReport = reportSections.filter(line => line !== null && line !== undefined).join('\n');
                                
                                const copySuccess = async () => {
                                  try {
                                    if (copyToClipboard && typeof copyToClipboard === 'function') {
                                      copyToClipboard(orderReport);
                                    } else if (navigator.clipboard) {
                                      await navigator.clipboard.writeText(orderReport);
                                    } else {
                                      const textArea = document.createElement('textarea');
                                      textArea.value = orderReport;
                                      document.body.appendChild(textArea);
                                      textArea.select();
                                      document.execCommand('copy');
                                      document.body.removeChild(textArea);
                                    }
                                    
                                    setCopiedOrders(prev => new Set([...prev, orderId]));
                                    console.log('✅ Copied formatted order report to clipboard');
                                    
                                    setTimeout(() => {
                                      setCopiedOrders(prev => {
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
                              {copiedOrders.has(orderId) ? (
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

      {/* Filter Results Summary */}
      {!loading && !error && selectedFilters.length > 0 && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
            <span>
              {orders.length === 0 ? 'No results' : `${pagination.count} total results`} for: 
              <span className="font-medium ml-1">
                {selectedFilters.map(f => {
                  if (f === 'reviewed') return 'Reviewed';
                  if (f === 'not_reviewed') return 'Not Reviewed';
                  if (f === 'all_practice_areas') return 'All Practice Areas';
                  return CATEGORY_FILTERS.find(cf => cf.key === f)?.label || f;
                }).join(', ')}
              </span>
            </span>
            {pagination.count > 25 && (
              <span className="text-xs bg-blue-100 px-2 py-1 rounded">
                {pagination.total_pages} pages
              </span>
            )}
          </div>
        </div>
      )}

      {/* CSS Styles */}
      <style jsx>{`
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
      `}</style>
    </div>
  );
};

export default ExecutiveOrdersPage;