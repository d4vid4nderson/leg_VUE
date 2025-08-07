import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  X,
  FileText,
  MapPin,
  ScrollText,
  Filter,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Hash,
  Calendar,
  Building,
  GraduationCap,
  HeartPulse,
  Wrench,
  Users,
  Ban,
  Globe,
  Sparkles,
  Target,
  Shield,
  Briefcase,
  ExternalLink
} from 'lucide-react';
import API_URL from '../config/api';
import { getCardClasses, getTextClasses, getButtonClasses } from '../utils/darkModeClasses';
import { getCategoryTagClass, SUPPORTED_STATES } from '../utils/constants';

// Utility function to strip HTML tags and clean up text for display
const stripHtmlAndClean = (html) => {
  if (!html) return '';
  
  // Remove HTML tags
  const stripped = html.replace(/<[^>]*>/g, '');
  
  // Decode common HTML entities
  const decoded = stripped
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
  
  // Clean up extra whitespace
  const cleaned = decoded
    .replace(/\s+/g, ' ')
    .trim();
  
  // Truncate if too long
  if (cleaned.length > 200) {
    return cleaned.substring(0, 197) + '...';
  }
  
  return cleaned;
};

// Valid practice area categories - matching EditableCategoryTag component
const VALID_PRACTICE_AREAS = [
  'all_practice_areas', 
  'civic', 
  'education', 
  'engineering', 
  'healthcare', 
  'not_applicable',
  'not-applicable' // Handle both formats
];

// Function to check if a category is a valid practice area
const isValidPracticeArea = (category) => {
  if (!category) return false;
  return VALID_PRACTICE_AREAS.includes(category.toLowerCase().replace('-', '_'));
};

// Category styling function matching ExecutiveOrdersPage
const getCategoryStyle = (cat) => {
  switch (cat) {
    case 'civic': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-700';
    case 'education': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-700';
    case 'engineering': return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700';
    case 'healthcare': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-200 dark:border-red-700';
    case 'all_practice_areas': return 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-700';
    case 'not-applicable': 
    case 'not_applicable': return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600';
    default: return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-600';
  }
};

const getCategoryLabel = (cat) => {
  const categoryMappings = {
    'civic': 'Civic',
    'education': 'Education', 
    'engineering': 'Engineering',
    'healthcare': 'Healthcare',
    'all_practice_areas': 'All Practice Areas',
    'not-applicable': 'Not Applicable',
    'not_applicable': 'Not Applicable'
  };
  return categoryMappings[cat] || 'Not Applicable';
};

// Get category icon component for practice areas
const getCategoryIcon = (category) => {
  switch (category?.toLowerCase()) {
    case 'civic':
      return Building;
    case 'education':
      return GraduationCap;
    case 'engineering':
      return Wrench;
    case 'healthcare':
      return HeartPulse;
    case 'not-applicable':
    case 'not_applicable':
      return Ban;
    default:
      return Ban; // Default to Ban for unknown categories in search
  }
};

// Format talking points function matching ExecutiveOrdersPage
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

