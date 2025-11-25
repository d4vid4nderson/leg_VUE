// useHighlights.js
// Custom hook to manage highlight status for legislation items across the app
import { useState, useEffect, useCallback } from 'react';
import API_URL from '../config/api';

/**
 * Custom hook to manage highlight status for both state legislation and executive orders
 * Provides consistent highlighting functionality across GlobalSearch, StatePage, and ExecutiveOrdersPage
 * 
 * @param {boolean} isEnabled - Whether to load highlights (default: true)
 * @returns {Object} - Highlight management functions and state
 */
const useHighlights = (isEnabled = true) => {
  const [localHighlights, setLocalHighlights] = useState(new Set());
  const [highlightLoading, setHighlightLoading] = useState(new Set());

  // Load existing highlights on mount
  useEffect(() => {
    if (!isEnabled) return;

    const loadExistingHighlights = async () => {
      try {
        const response = await fetch(`${API_URL}/api/highlights?user_id=1`);
        if (response.ok) {
          const data = await response.json();
          const highlights = Array.isArray(data.highlights) ? data.highlights : 
                           Array.isArray(data.results) ? data.results : 
                           Array.isArray(data) ? data : [];
          
          const highlightIds = new Set();
          highlights.forEach(highlight => {
            if (highlight.order_id) {
              highlightIds.add(highlight.order_id);
            }
          });
          
          setLocalHighlights(highlightIds);
        }
      } catch (error) {
        console.error('Failed to load highlights:', error);
      }
    };
    
    loadExistingHighlights();
  }, [isEnabled]);

  // Get item ID for highlighting
  const getItemId = useCallback((item) => {
    if (!item) return null;

    if (item.type === 'executive_order') {
      return item.executive_order_number || item.eo_number || item.id;
    } else if (item.type === 'state_legislation') {
      return item.bill_id || item.id;
    } else if (item.type === 'proclamation') {
      return item.proclamation_number || item.id;
    }
    
    // For items without type, try to infer
    if (item.executive_order_number || item.eo_number) {
      return item.executive_order_number || item.eo_number;
    }
    if (item.bill_id || item.bill_number) {
      return item.bill_id || item.id;
    }
    
    return item.id;
  }, []);

  // Check if item is highlighted
  const isItemHighlighted = useCallback((item) => {
    const itemId = getItemId(item);
    return itemId ? localHighlights.has(itemId) : false;
  }, [localHighlights, getItemId]);

  // Check if item is currently loading highlight operation
  const isItemHighlightLoading = useCallback((item) => {
    const itemId = getItemId(item);
    return itemId ? highlightLoading.has(itemId) : false;
  }, [highlightLoading, getItemId]);

  // Handle highlighting an item
  const handleItemHighlight = useCallback(async (item) => {
    const itemId = getItemId(item);
    if (!itemId) {
      console.error('No valid item ID found for highlighting');
      return;
    }
    
    const isCurrentlyHighlighted = localHighlights.has(itemId);
    setHighlightLoading(prev => new Set([...prev, itemId]));
    
    try {
      if (isCurrentlyHighlighted) {
        // Remove highlight
        setLocalHighlights(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
        
        const response = await fetch(`${API_URL}/api/highlights/${itemId}?user_id=1`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          console.error('Failed to remove highlight from backend');
          // Revert local state on failure
          setLocalHighlights(prev => new Set([...prev, itemId]));
        }
      } else {
        // Add highlight
        setLocalHighlights(prev => new Set([...prev, itemId]));
        
        // Determine item type for backend
        let itemType = item.type;
        if (!itemType) {
          if (item.executive_order_number || item.eo_number) {
            itemType = 'executive_order';
          } else if (item.bill_id || item.bill_number) {
            itemType = 'state_legislation';
          } else {
            itemType = 'unknown';
          }
        }
        
        const response = await fetch(`${API_URL}/api/highlights`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: "1",
            order_id: itemId,
            order_type: itemType,
            title: item.title,
            url: item.url || item.legiscan_url || item.html_url || null,
            state: item.state || null,
            bill_number: item.bill_number || null,
            executive_order_number: item.executive_order_number || item.eo_number || null,
            proclamation_number: item.proclamation_number || null
          }),
        });
        
        if (!response.ok) {
          console.error('Failed to add highlight to backend');
          // Revert local state on failure
          setLocalHighlights(prev => {
            const newSet = new Set(prev);
            newSet.delete(itemId);
            return newSet;
          });
        }
      }
    } catch (error) {
      console.error('Error toggling highlight:', error);
      // Revert to original state on error
      if (isCurrentlyHighlighted) {
        setLocalHighlights(prev => new Set([...prev, itemId]));
      } else {
        setLocalHighlights(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }
    } finally {
      setHighlightLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  }, [localHighlights, getItemId]);

  return {
    isItemHighlighted,
    isItemHighlightLoading,
    handleItemHighlight,
    localHighlights,
    highlightLoading
  };
};

export default useHighlights;