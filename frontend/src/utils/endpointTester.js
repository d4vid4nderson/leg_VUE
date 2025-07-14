// endpointTester.js
import API_URL from '../config/api';

class EndpointTester {
  static async testExecutiveOrdersEndpoints() {
    console.log('🧪 Testing Executive Orders Endpoints...');
    
    const tests = [
      {
        name: 'GET Executive Orders',
        method: 'GET',
        url: `${API_URL}/api/executive-orders?per_page=5`
      },
      {
        name: 'Debug Routes',
        method: 'GET',
        url: `${API_URL}/api/debug/routes`
      },
      {
        name: 'Test PATCH Method',
        method: 'PATCH',
        url: `${API_URL}/api/test-review/test123`,
        body: { reviewed: true }
      },
      {
        name: 'Executive Orders Endpoints Debug',
        method: 'GET',
        url: `${API_URL}/api/debug/executive-orders-endpoints`
      },
      {
        name: 'CORS Test',
        method: 'GET',
        url: `${API_URL}/api/cors-test`
      }
    ];
    
    const results = [];
    
    for (const test of tests) {
      try {
        console.log(`🔍 Testing: ${test.name}`);
        
        const options = {
          method: test.method,
          headers: { 'Content-Type': 'application/json' }
        };
        
        if (test.body) {
          options.body = JSON.stringify(test.body);
        }
        
        const response = await fetch(test.url, options);
        const data = await response.json();
        
        results.push({
          name: test.name,
          status: response.status,
          success: response.ok,
          url: test.url,
          method: test.method,
          response_preview: JSON.stringify(data).substring(0, 200),
          error: response.ok ? null : `HTTP ${response.status}`
        });
        
      } catch (error) {
        results.push({
          name: test.name,
          status: 'FAILED',
          success: false,
          error: error.message
        });
      }
    }
    
    console.table(results);
    return results;
  }
  
  static async testSpecificReviewEndpoint(orderId = 'eo-14316') {
    console.log(`🧪 Testing Review Endpoint for ${orderId}...`);
    
    const url = `${API_URL}/api/executive-orders/${orderId}/review`;
    
    try {
      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed: true })
      });
      
      const data = await response.json();
      
      console.log('📊 Review Endpoint Test Result:', {
        url,
        status: response.status,
        success: response.ok,
        response: data
      });
      
      return {
        url,
        status: response.status,
        success: response.ok,
        response: data
      };
      
    } catch (error) {
      console.error('❌ Review endpoint test failed:', error);
      return {
        url,
        status: 'FAILED',
        success: false,
        error: error.message
      };
    }
  }
  
  static async checkBackendHealth() {
    console.log('🏥 Checking Backend Health...');
    
    const healthChecks = [
      {
        name: 'Server Ping',
        url: `${API_URL}/api/cors-test`
      },
      {
        name: 'Routes Registration',
        url: `${API_URL}/api/debug/routes`
      },
      {
        name: 'Executive Orders Health',
        url: `${API_URL}/api/debug/executive-orders-endpoints`
      }
    ];
    
    const results = [];
    
    for (const check of healthChecks) {
      try {
        const response = await fetch(check.url);
        const data = await response.json();
        
        results.push({
          name: check.name,
          status: response.status,
          success: response.ok,
          details: response.ok ? 'OK' : data.error || 'Failed'
        });
        
      } catch (error) {
        results.push({
          name: check.name,
          status: 'FAILED',
          success: false,
          details: error.message
        });
      }
    }
    
    console.table(results);
    
    // Check if review endpoint is registered
    try {
      const routesResponse = await fetch(`${API_URL}/api/debug/routes`);
      const routesData = await routesResponse.json();
      
      const reviewEndpoint = routesData.review_routes?.find(r => 
        r.path.includes('executive-orders') && r.path.includes('review')
      );
      
      console.log('🔍 Review Endpoint Registration:', reviewEndpoint ? '✅ Found' : '❌ Not Found');
      if (reviewEndpoint) {
        console.log('📋 Review Endpoint Details:', reviewEndpoint);
      }
      
    } catch (error) {
      console.error('❌ Could not check endpoint registration:', error);
    }
    
    return results;
  }
}

export default EndpointTester;

// Usage examples:
// EndpointTester.testExecutiveOrdersEndpoints();
// EndpointTester.testSpecificReviewEndpoint('eo-14316');
// EndpointTester.checkBackendHealth();