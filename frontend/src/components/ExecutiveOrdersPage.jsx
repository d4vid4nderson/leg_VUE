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
  HeartPulse,
  Wrench,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  Hash,
  Download,
  Ban,
  RotateCw as RefreshIcon,
  Calendar,
  MoreVertical // Added for mobile menu
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
import ExecutiveOrderSkeleton from '../components/ExecutiveOrderSkeleton';
import useReviewStatus from '../hooks/useReviewStatus';

// =====================================
// CONFIGURATION AND CONSTANTS
// =====================================
// Use the full FILTERS array to match StatePage
const CATEGORY_FILTERS = FILTERS;

// =====================================
// SIMPLE FETCH BUTTON COMPONENT
// =====================================
const FetchButtonGroup = ({ onFetch, isLoading }) => {
  return (
    <button
      onClick={() => onFetch()}
      disabled={isLoading}
      className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-all duration-300 ${
        isLoading 
          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
          : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 hover:border-blue-700'
      }`}
    >
      {isLoading ? (
        <RefreshIcon size={16} className="animate-spin" />
      ) : (
        <Download size={16} />
      )}
      <span>{isLoading ? 'Checking...' : 'Check for New Orders'}</span>
    </button>
  );
};

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
  // Generate ID in format expected by backend: eo-{number}
  if (order.eo_number) return `eo-${order.eo_number}`;
  if (order.executive_order_number) return `eo-${order.executive_order_number}`;
  if (order.document_number) return `eo-${order.document_number}`;
  if (order.bill_number) return `eo-${order.bill_number}`;
  
  // Fallback to original implementation if none of the above work
  const baseId = getExecutiveOrderId(order);
  if (baseId) return baseId.startsWith('eo-') ? baseId : `eo-${baseId}`;
  
  return `fallback-${Math.random().toString(36).substr(2, 9)}`;
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
// HELPER FUNCTIONS
// =====================================
// Helper function to clean and validate categories
const cleanCategory = (category) => {
    if (!category || typeof category !== 'string') return 'not-applicable';
    const trimmedCategory = category.trim().toLowerCase();
    
    if (trimmedCategory === 'unknown' || trimmedCategory === '') {
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
        'hospital': 'healthcare'
    };
    
    const mappedCategory = categoryMap[trimmedCategory] || trimmedCategory;
    const validCategories = FILTERS.map(f => f.key);
    validCategories.push('not-applicable');
    
    return validCategories.includes(mappedCategory) ? mappedCategory : 'not-applicable';
};

// =====================================
// CONTENT FORMATTING FUNCTIONS
// =====================================
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
            <div className="space-y-2">
                {points.slice(0, 5).map((point, idx) => (
                    <div key={idx} className="flex gap-2">
                        <div className="flex-shrink-0 w-4 flex items-start justify-start text-sm font-bold text-blue-800">
                            {idx + 1}.
                        </div>
                        <p className="text-sm text-blue-800 leading-snug flex-1">
                            {point}
                        </p>
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

// =====================================
// SUB-COMPONENTS
// =====================================

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
        <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[120] min-w-[280px] max-w-[320px]">
          <div className="py-2">
            {/* Clear All Button */}
            {selectedFilters.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-200">
                <button
                  onClick={onClearAllFilters}
                  className="w-full text-left px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-all duration-300"
                >
                  Clear All Filters ({selectedFilters.length})
                </button>
              </div>
            )}
            
            {/* Practice Areas Section */}
            <div className="border-b border-gray-200 pb-2">
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Practice Areas
              </div>
              
              {/* All Practice Areas */}
              <button
                onClick={() => handleFilterToggle('all_practice_areas')}
                className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                  isAllPracticeAreasActive()
                    ? 'bg-teal-100 text-teal-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <LayoutGrid size={16} />
                  <span>All Practice Areas</span>
                </div>
                <span className="text-xs text-gray-500">({getAllPracticeAreasCount()})</span>
              </button>

              {/* Individual Categories */}
              {CATEGORY_FILTERS.map((filter) => {
                const IconComponent = filter.icon;
                const isActive = selectedFilters.includes(filter.key);
                const count = counts?.[filter.key] || 0;
                
                return (
                  <button
                    key={filter.key}
                    onClick={() => handleFilterToggle(filter.key)}
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

              {/* Not Applicable */}
              <button
                onClick={() => handleFilterToggle('not-applicable')}
                className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                  selectedFilters.includes('not-applicable')
                    ? 'bg-gray-100 text-gray-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Ban size={16} />
                  <span>Not Applicable</span>
                </div>
                <span className="text-xs text-gray-500">({counts?.['not-applicable'] || 0})</span>
              </button>
              </div>
            </div>

            {/* Review Status Section */}
            <div>
              <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Review Status
              </div>
              
              {/* Reviewed */}
              <button
                onClick={() => handleFilterToggle('reviewed')}
                className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                  selectedFilters.includes('reviewed')
                    ? 'bg-green-100 text-green-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Check size={16} />
                  <span>Reviewed</span>
                </div>
                <span className="text-xs text-gray-500">({counts?.reviewed || 0})</span>
              </button>

              {/* Not Reviewed */}
              <button
                onClick={() => handleFilterToggle('not_reviewed')}
                className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                  selectedFilters.includes('not_reviewed')
                    ? 'bg-yellow-100 text-yellow-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle size={16} />
                  <span>Not Reviewed</span>
                </div>
                <span className="text-xs text-gray-500">({counts?.not_reviewed || 0})</span>
              </button>
            </div>
          </div>

      )}
      </div>
  );
});

// Custom Category Tag Component - Editable version (StatePage style with updated colors)
const EditableCategoryTag = ({ category, itemId, itemType, onCategoryChange, disabled }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(cleanCategory(category));
    const dropdownRef = useRef(null);
    
    const handleCategorySelect = async (newCategory) => {
        console.log(`🎯 FRONTEND: Category selected - itemId: ${itemId}, from: ${selectedCategory}, to: ${newCategory}`);
        if (newCategory !== selectedCategory && onCategoryChange) {
            try {
                console.log(`🔄 FRONTEND: Calling onCategoryChange for itemId: ${itemId}`);
                await onCategoryChange(itemId, newCategory);
                setSelectedCategory(newCategory);
                console.log(`✅ FRONTEND: Category update successful for itemId: ${itemId}`);
            } catch (error) {
                console.error(`❌ FRONTEND: Failed to update category for itemId: ${itemId}`, error);
            }
        }
        setIsEditing(false);
    };
    
    // Close dropdown when clicking outside
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
    
    const cleanedCategory = cleanCategory(selectedCategory);
    const matchingFilter = FILTERS.find(filter => filter.key === cleanedCategory);
    const IconComponent = matchingFilter?.icon || AlertTriangle;
    
    // Sync selectedCategory with category prop when it changes
    useEffect(() => {
        setSelectedCategory(cleanCategory(category));
    }, [category]);
    
    const getCategoryStyle = (cat) => {
        switch (cat) {
            case 'civic': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'education': return 'bg-orange-100 text-orange-800 border-orange-200';
            case 'engineering': return 'bg-green-100 text-green-800 border-green-200';
            case 'healthcare': return 'bg-red-100 text-red-800 border-red-200';
            case 'all_practice_areas': return 'bg-teal-100 text-teal-800 border-teal-200';
            default: return 'bg-gray-100 text-gray-800 border-gray-200';
        }
    };
    
    const getCategoryLabel = (cat) => {
        const matchingFilter = FILTERS.find(filter => filter.key === cat);
        return matchingFilter?.label || 'Not Applicable';
    };
    
    if (disabled) {
        return (
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${getCategoryStyle(cleanedCategory)}`}>
                <IconComponent size={12} />
                {getCategoryLabel(cleanedCategory)}
            </span>
        );
    }
    
    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsEditing(!isEditing)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border cursor-pointer hover:shadow-sm transition-all duration-200 ${getCategoryStyle(cleanedCategory)}`}
                title="Click to change category"
            >
                <IconComponent size={12} />
                {getCategoryLabel(cleanedCategory)}
                <ChevronDown size={10} className="ml-1" />
            </button>
            
            {isEditing && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-[100] min-w-[160px] w-max max-h-64 overflow-y-auto">
                    <div className="py-1">
                        {FILTERS.map((filter) => {
                            const isSelected = filter.key === cleanedCategory;
                            return (
                                <button
                                    key={filter.key}
                                    onClick={() => handleCategorySelect(filter.key)}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 flex items-center gap-2 ${
                                        isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                                    }`}
                                >
                                    <filter.icon size={12} />
                                    {filter.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

const ReviewStatusTag = ({ isReviewed, onClick, disabled, isLoading }) => {
  if (isReviewed) {
    return (
      <button
        onClick={onClick}
        disabled={disabled || isLoading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 text-xs font-medium rounded-md hover:bg-green-100 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        title="Click to mark as not reviewed"
      >
        {isLoading ? (
          <RotateCw size={12} className="animate-spin" />
        ) : (
          <Check size={12} />
        )}
        Reviewed
      </button>
    );
  }
  
  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-medium rounded-md hover:bg-red-100 transition-all duration-200 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      title="Click to mark as reviewed"
    >
      {isLoading ? (
        <RotateCw size={12} className="animate-spin" />
      ) : (
        <AlertTriangle size={12} />
      )}
      Not Reviewed
    </button>
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
      // Debug specific order 14316
      const debugOrder = allOrders.find(order => order.eo_number === '14316');
      if (debugOrder) {
        console.log('🔍 DEBUG EO 14316 data:', {
          eo_number: debugOrder.eo_number,
          reviewed: debugOrder.reviewed,
          reviewed_type: typeof debugOrder.reviewed,
          is_reviewed_check: isItemReviewed(debugOrder)
        });
      }
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
  
  // Sort state
  const [sortOrder, setSortOrder] = useState('latest');
  
  // Highlight filter state
  const [showHighlightsOnly, setShowHighlightsOnly] = useState(false);
  
  const [localHighlights, setLocalHighlights] = useState(new Set());
  const [highlightLoading, setHighlightLoading] = useState(new Set());
  
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [activeMobileMenu, setActiveMobileMenu] = useState(null); // Mobile menu state
  
  const [fetchingData, setFetchingData] = useState(false);
  const [hasData, setHasData] = useState(false);
  const [fetchStatus, setFetchStatus] = useState('');
  
  const [reviewError, setReviewError] = useState(null);
  
  // Handle review toggle with error handling
  const handleReviewToggle = async (order) => {
    setReviewError(null); // Clear previous errors
    
    const success = await toggleReviewStatus(order);
    
    if (success === null || success === undefined) {
      setReviewError(`Failed to update review status for ${order.title}. Please try again.`);
      
      // Clear error after 5 seconds
      setTimeout(() => setReviewError(null), 5000);
    } else {
      // Update the main allOrders state to persist the change
      const orderId = getOrderId(order);
      setAllOrders(prevOrders => 
        prevOrders.map(o => {
          const currentOrderId = getOrderId(o);
          if (currentOrderId === orderId) {
            console.log(`🔄 Updating order ${currentOrderId} reviewed status: ${o.reviewed} → ${success}`);
            return { ...o, reviewed: success };
          }
          return o;
        })
      );
      console.log(`✅ Successfully updated reviewed status for order ${orderId}`);
    }
  };

  
  const [pagination, setPagination] = useState({
    page: 1,
    per_page: 25,
    total_pages: 1,
    count: 0
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
      'not-applicable': 0,
      all_practice_areas: allOrders.filter(order => order?.category === 'all_practice_areas').length,
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



  // =====================================
  // FETCH FUNCTIONS
  // =====================================
  

  const checkForNewExecutiveOrders = useCallback(async () => {
    try {
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

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('❌ Expected JSON but got:', contentType, 'Response:', textResponse.substring(0, 200));
        throw new Error(`API returned ${contentType || 'unknown content type'} instead of JSON. Check if backend is running properly.`);
      }

      const data = await response.json();
      console.log('📊 Count check result:', data);

      if (data.success) {
        // Check completed successfully but no UI feedback needed
      } else {
        throw new Error(data.error || 'Count check failed');
      }

    } catch (error) {
      console.error('❌ Error checking for new orders:', error);
    }
  }, []);

  const fetchExecutiveOrders = useCallback(async () => {
    try {
      setFetchingData(true);
      setFetchStatus('Checking for new Executive Orders...');
      console.log('🔄 Checking for new Executive Orders...');

      // Use the existing check-count endpoint
      setFetchStatus('Checking counts...');
      console.log('📊 Checking counts...');
      const checkCountResponse = await fetch(`${API_URL}/api/executive-orders/check-count`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!checkCountResponse.ok) {
        throw new Error(`Failed to check counts: ${checkCountResponse.status}`);
      }

      const checkData = await checkCountResponse.json();
      console.log('📊 Check count response:', checkData);

      const federalRegisterCount = checkData.federal_register_count || 0;
      const databaseCount = checkData.database_count || 0;
      const newOrdersCount = federalRegisterCount - databaseCount;

      console.log(`📊 Federal Register count: ${federalRegisterCount}`);
      console.log(`📊 Database count: ${databaseCount}`);
      console.log(`📊 New orders to fetch: ${newOrdersCount}`);

      if (newOrdersCount <= 0) {
        console.log('✅ No new executive orders to fetch');
        setFetchStatus(`No new orders found (Federal Register: ${federalRegisterCount}, Database: ${databaseCount})`);
        setTimeout(() => setFetchStatus(''), 3000);
        return;
      }

      setFetchStatus(`Fetching ${newOrdersCount} new executive orders...`);
      console.log(`🔄 Fetching ${newOrdersCount} new executive orders from Federal Register...`);

      // Fetch only new orders using the simple endpoint
      const requestBody = {
        start_date: "2025-01-20",
        end_date: null,
        with_ai: true,
        save_to_db: true,
        force_fetch: false,
        fetch_only_new: true,
        max_concurrent: 3
      };

      const response = await fetch(`${API_URL}/api/fetch-executive-orders-simple`, {
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

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('❌ Expected JSON but got:', contentType, 'Response:', textResponse.substring(0, 200));
        throw new Error(`API returned ${contentType || 'unknown content type'} instead of JSON. Check if backend is running properly.`);
      }

      const result = await response.json();
      console.log('📥 Fetch Result:', result);

      if (result.success !== false) {
        console.log(`✅ Successfully fetched ${newOrdersCount} new executive orders`);
        setFetchStatus(`Successfully fetched ${newOrdersCount} new executive orders`);
        setTimeout(() => setFetchStatus(''), 3000);
        
        setTimeout(async () => {
          await fetchFromDatabase();
        }, 2000);
        
      } else {
        throw new Error(result.message || result.error || 'Fetch failed');
      }

    } catch (err) {
      console.error('❌ Fetch failed:', err);
      setError(`Failed to fetch new executive orders: ${err.message}`);
      setFetchStatus('');
    } finally {
      setFetchingData(false);
    }
  }, []);

  // Define fetchFromDatabase FIRST (before handleFetch that depends on it)
  const fetchFromDatabase = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let allOrdersArray = [];
      let currentPage = 1;
      const perPage = 100;

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
        
        // Log the first few items to see the raw reviewed values
        if (data.results && data.results.length > 0) {
          console.log('📊 Raw reviewed values from API:');
          data.results.slice(0, 5).forEach(order => {
            console.log(`  EO ${order.eo_number}: reviewed=${order.reviewed} (type: ${typeof order.reviewed})`);
          });
        }

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
          reviewed: order.reviewed,
          index: index
        };
      });

      console.log(`✅ FINAL Database load: Loaded ${transformedOrders.length} total executive orders`);
      
      setAllOrders(transformedOrders);
      setHasData(transformedOrders.length > 0);
      
      setPagination(prev => ({ ...prev, page: 1 }));

    } catch (err) {
      console.error('❌ Database load failed:', err);
      setError(`Failed to load executive orders: ${err.message}`);
      setAllOrders([]);
      setHasData(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (activeMobileMenu && !event.target.closest('.mobile-menu-container')) {
        setActiveMobileMenu(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [activeMobileMenu]);


  const handleCategoryUpdate = useCallback(async (itemId, newCategory) => {
    try {
      console.log(`🔄 Updating category for order ${itemId} to ${newCategory}`);
      
      // Update local state immediately for better UX
      setAllOrders(prevOrders => 
        prevOrders.map(order => {
          const currentOrderId = getOrderId(order);
          if (currentOrderId === itemId) {
            console.log(`🔄 Updating order ${currentOrderId} category: ${order.category} → ${newCategory}`);
            return { ...order, category: newCategory };
          }
          return order;
        })
      );

      setOrders(prevOrders => 
        prevOrders.map(order => {
          const currentOrderId = getOrderId(order);
          if (currentOrderId === itemId) {
            console.log(`🔄 Updating displayed order ${currentOrderId} category: ${order.category} → ${newCategory}`);
            return { ...order, category: newCategory };
          }
          return order;
        })
      );

      // Trigger filter counts recalculation immediately
      setCategoryUpdateTrigger(prev => prev + 1);

      // Send update to backend
      const response = await fetch(`${API_URL}/api/executive-orders/${itemId}/category`, {
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

      // Check if response is actually JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const textResponse = await response.text();
        console.error('❌ Expected JSON but got:', contentType, 'Response:', textResponse.substring(0, 200));
        throw new Error(`API returned ${contentType || 'unknown content type'} instead of JSON. Check if backend is running properly.`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log(`✅ Category successfully updated in database to: ${newCategory}`);
        
        setCategoryUpdateTrigger(prev => prev + 1);
      } else {
        throw new Error(result.message || 'Update failed');
      }

    } catch (error) {
      console.error('❌ Failed to update category:', error);
      
      // Revert local state changes on error
      const originalCategory = allOrders.find(o => getOrderId(o) === itemId)?.category || 'civic';
      
      setAllOrders(prevOrders => 
        prevOrders.map(order => {
          const currentOrderId = getOrderId(order);
          if (currentOrderId === itemId) {
            console.log(`🔄 Reverting order ${currentOrderId} category back to: ${originalCategory}`);
            return { ...order, category: originalCategory };
          }
          return order;
        })
      );

      setOrders(prevOrders => 
        prevOrders.map(order => {
          const currentOrderId = getOrderId(order);
          if (currentOrderId === itemId) {
            console.log(`🔄 Reverting displayed order ${currentOrderId} category back to: ${originalCategory}`);
            return { ...order, category: originalCategory };
          }
          return order;
        })
      );
      
      setCategoryUpdateTrigger(prev => prev + 1);
      
      
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
  // FILTERED AND SORTED DATA
  // =====================================
  
  const filteredOrders = useMemo(() => {
    console.log('🔍 Running filters...', {
      selectedFilters,
      allOrdersCount: allOrders.length
    });

    let result = [...allOrders];

    // Apply category filters (matching StatePage logic)
    const categoryFilters = selectedFilters.filter(f => 
      ['civic', 'education', 'engineering', 'healthcare', 'all_practice_areas', 'not-applicable'].includes(f)
    );
    
    if (categoryFilters.length > 0) {
      result = result.filter(order => categoryFilters.includes(order?.category));
      console.log(`🔍 After category filter: ${result.length} orders`);
    }

    // Apply review status filters
    const hasReviewedFilter = selectedFilters.includes('reviewed');
    const hasNotReviewedFilter = selectedFilters.includes('not_reviewed');
    
    if (hasReviewedFilter && !hasNotReviewedFilter) {
      result = result.filter(order => isItemReviewed(order));
      console.log(`🔍 After reviewed filter: ${result.length} orders`);
    } else if (hasNotReviewedFilter && !hasReviewedFilter) {
      result = result.filter(order => !isItemReviewed(order));
      console.log(`🔍 After not-reviewed filter: ${result.length} orders`);
    }

    // Apply highlight filter
    if (showHighlightsOnly) {
      result = result.filter(order => isOrderHighlighted(order));
      console.log(`🔍 After highlights filter: ${result.length} orders`);
    }

    // Apply sorting
    result.sort((a, b) => {
      const getDate = (order) => {
        if (order.signing_date) return new Date(order.signing_date);
        if (order.publication_date) return new Date(order.publication_date);
        if (order.created_at) return new Date(order.created_at);
        return new Date(0); // Fallback to epoch
      };
      
      const dateA = getDate(a);
      const dateB = getDate(b);
      
      return sortOrder === 'latest' 
        ? dateB.getTime() - dateA.getTime()
        : dateA.getTime() - dateB.getTime();
    });

    return result;
  }, [allOrders, selectedFilters, isItemReviewed, sortOrder, showHighlightsOnly, isOrderHighlighted]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.per_page;
    const endIndex = startIndex + pagination.per_page;
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, pagination.page, pagination.per_page]);

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

  // =====================================
  // COUNT STATUS COMPONENT
  // =====================================
  const CountStatusComponent = () => {
    // All animated status banners have been removed
    return null;
  };

  // =====================================
  // RENDER COMPONENT
  // =====================================
  return (
    <div className="pt-6 min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <ScrollToTopButton />
      

      <CountStatusComponent />
      
      {/* Header Section */}
      <section className="relative overflow-hidden px-6 pt-12 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <ScrollText size={16} />
              Executive Orders
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              <span className="block">Executive Order</span>
              <span className="block bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent py-2">Intelligence</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Access the latest federal executive orders with comprehensive AI-powered analysis. Our advanced models provide executive summaries, key strategic insights, and business impact assessments to help you understand the implications of presidential directives.
            </p>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          {/* Controls Bar - Mobile Responsive */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            {/* Left side - FetchButtonGroup matching StatePage */}
            <FetchButtonGroup 
              onFetch={fetchExecutiveOrders} 
              isLoading={fetchingData}
            />

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-stretch sm:items-center">
              {/* Highlight Filter Button */}
              <button
                type="button"
                onClick={() => setShowHighlightsOnly(!showHighlightsOnly)}
                className={`flex items-center justify-center gap-3 px-4 py-3 border rounded-lg text-sm font-medium transition-all duration-300 min-h-[44px] ${
                  showHighlightsOnly
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-300 hover:bg-yellow-100'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Star size={16} className={showHighlightsOnly ? 'fill-current' : ''} />
                <span>{showHighlightsOnly ? 'Highlights Only' : 'All Items'}</span>
              </button>

              {/* Sort Button - Mobile Optimized */}
              <button
                type="button"
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
                    <ArrowUp size={16} />
                    <span>Earliest Date</span>
                  </>
                )}
              </button>
              
              {/* Filter Dropdown */}
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
                            const filter = CATEGORY_FILTERS.find(f => f.key === selectedFilters[0]);
                            if (filter) return filter.label;
                            if (selectedFilters[0] === 'all_practice_areas') return 'All Practice Areas';
                            if (selectedFilters[0] === 'not-applicable') return 'Not Applicable';
                            if (selectedFilters[0] === 'reviewed') return 'Reviewed';
                            if (selectedFilters[0] === 'not_reviewed') return 'Not Reviewed';
                            return 'Filter';
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
                          Clear All Filters ({selectedFilters.length})
                        </button>
                      </div>
                    )}
                    
                    {/* Practice Areas Section */}
                    <div className="border-b border-gray-200 pb-2">
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Practice Areas
                      </div>
                      
                      {/* All filter options from CATEGORY_FILTERS array */}
                      {CATEGORY_FILTERS.map((filter) => {
                        const IconComponent = filter.icon;
                        const isActive = selectedFilters.includes(filter.key);
                        const count = filterCounts[filter.key] || 0;
                        
                        return (
                          <button
                            key={filter.key}
                            onClick={() => toggleFilter(filter.key)}
                            className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                              isActive
                                ? filter.key === 'all_practice_areas' ? 'bg-teal-100 text-teal-700 font-medium' :
                                  filter.key === 'civic' ? 'bg-blue-100 text-blue-700 font-medium' :
                                  filter.key === 'education' ? 'bg-orange-100 text-orange-700 font-medium' :
                                  filter.key === 'engineering' ? 'bg-green-100 text-green-700 font-medium' :
                                  filter.key === 'healthcare' ? 'bg-red-100 text-red-700 font-medium' :
                                  filter.key === 'not-applicable' ? 'bg-gray-100 text-gray-700 font-medium' :
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

                      {/* Not Applicable */}
                      <button
                        onClick={() => toggleFilter('not-applicable')}
                        className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                          selectedFilters.includes('not-applicable')
                            ? 'bg-gray-100 text-gray-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Ban size={16} />
                          <span>Not Applicable</span>
                        </div>
                        <span className="text-xs text-gray-500">({filterCounts['not-applicable'] || 0})</span>
                      </button>
                    </div>

                    {/* Review Status Section */}
                    <div>
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Review Status
                      </div>
                      
                      {/* Reviewed */}
                      <button
                        onClick={() => toggleFilter('reviewed')}
                        className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                          selectedFilters.includes('reviewed')
                            ? 'bg-green-100 text-green-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Check size={16} />
                          <span>Reviewed</span>
                        </div>
                        <span className="text-xs text-gray-500">({filterCounts.reviewed || 0})</span>
                      </button>

                      {/* Not Reviewed */}
                      <button
                        onClick={() => toggleFilter('not_reviewed')}
                        className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                          selectedFilters.includes('not_reviewed')
                            ? 'bg-yellow-100 text-yellow-700 font-medium'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <AlertTriangle size={16} />
                          <span>Not Reviewed</span>
                        </div>
                        <span className="text-xs text-gray-500">({filterCounts.not_reviewed || 0})</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="space-y-6">
              {[...Array(4)].map((_, index) => (
                <ExecutiveOrderSkeleton key={index} />
              ))}
            </div>
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
                  Check for New Orders
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Review Error Display */}
              {reviewError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} />
                    <span>{reviewError}</span>
                  </div>
                </div>
              )}
            </>
          )}
          
          {orders.length === 0 ? (
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
                    Check for New Orders
                  </button>
                )}
              </div>
              
              {/* Fetch Status Display */}
              {fetchStatus && (
                <div className="mt-4 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm">
                    {fetchingData && <RotateCw size={16} className="animate-spin" />}
                    <span>{fetchStatus}</span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6 relative">
              {orders.map((order, index) => {
                const orderWithIndex = { ...order, index };
                const orderId = getOrderId(orderWithIndex);
                const isExpanded = expandedOrders.has(orderId);
                const isReviewed = isItemReviewed(order);
                
                return (
                  <div key={`order-${orderId}-${index}`} className="bg-white border rounded-lg transition-all duration-300 border-gray-200 hover:shadow-md relative" style={{ zIndex: 50 - index }}>
                    <div className="p-6">

                      {/* Header with Title and Star */}
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 leading-relaxed flex-1">
                          {cleanOrderTitle(order.title)}
                        </h3>
                        <button
                          type="button"
                          className={`p-2 rounded-md transition-all duration-300 flex-shrink-0 ${
                            isOrderHighlighted(orderWithIndex)
                              ? 'text-yellow-500 bg-yellow-50 hover:bg-yellow-100'
                              : 'text-gray-400 hover:text-yellow-500 hover:bg-gray-50'
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
                            <RotateCw size={18} className="animate-spin" />
                          ) : (
                            <Star 
                              size={18} 
                              className={isOrderHighlighted(orderWithIndex) ? "fill-current" : ""} 
                            />
                          )}
                        </button>
                      </div>
                      
                      {/* Metadata Row */}
                      <div className="flex flex-wrap items-center gap-4 text-sm mb-4">
                        <div className="flex items-center gap-2 text-gray-600">
                          <Hash size={14} className="text-blue-600" />
                          <span className="font-medium">{getExecutiveOrderNumber(order)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                          <Calendar size={14} className="text-green-600" />
                          <span className="font-medium">{order.formatted_signing_date || 'N/A'}</span>
                        </div>
                        <EditableCategoryTag 
                          category={order.category}
                          itemId={getOrderId(orderWithIndex)}
                          itemType="executive_order"
                          onCategoryChange={handleCategoryUpdate}
                          disabled={fetchingData || loading}
                        />
                        <ReviewStatusTag 
                          isReviewed={isReviewed}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleReviewToggle(orderWithIndex);
                          }}
                          disabled={fetchingData || loading}
                          isLoading={isItemReviewLoading(orderWithIndex)}
                        />
                        
                        {/* Source and PDF Links */}
                        {order.html_url && (
                          <a
                            href={order.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium rounded-md hover:bg-blue-100 transition-all duration-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink size={12} className="text-blue-600" />
                            Source
                          </a>
                        )}
                        
                        {order.pdf_url && (
                          <a
                            href={order.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-medium rounded-md hover:bg-red-100 transition-all duration-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <FileText size={12} className="text-red-600" />
                            PDF
                          </a>
                        )}
                      </div>

                      {/* AI Summary Preview */}
                      {order.ai_processed && order.ai_summary && !isExpanded && (
                        <div className="mb-4">
                          <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <h3 className="text-base font-semibold text-purple-900">Executive Summary</h3>
                              </div>
                              <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs font-medium rounded-md">
                                <Sparkles size={10} />
                                AI Generated
                              </div>
                            </div>
                            <div className="text-sm text-purple-800 line-clamp-2 leading-relaxed">
                              {stripHtmlTags(order.ai_summary)}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Read More Button */}
                      <div className="flex justify-end mb-4">
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
                          className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-all duration-200"
                        >
                          {isExpanded ? (
                            <>
                              Show Less
                              <ChevronDown size={14} className="rotate-180 transition-transform duration-200" />
                            </>
                          ) : (
                            <>
                              Read More
                              <ChevronDown size={14} className="transition-transform duration-200" />
                            </>
                          )}
                        </button>
                      </div>

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          {/* Full Executive Summary */}
                          {order.ai_processed && order.ai_summary && (
                            <div className="mb-4">
                              <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-base font-semibold text-purple-900">Executive Summary</h3>
                                  </div>
                                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs font-medium rounded-md">
                                    <Sparkles size={10} />
                                    AI Generated
                                  </div>
                                </div>
                                <div className="text-sm text-purple-800 leading-relaxed">
                                  {stripHtmlTags(order.ai_summary)}
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* Azure AI Talking Points */}
                          {order.ai_processed && order.ai_talking_points && (
                            <div className="mb-4">
                              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-base font-semibold text-blue-900">Key Talking Points</h3>
                                  </div>
                                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs font-medium rounded-md">
                                    <Sparkles size={10} />
                                    AI Generated
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  {formatTalkingPoints(order.ai_talking_points)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Azure AI Business Impact */}
                          {order.ai_processed && order.ai_business_impact && (
                            <div className="mb-4">
                              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <h3 className="text-base font-semibold text-green-900">Business Impact Analysis</h3>
                                  </div>
                                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs font-medium rounded-md">
                                    <Sparkles size={10} />
                                    AI Generated
                                  </div>
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
                                  Check for New Orders
                                </button>
                              </div>
                            </div>
                          )}

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

    </div>
  );
};

export default ExecutiveOrdersPage;