// =====================================
// IMPORTS AND DEPENDENCIES
// =====================================
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  ChevronDown,
  RotateCw,
  ScrollText,
  Star,
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
  MoreVertical, // Added for mobile menu
  FileText
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
import { getPageContainerClasses, getCardClasses, getButtonClasses, getTextClasses } from '../utils/darkModeClasses';

// =====================================
// CONFIGURATION AND CONSTANTS
// =====================================
// Use the full FILTERS array to match StatePage
const CATEGORY_FILTERS = FILTERS;



// RegenerateAIButton component removed - individual order regeneration only

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
    // Handle YYYY-MM-DD format to avoid timezone issues
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateStr.split('-');
      return `${parseInt(month)}/${parseInt(day)}/${year}`;
    }
    
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
  
  // Strip HTML tags and decode entities
  let text = content
    .replace(/<[^>]*>/g, '')
    .replace(/&bull;/g, '•')
    .replace(/&bullet;/g, '•')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&hellip;/g, '…')
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"');
  
  // Fix spacing issues - add spaces between concatenated words
  text = text
    // Add space between lowercase and uppercase letters (camelCase)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Add space between letters and numbers
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Z])/g, '$1 $2')
    // Fix missing spaces after periods
    .replace(/\.([A-Z])/g, '. $1')
    // Fix missing spaces after commas
    .replace(/,([A-Z])/g, ', $1')
    // Fix missing spaces after semicolons
    .replace(/;([A-Z])/g, '; $1')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
  
  // Simplify complex language for executive summaries
  text = text
    // Replace complex terms with simpler ones
    .replace(/\breassess\b/gi, 'review')
    .replace(/\baccommodate\b/gi, 'adjust for')
    .replace(/\bfluctuating\b/gi, 'changing')
    .replace(/\bretaliatory actions\b/gi, 'responses')
    .replace(/\bpronounced impacts\b/gi, 'major effects')
    .replace(/\bimport-dependent sectors\b/gi, 'industries that rely on imports')
    .replace(/\benforcement will be immediate and ongoing\b/gi, 'rules will be enforced right away')
    .replace(/\bproactively model scenario-based risks\b/gi, 'plan for different possible outcomes')
    .replace(/\bengage in stakeholder dialogue\b/gi, 'talk with key partners')
    .replace(/\bmitigate downstream disruptions\b/gi, 'reduce business problems')
    .replace(/\bC-level leaders\b/gi, 'senior executives')
    .replace(/\breciprocal tariff rates\b/gi, 'matching tax rates on trade')
    .replace(/\brecalibrate trade relationships\b/gi, 'adjust trade deals')
    .replace(/\benhance U\.S\. leverage\b/gi, "strengthen America's position")
    .replace(/\bincentivizing trading partners\b/gi, 'encouraging other countries')
    .replace(/\bequitable tariff structures\b/gi, 'fair trade taxes');
  
  return text;
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
    if (!category || typeof category !== 'string') return 'government-operations';
    const trimmedCategory = category.trim().toLowerCase();
    
    if (trimmedCategory === 'unknown' || trimmedCategory === '') {
        return 'government-operations';
    }
    
    // Updated category mapping to match our new categorization system
    const categoryMap = {
        'government': 'government-operations',
        'public policy': 'government-operations',
        'municipal': 'government-operations',
        'federal': 'government-operations',
        'administration': 'government-operations',
        'civic': 'government-operations', // Legacy mapping
        'engineering': 'technology', // Legacy mapping
        'school': 'education',
        'university': 'education',
        'learning': 'education',
        'infrastructure': 'transportation',
        'construction': 'transportation',
        'medical': 'healthcare',
        'health': 'healthcare',
        'hospital': 'healthcare',
        'crime': 'criminal-justice',
        'police': 'criminal-justice',
        'security': 'criminal-justice',
        'trade': 'economics',
        'finance': 'economics',
        'economic': 'economics',
        'business': 'economics',
        'employment': 'labor',
        'worker': 'labor',
        'job': 'labor'
    };
    
    const mappedCategory = categoryMap[trimmedCategory] || trimmedCategory;
    const validCategories = FILTERS.map(f => f.key);
    
    return validCategories.includes(mappedCategory) ? mappedCategory : 'government-operations';
};

// =====================================
// CONTENT FORMATTING FUNCTIONS
// =====================================
const formatTalkingPoints = (content) => {
    if (!content) return null;
    
    // Check if content contains HTML (specifically list items)
    if (content.includes('<li>') && content.includes('</li>')) {
        // Parse HTML list items directly
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const listItems = doc.querySelectorAll('li');
        
        if (listItems.length > 0) {
            const points = Array.from(listItems).map(li => {
                // Get text content and clean up any remaining numbered prefixes
                let text = li.textContent.trim();
                // Remove leading numbers and dots if they exist
                text = text.replace(/^\d+\.\s*/, '');
                return text;
            }).filter(point => point.length > 10);
            
            if (points.length > 0) {
                return (
                    <div className="space-y-2">
                        {points.slice(0, 5).map((point, idx) => (
                            <div key={idx} className="flex gap-2">
                                <div className="flex-shrink-0 w-4 flex items-start justify-start text-sm font-bold">
                                    {idx + 1}.
                                </div>
                                <p className="text-sm leading-snug flex-1">
                                    {point}
                                </p>
                            </div>
                        ))}
                    </div>
                );
            }
        }
    }
    
    // Fallback to original parsing for non-HTML content
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
                        <div className="flex-shrink-0 w-4 flex items-start justify-start text-sm font-bold">
                            {idx + 1}.
                        </div>
                        <p className="text-sm leading-snug flex-1">
                            {point}
                        </p>
                    </div>
                ))}
            </div>
        );
    }
    
    return <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{textContent}</div>;
};


