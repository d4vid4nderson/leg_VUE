// Temporary API configuration with CORS proxy for testing
// Use this while backend is being restarted

const API_URL = 'http://localhost:8000';

// Add CORS headers to fetch requests
export const fetchWithCORS = async (url, options = {}) => {
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  
  // For development, add mode: 'cors' and credentials
  const fetchOptions = {
    ...options,
    mode: 'cors',
    credentials: 'omit', // Don't send cookies for now
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(fullUrl, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`CORS Error fetching ${url}:`, error);
    // Try without credentials as fallback
    if (error.message.includes('CORS')) {
      console.log('Retrying without credentials...');
      const fallbackResponse = await fetch(fullUrl, {
        ...fetchOptions,
        credentials: 'omit',
        mode: 'no-cors', // This will give opaque response but might work
      });
      return fallbackResponse;
    }
    throw error;
  }
};

export default API_URL;