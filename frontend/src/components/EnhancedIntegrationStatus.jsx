import React from 'react';
import { AlertTriangle, CheckCircle, X, RotateCw, Info, Activity } from 'lucide-react';

const DiagnosticModal = ({
  diagnosticResults,
  loading,
  fixing,
  runDiagnostics,
  handleClose,
  API_URL,
  integrationStatus,
  onRunDiagnostics,
  lastHealthCheck
}) => {
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl p-6 overflow-y-auto max-h-[90vh]">
        <h3 className="text-lg font-semibold mb-4">Diagnostics</h3>

        {/* Enhanced Integration Status Component */}
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-800">Integration Status</h4>
            <div className="flex items-center gap-2">
              {lastHealthCheck && (
                <p className="text-xs text-gray-500">
                  Last checked: {lastHealthCheck.toLocaleTimeString()}
                </p>
              )}
            </div>
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
              const isFederalRegister = key === 'federalRegister';

              return (
                <div 
                  key={key}
                  className={`flex items-center justify-between p-3 rounded border ${display.bgColor} ${display.borderColor}`}
                >
                  <div className="flex items-center gap-2">
                    {display.icon}
                    <span className="font-medium">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
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
                    {isFederalRegister && status.status === 'error' && (
                      <button
                        onClick={() => onRunDiagnostics()}
                        className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
                        title="Run Federal Register diagnostics"
                      >
                        <Activity size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

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

              {integrationStatus.federalRegister?.status === 'error' && (
                <button
                  onClick={() => onRunDiagnostics()}
                  className="mt-2 px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                >
                  Diagnose Federal Register Issues
                </button>
              )}
            </div>
          )}
        </div>

        {/* Diagnostic Results */}
        {diagnosticResults && !loading && !fixing && (
          <div>
            {/* Recommendations */}
            {diagnosticResults.recommendations && diagnosticResults.recommendations.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-800 mb-3">Recommendations</h4>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <ul className="text-sm text-blue-800 space-y-1">
                    {diagnosticResults.recommendations.map((rec, index) => (
                      <li key={index}>• {rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div>
              <h4 className="font-semibold text-gray-800 mb-3">Quick Actions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  onClick={async () => {
                    try {
                      const response = await fetch(`${API_URL}/api/test/simple-federal-register`);
                      const result = await response.json();
                      alert(result.success ? 'Integration test passed!' : `Integration test failed: ${result.message}`);
                    } catch (error) {
                      alert(`Test failed: ${error.message}`);
                    }
                  }}
                  className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-left hover:bg-blue-100 transition-colors"
                >
                  <h5 className="font-medium text-blue-800">Test Simple Integration</h5>
                  <p className="text-sm text-blue-600">Quick test of executive orders fetch</p>
                </button>

                <button
                  onClick={() => {
                    window.open('https://www.federalregister.gov/api/v1/documents.json?per_page=1', '_blank');
                  }}
                  className="p-3 bg-green-50 border border-green-200 rounded-lg text-left hover:bg-green-100 transition-colors"
                >
                  <h5 className="font-medium text-green-800">Test Direct API</h5>
                  <p className="text-sm text-green-600">Open Federal Register API in new tab</p>
                </button>
              </div>
            </div>

            {/* Technical Details */}
            {diagnosticResults.base_url && (
              <div>
                <h4 className="font-semibold text-gray-800 mb-3">Technical Details</h4>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="text-sm text-gray-600 space-y-1">
                    <p><strong>API Base URL:</strong> {diagnosticResults.base_url}</p>
                    <p><strong>Test Time:</strong> {new Date(diagnosticResults.timestamp).toLocaleString()}</p>
                    <p><strong>User Agent:</strong> LegislationVue/1.0</p>
                    <p><strong>Timeout:</strong> 10-15 seconds per test</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error Message */}
        {diagnosticResults && diagnosticResults.error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={16} className="text-red-600" />
              <h4 className="font-semibold text-red-800">Diagnostic Error</h4>
            </div>
            <p className="text-red-700 text-sm">{diagnosticResults.error}</p>
            <button
              onClick={runDiagnostics}
              className="mt-3 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
            >
              Retry Diagnostics
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            Diagnostics help identify and resolve Federal Register API connectivity issues
          </div>
          <button
            onClick={handleClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticModal;