// Construct PDF URL from HTML URL (Federal Register pattern)
const constructPdfUrl = (htmlUrl) => {
  if (!htmlUrl || !htmlUrl.includes('federalregister.gov/documents/')) {
    return null;
  }
  
  try {
    // Extract date and document ID from Federal Register URL
    // Pattern: https://www.federalregister.gov/documents/2025/08/06/2025-15011/...
    const match = htmlUrl.match(/\/documents\/(\d{4}\/\d{2}\/\d{2})\/(\d{4}-\d+)\//);
    if (match) {
      const [, date, docId] = match;
      return `https://www.govinfo.gov/content/pkg/FR-${date}/pdf/${docId}.pdf`;
    }
  } catch (error) {
    console.warn('Error constructing PDF URL:', error);
  }
  
  return null;
};

// Format universal content function matching ExecutiveOrdersPage
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

const GlobalSearch = ({ isOpen, onClose, initialQuery = '' }) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedState, setSelectedState] = useState('all');
  const searchInputRef = useRef(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailView, setShowDetailView] = useState(false);

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Perform search when query changes (debounced)
  const performSearch = useCallback(async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults(null);
      setAllData([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        q: query,
        ...(selectedType !== 'all' && { type: selectedType }),
        ...(selectedCategory !== 'all' && { category: selectedCategory }),
        ...(selectedState !== 'all' && { state: selectedState }),
        limit: 20
      });


      const response = await fetch(`${API_URL}/api/search?${params}`);
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      setSearchResults(data);
    } catch (err) {
      console.error('Search error:', err);
      setError(err.message || 'Failed to perform search');
      setSearchResults(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedType, selectedCategory, selectedState]);

  // Use debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery && searchQuery.trim().length >= 2) {
        performSearch(searchQuery);
      } else {
        setSearchResults(null);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);


  // Show item detail in modal
  const handleItemClick = (item) => {
    setSelectedItem(item);
    setShowDetailView(true);
  };

  // Clear search input and results
  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setError(null);
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  // Navigate to item page and close modal
  const handleNavigateToItem = (item) => {
    if (item.type === 'executive_order') {
      navigate(`/executive-orders#${item.executive_order_number || item.eo_number}`);
    } else if (item.type === 'state_legislation') {
      const statePath = item.state.toLowerCase().replace(' ', '-');
      navigate(`/state/${statePath}#${item.bill_number}`);
    } else if (item.type === 'proclamation') {
      navigate(`/proclamations#${item.proclamation_number}`);
    }
    onClose();
  };

  // Return to search results
  const handleBackToResults = () => {
    setShowDetailView(false);
    setSelectedItem(null);
  };

  // Get type icon
  const getTypeIcon = (type) => {
    switch (type) {
      case 'executive_order':
        return <ScrollText size={16} className="text-gray-600 dark:text-gray-400 flex-shrink-0" />;
      case 'state_legislation':
        return <FileText size={16} className="text-gray-600 dark:text-gray-400 flex-shrink-0" />;
      case 'proclamation':
        return <FileText size={16} className="text-gray-600 dark:text-gray-400 flex-shrink-0" />;
      default:
        return <FileText size={16} className="text-gray-600 dark:text-gray-400 flex-shrink-0" />;
    }
  };

  // Get type label
  const getTypeLabel = (type) => {
    switch (type) {
      case 'executive_order':
        return 'Executive Order';
      case 'state_legislation':
        return 'State Legislation';
      case 'proclamation':
        return 'Proclamation';
      default:
        return 'Document';
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
      // Cmd/Ctrl + K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (!isOpen) {
          // This would need to be handled by parent component
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Get combined results from search response
  const displayResults = searchResults ? [
    ...(searchResults.executive_orders || []),
    ...(searchResults.state_legislation || []),
    ...(searchResults.proclamations || [])
  ] : [];

  return (
    <div className="fixed inset-0 z-[300] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity z-[301]"
        onClick={onClose}
      />

      {/* Search Modal */}
      <div className="relative min-h-screen flex items-start justify-center pt-4 md:pt-8 px-2 md:px-4 z-[302]">
        <div className={`relative w-full ${showDetailView ? 'max-w-7xl' : 'max-w-4xl'} ${getCardClasses()} rounded-lg md:rounded-xl shadow-2xl animate-bounce-in overflow-hidden transition-all duration-300`}>
          <div className="flex flex-col md:flex-row">
            
            {/* Search Results Panel */}
            <div className={`${showDetailView ? 'hidden md:block md:w-1/2' : 'w-full'} flex-shrink-0 transition-all duration-300`}>
              {/* Header */}
              <div className="border-b border-gray-200 dark:border-gray-700 p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <Search size={20} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search bills, orders..."
                className="flex-1 bg-transparent outline-none text-base md:text-lg placeholder-gray-400 dark:placeholder-gray-500 min-w-0"
              />
              {isLoading && (
                <Loader2 size={20} className="animate-spin text-blue-500" />
              )}
              {searchQuery ? (
                <button
                  onClick={handleClearSearch}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Clear search"
                >
                  <X size={20} />
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Clear search"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-col space-y-3 mt-3 md:mt-4 md:flex-row md:space-y-0 md:space-x-3">
              {/* Type Filter */}
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 touch-manipulation"
              >
                <option value="all">All Types</option>
                <option value="executive_orders">Executive Orders</option>
                <option value="state_legislation">State Legislation</option>
              </select>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 touch-manipulation"
              >
                <option value="all">All Practice Areas</option>
                <option value="civic">Civic</option>
                <option value="education">Education</option>
                <option value="engineering">Engineering</option>
                <option value="healthcare">Healthcare</option>
                <option value="not-applicable">Not Applicable</option>
              </select>

              {/* State Filter (for state legislation) */}
              {(selectedType === 'state_legislation' || selectedType === 'all') && (
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 touch-manipulation"
                >
                  <option value="all">All States</option>
                  {Object.entries(SUPPORTED_STATES).map(([stateName, stateCode]) => (
                    <option key={stateCode} value={stateCode}>
                      {stateName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Results */}
          <div className="max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="p-8 text-center">
                <AlertCircle size={48} className="mx-auto text-red-500 mb-4" />
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {!error && !searchQuery && (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Search size={48} className="mx-auto mb-4 opacity-50" />
                <p>Start typing to search across all legislation and orders</p>
                <p className="text-sm mt-2">Search by bill number, title, content, or category</p>
              </div>
            )}

            {!error && searchQuery && displayResults.length === 0 && !isLoading && (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
                <p>No results found for "{searchQuery}"</p>
                <p className="text-sm mt-2">Try adjusting your search terms or filters</p>
              </div>
            )}

            {!error && displayResults.length > 0 && (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {displayResults.map((item) => (
                  <button
                    key={`${item.type}-${item.id}`}
                    onClick={() => handleItemClick(item)}
                    className="w-full p-4 md:p-4 hover:bg-gray-50 dark:hover:bg-gray-700 active:bg-gray-100 dark:active:bg-gray-600 transition-colors text-left touch-manipulation"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          {getTypeIcon(item.type)}
                          <h3 className="font-medium text-gray-900 dark:text-gray-100 line-clamp-1 flex-1">
                            {item.title}
                          </h3>
                        </div>
                        {(item.ai_summary || item.description) && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                            {stripHtmlAndClean(item.ai_summary || item.description || '')}
                          </p>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex flex-wrap items-center gap-3">
                            {(item.bill_number || item.executive_order_number || item.proclamation_number) && (
                              <div className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                <Hash size={14} className="text-blue-600 dark:text-blue-400" />
                                <span className="font-medium text-xs">
                                  {item.bill_number || item.executive_order_number || item.proclamation_number}
                                </span>
                              </div>
                            )}
                            {item.state && (
                              <div className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                {item.type === 'state_legislation' && <MapPin size={14} className="text-green-600 dark:text-green-400" />}
                                <span className="font-medium text-xs">
                                  {item.state}
                                </span>
                              </div>
                            )}
                            {item.type === 'state_legislation' && (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${getCategoryStyle(isValidPracticeArea(item.category) ? item.category : 'not-applicable')}`}>
                                {(() => {
                                  const IconComponent = getCategoryIcon(isValidPracticeArea(item.category) ? item.category : 'not-applicable');
                                  return <IconComponent size={12} />;
                                })()}
                                {isValidPracticeArea(item.category) ? getCategoryLabel(item.category) : 'Not Applicable'}
                              </span>
                            )}
                            {item.type === 'executive_order' && item.category && isValidPracticeArea(item.category) && (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${getCategoryStyle(item.category)}`}>
                                {(() => {
                                  const IconComponent = getCategoryIcon(item.category);
                                  return <IconComponent size={12} />;
                                })()}
                                {getCategoryLabel(item.category)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <ChevronRight size={20} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {searchQuery && displayResults.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-3">
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>{displayResults.length} results found</span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded">ESC</kbd>
                    to close
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded">↵</kbd>
                    to select
                  </span>
                </div>
              </div>
            </div>
          )}
            </div>

            {/* Detail View Panel */}
            {showDetailView && (
            <div className={`w-full md:w-1/2 flex-shrink-0 md:border-l border-gray-200 dark:border-gray-700 transition-all duration-300 ${showDetailView ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
              {selectedItem ? (
                <div className="h-full">
                  {/* Detail Header */}
                  <div className="border-b border-gray-200 dark:border-gray-700 p-3 md:p-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleBackToResults}
                        className="p-3 md:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation"
                        title="Back to search results"
                      >
                        <ChevronLeft size={24} className="md:w-5 md:h-5" />
                      </button>
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getTypeIcon(selectedItem.type)}
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm md:text-base">
                          {getTypeLabel(selectedItem.type)}
                        </span>
                      </div>
                      <button
                        onClick={onClose}
                        className="p-3 md:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors touch-manipulation md:hidden"
                        title="Close search"
                      >
                        <X size={24} />
                      </button>
                    </div>
                  </div>

                  {/* Detail Content */}
                  <div className="flex-1 overflow-y-auto p-4 md:p-6 max-h-[calc(100vh-8rem)] md:max-h-[70vh]">
                    {selectedItem.type === 'executive_order' ? (
                      /* Executive Order Detail */
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-3 md:mb-2 leading-tight">
                            {selectedItem.title}
                          </h2>
                          <div className="flex flex-wrap items-center gap-2 md:gap-3 text-sm mb-4">
                            <div className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <Hash size={14} className="text-blue-600 dark:text-blue-400" />
                              <span className="font-medium">{selectedItem.executive_order_number || selectedItem.eo_number}</span>
                            </div>
                            {selectedItem.signing_date && (
                              <div className="text-gray-600 dark:text-gray-400 flex items-center gap-2">
                                <Calendar size={14} className="text-green-600 dark:text-green-400" />
                                <span className="font-medium">{new Date(selectedItem.signing_date).toLocaleDateString()}</span>
                              </div>
                            )}
                            {selectedItem.category && isValidPracticeArea(selectedItem.category) && (
                              <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${getCategoryStyle(selectedItem.category)}`}>
                                {(() => {
                                  const IconComponent = getCategoryIcon(selectedItem.category);
                                  return <IconComponent size={12} />;
                                })()}
                                {getCategoryLabel(selectedItem.category)}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Executive Summary */}
                        {(selectedItem.ai_summary || selectedItem.ai_executive_summary) && (
                          <div className="mb-4">
                            <div className="bg-gray-100 dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Executive Summary</h3>
                                </div>
                                <div className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-purple-500 dark:to-indigo-500 text-white rounded-lg text-xs font-bold">
                                  AI
                                </div>
                              </div>
                              <div 
                                className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed ai-content"
                                dangerouslySetInnerHTML={{ __html: selectedItem.ai_executive_summary || selectedItem.ai_summary }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Key Talking Points */}
                        {selectedItem.ai_talking_points && (
                          <div className="mb-4">
                            <div className="bg-gray-100 dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Key Talking Points</h3>
                                </div>
                                <div className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-purple-500 dark:to-indigo-500 text-white rounded-lg text-xs font-bold">
                                  AI
                                </div>
                              </div>
                              <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                                {formatTalkingPoints(selectedItem.ai_talking_points)}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Business Impact Assessment */}
                        {selectedItem.ai_business_impact && (
                          <div className="mb-4">
                            <div className="bg-gray-100 dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg p-4">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Business Impact Assessment</h3>
                                </div>
                                <div className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-purple-500 dark:to-indigo-500 text-white rounded-lg text-xs font-bold">
                                  AI
                                </div>
                              </div>
                              <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                                {formatUniversalContent(selectedItem.ai_business_impact)}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Source Links */}
                        <div className="border-t pt-4">
                          <div className="flex flex-wrap items-center gap-3 sm:gap-6">
                            {selectedItem.url && (
                              <a
                                href={selectedItem.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200 px-2 py-1 -mx-2 -my-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span>View Source Page</span>
                                <ExternalLink size={14} />
                              </a>
                            )}
                            {selectedItem.pdf_url && (
                              <a
                                href={selectedItem.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-xs sm:text-sm text-blue-600 hover:text-blue-800 transition-colors duration-200 px-2 py-1 -mx-2 -my-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span>View PDF Document</span>
                                <ExternalLink size={14} />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* State Legislation Detail */
                      <div className="space-y-6">
                        <div>
                          <h2 className="text-lg md:text-xl font-bold text-gray-900 dark:text-gray-100 mb-4 leading-tight">
                            {selectedItem.title}
                          </h2>
                          
                          {/* Metadata Row */}
                          <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-3 md:gap-2 text-sm mb-4">
                            <div className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                              <Hash size={16} className="text-blue-600 dark:text-blue-400" />
                              <span className="font-medium">{selectedItem.bill_number || 'Unknown'}</span>
                            </div>
                            {selectedItem.introduced_date && (
                              <div className="text-gray-600 dark:text-gray-400 flex items-center gap-1.5">
                                <Calendar size={16} className="text-green-600 dark:text-green-400" />
                                <span>{new Date(selectedItem.introduced_date).toLocaleDateString('en-US', {
                                  month: 'numeric',
                                  day: 'numeric', 
                                  year: 'numeric'
                                })}</span>
                              </div>
                            )}
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border ${getCategoryStyle(isValidPracticeArea(selectedItem.category) ? selectedItem.category : 'not-applicable')}`}>
                              {(() => {
                                const IconComponent = getCategoryIcon(isValidPracticeArea(selectedItem.category) ? selectedItem.category : 'not-applicable');
                                return <IconComponent size={12} />;
                              })()}
                              {isValidPracticeArea(selectedItem.category) ? getCategoryLabel(selectedItem.category) : 'Not Applicable'}
                            </span>
                            {selectedItem.session && (
                              <div className="text-purple-600 dark:text-purple-400 text-xs font-medium">
                                {selectedItem.session}
                              </div>
                            )}
                          </div>

                          {/* Progress Bar */}
                          {selectedItem.status && (
                            <div className="mb-6">
                              {(() => {
                                const getProgressInfo = (billStatus) => {
                                  if (!billStatus) return { percentage: 10, stage: 'Introduced', color: 'bg-blue-600' };
                                  
                                  const statusLower = billStatus.toLowerCase();
                                  
                                  if (statusLower.includes('enacted') || statusLower.includes('signed') || statusLower.includes('law')) {
                                    return { percentage: 100, stage: 'Enacted', color: 'bg-green-600' };
                                  }
                                  if (statusLower.includes('passed') || statusLower.includes('enrolled')) {
                                    return { percentage: 75, stage: 'Passed', color: 'bg-emerald-600' };
                                  }
                                  if (statusLower.includes('floor') || statusLower.includes('vote') || statusLower.includes('reading')) {
                                    return { percentage: 50, stage: 'Floor Vote', color: 'bg-yellow-600' };
                                  }
                                  if (statusLower.includes('committee') || statusLower.includes('referred')) {
                                    return { percentage: 25, stage: 'Committee', color: 'bg-purple-600' };
                                  }
                                  
                                  return { percentage: 10, stage: 'Introduced', color: 'bg-blue-600' };
                                };

                                const progressInfo = getProgressInfo(selectedItem.status);

                                return (
                                  <div className="w-full">
                                    <div className="flex justify-between items-center mb-2">
                                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                        {progressInfo.stage}
                                      </span>
                                      <span className="text-xs text-gray-500 dark:text-gray-500">
                                        {progressInfo.percentage}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                      <div 
                                        className={`h-2 rounded-full transition-all duration-500 ${progressInfo.color}`}
                                        style={{ width: `${progressInfo.percentage}%` }}
                                      ></div>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                      <span className="text-xs text-gray-400 dark:text-gray-600">Introduced</span>
                                      <span className="text-xs text-gray-400 dark:text-gray-600">Committee</span>
                                      <span className="text-xs text-gray-400 dark:text-gray-600">Floor Vote</span>
                                      <span className="text-xs text-gray-400 dark:text-gray-600">Passed</span>
                                      <span className="text-xs text-gray-400 dark:text-gray-600">Enacted</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                          )}
                        </div>

                        {/* AI Generated Summary */}
                        {selectedItem.ai_summary && (
                          <div className="bg-gradient-to-r from-slate-50 to-gray-50 dark:from-gray-800 dark:to-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-5">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{selectedItem.bill_number || 'Bill'} AI Generated Summary</h3>
                              </div>
                              <div className="inline-flex items-center justify-center w-6 h-6 bg-gradient-to-br from-purple-600 to-indigo-600 dark:from-purple-500 dark:to-indigo-500 text-white rounded-lg text-xs font-bold">
                                AI
                              </div>
                            </div>
                            <div 
                              className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: selectedItem.ai_summary }}
                            />
                            {selectedItem.legiscan_url && (
                              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                                <a 
                                  href={selectedItem.legiscan_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors duration-200"
                                >
                                  <ExternalLink size={14} />
                                  <span>View Original Bill Information</span>
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center p-4">
                  <div className="text-center text-gray-500">
                    <p>Loading item details...</p>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearch;