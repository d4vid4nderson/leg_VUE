// Create this as a temporary debugging component to test your backend endpoints
// Add this to a new file: components/DebugEndpoints.jsx

import React, { useState } from 'react';

const DebugEndpoints = () => {
  const [results, setResults] = useState([]);
  const [testing, setTesting] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || '';

  const testEndpoints = async () => {
    setTesting(true);
    setResults([]);
    
    // List of endpoints to test
    const endpoints = [
      // Basic endpoints without parameters
      `${API_URL}/api/executive-orders`,
      `${API_URL}/api/executive-orders-fixed`,
      `${API_URL}/api/bills`,
      `${API_URL}/api/legislation`,
      
      // With basic parameters
      `${API_URL}/api/executive-orders?page=1`,
      `${API_URL}/api/executive-orders-fixed?page=1`,
      `${API_URL}/api/bills?page=1`,
      `${API_URL}/api/legislation?page=1`,
      
      // With type parameter
      `${API_URL}/api/bills?type=executive_order`,
      `${API_URL}/api/legislation?type=executive_order`,
      
      // Alternative naming patterns
      `${API_URL}/api/executive_orders`,
      `${API_URL}/api/executive_orders?page=1`,
      `${API_URL}/api/orders`,
      `${API_URL}/api/orders?page=1`,
      
      // Check for any existing data endpoints
      `${API_URL}/api/`,
      `${API_URL}/api/health`,
      `${API_URL}/api/status`,
    ];

    for (const endpoint of endpoints) {
      try {
        console.log(`Testing: ${endpoint}`);
        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        const result = {
          endpoint,
          status: response.status,
          statusText: response.statusText,
          success: response.ok,
          contentType: response.headers.get('content-type'),
          data: null,
          error: null
        };

        if (response.ok) {
          try {
            const data = await response.json();
            result.data = data;
            result.recordCount = Array.isArray(data) ? data.length : 
                                Array.isArray(data.results) ? data.results.length :
                                data.count || 'unknown';
          } catch (e) {
            result.error = 'Failed to parse JSON response';
          }
        } else {
          try {
            const errorText = await response.text();
            result.error = errorText;
          } catch (e) {
            result.error = 'Failed to read error response';
          }
        }

        setResults(prev => [...prev, result]);
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        setResults(prev => [...prev, {
          endpoint,
          status: 'Network Error',
          success: false,
          error: error.message
        }]);
      }
    }
    
    setTesting(false);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Backend Endpoint Debugger</h3>
      
      <button
        onClick={testEndpoints}
        disabled={testing}
        className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300 ${
          testing ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {testing ? 'Testing Endpoints...' : 'Test All Endpoints'}
      </button>

      {results.length > 0 && (
        <div className="mt-6">
          <h4 className="font-medium text-gray-800 mb-3">Results:</h4>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {results.map((result, index) => (
              <div key={index} className={`p-3 rounded border ${
                result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <div className="font-mono text-sm mb-2">
                  <span className={`font-semibold ${result.success ? 'text-green-800' : 'text-red-800'}`}>
                    {result.status}
                  </span>
                  {' '}
                  <span className="text-gray-600">{result.endpoint}</span>
                </div>
                
                {result.success && result.recordCount && (
                  <div className="text-sm text-green-700">
                    Records found: {result.recordCount}
                  </div>
                )}
                
                {result.error && (
                  <div className="text-sm text-red-700 mt-1">
                    Error: {result.error}
                  </div>
                )}
                
                {result.data && (
                  <details className="mt-2">
                    <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-800">
                      View Response Data
                    </summary>
                    <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(result.data, null, 2).slice(0, 500)}
                      {JSON.stringify(result.data, null, 2).length > 500 ? '...' : ''}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DebugEndpoints;