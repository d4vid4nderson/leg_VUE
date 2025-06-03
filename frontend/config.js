// src/config/api.js

// Check if the app is running in production mode
const isProduction = import.meta.env.MODE === 'production';

// Select the appropriate API URL based on environment
const API_URL = isProduction 
  ? import.meta.env.VITE_API_URL_PROD 
  : import.meta.env.VITE_API_URL;

// Export the configured API URL
export const apiUrl = API_URL;

// You can also export a configured axios instance or fetch wrapper
export const fetchApi = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  const response = await fetch(url, options);
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
};

export default {
  apiUrl,
  fetchApi
};