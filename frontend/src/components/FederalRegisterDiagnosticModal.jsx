// Part 1: Enhanced imports and Federal Register Diagnostic Modal
// Add these new imports to your existing imports
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
  Edit3,
  Save,
  FileText,
  Plus,
  Edit,
  Loader,
  AlertTriangle,  // NEW
  Wrench,         // NEW
  Activity,       // NEW
  Globe          // NEW
} from 'lucide-react';

import { getApiUrl } from '../utils/helpers';

const API_URL = getApiUrl();

// Federal Register Diagnostic Modal Component - ADD THIS NEW COMPONENT
const FederalRegisterDiagnosticModal = ({ isOpen, onClose, onStatusUpdate }) => {
  const [diagnosticResults, setDiagnosticResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [currentTest, setCurrentTest] = useState('');

  const runDiagnostics = async () => {
    setLoading(true);
    setCurrentTest('Running comprehensive diagnostics...');
    
    try {
      const response = await fetch(`${API_URL}/api/test/federal-register-connection`);
      const results = await response.json();
      setDiagnosticResults(results);
      
      // Update parent component's status
      if (onStatusUpdate) {
        const federalRegisterWorking = results.summary?.federal_register_accessible || false;
        onStatusUpdate('federalRegister', {
          status: federalRegisterWorking ? 'healthy' : 'error',
          message: federalRegisterWorking ? 'Federal Register accessible' : 'Federal Register connection failed',
          responseTime: null
        });
      }
      
    } catch (error) {
      console.error('Diagnostic failed:', error);
      setDiagnosticResults({
        success: false,
        error: `Diagnostic failed: ${error.message}`,
        tests: [],
        summary: { overall_status: 'failing' }
      });
    } finally {
      setLoading(false);
      setCurrentTest('');
    }
  };

  const attemptFix = async () => {
    setFixing(true);
    setCurrentTest('Attempting to fix Federal Register connection...');
    
    try {
      const response = await fetch(`${API_URL}/api/fix-federal-register`, {
        method: 'POST'
      });
      const results = await response.json();
      
      // Re-run diagnostics after fix attempt
      setTimeout(() => {
        runDiagnostics();
        setFixing(false);
      }, 2000);
      
    } catch (error) {
      console.error('Fix attempt failed:', error);
      setFixing(false);
      setCurrentTest('');
    }
  };

  useEffect(() => {
    if (isOpen) {
      runDiagnostics();
    }
  }, [isOpen]);

  const handleClose = () => {
    setDiagnosticResults(null);
    setLoading(false);
    setFixing(false);
    setCurrentTest('');
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  const getTestStatusIcon = (success) => {
    if (success) {
      return <CheckCircle size={16} className="text-green-600" />;
    } else {
      return <X size={16} className="text-red-600" />;
    }
  };

  const getOverallStatusConfig = (status) => {
    switch (status) {
      case 'healthy':
        return {
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
          message: 'Federal Register API is working correctly'
        };
      case 'degraded':
        return {
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
          message: 'Some Federal Register features may not work properly'
        };
      case 'failing':
        return {
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
          message: 'Federal Register API is not accessible'
        };
      default:
        return {
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          message: 'Unknown status'
        };
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Globe size={24} className="text-blue-600" />
            <div>
              <h3 className="text-xl font-semibold text-gray-800">Federal Register Diagnostics</h3>
              <p className="text-sm text-gray-600">Testing connection and functionality</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runDiagnostics}
              disabled={loading || fixing}
              className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
              Re-test
            </button>
            <button 
              onClick={handleClose} 
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {(loading || fixing) && (
            <div className="flex items-center justify-center py-8">
              <Loader size={24} className="animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">{currentTest}</span>
            </div>
          )}

          {diagnosticResults && !loading && !fixing && (
            <div className="space-y-6">
              {/* Overall Status */}
              {diagnosticResults.summary && (
                <div className={`p-4 rounded-lg border ${getOverallStatusConfig(diagnosticResults.summary.overall_status).bgColor} ${getOverallStatusConfig(diagnosticResults.summary.overall_status).borderColor}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className={`font-semibold ${getOverallStatusConfig(diagnosticResults.summary.overall_status).color}`}>
                        Overall Status: {diagnosticResults.summary.overall_status.toUpperCase()}
                      </h4>
                      <p className={`text-sm ${getOverallStatusConfig(diagnosticResults.summary.overall_status).color}`}>
                        {getOverallStatusConfig(diagnosticResults.summary.overall_status).message}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {diagnosticResults.summary.successful_tests}/{diagnosticResults.summary.total_tests} tests passed 
                        ({diagnosticResults.summary.success_rate})
                      </p>
                    </div>
                    {diagnosticResults.summary.overall_status === 'failing' && (
                      <button
                        onClick={attemptFix}
                        disabled={fixing}
                        className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700 transition-colors disabled:opacity-50"
                      >
                        <Wrench size={14} />
                        Attempt Fix
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Individual Test Results */}
              {diagnosticResults.tests && diagnosticResults.tests.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-800 mb-3">Test Results</h4>
                  <div className="space-y-3">
                    {diagnosticResults.tests.map((test, index) => (
                      <div key={index} className={`p-4 rounded-lg border ${test.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            {getTestStatusIcon(test.success)}
                            <div>
                              <h5 className={`font-medium ${test.success ? 'text-green-800' : 'text-red-800'}`}>
                                {test.test.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </h5>
                              {test.success ? (
                                <div className="text-sm text-green-700 mt-1">
                                  {test.response_time_ms && (
                                    <p>Response time: {Math.round(test.response_time_ms)}ms</p>
                                  )}
                                  {test.api_response && (
                                    <p>Found {test.api_response.count} documents</p>
                                  )}
                                  {test.query_results && (
                                    <p>Query returned {test.query_results.results_returned} results</p>
                                  )}
                                </div>
                              ) : (
                                <p className="text-sm text-red-700 mt-1">
                                  {test.error || 'Test failed'}
                                </p>
                              )}
                            </div>
                          </div>
                          {test.url_tested && (
                            <a 
                              href={test.url_tested} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              Test URL <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                        
                        {/* Sample Results */}
                        {test.query_results && test.query_results.sample_titles && test.query_results.sample_titles.length > 0 && (
                          <div className="mt-3 pl-6">
                            <p className="text-xs font-medium text-green-800 mb-1">Sample Results:</p>
                            <ul className="text-xs text-green-700 space-y-1">
                              {test.query_results.sample_titles.map((title, i) => (
                                <li key={i}>• {title}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default FederalRegisterDiagnosticModal;