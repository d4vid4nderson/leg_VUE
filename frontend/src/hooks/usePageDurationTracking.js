import { useEffect, useRef } from 'react';
import { trackPageLeave } from '../utils/analytics';

/**
 * Custom hook to automatically track page duration
 * Tracks how long a user spends on a page
 *
 * Usage:
 *   usePageDurationTracking('Homepage');
 */
export const usePageDurationTracking = (pageName) => {
    const startTimeRef = useRef(null);
    const pageNameRef = useRef(pageName);

    useEffect(() => {
        // Record page entry time
        startTimeRef.current = Date.now();
        pageNameRef.current = pageName;

        console.log(`⏱️ Page duration tracking started for: ${pageName}`);

        // Track page leave on unmount
        return () => {
            if (startTimeRef.current) {
                const durationMs = Date.now() - startTimeRef.current;
                const durationSeconds = Math.floor(durationMs / 1000);

                console.log(`⏱️ Page leave: ${pageNameRef.current} (${durationSeconds}s)`);

                // Only track if user spent at least 1 second on the page
                if (durationSeconds >= 1) {
                    trackPageLeave(
                        pageNameRef.current,
                        window.location.pathname,
                        durationSeconds
                    );
                }
            }
        };
    }, [pageName]);
};
