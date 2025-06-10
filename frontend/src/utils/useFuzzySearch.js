// utils/useFuzzySearch.js - Native JavaScript Fuzzy Search (No Dependencies)
// This version doesn't require Fuse.js and provides similar functionality

import { useMemo, useState, useEffect } from 'react';

/**
 * Calculate the Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} - Distance score
 */
const levenshteinDistance = (a, b) => {
  if (!a || !b) return Math.max(a?.length || 0, b?.length || 0);
  
  const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1, // deletion
        matrix[j - 1][i] + 1, // insertion
        matrix[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  return matrix[b.length][a.length];
};

/**
 * Calculate fuzzy match score for a search term against text
 * @param {string} searchTerm - The search term
 * @param {string} text - Text to search in
 * @param {number} threshold - Fuzzy match threshold (0-1)
 * @returns {number} - Match score (lower is better, -1 means no match)
 */
const fuzzyMatchScore = (searchTerm, text, threshold = 0.6) => {
  if (!searchTerm || !text) return -1;
  
  const search = searchTerm.toLowerCase();
  const target = text.toLowerCase();
  
  // Exact match gets best score
  if (target.includes(search)) {
    return 0;
  }
  
  // Split search term into words for multi-word matching
  const searchWords = search.split(/\s+/).filter(word => word.length > 1);
  
  let totalScore = 0;
  let matchedWords = 0;
  
  for (const word of searchWords) {
    let bestWordScore = Infinity;
    
    // Check against whole text
    const distance = levenshteinDistance(word, target);
    const normalizedScore = distance / Math.max(word.length, target.length);
    
    if (normalizedScore <= threshold) {
      bestWordScore = Math.min(bestWordScore, normalizedScore);
    }
    
    // Check against individual words in target
    const targetWords = target.split(/\s+/);
    for (const targetWord of targetWords) {
      const wordDistance = levenshteinDistance(word, targetWord);
      const wordScore = wordDistance / Math.max(word.length, targetWord.length);
      
      if (wordScore <= threshold) {
        bestWordScore = Math.min(bestWordScore, wordScore);
      }
      
      // Partial word matching
      if (targetWord.includes(word) || word.includes(targetWord)) {
        bestWordScore = Math.min(bestWordScore, 0.3);
      }
    }
    
    if (bestWordScore !== Infinity) {
      totalScore += bestWordScore;
      matchedWords++;
    }
  }
  
  // Return average score if at least one word matched
  return matchedWords > 0 ? totalScore / matchedWords : -1;
};

/**
 * Search through an array of items using fuzzy matching
 * @param {Array} items - Items to search through
 * @param {string} searchTerm - Search term
 * @param {Object} options - Search options
 * @returns {Array} - Sorted search results
 */
const performFuzzySearch = (items, searchTerm, options = {}) => {
  const {
    keys = [
      { name: 'title', weight: 0.7 },
      { name: 'description', weight: 0.3 },
      { name: 'summary', weight: 0.2 },
      { name: 'ai_summary', weight: 0.3 },
      { name: 'bill_number', weight: 0.8 },
      { name: 'executive_order_number', weight: 0.8 },
      { name: 'category', weight: 0.1 },
      { name: 'president', weight: 0.5 },
      { name: 'state', weight: 0.4 }
    ],
    threshold = 0.6,
    minMatchCharLength = 2
  } = options;
  
  if (!searchTerm || searchTerm.trim().length < minMatchCharLength) {
    return items;
  }
  
  const results = [];
  
  for (const item of items) {
    let bestScore = Infinity;
    let hasMatch = false;
    
    for (const key of keys) {
      const fieldValue = item[key.name];
      if (!fieldValue) continue;
      
      const score = fuzzyMatchScore(searchTerm, fieldValue.toString(), threshold);
      
      if (score !== -1) {
        // Apply weight to the score
        const weightedScore = score * (2 - key.weight); // Lower weight = better score
        bestScore = Math.min(bestScore, weightedScore);
        hasMatch = true;
      }
    }
    
    if (hasMatch) {
      results.push({
        item,
        score: bestScore
      });
    }
  }
  
  // Sort by score (lower is better)
  results.sort((a, b) => a.score - b.score);
  
  return results.map(result => result.item);
};

/**
 * Custom hook for fuzzy search functionality using native JavaScript
 * @param {Array} items - Array of items to search through
 * @param {string} searchTerm - The search term to filter by
 * @param {Object} options - Search configuration options
 * @returns {Array} - Filtered array of items matching the search term
 */
export const useFuzzySearch = (items, searchTerm, options = {}) => {
  const results = useMemo(() => {
    if (!items || items.length === 0) return [];
    if (!searchTerm || searchTerm.trim().length < 2) return items;
    
    return performFuzzySearch(items, searchTerm, options);
  }, [items, searchTerm, JSON.stringify(options)]);

  return results;
};

/**
 * Enhanced fuzzy search hook with additional features
 * @param {Array} items - Array of items to search through
 * @param {string} searchTerm - The search term to filter by
 * @param {Object} options - Extended configuration options
 * @returns {Object} - Object containing results and additional metadata
 */
export const useAdvancedFuzzySearch = (items, searchTerm, options = {}) => {
  const searchResults = useMemo(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return {
        results: items || [],
        searchPerformed: false,
        totalResults: items?.length || 0,
        searchTerm: '',
        matches: []
      };
    }

    const trimmedTerm = searchTerm.trim();
    const results = performFuzzySearch(items, trimmedTerm, options);
    
    return {
      results,
      searchPerformed: true,
      totalResults: results.length,
      searchTerm: trimmedTerm,
      matches: results.map(item => ({ item, score: 0, matches: [] }))
    };
  }, [items, searchTerm, JSON.stringify(options)]);

  return searchResults;
};

