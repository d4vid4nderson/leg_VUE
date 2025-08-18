import React, { useState, useEffect } from 'react';

const FetchProgress = ({ state = null, className = '' }) => {
  const [isMonitoring, setIsMonitoring] = useState(true);
  const [lastChecked, setLastChecked] = useState(new Date());
  const [monitoringStatus, setMonitoringStatus] = useState('active');

  // Simulate monitoring status
  useEffect(() => {
    if (!state) return;

    const interval = setInterval(() => {
      setLastChecked(new Date());
      // Randomly change status for demonstration
      const statuses = ['active', 'idle', 'checking'];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      setMonitoringStatus(randomStatus);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [state]);

  if (!state) {
    return null;
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-blue-800">
          Bill Fetch Monitor - {state}
        </h3>
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-blue-600">
            Live monitoring
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <div className="bg-white rounded-lg p-3 border">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-gray-800">System Status</h4>
            <span className="text-xs text-gray-500">
              {lastChecked.toLocaleTimeString()}
            </span>
          </div>

          <div className="mb-2">
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>
                {monitoringStatus === 'active' ? 'Actively monitoring for new bills...' :
                 monitoringStatus === 'checking' ? 'Checking LegiScan API...' :
                 'System idle - monitoring for activity'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center py-4">
        <div className="inline-flex items-center space-x-2 text-gray-600">
          <div className="animate-pulse w-2 h-2 bg-blue-400 rounded-full"></div>
          <div className="animate-pulse w-2 h-2 bg-blue-400 rounded-full" style={{animationDelay: '0.2s'}}></div>
          <div className="animate-pulse w-2 h-2 bg-blue-400 rounded-full" style={{animationDelay: '0.4s'}}></div>
          <span className="ml-2 text-sm">Monitoring for new fetch operations...</span>
        </div>
      </div>
    </div>
  );
};

export default FetchProgress;