import { FILTERS } from './constants';

/**
 * Calculate category counts from a list of items
 * @param {Array} items - Array of items (orders, bills, highlights)
 * @param {Function} getCategoryFn - Function to extract category from item
 * @returns {Object} - Object with counts for each filter category
 */
export const calculateCategoryCounts = (items = [], getCategoryFn = (item) => item?.category) => {
  const counts = {};

  // Initialize all filter keys with 0
  FILTERS.forEach(filter => {
    counts[filter.key] = 0;
  });

  // Count items by category
  items.forEach(item => {
    const category = getCategoryFn(item);
    if (category && counts.hasOwnProperty(category)) {
      counts[category]++;
    }
  });

  // all_practice_areas = sum of all categories EXCEPT not-applicable
  // This represents items that have a meaningful practice area assigned
  const practiceAreaCategories = ['civic', 'education', 'engineering', 'healthcare'];
  counts['all_practice_areas'] = practiceAreaCategories.reduce((sum, cat) => sum + (counts[cat] || 0), 0);
  counts['all-practice-areas'] = counts['all_practice_areas']; // Support both key formats

  return counts;
};

/**
 * Calculate additional filter counts (like reviewed status, order types)
 * @param {Array} items - Array of items
 * @param {Object} options - Additional counting options
 * @returns {Object} - Object with additional counts
 */
export const calculateAdditionalCounts = (items = [], options = {}) => {
  const counts = {};
  
  // Review status counts
  if (options.reviewStatusFn) {
    const reviewed = items.filter(options.reviewStatusFn).length;
    counts.reviewed = reviewed;
    counts.not_reviewed = items.length - reviewed;
  }
  
  // Order type counts (for highlights page)
  if (options.includeOrderTypes) {
    counts.executive_order = items.filter(item => item.order_type === 'executive_order').length;
    counts.state_legislation = items.filter(item => item.order_type === 'state_legislation').length;
  }
  
  // Total count
  counts.total = items.length;
  
  return counts;
};

/**
 * Combine category counts with additional counts
 * @param {Array} items - Array of items
 * @param {Object} options - Counting options
 * @returns {Object} - Complete count object
 */
export const calculateAllCounts = (items = [], options = {}) => {
  const categoryCounts = calculateCategoryCounts(items, options.getCategoryFn);
  const additionalCounts = calculateAdditionalCounts(items, options);
  
  return {
    ...categoryCounts,
    ...additionalCounts
  };
};