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

// Get browser information for user identification
const getBrowserInfo = () => {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    let os = 'Unknown';
    
    // Detect browser
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';
    else if (ua.includes('Opera')) browser = 'Opera';
    
    // Detect OS
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS X')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Android')) os = 'Android';
    
    // Detect device type
    let deviceType = 'Desktop';
    if (/Mobi|Android/i.test(ua)) deviceType = 'Mobile';
    else if (/Tablet|iPad/i.test(ua)) deviceType = 'Tablet';
    
    return {
        browser,
        os,
        deviceType,
        screenResolution: `${screen.width}x${screen.height}`,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        userAgent: ua
    };
};

// Get user ID (in production, this would come from your auth system)
const getUserId = () => {
    // Generate a unique user ID based on browser fingerprinting
    let userId = localStorage.getItem('analyticsUserId');
    if (!userId) {
        // Create a pseudo-unique identifier using browser characteristics
        const browserInfo = getBrowserInfo();
        const browserFingerprint = `${browserInfo.userAgent}-${browserInfo.screenResolution}-${browserInfo.language}-${browserInfo.timezone}`;
        const hash = btoa(browserFingerprint).replace(/[^a-zA-Z0-9]/g, '').substring(0, 12);
        userId = `user-${hash}-${Date.now().toString(36)}`;
        localStorage.setItem('analyticsUserId', userId);
        
        // Store browser info for later use
        localStorage.setItem('analyticsBrowserInfo', JSON.stringify(browserInfo));
        console.log('🆔 New user ID created:', userId);
        console.log('🔍 Browser info:', browserInfo);
    } else {
        console.log('🆔 Existing user ID:', userId);
    }
    return userId;
};

// Track page view
export const trackPageView = async (pageName, pagePath) => {
    try {
        const userId = getUserId();
        const sessionId = getSessionId();
        const browserInfo = getBrowserInfo();
        const payload = {
            user_id: userId,
            page_name: pageName,
            page_path: pagePath || window.location.pathname,
            session_id: sessionId,
            browser_info: browserInfo
        };
        
        // console.log('📊 Tracking page view:', payload);
        
        // Get Azure AD token if available
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user');
        
        console.log('🔍 Analytics Debug:');
        console.log('  Token exists:', !!token);
        console.log('  User data:', userData ? JSON.parse(userData) : 'None');
        
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            console.log('  ✅ Adding Authorization header');
        } else {
            console.log('  ❌ No token found - tracking as anonymous');
        }
        
        const response = await fetch(`${API_URL}/api/analytics/track-page-view`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            console.error('Failed to track page view');
        }
        // else { console.log('✅ Page view tracked successfully'); }
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

// Track user activity event
export const trackEvent = async (eventType, eventCategory, eventData = {}) => {
    try {
        const token = localStorage.getItem('auth_token');
        const headers = {
            'Content-Type': 'application/json',
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/api/analytics/track-event`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                user_id: getUserId(),
                session_id: getSessionId(),
                event_type: eventType,
                event_category: eventCategory,
                page_name: eventData.pageName || document.title,
                page_path: eventData.pagePath || window.location.pathname,
                event_data: eventData
            })
        });

        if (!response.ok) {
            console.error('Failed to track event');
        }
    } catch (error) {
        console.error('Error tracking event:', error);
    }
};

// Track page leave (for duration tracking)
export const trackPageLeave = async (pageName, pagePath, durationSeconds) => {
    try {
        const token = localStorage.getItem('auth_token');
        const headers = {
            'Content-Type': 'application/json',
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/api/analytics/track-page-leave`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                user_id: getUserId(),
                session_id: getSessionId(),
                page_name: pageName,
                page_path: pagePath || window.location.pathname,
                duration_seconds: durationSeconds
            })
        });

        if (!response.ok) {
            console.error('Failed to track page leave');
        }
    } catch (error) {
        console.error('Error tracking page leave:', error);
    }
};