const formatUniversalContent = (content) => {
    if (!content) return null;
    
    // Step 1: Strip HTML and decode entities
    let text = content
        .replace(/<[^>]*>/g, '') // Remove all HTML tags
        .replace(/&bull;/g, '•')
        .replace(/&bullet;/g, '•')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&mdash;/g, '—')
        .replace(/&ndash;/g, '–')
        .replace(/&hellip;/g, '…')
        .replace(/&rsquo;/g, "'")
        .replace(/&lsquo;/g, "'")
        .replace(/&rdquo;/g, '"')
        .replace(/&ldquo;/g, '"');
    
    // Step 2: Completely remove all formatting artifacts and symbols
    text = text
        // Remove ALL bullets, asterisks, colons that are formatting artifacts
        .replace(/[•*:]+/g, ' ')
        .replace(/^\s*[•*:]+\s*/gm, '')
        .replace(/\s+[•*:]+\s+/g, ' ')
        // Remove markdown and numbering
        .replace(/#{1,6}\s*/g, '')
        .replace(/\d+\.\s*/g, '')
        // Remove section headers that are creating duplicates - with proper spacing
        .replace(/\b(Risk Assessment|Market Opportunity|Implementation Requirements|Financial Implications|Competitive Implications|Timeline Pressures|Summary|Business Impact|Key Points|Recommendations|Actionable Next Steps|Financial and Operational Considerations|Executive Recommendation)\b/gi, ' ')
        // Fix common word concatenation issues
        .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase words
        .replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1 $2') // Handle ACRONYM followed by Word
        .replace(/([a-z])(\d)/g, '$1 $2') // Add space between letters and numbers
        .replace(/(\d)([A-Z])/g, '$1 $2') // Add space between numbers and capital letters
        // Fix specific concatenated words commonly seen in business content
        .replace(/([a-z])(Summary)/g, '$1 $2')
        .replace(/([a-z])(Organizations)/g, '$1 $2') 
        .replace(/([a-z])(Recommendation)/g, '$1 $2')
        .replace(/([a-z])(Executive)/g, '$1 $2')
        .replace(/([a-z])(Business)/g, '$1 $2')
        .replace(/([a-z])(Impact)/g, '$1 $2')
        .replace(/([a-z])(Analysis)/g, '$1 $2')
        // Handle longer concatenated phrases
        .replace(/(Executive)(Recommendation)/g, '$1 $2')
        .replace(/(Recommendation)(Summary)/g, '$1 $2')
        .replace(/(Summary)(Organizations)/g, '$1 $2')
        // Clean up spacing
        .replace(/\s+/g, ' ')
        .replace(/\n+/g, ' ')
        .trim();
    
    // Step 3: Extract specific business impacts for architectural engineering firm
    // Clean and process the text to find actionable business insights
    const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 30);
    
    // Create 3 specific business impact statements
    const businessImpacts = [];
    
    // Process sentences to create meaningful business impacts
    for (let i = 0; i < sentences.length && businessImpacts.length < 3; i++) {
        let sentence = sentences[i].trim();
        
        // Skip overly technical or non-business content
        if (sentence.length < 40 || sentence.length > 300) continue;
        
        // Convert to business-focused impact statement
        let impact = sentence;
        
        // Make it more business-specific by adding context
        if (impact.toLowerCase().includes('cost') || impact.toLowerCase().includes('investment')) {
            if (!impact.toLowerCase().includes('business') && !impact.toLowerCase().includes('firm')) {
                impact = `${impact} This may require budget adjustments for our firm.`;
            }
        } else if (impact.toLowerCase().includes('compliance') || impact.toLowerCase().includes('regulation')) {
            if (!impact.toLowerCase().includes('review') && !impact.toLowerCase().includes('assess')) {
                impact = `${impact} We should review our current procedures and project delivery methods.`;
            }
        } else if (impact.toLowerCase().includes('market') || impact.toLowerCase().includes('industry')) {
            if (!impact.toLowerCase().includes('opportunity') && !impact.toLowerCase().includes('consider')) {
                impact = `${impact} Consider how this affects our competitive positioning and client relationships.`;
            }
        } else {
            // For other content, add general business context
            impact = `${impact} This requires careful evaluation of potential impacts on our operations.`;
        }
        
        // Clean up the impact statement
        impact = impact
            .replace(/\s+/g, ' ')
            .replace(/([.!?])\s*([A-Z])/g, '$1 $2') // Ensure proper spacing after periods
            .trim();
        
        // Ensure it ends with proper punctuation
        if (!impact.match(/[.!?]$/)) {
            impact += '.';
        }
        
        businessImpacts.push(impact);
    }
    
    // If we don't have enough impacts from the text, create relevant architectural/engineering ones
    const defaultImpacts = [
        'Project compliance requirements may need review to ensure all designs meet new federal standards. This could affect project timelines and require additional documentation.',
        'Building codes and design specifications may be updated, requiring our team to adapt current practices. We should monitor implementation dates and training requirements.',
        'Client expectations and project scopes may shift based on new regulatory requirements. Consider proactive communication with current and prospective clients about potential changes.'
    ];
    
    // Fill remaining slots with relevant defaults
    while (businessImpacts.length < 3) {
        const defaultIndex = businessImpacts.length;
        if (defaultIndex < defaultImpacts.length) {
            businessImpacts.push(defaultImpacts[defaultIndex]);
        } else {
            businessImpacts.push('Monitor regulatory developments and assess potential impacts on firm operations and client projects.');
        }
    }
    
    // Ensure exactly 3 impacts
    const finalImpacts = businessImpacts.slice(0, 3);
    
    return (
        <div className="space-y-2">
            {finalImpacts.map((impact, idx) => (
                <div key={idx} className="flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-current opacity-50 rounded-full mt-2 flex-shrink-0"></div>
                    <div className="text-sm leading-relaxed">
                        {impact}
                    </div>
                </div>
            ))}
        </div>
    );
};

