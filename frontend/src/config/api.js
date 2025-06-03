// src/config/api.js
// Environment-aware API configuration with fallbacks

// Check if the app is running in production mode
const isProduction = import.meta.env.MODE === 'production';

// Select the appropriate API URL based on environment with fallbacks
const API_URL = isProduction 
  ? (import.meta.env.VITE_API_URL_PROD || 'https://your-production-url.com')
  : (import.meta.env.VITE_API_URL || 'http://localhost:8000');

// Debug logging
console.log(`PoliticalVue: Environment details:`, {
  mode: import.meta.env.MODE,
  isProduction,
  VITE_API_URL: import.meta.env.VITE_API_URL,
  VITE_API_URL_PROD: import.meta.env.VITE_API_URL_PROD,
  finalApiUrl: API_URL,
  allEnvVars: import.meta.env
});

console.log(`PoliticalVue: Using API URL: ${API_URL} (${isProduction ? 'production' : 'development'} mode)`);

// Validate that we have a proper URL
if (!API_URL || API_URL === 'undefined') {
  console.error('❌ API_URL is not properly configured!');
  console.error('Make sure you have set VITE_API_URL in your .env file');
}

export default API_URL;