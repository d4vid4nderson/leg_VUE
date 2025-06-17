// src/config/api.js
export const getApiUrl = () => {
  const hostname = window.location.hostname;
  const isProduction = import.meta.env.MODE === 'production';
  
  console.log(`🔍 Hostname: ${hostname}, Mode: ${isProduction ? 'production' : 'development'}`);
  
  // Azure or Production - force relative URL
  if (hostname.includes('azurecontainerapps.io') || isProduction) {
    console.log('✅ Production environment detected, forcing relative API URL');
    return '';
  }
  
  // Development only - localhost
  console.log('✅ Development environment detected, using localhost API URL');
  return 'http://localhost:8000';
};

const API_URL = getApiUrl();

console.log(`🎯 API URL: ${API_URL || "(same origin)"}`);

// IMPORTANT: Add this monkey patch to prevent any hardcoded localhost usage
if (window.location.hostname.includes('azurecontainerapps.io')) {
  console.log('🛡️ Adding fetch override to block localhost URLs in production');
  const originalFetch = window.fetch;
  window.fetch = function(url, options) {
    if (typeof url === 'string' && url.includes('localhost')) {
      console.warn('⚠️ Blocked localhost URL, using relative URL instead:', url);
      // Replace localhost:8000 with empty string to make it relative
      url = url.replace(/https?:\/\/localhost:8000/g, '');
      console.log('🔄 Converted to:', url);
    }
    return originalFetch.call(this, url, options);
  };
}

export default API_URL;