// =====================================
// SUB-COMPONENTS
// =====================================


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
            case 'civic': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700';
            case 'education': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-700';
            case 'engineering': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700';
            case 'healthcare': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700';
            case 'all_practice_areas': return 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-700';
            default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600';
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
                <div className="absolute top-full left-0 mt-1 bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg shadow-xl z-[100] min-w-[160px] w-max max-h-64 overflow-y-auto">
                    <div className="py-1">
                        {FILTERS.map((filter) => {
                            const isSelected = filter.key === cleanedCategory;
                            return (
                                <button
                                    key={filter.key}
                                    onClick={() => handleCategorySelect(filter.key)}
                                    className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary flex items-center gap-2 ${
                                        isSelected ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-700 dark:text-gray-300'
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
      className={`fixed right-6 bottom-6 z-[200] p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 py-3 sm:py-4 bg-gray-50 dark:bg-dark-bg-tertiary border-t border-gray-200 dark:border-dark-border">
      <div className="text-xs sm:text-sm text-gray-700 dark:text-dark-text text-center sm:text-left">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{totalItems}</span> {itemType}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={`p-2.5 sm:p-2 rounded-md text-sm font-medium transition-all duration-200 min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center ${
            currentPage === 1
              ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary'
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
              className={`px-2.5 sm:px-3 py-2.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all duration-200 min-w-[44px] sm:min-w-[40px] min-h-[44px] sm:min-h-[36px] flex items-center justify-center ${
                page === currentPage
                  ? 'bg-blue-600 dark:bg-blue-700 text-white'
                  : page === '...'
                  ? 'text-gray-400 dark:text-gray-500 cursor-default'
                  : 'text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary'
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={`p-2.5 sm:p-2 rounded-md text-sm font-medium transition-all duration-200 min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center ${
            currentPage === totalPages
              ? 'text-gray-400 dark:text-gray-500 cursor-not-allowed'
              : 'text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary'
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
  
  // Note: Review status functionality removed

  
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
  
  // Bulk regeneration state removed - individual order regeneration only
  
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  
  // New orders notification state
  const [newOrdersAvailable, setNewOrdersAvailable] = useState(false);
  const [newOrdersCount, setNewOrdersCount] = useState(0);

  // Check for new orders state
  const [checkingNewOrders, setCheckingNewOrders] = useState(false);
  const [checkNewOrdersStatus, setCheckNewOrdersStatus] = useState('');

  
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
      total: allOrders.length
    };

    allOrders.forEach(order => {
      const category = order?.category;
      
      if (category && counts.hasOwnProperty(category)) {
        counts[category]++;
      }
    });

    console.log('🔢 Manual filter counts:', counts);
    return counts;
  }, [allOrders, categoryUpdateTrigger]);



  // =====================================
  // API FUNCTIONS
  // =====================================
  
  const markOrderAsViewed = async (eoNumber) => {
    try {
      const response = await fetch(`${API_URL}/api/executive-orders/mark-viewed/${eoNumber}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        // Update the local state to remove the "new" flag
        setAllOrders(prevOrders => 
          prevOrders.map(order => 
            (order.eo_number === eoNumber || order.executive_order_number === eoNumber) 
              ? { ...order, is_new: false }
              : order
          )
        );
        setOrders(prevOrders => 
          prevOrders.map(order => 
            (order.eo_number === eoNumber || order.executive_order_number === eoNumber) 
              ? { ...order, is_new: false }
              : order
          )
        );
      }
    } catch (error) {
      console.error('Error marking order as viewed:', error);
    }
  };

  // =====================================
  // FETCH FUNCTIONS
  // =====================================
  

  const checkForNewExecutiveOrders = useCallback(async () => {
    try {
      console.log('🔍 Checking for new executive orders...');

      const response = await fetch(`${API_URL}/api/executive-orders/check-updates`, {
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
        // Check if there are new orders available
        const federalCount = data.federal_count || 0;
        const dbCount = data.database_count || 0;
        const updateCount = data.update_count || 0;
        const hasUpdates = data.has_updates || false;
        
        if (hasUpdates && updateCount > 0) {
          console.log(`🆕 Found ${updateCount} new executive orders available!`);
          setNewOrdersAvailable(true);
          setNewOrdersCount(updateCount);
        } else {
          console.log('✅ Database is up to date with Federal Register');
          setNewOrdersAvailable(false);
          setNewOrdersCount(0);
        }
      } else {
        throw new Error(data.error || 'Count check failed');
      }

    } catch (error) {
      console.error('❌ Error checking for new orders:', error);
    }
  }, []);

  const fetchExecutiveOrders = useCallback(async (docType = 'executive_orders') => {
    try {
      setFetchingData(true);
      // Clear the notification after fetching
      setNewOrdersAvailable(false);
      setNewOrdersCount(0);
      setError(null);
      
      const docTypeName = 'Executive Orders';
      console.log(`🔄 Starting fetch for ${docTypeName}...`);
      
      setFetchStatus(`Checking for new ${docTypeName.toLowerCase()}...`);

      const requestBody = {
        start_date: "2025-01-20",
        end_date: null,
        with_ai: true,
        save_to_db: true
      };

      console.log('📡 Sending request:', requestBody);
      
      const getEndpoint = () => {
        switch (docType) {
          case 'proclamations': return '/api/fetch-proclamations-simple';
          case 'memoranda': return '/api/fetch-memoranda-simple';
          case 'notices': return '/api/fetch-notices-simple';
          case 'executive_orders':
          case 'all':
          case 'other':
          default: return '/api/fetch-executive-orders-simple';
        }
      };

      const endpoint = getEndpoint();
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      console.log(`📥 Fetch API response:`, result);

      if (!response.ok) {
        console.error(`❌ API Error: ${result.detail || result.error || 'Unknown error'}`);
        throw new Error(result.detail || result.error || 'Failed to fetch from API');
      }

      if (result.success) {
        const actualNewOrders = result.orders_saved || result.count || 0;
        const totalOrders = result.total_found || 0;
        const databaseCount = result.database_count || 0;
        
        if (actualNewOrders === 0 && result.message && result.message.includes('up to date')) {
          console.log('✅ Database is already up to date');
          setFetchStatus('Database is already up to date');
        } else {
          console.log(`✅ Successfully processed ${actualNewOrders} new orders`);
          setFetchStatus(`Successfully fetched ${actualNewOrders} new ${docTypeName.toLowerCase()}`);
        }
        
        setTimeout(() => setFetchStatus(''), 3000);
        
        // Clear update notification since we just fetched new orders
        setUpdateInfo(null);
        
        // Refresh the display with the latest data
        setTimeout(async () => {
          await fetchFromDatabase();
        }, 1000);
        
      } else {
        throw new Error(result.error || 'Failed to fetch orders');
      }
      
    } catch (err) {
      console.error('❌ Fetch failed:', err);
      setError(`Failed to fetch new executive orders: ${err.message}`);
      setFetchStatus('');
    } finally {
      setFetchingData(false);
    }
  }, []);

  // Define fetchFromDatabase FIRST (before handleFetch and regenerateAI that depend on it)
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

  // Regenerate AI Analysis function
  // Regenerate AI for a single order

  // Bulk regenerateAI function removed - individual order regeneration only

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
      
      // Find the actual order to get more debugging info
      const targetOrder = allOrders.find(order => getOrderId(order) === itemId);
      console.log(`🔍 DEBUG: allOrders length: ${allOrders.length}, looking for: ${itemId}`);
      if (targetOrder) {
        console.log(`🔍 Found target order:`, {
          id: targetOrder.id,
          eo_number: targetOrder.eo_number,
          executive_order_number: targetOrder.executive_order_number,
          document_number: targetOrder.document_number,
          bill_number: targetOrder.bill_number,
          title: targetOrder.title?.substring(0, 50) + '...',
          generatedId: getOrderId(targetOrder)
        });
        
        // Try alternative ID formats that might work with the backend
        const alternativeIds = [];
        if (targetOrder.eo_number) alternativeIds.push(targetOrder.eo_number.toString());
        if (targetOrder.executive_order_number) alternativeIds.push(targetOrder.executive_order_number.toString());
        if (targetOrder.document_number) alternativeIds.push(targetOrder.document_number.toString());
        if (targetOrder.id) alternativeIds.push(targetOrder.id.toString());
        
        console.log(`🔍 Possible alternative IDs to try:`, alternativeIds);
      } else {
        console.warn(`⚠️ Could not find order with ID ${itemId} in current orders`);
        
        // Log a few orders for comparison
        console.log(`🔍 Available orders (first 3):`, allOrders.slice(0, 3).map(order => ({
          id: order.id,
          eo_number: order.eo_number,
          document_number: order.document_number,
          generatedId: getOrderId(order)
        })));
      }
      
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

      // Send update to backend - try different ID formats if first fails
      let response;
      let lastError;
      
      // Get possible ID formats to try
      const idsToTry = [itemId]; // Start with the original ID
      if (targetOrder) {
        // Add alternative formats based on the actual order data
        if (targetOrder.eo_number && targetOrder.eo_number.toString() !== itemId.replace('eo-', '')) {
          idsToTry.push(`eo-${targetOrder.eo_number}`);
          idsToTry.push(targetOrder.eo_number.toString());
        }
        if (targetOrder.document_number && targetOrder.document_number !== itemId) {
          idsToTry.push(targetOrder.document_number);
        }
        if (targetOrder.id && targetOrder.id.toString() !== itemId) {
          idsToTry.push(targetOrder.id.toString());
        }
      }
      
      // Remove duplicates
      const uniqueIds = [...new Set(idsToTry)];
      console.log(`🔄 Will try these ID formats:`, uniqueIds);
      
      for (const tryId of uniqueIds) {
        const apiUrl = `${API_URL}/api/executive-orders/${tryId}/category`;
        console.log(`🌐 Making PATCH request to: ${apiUrl}`);
        console.log(`📤 Request body:`, { category: newCategory });
        
        try {
          response = await fetch(apiUrl, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              category: newCategory
            })
          });

          console.log(`📥 Response status: ${response.status} ${response.statusText}`);

          if (response.ok) {
            console.log(`✅ Successfully updated with ID format: ${tryId}`);
            break; // Success! Exit the loop
          } else {
            // Store this error but try the next ID format
            const errorResponse = await response.text();
            console.log(`❌ Failed with ID ${tryId}. Error response body:`, errorResponse);
            lastError = { status: response.status, statusText: response.statusText, body: errorResponse };
          }
        } catch (fetchError) {
          console.log(`❌ Network error with ID ${tryId}:`, fetchError);
          lastError = { error: fetchError };
        }
      }

      if (!response || !response.ok) {
        // All ID formats failed - try to get more info about what exists in backend
        console.log(`🔍 All ID formats failed. Checking what exists in backend...`);
        try {
          const debugResponse = await fetch(`${API_URL}/api/debug/executive-order/${itemId}`);
          if (debugResponse.ok) {
            const debugData = await debugResponse.json();
            console.log(`🔍 Backend debug info:`, debugData);
          } else {
            console.log(`🔍 Debug endpoint also failed:`, debugResponse.status);
          }
        } catch (debugError) {
          console.log(`🔍 Could not call debug endpoint:`, debugError);
        }
        
        // Also check what EOs are available in first page
        try {
          const listResponse = await fetch(`${API_URL}/api/executive-orders?page=1&per_page=5`);
          if (listResponse.ok) {
            const listData = await listResponse.json();
            console.log(`🔍 Full backend response structure:`, listData);
            console.log(`🔍 Sample of available EOs in backend:`, listData.results?.slice(0, 3).map(eo => ({
              id: eo.id,
              eo_number: eo.eo_number,
              document_number: eo.document_number,
              title: eo.title?.substring(0, 50),
              category: eo.category
            })));
            
            // Look for the specific EO we're trying to update
            const targetEO = listData.results?.find(eo => 
              eo.eo_number === "14316" || eo.eo_number === 14316 || 
              eo.id === "14316" || eo.id === 14316 ||
              eo.document_number === "14316"
            );
            if (targetEO) {
              console.log(`🎯 Found target EO 14316 in backend:`, {
                id: targetEO.id,
                eo_number: targetEO.eo_number,
                document_number: targetEO.document_number,
                category: targetEO.category,
                title: targetEO.title?.substring(0, 50)
              });
            } else {
              console.log(`❌ EO 14316 not found in first 5 results`);
            }
          }
        } catch (listError) {
          console.log(`🔍 Could not fetch sample EOs:`, listError);
        }
        
        let errorDetail = `Failed with all ID formats. Last error: `;
        if (lastError) {
          if (lastError.body) {
            try {
              const errorJson = JSON.parse(lastError.body);
              errorDetail += errorJson.detail || `HTTP ${lastError.status}: ${lastError.statusText}`;
            } catch {
              errorDetail += lastError.body.substring(0, 200);
            }
          } else if (lastError.error) {
            errorDetail += lastError.error.message;
          }
        }
        throw new Error(errorDetail);
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

  // Handle checking for new executive orders
  const handleCheckForNewOrders = useCallback(async () => {
    setCheckingNewOrders(true);
    setCheckNewOrdersStatus('Checking for new executive orders...');
    
    try {
      console.log('🔄 Starting check for new executive orders');
      
      const response = await fetch(`${API_URL}/api/executive-orders/check-new-orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          checkFederalRegister: true,
          processWithAI: true
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        const newOrdersCount = result.new_orders_count || 0;
        
        if (newOrdersCount > 0) {
          setCheckNewOrdersStatus(`Found ${newOrdersCount} new executive order${newOrdersCount === 1 ? '' : 's'}! Refreshing data...`);
          
          // Refresh the page data to show new orders
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        } else {
          setCheckNewOrdersStatus('No new executive orders found');
          setTimeout(() => {
            setCheckNewOrdersStatus('');
          }, 3000);
        }
      } else {
        throw new Error(result.message || 'Failed to check for new orders');
      }
      
    } catch (error) {
      console.error('❌ Error checking for new orders:', error);
      setCheckNewOrdersStatus(`Error: ${error.message}`);
      setTimeout(() => {
        setCheckNewOrdersStatus('');
      }, 5000);
    } finally {
      setCheckingNewOrders(false);
    }
  }, []);

  // =====================================
  // EVENT HANDLERS
  // =====================================
  const toggleFilter = (filterKey) => {
    setSelectedFilters(prev => {
      let newFilters;
      
      // Single selection logic - only one filter can be selected at a time
      if (prev.includes(filterKey)) {
        // If clicking the same filter, deselect it (clear all)
        newFilters = [];
      } else {
        // Select only this filter (replace any existing selection)
        newFilters = [filterKey];
      }
      
      console.log('🔄 Filter selected:', filterKey, 'Previous filters:', prev, 'New filters:', newFilters);
      
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
            user_id: "1",
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
  }, [allOrders, selectedFilters, sortOrder, showHighlightsOnly, isOrderHighlighted]);

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

  // Check for updates from Federal Register
  const checkForUpdates = async () => {
    if (checkingUpdates) return;
    
    try {
      setCheckingUpdates(true);
      console.log('🔍 Checking for executive order updates...');
      
      const response = await fetch(`${API_URL}/api/executive-orders/check-updates`);
      const result = await response.json();
      
      if (result.success) {
        setUpdateInfo(result);
        console.log(`📊 Update check complete: ${result.message}`);
        
        if (result.has_updates) {
          console.log(`🆕 Found ${result.update_count} new executive orders available!`);
        }
      } else {
        console.warn('⚠️ Update check failed:', result.error);
        setUpdateInfo(null);
      }
      
    } catch (error) {
      console.error('❌ Error checking for updates:', error);
      setUpdateInfo(null);
    } finally {
      setCheckingUpdates(false);
    }
  };

  useEffect(() => {
    console.log('🚀 Component mounted - attempting auto-load...');
    
    const autoLoad = async () => {
      try {
        await fetchFromDatabase();
        setTimeout(() => {
          checkForNewExecutiveOrders();
          // Initial load complete - updates will be checked manually or on refresh
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
    <div className={getPageContainerClasses()}>
      <ScrollToTopButton />
      

      <CountStatusComponent />
      
      {/* Header Section */}
      <section className="relative overflow-hidden pt-8 sm:pt-12 pb-8 sm:pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            
            <h1 className={getTextClasses('primary', 'text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 leading-tight')}>
              <span className="block">Executive Orders</span>
              <span className="block bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent py-2">Intelligence</span>
            </h1>
            
            <p className={getTextClasses('secondary', 'text-base sm:text-lg md:text-xl mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed px-2 sm:px-0')}>
              Access the latest executive orders with comprehensive AI-powered analysis. Our advanced models provide executive summaries, key strategic insights, and business impact assessments to help you understand the implications of presidential directives.
            </p>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-6 sm:py-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-500 text-gray-900 dark:text-dark-text rounded-lg shadow-sm overflow-visible">
            <div className="p-4 sm:p-6">
              {/* Status Message for Check New Orders */}
              {checkNewOrdersStatus && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                    {checkNewOrdersStatus}
                  </p>
                </div>
              )}
              
              {/* Controls Bar - Mobile Responsive */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6" style={{overflow: 'visible'}}>
                {/* Left side - Check for New Orders Button and Orders Count */}
                <div className="flex items-center gap-3">
                  {/* Check for New Orders Button */}
                  <button
                    onClick={handleCheckForNewOrders}
                    disabled={checkingNewOrders}
                    className={`px-4 py-3 border rounded-lg text-sm font-medium min-h-[44px] flex items-center justify-center gap-2 transition-all ${
                      checkingNewOrders
                        ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-600 text-blue-600 dark:text-blue-400 cursor-not-allowed'
                        : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:border-blue-600 dark:hover:text-blue-400'
                    }`}
                  >
                    {checkingNewOrders ? (
                      <>
                        <RefreshIcon size={16} className="animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <RefreshIcon size={16} />
                        Check for New Orders
                      </>
                    )}
                  </button>
                  
                  {/* Orders Count */}
                  <div className="px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 min-h-[44px] flex items-center justify-center">
                    {filteredOrders.length} {filteredOrders.length === 1 ? 'Order' : 'Orders'}
                  </div>
                </div>
                
                {/* Right side - All Filters */}
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-2 sm:items-center lg:justify-end pb-2 lg:pb-0" style={{overflow: 'visible'}}>
                  
                  {/* Highlight Filter Button */}
                  <button
                    type="button"
                    onClick={() => setShowHighlightsOnly(!showHighlightsOnly)}
                    className={`flex items-center justify-center gap-2 px-4 py-3 border rounded-lg text-sm font-medium transition-all duration-300 min-h-[44px] w-full xl:w-[130px] ${
                      showHighlightsOnly
                        ? 'bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700 hover:bg-yellow-100 dark:hover:bg-yellow-900/50'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Star size={16} className={showHighlightsOnly ? 'fill-current' : ''} />
                    <span className="whitespace-nowrap">{showHighlightsOnly ? 'Highlights' : 'All Items'}</span>
                  </button>
                  
                  {/* Sort Button - Mobile Optimized */}
                  <button
                    type="button"
                    onClick={() => setSortOrder(sortOrder === 'latest' ? 'earliest' : 'latest')}
                    className="flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 border rounded-lg text-sm sm:text-base font-medium transition-all duration-300 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[48px] sm:min-h-[44px] w-full sm:w-40"
                  >
                    {sortOrder === 'latest' ? (
                      <>
                        <ArrowDown size={16} className="flex-shrink-0" />
                        <span className="whitespace-nowrap">Latest Date</span>
                      </>
                    ) : (
                      <>
                        <ArrowUp size={16} className="flex-shrink-0" />
                        <span className="whitespace-nowrap">Earliest Date</span>
                      </>
                    )}
                  </button>
                  
                  {/* Filter Dropdown */}
                  <div className="relative z-[90]" ref={filterDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                      className={`flex items-center justify-center sm:justify-between px-6 py-3 sm:py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm sm:text-base font-medium bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-300 min-h-[48px] sm:min-h-[44px] w-full sm:w-56 ${
                        selectedFilters.length > 0 ? 'ring-2 ring-blue-500 dark:ring-blue-400 border-blue-500 dark:border-blue-400' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {(() => {
                          if (selectedFilters.length > 0) {
                            const selectedFilter = CATEGORY_FILTERS.find(f => f.key === selectedFilters[0]);
                            if (selectedFilter) {
                              const IconComponent = selectedFilter.icon;
                              return <IconComponent size={16} className="text-gray-500 dark:text-gray-400" />;
                            }
                          }
                          return <LayoutGrid size={16} className="text-gray-500 dark:text-gray-400" />;
                        })()}
                        <span className="truncate">
                          {selectedFilters.length > 0 ? (
                            (() => {
                              const selectedFilter = CATEGORY_FILTERS.find(f => f.key === selectedFilters[0]);
                              return selectedFilter ? selectedFilter.label : 'All Practice Areas';
                            })()
                          ) : 'All Practice Areas'}
                        </span>
                      </div>
                      <ChevronDown 
                        size={16} 
                        className={`transition-transform duration-200 flex-shrink-0 ${showFilterDropdown ? 'rotate-180' : ''}`}
                      />
                    </button>

                {/* Dropdown content - Match StatePage structure exactly */}
                {showFilterDropdown && (
                  <div className="absolute top-full mt-2 w-full sm:w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 z-[95] left-0 sm:left-auto sm:right-0 max-h-[60vh] sm:max-h-96 overflow-hidden flex flex-col" style={{transform: 'translateZ(0)'}}>
                    {/* Header */}
                    <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-600">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                          Filter by Practice Area
                        </span>
                        {selectedFilters.length > 0 && (
                          <button
                            onClick={() => {
                              clearAllFilters();
                              setShowFilterDropdown(false);
                            }}
                            className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Practice Areas Section */}
                    <div className="pb-2">
                      
                      {/* All Practice Areas First */}
                      {CATEGORY_FILTERS.filter(filter => filter.key === 'all_practice_areas').map((filter) => {
                        const IconComponent = filter.icon;
                        const isActive = selectedFilters.includes(filter.key);
                        const count = filterCounts[filter.key] || 0;
                        
                        return (
                          <button
                            key={filter.key}
                            onClick={() => toggleFilter(filter.key)}
                            className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                              isActive ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium' : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <IconComponent size={16} />
                              <span>{filter.label}</span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">({count})</span>
                          </button>
                        );
                      })}
                      
                      {/* Individual Practice Areas */}
                      {CATEGORY_FILTERS.filter(filter => filter.key !== 'all_practice_areas').map((filter) => {
                        const IconComponent = filter.icon;
                        const isActive = selectedFilters.includes(filter.key);
                        const count = filterCounts[filter.key] || 0;
                        
                        return (
                          <button
                            key={filter.key}
                            onClick={() => toggleFilter(filter.key)}
                            className={`w-full text-left px-4 py-2 text-sm transition-all duration-300 flex items-center justify-between ${
                              isActive
                                ? filter.key === 'civic' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' :
                                  filter.key === 'education' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium' :
                                  filter.key === 'engineering' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium' :
                                  filter.key === 'healthcare' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium' :
                                  filter.key === 'not-applicable' ? 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium' :
                                  'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium'
                                : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <IconComponent size={16} />
                              <span>{filter.label}</span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">({count})</span>
                          </button>
                        );
                      })}

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
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-800 dark:text-red-300 p-4 rounded-md">
              <p className="font-semibold mb-2">Error loading executive orders:</p>
              <p className="text-sm mb-4">{error}</p>
              <div className="flex gap-2">
                <button
                  onClick={fetchFromDatabase}
                  className="px-4 py-2 bg-red-600 dark:bg-red-700 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-600 transition-all duration-300"
                >
                  Try Again
                </button>
                <button
                  onClick={fetchExecutiveOrders}
                  className="px-4 py-2 bg-purple-600 dark:bg-purple-700 text-white rounded-md hover:bg-purple-700 dark:hover:bg-purple-600 transition-all duration-300"
                >
                  Check for Executive Orders
                </button>
              </div>
            </div>
          ) : null}
          
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <Database size={48} className="mx-auto mb-4 text-gray-400 dark:text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">No Presidential Documents Found</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {selectedFilters.length > 0 
                  ? `No executive orders match your current filter criteria.` 
                  : "No executive orders are loaded in the database yet."
                }
              </p>
              <div className="flex gap-2 justify-center">
                {selectedFilters.length > 0 && (
                  <button
                    onClick={clearAllFilters}
                    className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-all duration-300"
                  >
                    Clear Filters
                  </button>
                )}
                {!allOrders.length && (
                  <button
                    onClick={fetchExecutiveOrders}
                    disabled={fetchingData}
                    className="px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-all duration-300 flex items-center gap-2"
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

              {/* Bulk regeneration status display removed */}
            </div>
          ) : (
            <div className="space-y-6 relative">
              {orders.map((order, index) => {
                const orderWithIndex = { ...order, index };
                const orderId = getOrderId(orderWithIndex);
                const isExpanded = expandedOrders.has(orderId);
                
                return (
                  <div key={`order-${orderId}-${index}`} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-gray-100 rounded-lg transition-all duration-300 hover:shadow-md relative" style={{ zIndex: 50 - index }}>
                    <div className="p-4 sm:p-6">

                      {/* Header with Title, NEW badge, and Star */}
                      <div className="flex items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <h3 className={getTextClasses('primary', 'text-base sm:text-lg font-semibold leading-relaxed flex-1 min-w-0')}>
                            {cleanOrderTitle(order.title)}
                          </h3>
                          {(order?.is_new === true || order?.is_new === 1) && (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-bold text-white bg-red-500 rounded-full animate-pulse shadow-sm flex-shrink-0">
                              NEW
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className={`p-2.5 sm:p-2 rounded-md transition-all duration-300 flex-shrink-0 min-w-[44px] min-h-[44px] sm:min-w-[36px] sm:min-h-[36px] flex items-center justify-center ${
                            isOrderHighlighted(orderWithIndex)
                              ? 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                              : 'text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary'
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
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm mb-3 sm:mb-4">
                        <div className={getTextClasses('secondary', 'flex items-center gap-2')}>
                          <Hash size={14} className="text-blue-600 dark:text-blue-400" />
                          <span className="font-medium">{getExecutiveOrderNumber(order)}</span>
                        </div>
                        <div className={getTextClasses('secondary', 'flex items-center gap-2')}>
                          <Calendar size={14} className="text-green-600 dark:text-green-400" />
                          <span className="font-medium">{order.formatted_signing_date || 'N/A'}</span>
                        </div>
                        <EditableCategoryTag 
                          category={order.category}
                          itemId={getOrderId(orderWithIndex)}
                          itemType="executive_order"
                          onCategoryChange={handleCategoryUpdate}
                          disabled={fetchingData || loading}
                        />
                        
                      </div>

                      {/* AI Summary Preview */}
                      {order.ai_processed && order.ai_summary && !isExpanded && (
                        <div className="mb-4">
                          <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <h3 className={getTextClasses('primary', 'text-base font-semibold')}>Executive Summary</h3>
                              </div>
                              <div className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-purple-500 dark:to-indigo-500 text-white rounded-lg text-xs font-bold">
                                AI
                              </div>
                            </div>
                            <div className={getTextClasses('secondary', 'text-sm leading-relaxed')}>
                              {stripHtmlTags(order.ai_summary)}
                            </div>
                          </div>
                          <div className="border-b border-gray-200 dark:border-gray-600 mt-4"></div>
                          
                          {/* Source and PDF Links with Read More Button */}
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
                            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                              {order.html_url && (
                                <a
                                  href={order.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200 px-2 py-1 -mx-2 -my-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span>View Source Page</span>
                                  <ExternalLink size={14} />
                                </a>
                              )}
                              
                              {order.pdf_url && (
                                <a
                                  href={order.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200 px-2 py-1 -mx-2 -my-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span>View PDF Document</span>
                                  <ExternalLink size={14} />
                                </a>
                              )}
                            </div>
                            
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
                                    // Mark as viewed when expanded for the first time
                                    if (order?.is_new === true || order?.is_new === 1) {
                                      const eoNumber = order?.eo_number || order?.executive_order_number;
                                      if (eoNumber) {
                                        markOrderAsViewed(eoNumber);
                                      }
                                    }
                                  }
                                  return newSet;
                                });
                              }}
                              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200 text-sm sm:text-base flex items-center gap-1 px-3 py-2 -mx-3 -my-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 min-h-[44px]"
                            >
                              {isExpanded ? 'Read Less' : 'Read More'}
                              <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          </div>
                        </div>
                      )}


                      {/* Expanded Content */}
                      {isExpanded && (
                        <div className="mt-3">
                          {/* Full Executive Summary */}
                          {order.ai_summary && (
                            <div className="mb-4">
                              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <h3 className={getTextClasses('primary', 'text-base font-semibold')}>Executive Summary</h3>
                                  </div>
                                  <div className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-purple-500 dark:to-indigo-500 text-white rounded-lg text-xs font-bold">
                                    AI
                                  </div>
                                </div>
                                <div className={getTextClasses('secondary', 'text-sm leading-relaxed')}>
                                  {stripHtmlTags(order.ai_summary)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Azure AI Talking Points */}
                          {order.ai_talking_points && (
                            <div className="mb-4">
                              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <h3 className={getTextClasses('primary', 'text-base font-semibold')}>Key Talking Points</h3>
                                  </div>
                                  <div className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-purple-500 dark:to-indigo-500 text-white rounded-lg text-xs font-bold">
                                    AI
                                  </div>
                                </div>
                                <div className={getTextClasses('secondary', 'text-sm leading-relaxed')}>
                                  {formatTalkingPoints(order.ai_talking_points)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Azure AI Business Impact */}
                          {order.ai_business_impact && (
                            <div className="mb-4">
                              <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <h3 className={getTextClasses('primary', 'text-base font-semibold')}>Business Impact Assessment</h3>
                                  </div>
                                  <div className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-purple-500 dark:to-indigo-500 text-white rounded-lg text-xs font-bold">
                                    AI
                                  </div>
                                </div>
                                <div className={getTextClasses('secondary', 'text-sm leading-relaxed')}>
                                  {formatUniversalContent(order.ai_business_impact)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* No AI Analysis Message */}
                          {!order.ai_processed && (
                            <div className="bg-yellow-50 dark:bg-yellow-900/30 p-4 rounded-md border border-yellow-200 dark:border-yellow-700">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium text-yellow-800 dark:text-yellow-300">No AI Analysis Available</h4>
                                  <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                                    Fetch executive orders to get Azure AI analysis for this order.
                                  </p>
                                </div>
                                <button
                                  onClick={fetchExecutiveOrders}
                                  disabled={fetchingData}
                                  className="px-3 py-2 bg-yellow-600 dark:bg-yellow-700 text-white rounded-md hover:bg-yellow-700 dark:hover:bg-yellow-600 transition-all duration-300 flex items-center gap-2"
                                >
                                  <Sparkles size={14} />
                                  Check for New Orders
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Action Buttons Section */}
                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
                            <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                              {order.html_url && (
                                <a
                                  href={order.html_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200 px-2 py-1 -mx-2 -my-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span>View Source Page</span>
                                  <ExternalLink size={14} />
                                </a>
                              )}
                              
                              {order.pdf_url && (
                                <a
                                  href={order.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-xs sm:text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200 px-2 py-1 -mx-2 -my-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <span>View PDF Document</span>
                                  <ExternalLink size={14} />
                                </a>
                              )}
                            </div>
                            
                            {/* Read More/Less Button */}
                            <div className="flex justify-end">
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
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200 text-sm sm:text-base flex items-center gap-1 px-3 py-2 -mx-3 -my-2 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 min-h-[44px]"
                              >
                                {isExpanded ? 'Read Less' : 'Read More'}
                                <ChevronDown size={14} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                              </button>
                            </div>
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

        {/* Filter Results Summary */}
        {!loading && !error && selectedFilters.length > 0 && (
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
              <span>
                {orders.length === 0 ? 'No results' : `${pagination.count} total results`} for: 
                <span className="font-medium ml-1">
                  {selectedFilters.map(f => {
                    if (f === 'all_practice_areas') return 'All Practice Areas';
                    return CATEGORY_FILTERS.find(cf => cf.key === f)?.label || f;
                  }).join(', ')}
                </span>
              </span>
              {pagination.count > 25 && (
                <span className="text-xs bg-blue-100 dark:bg-blue-800/50 text-blue-700 dark:text-blue-200 px-2 py-1 rounded">
                  {pagination.total_pages} pages
                </span>
              )}
            </div>
          </div>
        )}
          </div>
        </div>
      </section>

      <ScrollToTopButton />
    </div>
  );
};

export default ExecutiveOrdersPage;