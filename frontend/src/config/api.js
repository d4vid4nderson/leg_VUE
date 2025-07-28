// src/config/api.js
export const getApiUrl = () => {
  const hostname = window.location.hostname;
  const port = window.location.port;
  
  // Log details for debugging
  console.log('🔍 Hostname detection:', hostname, 'Port:', port);
  
  // In Azure or production, use backend container URL
  if (hostname.includes('azurecontainerapps.io') || 
      hostname.includes('azure') || 
      import.meta.env.MODE === 'production') {
    console.log('✅ Production environment detected');
    
    // Check if we have a specific backend URL configured
    if (import.meta.env.VITE_API_URL_PROD) {
      console.log('✅ Using configured backend URL:', import.meta.env.VITE_API_URL_PROD);
      return import.meta.env.VITE_API_URL_PROD;
    }
    
    // Try to construct backend URL from frontend URL pattern
    const backendUrl = hostname.replace('frontend', 'backend');
    console.log('✅ Using constructed backend URL pattern:', `https://${backendUrl}`);
    return `https://${backendUrl}`;
  }
  
  // If running on port 3000, use Vite dev server with proxy
  if (port === '3000') {
    console.log('✅ Vite development server detected on port 3000, using relative URLs for Vite proxy');
    return '';
  }
  
  // For Docker development (port 80), use relative URLs for nginx proxy
  console.log('✅ Docker development environment detected, using relative URLs for nginx proxy');
  return '';
};

const API_URL = getApiUrl();

// Add more debugging for the final URL
console.log(`🎯 API URL determined as: ${API_URL || "(same origin)"}`);

// Add a test method to verify API connectivity
export const testApiConnection = async () => {
  try {
    console.log('🔍 Testing API connection to:', `${API_URL}/api/status`);
    const response = await fetch(`${API_URL}/api/status`);
    const data = await response.json();
    console.log('✅ API connection successful:', data);
    return { success: true, data };
  } catch (error) {
    console.error('❌ API connection failed:', error);
    return { success: false, error: error.message };
  }
};

// Enhanced error handling for fetch
export const fetchWithErrorHandling = async (url, options = {}) => {
  const fullUrl = url.startsWith('http') ? url : `${API_URL}${url}`;
  console.log(`🔍 Making API call to: ${fullUrl}`);
  
  try {
    const response = await fetch(fullUrl, options);
    
    if (!response.ok) {
      console.error(`❌ API error ${response.status}: ${response.statusText}`);
      let errorData = null;
      try {
        errorData = await response.json();
        console.error('❌ Error details:', errorData);
      } catch (e) {
        // Could not parse error as JSON
      }
      
      throw new Error(`API error ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`❌ Error fetching ${url}:`, error);
    if (error.message.includes('Failed to fetch')) {
      console.error('❌ Network error - check if backend is running and accessible');
    }
    throw error;
  }
};

export default API_URL;
