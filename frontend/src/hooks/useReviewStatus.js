// useReviewStatus.js
// Custom hook to manage review status for legislation items
import { useState, useEffect, useCallback } from 'react';
import API_URL from '../config/api';

/**
 * Custom hook to manage review status for both state legislation and executive orders
 * Supports toggling, checking, and loading states for review status
 * 
 * @param {Array} items - The array of items to manage review status for
 * @param {String} itemType - The type of items ('state_legislation' or 'executive_order')
 * @returns {Object} - Review status management functions and state
 */
const useReviewStatus = (items = [], itemType = 'state_legislation') => {
  const [reviewedItems, setReviewedItems] = useState(new Set());
  const [reviewLoading, setReviewLoading] = useState(new Set());

  // Helper function to get a stable ID for any item
  const getItemId = useCallback((item) => {
    if (!item) return null;
    
    // Different formats based on item type
    if (itemType === 'state_legislation') {
      // For state legislation, prioritize generic IDs first
      if (item.id && typeof item.id === 'string') return item.id;
      if (item.bill_id && typeof item.bill_id === 'string') return item.bill_id;
      if (item.bill_number && item.state) {
        return `${item.state}-${item.bill_number}`;
      }
      if (item.bill_number) {
        return `state-${item.bill_number}`;
      }
    } else if (itemType === 'executive_order') {
      // For executive orders, always use eo- prefixed format for backend consistency
      if (item.eo_number) return `eo-${item.eo_number}`;
      if (item.document_number) return `eo-${item.document_number}`;
      if (item.executive_order_number) return `eo-${item.executive_order_number}`;
      if (item.bill_number) return `eo-${item.bill_number}`;
      // Fall back to generic IDs with eo- prefix if needed
      if (item.id && typeof item.id === 'string') return `eo-${item.id}`;
      if (item.bill_id && typeof item.bill_id === 'string') return `eo-${item.bill_id}`;
    }
    
    // Last resort fallback
    return null;
  }, [itemType]);

  // Load reviewed status from items when the array changes
  useEffect(() => {
    if (!items || items.length === 0) return;
    
    // Extract reviewed items from the provided array
    const reviewedSet = new Set();
    items.forEach(item => {
      if (item && (item.reviewed === true || 
                   item.reviewed === 1 || 
                   item.reviewed === '1' || 
                   item.reviewed === 'true' ||
                   item.reviewed === 'True')) {
        const itemId = getItemId(item);
        if (itemId) reviewedSet.add(itemId);
      }
    });
    
    // Update state
    setReviewedItems(reviewedSet);
    console.log(`✅ Loaded ${reviewedSet.size} reviewed items from ${items.length} ${itemType} items`);
  }, [items, getItemId, itemType]);

  // Toggle review status with API call
  const toggleReviewStatus = useCallback(async (item) => {
    const itemId = getItemId(item);
    if (!itemId) {
      console.error('❌ Cannot toggle review status: invalid item ID');
      return false;
    }
    
    console.log(`🔄 Toggling review status for ${itemType} item: ${itemId}`);
    console.log(`📊 Current item.reviewed value: ${item.reviewed}, type: ${typeof item.reviewed}`);
    
    const isCurrentlyReviewed = item.reviewed === true || item.reviewed === 1 || item.reviewed === '1' || item.reviewed === 'true' || reviewedItems.has(itemId);
    const newStatus = !isCurrentlyReviewed;
    console.log(`📊 isCurrentlyReviewed: ${isCurrentlyReviewed}, newStatus: ${newStatus}, type: ${typeof newStatus}`);
    
    // Set loading state
    setReviewLoading(prev => new Set([...prev, itemId]));
    
    try {
      // Format: /api/{item_type}/{id}/review
      const endpoint = `${API_URL}/api/${itemType === 'state_legislation' ? 'state-legislation' : 'executive-orders'}/${itemId}/review`;
      
      console.log(`🔍 CALLING API: ${endpoint} with reviewed=${newStatus} (type: ${typeof newStatus})`);
      
      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reviewed: newStatus }),
      });
      
      // ⚡ IMPROVED ERROR HANDLING
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Handle specific error cases
        if (response.status === 405) {
          errorMessage = `Review endpoint not available for ${itemType}. Please check backend configuration.`;
        } else if (response.status === 404) {
          errorMessage = `Item ${itemId} not found in database.`;
        } else if (response.status === 500) {
          try {
            const errorData = JSON.parse(errorText);
            errorMessage = errorData.detail || errorMessage;
          } catch {
            // Keep original error message if can't parse JSON
          }
        }
        
        throw new Error(errorMessage);
      }
      
      const result = await response.json();
      console.log('✅ API Response:', result);
      
      // Update local state
      setReviewedItems(prev => {
        const newSet = new Set(prev);
        if (newStatus) {
          newSet.add(itemId);
        } else {
          newSet.delete(itemId);
        }
        return newSet;
      });
      
      console.log(`✅ Successfully ${newStatus ? 'marked' : 'unmarked'} item ${itemId} as reviewed`);
      return newStatus;
      
    } catch (error) {
      console.error('❌ Error toggling review status:', error);
      
      // ⚡ SHOW USER-FRIENDLY ERROR MESSAGE
      if (error.message.includes('405')) {
        console.error('💡 Hint: Backend missing review endpoint for executive orders');
      }
      
      return isCurrentlyReviewed; // Return original status on error
    } finally {
      // Remove loading state
      setReviewLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  }, [reviewedItems, getItemId, itemType]);

  // Check if an item is reviewed
  const isItemReviewed = useCallback((item) => {
    if (!item) return false;
    
    // First check the item's own reviewed property (from database)
    // Handle various possible formats from the database
    if (item.reviewed === true || 
        item.reviewed === 1 || 
        item.reviewed === '1' || 
        item.reviewed === 'true' ||
        item.reviewed === 'True') return true;
    
    // Then check our local state (for items toggled during this session)
    const itemId = getItemId(item);
    return itemId ? reviewedItems.has(itemId) : false;
  }, [reviewedItems, getItemId]);

  // Check if an item is currently having its review status updated
  const isItemReviewLoading = useCallback((item) => {
    const itemId = getItemId(item);
    return itemId ? reviewLoading.has(itemId) : false;
  }, [reviewLoading, getItemId]);

  // Calculate review counts for the current items array
  const reviewCounts = {
    total: items.length,
    reviewed: items.filter(item => isItemReviewed(item)).length,
    notReviewed: items.length - items.filter(item => isItemReviewed(item)).length
  };

  return {
    toggleReviewStatus,
    isItemReviewed,
    isItemReviewLoading,
    reviewedItems,
    reviewCounts
  };
};

export default useReviewStatus;
