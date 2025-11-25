import { useState, useEffect, useRef } from 'react';
import API_URL from '../config/api';

/**
 * Hook for monitoring fetch progress without timeouts
 * Polls the backend every few seconds to check for active fetch operations
 */
export const useFetchProgress = (state = null) => {
  const [progress, setProgress] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const [isPolling, setIsPolling] = useState(false);

  const startPolling = () => {
    if (isPolling) return; // Already polling
    
    setIsPolling(true);
    setError(null);
    
    // Poll immediately, then every 3 seconds
    checkProgress();
    
    intervalRef.current = setInterval(() => {
      checkProgress();
    }, 3000); // Poll every 3 seconds
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
  };

  const checkProgress = async () => {
    try {
      setIsLoading(true);
      
      // Use state-specific endpoint if state is provided, otherwise general progress
      const endpoint = state 
        ? `${API_URL}/api/fetch-progress/${state}`
        : `${API_URL}/api/fetch-progress`;
      
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // No timeout - let it wait as long as needed
      });

      if (response.ok) {
        const data = await response.json();
        setProgress(data);
        setError(null);
        
        // Auto-stop polling if no active tasks
        if (state) {
          // For state-specific, check if any active tasks
          if (!data.active_tasks || Object.keys(data.active_tasks).length === 0) {
            // Still keep polling to detect new tasks, but less frequently
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = setInterval(checkProgress, 10000); // Check every 10 seconds
            }
          }
        } else {
          // For general progress, check if any active tasks
          if (!data.active_tasks || Object.keys(data.active_tasks).length === 0) {
            // Keep polling but less frequently
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = setInterval(checkProgress, 10000); // Check every 10 seconds
            }
          }
        }
      } else {
        console.warn('Progress check failed:', response.status);
        setError(`Failed to check progress: ${response.status}`);
      }
    } catch (err) {
      console.warn('Progress check error:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Auto-start polling if state changes
  useEffect(() => {
    if (state && !isPolling) {
      startPolling();
    }
  }, [state, isPolling, startPolling]);

  return {
    progress,
    isLoading,
    error,
    isPolling,
    startPolling,
    stopPolling,
    checkProgress
  };
};

export default useFetchProgress;