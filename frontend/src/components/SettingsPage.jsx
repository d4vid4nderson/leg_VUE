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
    Save,
    AlertTriangle,
    Eye,
    EyeOff
} from 'lucide-react';

import API_URL from '../config/api';

// Password required for database clearing (change this to whatever you want)
const REQUIRED_PASSWORD = "DELETE_DATABASE_2024";

const SettingsPage = ({
    federalDateRange,
    setFederalDateRange,
    makeApiCall,
    appVersion,
    setAppVersion
}) => {
    const [showDatabaseSection, setShowDatabaseSection] = useState(false);
    const [showSystemSection, setShowSystemSection] = useState(true);
    const [clearingDatabase, setClearingDatabase] = useState(false);
    const [showClearWarning, setShowClearWarning] = useState(false);
    const [clearStatus, setClearStatus] = useState(null);
    const [databaseDebugInfo, setDatabaseDebugInfo] = useState({ logs: [], success: false, loading: false });

    // Database modal states
    const [showDatabaseModal, setShowDatabaseModal] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    // Local editing state
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

        setAppVersion(tempVersion);
        localStorage.setItem('appVersion', tempVersion);
        setIsEditingVersion(false);
        setVersionUpdateStatus('✅ Version updated successfully!');

        const event = new CustomEvent('versionUpdated', { detail: { version: tempVersion } });
        window.dispatchEvent(event);

        setTimeout(() => setVersionUpdateStatus(null), 3000);
    };

    const handleCancelVersionEdit = () => {
        setTempVersion(appVersion);
        setIsEditingVersion(false);
    };

    const debugDatabaseConnection = async () => {
        try {
            setDatabaseDebugInfo({ ...databaseDebugInfo, loading: true });
            
            // Explicit GET method with proper headers
            const response = await fetch(`${API_URL}/api/debug/database-msi`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });
            
            // Handle non-200 responses
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP error ${response.status}: ${errorText}`);
            }
            
            const data = await response.json();
            
            setDatabaseDebugInfo({
                success: data.success,
                logs: data.logs || [],
                timestamp: data.timestamp,
                loading: false
            });
            
            // Also update the general status
            setIntegrationStatus(prev => ({
                ...prev,
                database: {
                    status: data.success ? 'healthy' : 'error',
                    message: data.success ? 'Database connected (MSI)' : 'Database connection failed (MSI)',
                    responseTime: null
                }
            }));
            
        } catch (error) {
            console.error('Database debug failed:', error);
            
            setDatabaseDebugInfo({
                success: false,
                logs: [`Error: ${error.message}`],
                timestamp: new Date().toISOString(),
                loading: false
            });
            
            // Update integration status to reflect the error
            setIntegrationStatus(prev => ({
                ...prev,
                database: {
                    status: 'error',
                    message: `Connection failed: ${error.message}`,
                    responseTime: null
                }
            }));
        }
    };

    // Database modal functions
    const openDatabaseModal = () => {
        setShowDatabaseModal(true);
        setPasswordInput('');
        setPasswordError('');
        setShowPassword(false);
    };

    const closeDatabaseModal = () => {
        setShowDatabaseModal(false);
        setPasswordInput('');
        setPasswordError('');
        setShowPassword(false);
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
            // Call both endpoints
            const [statusResponse, dbDebugResponse] = await Promise.allSettled([
                fetch(`${API_URL}/api/status`),
                fetch(`${API_URL}/api/debug/database-msi`)
            ]);

            // Initialize with default error status
            let newStatus = {
                database: { status: 'error', message: 'Connection failed', responseTime: null },
                legiscan: { status: 'error', message: 'Connection failed', responseTime: null },
                azureAI: { status: 'error', message: 'Connection failed', responseTime: null },
                federalRegister: { status: 'healthy', message: 'Federal Register API operational', responseTime: null }
            };

            // Process status data
            if (statusResponse.status === 'fulfilled' && statusResponse.value.ok) {
                const statusData = await statusResponse.value.json();

                // Update newStatus with statusData
                newStatus = {
                    database: {
                        status: statusData.database?.status === 'connected' ? 'healthy' : 'error',
                        message: statusData.database?.status === 'connected' ? 'Database connected' : 'Database connection failed',
                        responseTime: null
                    },
                    legiscan: {
                        status: statusData.integrations?.legiscan === 'connected' ? 'healthy' : 'error',
                        message: statusData.integrations?.legiscan === 'connected' ? 'LegiScan API connected' : 'LegiScan API not configured',
                        responseTime: null
                    },
                    azureAI: {
                        status: statusData.integrations?.enhanced_ai_analysis === 'connected' ? 'healthy' : 'error',
                        message: statusData.integrations?.enhanced_ai_analysis === 'connected' ? 'Azure AI connected' : 'Azure AI not configured',
                        responseTime: null
                    },
                    federalRegister: {
                        status: 'healthy',
                        message: 'Federal Register API operational',
                        responseTime: null
                    }
                };

                // Update integration status
                setIntegrationStatus(newStatus);
                setLastHealthCheck(new Date());
            }

            // Process database debug data
            if (dbDebugResponse.status === 'fulfilled' && dbDebugResponse.value.ok) {
                const dbData = await dbDebugResponse.value.json();

                setDatabaseDebugInfo({
                    success: dbData.success,
                    logs: dbData.logs || [],
                    timestamp: dbData.timestamp,
                    loading: false
                });

                // Update database status based on MSI test
                setIntegrationStatus(prev => ({
                    ...prev,
                    database: {
                        status: dbData.success ? 'healthy' : 'error',
                        message: dbData.success ? 'Database connected (MSI)' : 'Database connection failed (MSI)',
                        responseTime: null
                    }
                }));
            }

        } catch (error) {
            console.error('Health check failed:', error);

            // Set error status in case of exception
            const errorStatus = {
                database: { status: 'error', message: 'Connection failed', responseTime: null },
                legiscan: { status: 'error', message: 'Connection failed', responseTime: null },
                azureAI: { status: 'error', message: 'Connection failed', responseTime: null },
                federalRegister: {
                    status: 'healthy',
                    message: 'Federal Register API operational',
                    responseTime: null
                }
            };

            setIntegrationStatus(errorStatus);
        } finally {
            setCheckingHealth(false);
        }
    };

    // Auto-check on component mount
    useEffect(() => {
        checkAllIntegrations();
        const interval = setInterval(checkAllIntegrations, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    // Database clear function with password validation
    const handleClearDatabase = async () => {
        if (clearingDatabase) return;

        // Check password
        if (passwordInput !== REQUIRED_PASSWORD) {
            setPasswordError('Incorrect password. Please try again.');
            return;
        }

        setClearingDatabase(true);
        setClearStatus('🗑️ Clearing database...');
        setShowDatabaseModal(false); // Close modal
        setPasswordInput(''); // Clear password
        setPasswordError(''); // Clear any errors

        try {
            const response = await fetch(`${API_URL}/api/database/clear-all`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                setClearStatus('✅ Database cleared successfully!');
                setShowClearWarning(false);
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

    // Database Clear Modal Component
    const DatabaseClearModal = () => {
        if (!showDatabaseModal) return null;

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <AlertTriangle size={20} className="text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">Clear Database</h3>
                        </div>
                        <button
                            onClick={closeDatabaseModal}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6">
                        <div className="mb-4">
                            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                                <h4 className="font-semibold text-red-800 mb-2">⚠️ Warning: This action cannot be undone</h4>
                                <p className="text-red-700 text-sm mb-2">
                                    Deleting the database will permanently remove:
                                </p>
                                <ul className="text-red-700 text-sm space-y-1 ml-4">
                                    <li>• All executive orders and state legislation</li>
                                    <li>• AI analysis and summaries</li>
                                    <li>• Your highlighted items and bookmarks</li>
                                    <li>• All cached data and preferences</li>
                                </ul>
                            </div>

                            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
                                <h4 className="font-semibold text-yellow-800 mb-2">📊 Data Recovery Notice</h4>
                                <p className="text-yellow-700 text-sm">
                                    When data is re-fetched from external APIs, the information you get back
                                    might not be exactly the same as before due to:
                                </p>
                                <ul className="text-yellow-700 text-sm space-y-1 ml-4 mt-2">
                                    <li>• Updates to federal regulations</li>
                                    <li>• Changes in state legislation</li>
                                    <li>• API modifications or data source updates</li>
                                    <li>• Different AI analysis results</li>
                                </ul>
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="mb-4">
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                Enter password to confirm deletion:
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    id="password"
                                    value={passwordInput}
                                    onChange={(e) => {
                                        setPasswordInput(e.target.value);
                                        if (passwordError) setPasswordError(''); // Clear error when typing
                                    }}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleClearDatabase();
                                        }
                                    }}
                                    className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 ${passwordError ? 'border-red-300 bg-red-50' : 'border-gray-300'
                                        }`}
                                    placeholder="Enter required password..."
                                    autoComplete="off"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {passwordError && (
                                <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                                    <X size={14} />
                                    {passwordError}
                                </p>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={closeDatabaseModal}
                                disabled={clearingDatabase}
                                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClearDatabase}
                                disabled={clearingDatabase || !passwordInput.trim()}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${clearingDatabase || !passwordInput.trim()
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        : 'bg-red-600 text-white hover:bg-red-700'
                                    }`}
                            >
                                <Trash2 size={14} />
                                {clearingDatabase ? 'Clearing...' : 'Clear Database'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
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
                {/* Combined System Configuration & Information Section */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                    <button
                        onClick={() => setShowSystemSection(!showSystemSection)}
                        className="w-full flex items-center justify-between text-left focus:outline-none"
                    >
                        <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                            <Settings size={20} />
                            <span>System Configuration & Information</span>
                        </h3>
                        <div className="flex items-center gap-2">
                            <ChevronDown
                                size={20}
                                className={`text-gray-500 transition-transform duration-200 ${showSystemSection ? 'rotate-180' : ''}`}
                            />
                        </div>
                    </button>

                    {showSystemSection && (
                        <div className="mt-4 pt-4 border-gray-200 space-y-6">

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

                            {/* System Information Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                {/* Application Version */}
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

                                {/* System Status */}
                                {(() => {
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
                                                        {lastHealthCheck.toLocaleDateString()} at {lastHealthCheck.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </>
                                                ) : (
                                                    'Checking system status...'
                                                )}
                                            </p>
                                            <p className={`text-sm ${statusConfig.messageColor}`}>
                                                System status: {statusConfig.message}
                                            </p>

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

                            {/* API Configuration */}
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                <h4 className="font-semibold text-gray-800 mb-2">API Configuration</h4>
                                <div className="text-sm text-gray-600 space-y-1">
                                    <p>• <strong>Backend API:</strong> {API_URL}</p>
                                    <p>• <strong>Environment:</strong> {window.location.hostname === 'localhost' ? 'Development' : 'Production'}</p>
                                    <p>• <strong>Database Type:</strong> Azure SQL with SQLite fallback</p>
                                </div>
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

                            {/* Technical Details */}
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
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
                    )}
                </div>

                {/* MSI Database Debug Section */}
                <div className="mt-4 bg-gray-50 border border-gray-200 rounded-md p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-gray-800">MSI Database Connection Debug</h4>
                        <button
                            onClick={debugDatabaseConnection}
                            disabled={databaseDebugInfo.loading}
                            className={`px-3 py-1 text-sm rounded-md ${databaseDebugInfo.loading ? 'bg-gray-300' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                        >
                            {databaseDebugInfo.loading ? 'Testing...' : 'Test MSI Connection'}
                        </button>
                    </div>

                    {databaseDebugInfo.logs.length > 0 && (
                        <div className={`mt-3 p-3 rounded border text-sm font-mono ${databaseDebugInfo.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="mb-2 flex items-center justify-between">
                                <span className={`font-medium ${databaseDebugInfo.success ? 'text-green-700' : 'text-red-700'}`}>
                                    {databaseDebugInfo.success ? '✅ Connection Successful' : '❌ Connection Failed'}
                                </span>
                                {databaseDebugInfo.timestamp && (
                                    <span className="text-xs text-gray-500">
                                        {new Date(databaseDebugInfo.timestamp).toLocaleTimeString()}
                                    </span>
                                )}
                            </div>
                            <div className="bg-black bg-opacity-10 p-2 rounded max-h-64 overflow-y-auto">
                                {databaseDebugInfo.logs.map((log, index) => (
                                    <div key={index} className="whitespace-pre-wrap mb-1">
                                        {log}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Database Management Section - SEPARATE CONTAINER */}
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
                        <div className="mt-4 pt-4 border-gray-200">
                            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
                                <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                                    <Trash2 size={16} />
                                    <span>Clear Database</span>
                                </h4>
                                <p className="text-red-700 text-sm mb-3">
                                    This will permanently delete all executive orders and legislation from the database.
                                    This action cannot be undone and requires password confirmation.
                                </p>

                                <button
                                    onClick={openDatabaseModal}
                                    disabled={clearingDatabase}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${clearingDatabase
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-red-600 text-white hover:bg-red-700'
                                        }`}
                                >
                                    Clear Database
                                </button>
                            </div>

                            {/* Database Info */}
                            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
                                <h4 className="font-semibold text-gray-800 mb-2">Database Information</h4>
                                <div className="text-sm text-gray-600 space-y-1">
                                    <p>• Executive orders and state legislation are stored locally</p>
                                    <p>• Data includes AI analysis and summaries</p>
                                    <p>• Clearing will require re-fetching all data</p>
                                    <p>• Your highlighted items are stored separately but will also be cleared</p>
                                    <p>• Password required for security purposes</p>
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

            {/* Database Clear Modal */}
            <DatabaseClearModal />
        </div>
    );
};

export default SettingsPage;
