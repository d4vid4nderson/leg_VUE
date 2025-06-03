// services/enhancedLegiScanService.js
class EnhancedLegiScanService {
  constructor(baseURL = 'http://localhost:8000') {
    this.baseURL = baseURL;
  }

  // Test the enhanced integration
  async testIntegration() {
    try {
      const response = await fetch(`${this.baseURL}/api/legiscan/test-integration`);
      const data = await response.json();
      return {
        success: response.ok,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Enhanced multi-state fetch with AI analysis
  async enhancedFetch(options = {}) {
    const {
      states = ['CA'],
      billsPerState = 25,
      saveToDb = true,
      useAiAnalysis = true,
      sessionId = null
    } = options;

    try {
      const response = await fetch(`${this.baseURL}/api/legiscan/enhanced-fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          states,
          bills_per_state: billsPerState,
          save_to_db: saveToDb,
          use_ai_analysis: useAiAnalysis,
          session_id: sessionId
        })
      });

      const data = await response.json();
      return {
        success: response.ok,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Search bills by topic with AI analysis
  async searchAndAnalyze(options = {}) {
    const {
      query,
      state = null,
      limit = 20,
      saveToDb = true
    } = options;

    if (!query) {
      return {
        success: false,
        error: 'Query is required'
      };
    }

    try {
      const response = await fetch(`${this.baseURL}/api/legiscan/search-and-analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          state,
          limit,
          save_to_db: saveToDb
        })
      });

      const data = await response.json();
      return {
        success: response.ok,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get system status
  async getSystemStatus() {
    try {
      const response = await fetch(`${this.baseURL}/api/status`);
      const data = await response.json();
      return {
        success: response.ok,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get existing legislation from database
  async getStateLegislation(options = {}) {
    const {
      state = null,
      category = null,
      page = 1,
      perPage = 25,
      search = null,
      sortBy = 'last_updated',
      sortOrder = 'desc'
    } = options;

    const params = new URLSearchParams();
    if (state) params.append('state', state);
    if (category) params.append('category', category);
    if (search) params.append('search', search);
    params.append('page', page);
    params.append('per_page', perPage);
    params.append('sort_by', sortBy);
    params.append('sort_order', sortOrder);

    try {
      const response = await fetch(`${this.baseURL}/api/state-legislation?${params}`);
      const data = await response.json();
      return {
        success: response.ok,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get analytics overview
  async getAnalytics() {
    try {
      const response = await fetch(`${this.baseURL}/api/analytics/overview`);
      const data = await response.json();
      return {
        success: response.ok,
        data
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default EnhancedLegiScanService;