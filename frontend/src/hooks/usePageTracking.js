// Hook for automatic page view tracking
import { useEffect } from 'react';
import { trackPageView } from '../utils/analytics';

export const usePageTracking = (pageName) => {
    useEffect(() => {
        if (pageName) {
            trackPageView(pageName);
        }
    }, [pageName]);
};