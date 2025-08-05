// Analytics tracking utilities
import API_URL from '../config/api';

// Generate or retrieve session ID
const getSessionId = () => {
    let sessionId = sessionStorage.getItem('analyticsSessionId');
    if (!sessionId) {
        sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('analyticsSessionId', sessionId);
    }
    return sessionId;
};

// Get user ID (in production, this would come from your auth system)
const getUserId = () => {
    // For now, using a hardcoded user ID
    // In production, this should come from your MSI authentication
    return '1';
};

// Track page view
export const trackPageView = async (pageName, pagePath) => {
    try {
        const response = await fetch(`${API_URL}/api/analytics/track-page-view`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: getUserId(),
                page_name: pageName,
                page_path: pagePath || window.location.pathname,
                session_id: getSessionId()
            })
        });
        
        if (!response.ok) {
            console.error('Failed to track page view');
        }
    } catch (error) {
        console.error('Error tracking page view:', error);
    }
};

// Start or update session
export const startSession = async () => {
    try {
        const response = await fetch(`${API_URL}/api/analytics/start-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: getSessionId(),
                user_id: getUserId()
            })
        });
        
        if (!response.ok) {
            console.error('Failed to start session');
        }
    } catch (error) {
        console.error('Error starting session:', error);
    }
};

// Track user login
export const trackLogin = async (email = null, displayName = null) => {
    try {
        const response = await fetch(`${API_URL}/api/analytics/track-login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: getUserId(),
                email: email,
                display_name: displayName
            })
        });
        
        if (!response.ok) {
            console.error('Failed to track login');
        }
    } catch (error) {
        console.error('Error tracking login:', error);
    }
};

// End session (call on logout or page unload)
export const endSession = async () => {
    try {
        const sessionId = getSessionId();
        const response = await fetch(`${API_URL}/api/analytics/end-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: sessionId
            })
        });
        
        if (!response.ok) {
            console.error('Failed to end session');
        }
        
        // Clear session ID
        sessionStorage.removeItem('analyticsSessionId');
    } catch (error) {
        console.error('Error ending session:', error);
    }
};