// components/SettingsPage.jsx - Settings and system management page
import React, { useState, useEffect } from 'react';
import {
  Settings,
  Info,
  RotateCw,
  CheckCircle,
  X,
  Trash2,
  ChevronDown,
  HelpCircle,
  ExternalLink,
  Mail,
  Monitor,
  Shield,
  Globe,
  Database,
  Edit3,
  Save
} from 'lucide-react';

import { getApiUrl } from '../utils/helpers';

const API_URL = getApiUrl();

const SettingsPage = ({ 
  federalDateRange, 
  setFederalDateRange, 
  makeApiCall,
  appVersion,           // ← Receive from App.jsx
  setAppVersion         // ← Receive from App.jsx
}) => {
  const [showDatabaseSection, setShowDatabaseSection] = useState(false);
  const [clearingDatabase, setClearingDatabase] = useState(false);
  const [showClearWarning, setShowClearWarning] = useState(false);
  const [clearStatus, setClearStatus] = useState(null);
  
  // Local editing state (no longer need appVersion state here)
  const [isEditingVersion, setIsEditingVersion] = useState(false);
  const [tempVersion, setTempVersion] = useState(appVersion || '1.0.0');
  const [versionUpdateStatus, setVersionUpdateStatus] = useState(null);
  
  // Integration status state
  const [integrationStatus, setIntegrationStatus] = useState({
    database: { status: 'checking', message: 'Checking...', responseTime: null },
    legiscan: { status: 'checking', message: 'Checking...', responseTime: null },
    azureAI: { status: 'checking', message: 'Checking...', responseTime: null },
    federalRegister: { status: 'checking', message: 'Checking...', responseTime: null }
  });
  
  const [lastHealthCheck, setLastHealthCheck] = useState(null);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // Update tempVersion when appVersion prop changes
  useEffect(() => {
    setTempVersion(appVersion || '1.0.0');
  }, [appVersion]);

  // Save version and notify App.jsx
  const handleVersionUpdate = () => {
    if (tempVersion.trim() === '') {
      setVersionUpdateStatus('❌ Version cannot be empty');
      setTimeout(() => setVersionUpdateStatus(null), 3000);
      return;
    }

    // Update the parent state (App.jsx)
    setAppVersion(tempVersion);
    
    // Save to localStorage
    localStorage.setItem('appVersion', tempVersion);
    
    // Update UI
    setIsEditingVersion(false);
    setVersionUpdateStatus('✅ Version updated successfully!');
    
    // Dispatch event to notify other components (like Footer)
    const event = new CustomEvent('versionUpdated', { detail: { version: tempVersion } });
    window.dispatchEvent(event);
    
    setTimeout(() => setVersionUpdateStatus(null), 3000);
  };

  const handleCancelVersionEdit = () => {
    setTempVersion(appVersion);
    setIsEditingVersion(false);
  };

  // Status icon and color mapping
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'healthy':
      case 'connected':
      case 'operational':
        return { 
          icon: <CheckCircle size={16} className="text-green-600" />, 
          text: 'Online ✓', 
          textColor: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200'
        };
      case 'unhealthy':
      case 'error':
      case 'failed':
        return { 
          icon: <X size={16} className="text-red-600" />, 
          text: 'Offline ✗', 
          textColor: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200'
        };
      case 'checking':
      case 'loading':
        return { 
          icon: <RotateCw size={16} className="text-yellow-600 animate-spin" />, 
          text: 'Checking...', 
          textColor: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200'
        };
      default:
        return { 
          icon: <Info size={16} className="text-gray-600" />, 
          text: 'Unknown', 
          textColor: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200'
        };
    }
  };

  // Check all services health
  const checkAllIntegrations = async () => {
    setCheckingHealth(true);
    
    try {
      // Try the main status endpoint
      const response = await fetch(`${API_URL}/api/status`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Map the response to our integration status format
        const newStatus = {
          database: {
            status: data.database?.status === 'connected' ? 'healthy' : 'error',
            message: data.database?.status === 'connected' ? 'Database connected' : 'Database connection failed',
            responseTime: null
          },
          legiscan: {
            status: data.integrations?.legiscan === 'connected' ? 'healthy' : 'error',
            message: data.integrations?.legiscan === 'connected' ? 'LegiScan API connected' : 'LegiScan API not configured',
            responseTime: null
          },
          azureAI: {
            status: data.integrations?.ai_analysis === 'connected' ? 'healthy' : 'error',
            message: data.integrations?.ai_analysis === 'connected' ? 'Azure AI connected' : 'Azure AI not configured',
            responseTime: null
          },
          federalRegister: {
            status: data.integrations?.federal_register === 'available' ? 'healthy' : 'error',
            message: data.integrations?.federal_register === 'available' ? 'Federal Register available' : 'Federal Register unavailable',
            responseTime: null
          }
        };
        
        setIntegrationStatus(newStatus);
        setLastHealthCheck(new Date());
      } else {
        // Set all to error state if main endpoint fails
        const errorStatus = {
          database: { status: 'error', message: 'Health check failed', responseTime: null },
          legiscan: { status: 'error', message: 'Health check failed', responseTime: null },
          azureAI: { status: 'error', message: 'Health check failed', responseTime: null },
          federalRegister: { status: 'error', message: 'Health check failed', responseTime: null }
        };
        setIntegrationStatus(errorStatus);
      }
    } catch (error) {
      console.error('Health check failed:', error);
      // Set all to error state
      const errorStatus = {
        database: { status: 'error', message: 'Connection failed', responseTime: null },
        legiscan: { status: 'error', message: 'Connection failed', responseTime: null },
        azureAI: { status: 'error', message: 'Connection failed', responseTime: null },
        federalRegister: { status: 'error', message: 'Connection failed', responseTime: null }
      };
      setIntegrationStatus(errorStatus);
    } finally {
      setCheckingHealth(false);
    }
  };

  // Auto-check on component mount
  useEffect(() => {
    checkAllIntegrations();
    
    // Optional: Set up auto-refresh every 5 minutes
    const interval = setInterval(checkAllIntegrations, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Database clear function
  const handleClearDatabase = async () => {
    if (clearingDatabase) return;
    
    setClearingDatabase(true);
    setClearStatus('🗑️ Clearing database...');
    
    try {
      const response = await fetch(`${API_URL}/api/database/clear-all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.ok) {
        setClearStatus('✅ Database cleared successfully!');
        setShowClearWarning(false);
        // Recheck health after clearing
        setTimeout(checkAllIntegrations, 2000);
      } else {
        const errorData = await response.json();
        setClearStatus(`❌ Error: ${errorData.message || 'Failed to clear database'}`);
      }
      
    } catch (error) {
      console.error('Error clearing database:', error);
      setClearStatus(`❌ Error: ${error.message}`);
    } finally {
      setClearingDatabase(false);
      setTimeout(() => setClearStatus(null), 5000);
    }
  };

  return (
    <div className="pt-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Settings</h2>
        <p className="text-gray-600">Monitor your system status and manage your database</p>
      </div>

      {/* Clear Status */}
      {clearStatus && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800 text-sm font-medium">{clearStatus}</p>
        </div>
      )}

      {/* Version Update Status */}
      {versionUpdateStatus && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800 text-sm font-medium">{versionUpdateStatus}</p>
        </div>
      )}

      <div className="space-y-6">
        {/* System Configuration Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Settings size={20} />
              <span>System Configuration</span>
            </h3>
            <button
              onClick={checkAllIntegrations}
              disabled={checkingHealth}
              className="flex items-center gap-2 px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              <RotateCw size={14} className={checkingHealth ? 'animate-spin' : ''} />
              <span>{checkingHealth ? 'Checking...' : 'Refresh'}</span>
            </button>
          </div>
          
          <div className="space-y-4">
            {/* API Configuration */}
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <h4 className="font-semibold text-gray-800 mb-2">API Configuration</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• <strong>Backend API:</strong> {API_URL}</p>
                <p>• <strong>Environment:</strong> {window.location.hostname === 'localhost' ? 'Development' : 'Production'}</p>
                <p>• <strong>Database Type:</strong> Azure SQL with SQLite fallback</p>
              </div>
            </div>

            {/* Integration Status */}
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-800">Integration Status</h4>
                {lastHealthCheck && (
                  <p className="text-xs text-gray-500">
                    Last checked: {lastHealthCheck.toLocaleTimeString()}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {Object.entries({
                  'LegiScan API': 'legiscan',
                  'Azure AI': 'azureAI', 
                  'Federal Register': 'federalRegister',
                  'Database': 'database'
                }).map(([label, key]) => {
                  const status = integrationStatus[key];
                  const display = getStatusDisplay(status.status);
                  
                  return (
                    <div 
                      key={key}
                      className={`flex items-center justify-between p-3 rounded border ${display.bgColor} ${display.borderColor}`}
                    >
                      <div className="flex items-center gap-2">
                        {display.icon}
                        <span className="font-medium">{label}</span>
                      </div>
                      <div className="text-right">
                        <span className={`font-medium ${display.textColor}`}>
                          {display.text}
                        </span>
                        {status.responseTime && (
                          <p className="text-xs text-gray-500">
                            {status.responseTime}ms
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Show any error messages */}
              {Object.values(integrationStatus).some(s => s.status === 'error') && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                  <h5 className="font-medium text-red-800 mb-1">Service Issues:</h5>
                  <ul className="text-xs text-red-700 space-y-1">
                    {Object.entries(integrationStatus)
                      .filter(([_, status]) => status.status === 'error')
                      .map(([service, status]) => (
                        <li key={service}>• {service}: {status.message}</li>
                      ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Performance Settings */}
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <h4 className="font-semibold text-gray-800 mb-2">Performance Settings</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• <strong>AI Processing:</strong> Batch processing enabled for efficiency</p>
                <p>• <strong>Data Caching:</strong> Local storage for improved load times</p>
                <p>• <strong>Rate Limiting:</strong> API calls optimized to prevent throttling</p>
                <p>• <strong>Auto-refresh:</strong> Background updates every 5 minutes</p>
              </div>
            </div>
          </div>
        </div>

        {/* System Information Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Info size={20} />
            <span>System Information</span>
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-blue-800">Application Version</h4>
                {!isEditingVersion && (
                  <button
                    onClick={() => setIsEditingVersion(true)}
                    className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                    title="Edit version"
                  >
                    <Edit3 size={14} />
                  </button>
                )}
              </div>
              
              {isEditingVersion ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={tempVersion}
                    onChange={(e) => setTempVersion(e.target.value)}
                    className="w-full px-3 py-2 text-lg font-bold text-blue-600 bg-white border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 1.0.0"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') handleVersionUpdate();
                      if (e.key === 'Escape') handleCancelVersionEdit();
                    }}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleVersionUpdate}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      <Save size={12} />
                      Save
                    </button>
                    <button
                      onClick={handleCancelVersionEdit}
                      className="px-3 py-1 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-2xl font-bold text-blue-600 mb-2">v{appVersion}</p>
                  <p className="text-sm text-blue-700">
                    Azure SQL Enhanced Edition
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Click the edit icon to update version
                  </p>
                </>
              )}
            </div>
            
            {/* DYNAMIC STATUS SECTION */}
            {(() => {
              // Determine overall system status based on integration statuses
              const statuses = Object.values(integrationStatus);
              const hasErrors = statuses.some(s => s.status === 'error' || s.status === 'unhealthy');
              const isChecking = statuses.some(s => s.status === 'checking');
              
              let statusConfig;
              if (hasErrors) {
                statusConfig = {
                  bgColor: 'bg-orange-50',
                  borderColor: 'border-orange-200',
                  titleColor: 'text-orange-800',
                  valueColor: 'text-orange-600',
                  messageColor: 'text-orange-700',
                  message: 'Service issues detected - some features may be unavailable'
                };
              } else if (isChecking) {
                statusConfig = {
                  bgColor: 'bg-yellow-50',
                  borderColor: 'border-yellow-200',
                  titleColor: 'text-yellow-800',
                  valueColor: 'text-yellow-600',
                  messageColor: 'text-yellow-700',
                  message: 'System status check in progress...'
                };
              } else {
                statusConfig = {
                  bgColor: 'bg-green-50',
                  borderColor: 'border-green-200',
                  titleColor: 'text-green-800',
                  valueColor: 'text-green-600',
                  messageColor: 'text-green-700',
                  message: 'All services operational'
                };
              }
              
              return (
                <div className={`${statusConfig.bgColor} p-4 rounded-lg border ${statusConfig.borderColor}`}>
                  <h4 className={`font-semibold ${statusConfig.titleColor} mb-2`}>Last Updated</h4>
                  <p className={`text-lg font-bold ${statusConfig.valueColor} mb-2`}>
                    {lastHealthCheck ? (
                      <>
                        {lastHealthCheck.toLocaleDateString()} at {lastHealthCheck.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </>
                    ) : (
                      'Checking system status...'
                    )}
                  </p>
                  <p className={`text-sm ${statusConfig.messageColor}`}>
                    System status: {statusConfig.message}
                  </p>
                  
                  {/* Optional: Show detailed status for errors */}
                  {hasErrors && (
                    <div className="mt-2 text-xs text-orange-600">
                      Issues: {statuses
                        .filter(s => s.status === 'error' || s.status === 'unhealthy')
                        .map(s => s.message)
                        .join(', ')
                      }
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-md">
            <h4 className="font-semibold text-gray-800 mb-2">Technical Details</h4>
            <div className="text-sm text-gray-600 space-y-1">
              <p>• <strong>Frontend:</strong> React 18 with Vite build system</p>
              <p>• <strong>Backend:</strong> FastAPI with Python async support</p>
              <p>• <strong>Database:</strong> Azure SQL Server with automatic failover</p>
              <p>• <strong>AI Engine:</strong> Azure OpenAI GPT-4 integration</p>
              <p>• <strong>Data Sources:</strong> Federal Register API, LegiScan API</p>
            </div>
          </div>
        </div>

        {/* Database Management Section */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <button
            onClick={() => setShowDatabaseSection(!showDatabaseSection)}
            className="w-full flex items-center justify-between text-left focus:outline-none"
          >
            <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Settings size={20} />
              <span>Database Management</span>
            </h3>
            <ChevronDown 
              size={20} 
              className={`text-gray-500 transition-transform duration-200 ${showDatabaseSection ? 'rotate-180' : ''}`}
            />
          </button>

          {showDatabaseSection && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                  <Trash2 size={16} />
                  <span>Clear Database</span>
                </h4>
                <p className="text-red-700 text-sm mb-3">
                  This will permanently delete all executive orders and legislation from the database. 
                  This action cannot be undone. Your highlights will also be cleared.
                </p>
                
                {!showClearWarning ? (
                  <button
                    onClick={() => setShowClearWarning(true)}
                    disabled={clearingDatabase}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
                      clearingDatabase 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    Clear Database
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={handleClearDatabase}
                      disabled={clearingDatabase}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
                        clearingDatabase
                          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      <Trash2 size={14} />
                      <span>{clearingDatabase ? 'Clearing...' : 'Confirm Clear'}</span>
                    </button>
                    <button
                      onClick={() => setShowClearWarning(false)}
                      disabled={clearingDatabase}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-400 transition-all duration-300"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              {/* Database Info */}
              <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                <h4 className="font-semibold text-gray-800 mb-2">Database Information</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• Executive orders and state legislation are stored locally</p>
                  <p>• Data includes AI analysis and summaries</p>
                  <p>• Clearing will require re-fetching all data</p>
                  <p>• Your highlighted items are stored separately but will also be cleared</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Help and Support */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <HelpCircle size={20} />
            <span>Help & Support</span>
          </h3>
          
          <div className="grid grid-cols-1 gap-4">
            <div className="border border-blue-100 rounded-lg p-4 bg-blue-50">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Mail size={20} className="text-blue-600" />
                </div>
                <div>
                  <h5 className="font-medium text-blue-800">Email Support</h5>
                  <p className="text-sm text-blue-600">For technical issues and questions</p>
                </div>
              </div>
              <a 
                href="mailto:legal@moregroup-inc.com"
                className="text-blue-700 hover:text-blue-900 font-medium text-sm flex items-center gap-1"
              >
                legal@moregroup-inc.com <ExternalLink size={12} />
              </a>
              <p className="text-xs text-blue-600 mt-1">Response time: 24-48 hours</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;