/**
 * Specialized fuzzy search for executive orders
 * @param {Array} orders - Array of executive orders
 * @param {string} searchTerm - Search term
 * @param {Object} customOptions - Custom search options
 * @returns {Array} - Filtered executive orders
 */
export const useExecutiveOrdersFuzzySearch = (orders, searchTerm, customOptions = {}) => {
  const options = {
    threshold: 0.6,
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'ai_summary', weight: 0.3 },
      { name: 'ai_talking_points', weight: 0.2 },
      { name: 'ai_business_impact', weight: 0.2 },
      { name: 'ai_potential_impact', weight: 0.2 },
      { name: 'executive_order_number', weight: 0.8 },
      { name: 'category', weight: 0.1 },
      { name: 'president', weight: 0.5 }
    ],
    ...customOptions
  };

  return useFuzzySearch(orders, searchTerm, options);
};

/**
 * Specialized fuzzy search for state legislation
 * @param {Array} bills - Array of state bills
 * @param {string} searchTerm - Search term
 * @param {Object} customOptions - Custom search options
 * @returns {Array} - Filtered state bills
 */
export const useStateLegislationFuzzySearch = (bills, searchTerm, customOptions = {}) => {
  const options = {
    threshold: 0.7, // More lenient for legislation
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'description', weight: 0.3 },
      { name: 'summary', weight: 0.2 },
      { name: 'ai_summary', weight: 0.3 },
      { name: 'ai_talking_points', weight: 0.2 },
      { name: 'ai_business_impact', weight: 0.2 },
      { name: 'ai_potential_impact', weight: 0.2 },
      { name: 'bill_number', weight: 0.8 },
      { name: 'category', weight: 0.1 },
      { name: 'state', weight: 0.4 },
      { name: 'status', weight: 0.2 }
    ],
    ...customOptions
  };

  return useFuzzySearch(bills, searchTerm, options);
};

/**
 * Specialized fuzzy search for highlights page
 * @param {Array} highlights - Array of highlighted items
 * @param {string} searchTerm - Search term
 * @param {Object} customOptions - Custom search options
 * @returns {Array} - Filtered highlights
 */
export const useHighlightsFuzzySearch = (highlights, searchTerm, customOptions = {}) => {
  const options = {
    threshold: 0.7,
    keys: [
      { name: 'title', weight: 0.7 },
      { name: 'ai_summary', weight: 0.3 },
      { name: 'description', weight: 0.3 },
      { name: 'summary', weight: 0.2 },
      { name: 'ai_talking_points', weight: 0.2 },
      { name: 'ai_business_impact', weight: 0.2 },
      { name: 'ai_potential_impact', weight: 0.2 },
      { name: 'executive_order_number', weight: 0.8 },
      { name: 'bill_number', weight: 0.8 },
      { name: 'category', weight: 0.1 },
      { name: 'president', weight: 0.5 },
      { name: 'state', weight: 0.4 },
      { name: 'status', weight: 0.2 }
    ],
    ...customOptions
  };

  return useFuzzySearch(highlights, searchTerm, options);
};

