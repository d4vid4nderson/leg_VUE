// Hook for automatic page view tracking with duration
import { useEffect, useRef } from 'react';
import { trackPageView, trackPageLeave } from '../utils/analytics';

export const usePageTracking = (pageName) => {
    const startTimeRef = useRef(null);

    useEffect(() => {
        if (pageName) {
            // Track page view
            trackPageView(pageName);

            // Record start time for duration tracking
            startTimeRef.current = Date.now();

            // Track page leave and duration on unmount
            return () => {
                if (startTimeRef.current) {
                    const durationMs = Date.now() - startTimeRef.current;
                    const durationSeconds = Math.floor(durationMs / 1000);

                    // Only track if user spent at least 1 second on the page
                    if (durationSeconds >= 1) {
                        trackPageLeave(
                            pageName,
                            window.location.pathname,
                            durationSeconds
                        );
                    }
                }
            };
        }
    }, [pageName]);
};