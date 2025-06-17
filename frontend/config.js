// src/config/config.js
import API_URL from './api';

const isProduction = import.meta.env.MODE === 'production';

// Export the configured API URL
export const apiUrl = API_URL;

// Enhanced fetch wrapper with better error handling
export const fetchApi = async (endpoint, options = {}) => {
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      let errorDetails = '';
      try {
        const errorData = await response.json();
        errorDetails = errorData.detail || errorData.message || JSON.stringify(errorData);
      } catch (parseError) {
        errorDetails = response.statusText;
      }
      
      throw new Error(`API error ${response.status}: ${errorDetails}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
      error.message = `Cannot connect to backend server at ${API_URL}. Make sure the backend is running.`;
    }
    
    console.error('❌ API Error:', error.message);
    throw error;
  }
};

export default {
  apiUrl,
  fetchApi,
  isProduction
};