/**
 * Debounced fuzzy search hook for performance optimization
 * @param {Array} items - Array of items to search
 * @param {string} searchTerm - Search term
 * @param {Object} options - Search options
 * @param {number} delay - Debounce delay in milliseconds
 * @returns {Array} - Search results
 */
export const useDebouncedFuzzySearch = (items, searchTerm, options = {}, delay = 300) => {
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, delay);

    return () => clearTimeout(timer);
  }, [searchTerm, delay]);

  return useFuzzySearch(items, debouncedTerm, options);
};

/**
 * Utility function to highlight search matches in text
 * @param {string} text - Original text
 * @param {string} searchTerm - Search term to highlight
 * @param {string} highlightClass - CSS class for highlighting
 * @returns {string} - HTML string with highlighted matches
 */
export const highlightMatches = (text, searchTerm, highlightClass = 'bg-yellow-200 px-1 rounded') => {
  if (!text || !searchTerm || searchTerm.length < 2) {
    return text;
  }

  // Escape special regex characters in search term
  const escapedTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedTerm})`, 'gi');
  
  return text.replace(regex, `<span class="${highlightClass}">$1</span>`);
};

/**
 * Utility function to get search suggestions based on available data
 * @param {Array} items - Array of items to analyze
 * @param {Array} fields - Fields to extract suggestions from
 * @param {number} maxSuggestions - Maximum number of suggestions to return
 * @returns {Array} - Array of unique suggestions
 */
export const getSearchSuggestions = (items, fields = ['title', 'category'], maxSuggestions = 20) => {
  if (!items || items.length === 0) return [];

  const suggestions = new Set();
  const wordFrequency = new Map();
  
  items.forEach(item => {
    fields.forEach(field => {
      if (item[field]) {
        const fieldValue = item[field].toString().toLowerCase();
        
        // Split by common delimiters and add individual words
        const words = fieldValue
          .split(/[\s,.-_:;!?()[\]{}]+/)
          .filter(word => word.length > 3 && !/^\d+$/.test(word))
          .map(word => word.trim());
        
        words.forEach(word => {
          if (word) {
            suggestions.add(word);
            wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
          }
        });
        
        // Also add the full field value if it's not too long
        if (fieldValue.length <= 50) {
          suggestions.add(fieldValue);
          wordFrequency.set(fieldValue, (wordFrequency.get(fieldValue) || 0) + 1);
        }
      }
    });
  });

  // Sort by frequency and return top suggestions
  return Array.from(suggestions)
    .sort((a, b) => (wordFrequency.get(b) || 0) - (wordFrequency.get(a) || 0))
    .slice(0, maxSuggestions);
};

/**
 * Search analytics utility to track search performance
 * @param {Array} items - Original items array
 * @param {Array} results - Search results
 * @param {string} searchTerm - Search term used
 * @returns {Object} - Analytics data
 */
export const getSearchAnalytics = (items, results, searchTerm) => {
  const totalItems = items?.length || 0;
  const resultCount = results?.length || 0;
  const searchPerformed = Boolean(searchTerm && searchTerm.trim().length >= 2);
  
  return {
    totalItems,
    resultCount,
    searchTerm: searchTerm?.trim() || '',
    searchPerformed,
    hitRate: totalItems > 0 ? (resultCount / totalItems) * 100 : 0,
    hasResults: resultCount > 0,
    isEmpty: resultCount === 0 && searchPerformed
  };
};

/**
 * Search term validation and sanitization
 * @param {string} searchTerm - Raw search term
 * @returns {Object} - Validation result
 */
export const validateSearchTerm = (searchTerm) => {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return {
      isValid: false,
      sanitized: '',
      errors: ['Search term must be a non-empty string']
    };
  }

  const trimmed = searchTerm.trim();
  const errors = [];

  if (trimmed.length < 2) {
    errors.push('Search term must be at least 2 characters long');
  }

  if (trimmed.length > 100) {
    errors.push('Search term cannot exceed 100 characters');
  }

  // Remove potentially harmful characters but keep useful ones
  const sanitized = trimmed.replace(/[<>{}]/g, '');

  return {
    isValid: errors.length === 0,
    sanitized,
    errors,
    originalLength: searchTerm.length,
    trimmedLength: trimmed.length
  };
};

// Export default for main hook
export default useFuzzySearch;