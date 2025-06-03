// Debug Dashboard Component for monitoring backend and database state

import React, { useState, useEffect, useRef } from 'react';
import { 
  Monitor, 
  Database, 
  Activity, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Server,
  Eye,
  EyeOff,
  Trash2,
  Info
} from 'lucide-react';

const DebugDashboard = ({ API_URL }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [debugData, setDebugData] = useState({
    apiStatus: 'unknown',
    databaseStats: null,
    recentApiCalls: [],
    systemHealth: null,
    lastUpdate: null
  });
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef(null);

  // Auto-refresh effect
  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        refreshDebugData();
      }, refreshInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, refreshInterval]);

  // Initial load
  useEffect(() => {
    if (isVisible) {
      refreshDebugData();
    }
  }, [isVisible]);

  const refreshDebugData = async () => {
    setIsRefreshing(true);
    try {
      // API Health Check
      const healthResponse = await fetch(`${API_URL}/api/health`);
      const healthData = healthResponse.ok ? await healthResponse.json() : null;

      // Database Stats
      const dbResponse = await fetch(`${API_URL}/api/debug/database-stats`);
      const dbData = dbResponse.ok ? await dbResponse.json() : null;

      // Recent API Calls Log
      const logsResponse = await fetch(`${API_URL}/api/debug/recent-logs`);
      const logsData = logsResponse.ok ? await logsResponse.json() : null;

      // System Health
      const systemResponse = await fetch(`${API_URL}/api/debug/system-health`);
      const systemData = systemResponse.ok ? await systemResponse.json() : null;

      setDebugData({
        apiStatus: healthResponse.ok ? 'healthy' : 'error',
        databaseStats: dbData,
        recentApiCalls: logsData?.logs || [],
        systemHealth: systemData,
        lastUpdate: new Date().toLocaleTimeString()
      });

    } catch (error) {
      console.error('Debug data fetch error:', error);
      setDebugData(prev => ({
        ...prev,
        apiStatus: 'error',
        lastUpdate: new Date().toLocaleTimeString()
      }));
    } finally {
      setIsRefreshing(false);
    }
  };

  const clearLogs = async () => {
    try {
      await fetch(`${API_URL}/api/debug/clear-logs`, { method: 'POST' });
      refreshDebugData();
    } catch (error) {
      console.error('Error clearing logs:', error);
    }
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-gray-800 text-white p-3 rounded-full shadow-lg hover:bg-gray-700 transition-all duration-300 flex items-center gap-2"
        >
          <Monitor size={20} />
          <span className="hidden sm:inline">Debug</span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 max-h-96 bg-white border border-gray-300 rounded-lg shadow-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 text-white p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor size={16} />
          <span className="font-medium">Debug Dashboard</span>
          {debugData.apiStatus === 'healthy' && <CheckCircle size={14} className="text-green-400" />}
          {debugData.apiStatus === 'error' && <AlertCircle size={14} className="text-red-400" />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={refreshDebugData}
            disabled={isRefreshing}
            className="p-1 hover:bg-gray-700 rounded transition-colors duration-200"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-gray-700 rounded transition-colors duration-200"
          >
            <EyeOff size={14} />
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="p-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span>Auto-refresh</span>
          </label>
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="text-xs border border-gray-300 rounded px-2 py-1"
            disabled={!autoRefresh}
          >
            <option value={2000}>2s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
          </select>
        </div>
        {debugData.lastUpdate && (
          <div className="text-xs text-gray-600 flex items-center gap-1">
            <Clock size={12} />
            <span>Last update: {debugData.lastUpdate}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-h-80 overflow-y-auto">
        {/* API Status */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Server size={14} className="text-blue-600" />
            <span className="text-sm font-medium">API Status</span>
          </div>
          <div className="text-xs">
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
              debugData.apiStatus === 'healthy' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {debugData.apiStatus === 'healthy' ? (
                <CheckCircle size={12} />
              ) : (
                <AlertCircle size={12} />
              )}
              <span>{debugData.apiStatus.toUpperCase()}</span>
            </div>
            <div className="mt-1 text-gray-600">
              Endpoint: {API_URL}
            </div>
          </div>
        </div>

        {/* Database Stats */}
        <div className="p-3 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Database size={14} className="text-green-600" />
            <span className="text-sm font-medium">Database Stats</span>
          </div>
          {debugData.databaseStats ? (
            <div className="text-xs space-y-1">
              <div className="grid grid-cols-2 gap-2">
                <div>Executive Orders: <span className="font-medium">{debugData.databaseStats.executive_orders || 0}</span></div>
                <div>State Bills: <span className="font-medium">{debugData.databaseStats.state_legislation || 0}</span></div>
                <div>Total Records: <span className="font-medium">{debugData.databaseStats.total_records || 0}</span></div>
                <div>DB Size: <span className="font-medium">{debugData.databaseStats.db_size || 'Unknown'}</span></div>
              </div>
              {debugData.databaseStats.recent_activity && (
                <div className="mt-2 text-gray-600">
                  Last Activity: {debugData.databaseStats.recent_activity}
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-500">No database stats available</div>
          )}
        </div>

        {/* System Health */}
        {debugData.systemHealth && (
          <div className="p-3 border-b border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <Activity size={14} className="text-purple-600" />
              <span className="text-sm font-medium">System Health</span>
            </div>
            <div className="text-xs space-y-1">
              <div>Memory Usage: <span className="font-medium">{debugData.systemHealth.memory_usage || 'Unknown'}</span></div>
              <div>CPU Usage: <span className="font-medium">{debugData.systemHealth.cpu_usage || 'Unknown'}</span></div>
              <div>Uptime: <span className="font-medium">{debugData.systemHealth.uptime || 'Unknown'}</span></div>
            </div>
          </div>
        )}

        {/* Recent API Calls */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Info size={14} className="text-orange-600" />
              <span className="text-sm font-medium">Recent API Calls</span>
            </div>
            <button
              onClick={clearLogs}
              className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
            >
              <Trash2 size={12} />
              Clear
            </button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {debugData.recentApiCalls.length > 0 ? (
              debugData.recentApiCalls.map((call, index) => (
                <div key={index} className="text-xs p-2 bg-gray-50 rounded border">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${
                      call.status >= 200 && call.status < 300 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {call.method} {call.endpoint}
                    </span>
                    <span className="text-gray-500">{call.status}</span>
                  </div>
                  <div className="text-gray-600 flex items-center justify-between">
                    <span>{call.timestamp}</span>
                    <span>{call.duration}ms</span>
                  </div>
                  {call.error && (
                    <div className="text-red-600 mt-1">{call.error}</div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-xs text-gray-500 text-center py-2">No recent API calls</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Mock Backend Endpoints Component (for testing without actual backend)
const MockDebugEndpoints = ({ API_URL }) => {
  const [showMockInfo, setShowMockInfo] = useState(false);

  const mockEndpoints = [
    'GET /api/health',
    'GET /api/debug/database-stats', 
    'GET /api/debug/recent-logs',
    'GET /api/debug/system-health',
    'POST /api/debug/clear-logs'
  ];

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={() => setShowMockInfo(!showMockInfo)}
        className="bg-yellow-600 text-white p-2 rounded-full shadow-lg hover:bg-yellow-700 transition-all duration-300"
      >
        <Info size={16} />
      </button>
      
      {showMockInfo && (
        <div className="absolute bottom-full mb-2 bg-white border border-gray-300 rounded-lg shadow-xl p-4 w-80">
          <h3 className="font-semibold mb-2">Required Backend Endpoints</h3>
          <div className="text-xs space-y-1">
            {mockEndpoints.map((endpoint, index) => (
              <div key={index} className="font-mono text-gray-700 bg-gray-100 p-1 rounded">
                {endpoint}
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-600">
            <p>Add these endpoints to your backend to enable debugging:</p>
            <ul className="mt-1 space-y-1">
              <li>• <code>/api/health</code> - Basic API health check</li>
              <li>• <code>/api/debug/database-stats</code> - DB record counts</li>
              <li>• <code>/api/debug/recent-logs</code> - Recent API call logs</li>
              <li>• <code>/api/debug/system-health</code> - System metrics</li>
              <li>• <code>/api/debug/clear-logs</code> - Clear logs</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export { DebugDashboard, MockDebugEndpoints };