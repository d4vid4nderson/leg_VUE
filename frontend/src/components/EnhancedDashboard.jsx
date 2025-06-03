// components/EnhancedDashboard.jsx
import React, { useState, useEffect } from 'react';
import EnhancedLegiScanService from '../services/enhancedLegiScanService';

const EnhancedDashboard = () => {
  const [analytics, setAnalytics] = useState(null);
  const [systemStatus, setSystemStatus] = useState(null);
  const [recentBills, setRecentBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const service = new EnhancedLegiScanService();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load analytics and system status in parallel
      const [analyticsResult, statusResult, billsResult] = await Promise.all([
        service.getAnalytics(),
        service.getSystemStatus(),
        service.getStateLegislation({ page: 1, perPage: 5, sortBy: 'last_updated' })
      ]);

      if (analyticsResult.success) {
        setAnalytics(analyticsResult.data);
      }

      if (statusResult.success) {
        setSystemStatus(statusResult.data);
      }

      if (billsResult.success) {
        setRecentBills(billsResult.data.bills || []);
      }

    } catch (err) {
      setError(`Dashboard error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderSystemOverview = () => {
    if (!systemStatus) return null;

    const integrations = systemStatus.integrations || {};
    const features = systemStatus.features || {};

    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">🔧 System Status</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">v{systemStatus.app_version}</div>
            <div className="text-sm text-gray-600">API Version</div>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">
              {integrations.azure_ai?.status === 'connected' ? '✅' : '❌'}
            </div>
            <div className="text-sm text-gray-600">Azure AI</div>
          </div>
          
          <div className="text-center p-3 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {integrations.legiscan_enhanced === 'connected' ? '✅' : '❌'}
            </div>
            <div className="text-sm text-gray-600">Enhanced LegiScan</div>
          </div>
          
          <div className="text-center p-3 bg-orange-50 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              {systemStatus.database?.status === 'connected' ? '✅' : '❌'}
            </div>
            <div className="text-sm text-gray-600">Database</div>
          </div>
        </div>

        <div className="border-t pt-4">
          <h3 className="font-medium mb-2">Available Features</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            {Object.entries(features).map(([feature, available]) => (
              <div key={feature} className="flex items-center space-x-2">
                <span className={available ? 'text-green-500' : 'text-red-500'}>
                  {available ? '✅' : '❌'}
                </span>
                <span className="capitalize">
                  {feature.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderAnalyticsOverview = () => {
    if (!analytics) return null;

    const overview = analytics.overview || {};
    const distributions = analytics.distributions || {};

    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">📊 Analytics Overview</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600">
              {overview.total_bills?.toLocaleString() || 0}
            </div>
            <div className="text-sm text-gray-600">Total Bills</div>
          </div>
          
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <div className="text-3xl font-bold text-green-600">
              {overview.total_executive_orders?.toLocaleString() || 0}
            </div>
            <div className="text-sm text-gray-600">Executive Orders</div>
          </div>
          
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-3xl font-bold text-purple-600">
              {overview.states_covered || 0}
            </div>
            <div className="text-sm text-gray-600">States Covered</div>
          </div>
          
          <div className="text-center p-4 bg-orange-50 rounded-lg">
            <div className="text-3xl font-bold text-orange-600">
              {overview.recent_activity || 0}
            </div>
            <div className="text-sm text-gray-600">Recent Activity</div>
          </div>
        </div>

        {distributions.bills_by_state && distributions.bills_by_state.length > 0 && (
          <div className="mb-6">
            <h3 className="font-medium mb-3">📍 Bills by State</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {distributions.bills_by_state.slice(0, 8).map(item => (
                <div key={item.state} className="text-center p-2 bg-gray-50 rounded">
                  <div className="font-semibold">{item.state}</div>
                  <div className="text-sm text-gray-600">{item.count} bills</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {distributions.bills_by_category && distributions.bills_by_category.length > 0 && (
          <div>
            <h3 className="font-medium mb-3">🏷️ Bills by Category</h3>
            <div className="space-y-2">
              {distributions.bills_by_category.slice(0, 6).map(item => (
                <div key={item.category} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="capitalize">{item.category?.replace(/_/g, ' ') || 'Uncategorized'}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderRecentBills = () => {
    if (!recentBills || recentBills.length === 0) return null;

    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">📄 Recent Bills</h2>
        
        <div className="space-y-4">
          {recentBills.map(bill => (
            <div key={bill.bill_id} className="border-l-4 border-blue-500 pl-4 py-2">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">
                    {bill.bill_number} - {bill.title || 'No Title'}
                  </h3>
                  <div className="text-sm text-gray-600 mt-1">
                    {bill.state} • {bill.category || 'Uncategorized'}
                    {bill.last_updated && (
                      <span className="ml-2">
                        Updated: {new Date(bill.last_updated).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {bill.description && (
                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                      {bill.description.length > 100 
                        ? `${bill.description.substring(0, 100)}...` 
                        : bill.description
                      }
                    </p>
                  )}
                </div>
                {bill.ai_summary && (
                  <div className="ml-4 flex-shrink-0">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      🤖 AI Analyzed
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 text-center">
          <button 
            onClick={() => window.location.href = '/legislation'}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View All Bills →
          </button>
        </div>
      </div>
    );
  };

  const renderQuickActions = () => {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">⚡ Quick Actions</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button 
            onClick={() => window.location.href = '/enhanced-search'}
            className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-left transition-colors"
          >
            <div className="text-lg font-medium text-blue-800 mb-1">🔍 Search Bills</div>
            <div className="text-sm text-blue-600">
              Search legislation by topic with AI analysis
            </div>
          </button>
          
          <button 
            onClick={() => window.location.href = '/multi-state-processor'}
            className="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-left transition-colors"
          >
            <div className="text-lg font-medium text-green-800 mb-1">🏛️ Process States</div>
            <div className="text-sm text-green-600">
              Fetch and analyze bills from multiple states
            </div>
          </button>
          
          <button 
            onClick={() => window.location.href = '/executive-orders'}
            className="p-4 bg-purple-50 hover:bg-purple-100 rounded-lg text-left transition-colors"
          >
            <div className="text-lg font-medium text-purple-800 mb-1">📜 Executive Orders</div>
            <div className="text-sm text-purple-600">
              View and analyze executive orders
            </div>
          </button>
          
          <button 
            onClick={loadDashboardData}
            className="p-4 bg-orange-50 hover:bg-orange-100 rounded-lg text-left transition-colors"
          >
            <div className="text-lg font-medium text-orange-800 mb-1">🔄 Refresh Data</div>
            <div className="text-sm text-orange-600">
              Update dashboard with latest information
            </div>
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-3">
            <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span className="text-lg">Loading dashboard...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🎯 Enhanced LegiScan Dashboard
        </h1>
        <p className="text-gray-600">
          Monitor your legislative data pipeline with AI-powered analysis and multi-state processing
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <div className="text-red-600">
            <h3 className="text-sm font-medium">Dashboard Error</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {renderSystemOverview()}
        {renderQuickActions()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderAnalyticsOverview()}
        {renderRecentBills()}
      </div>
    </div>
  );
};

export default EnhancedDashboard;