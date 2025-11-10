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
    ChevronUp,
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
    EyeOff,
    BarChart3,
    Users,
    Activity,
    TrendingUp,
    User,
    Lock,
    MapPin,
    Clock,
    AlertCircle,
    Play
} from 'lucide-react';

import API_URL, { fetchWithErrorHandling } from '../config/api';
import { getTextClasses, getPageContainerClasses, getCardClasses } from '../utils/darkModeClasses';
import { usePageTracking } from '../hooks/usePageTracking';
import DataUploadSection from './DataUploadSection';

// Password required for database management (change this to whatever you want)
const REQUIRED_PASSWORD = "database";

// Password required for analytics access
const ANALYTICS_PASSWORD = "analytics";

const SettingsPage = ({
    federalDateRange,
    setFederalDateRange,
    makeApiCall,
    appVersion,
    setAppVersion
}) => {
    const [showDatabaseSection, setShowDatabaseSection] = useState(false);
    const [showSystemSection, setShowSystemSection] = useState(true);
    const [showTechnicalSection, setShowTechnicalSection] = useState(false);
    const [showAdminAnalytics, setShowAdminAnalytics] = useState(false);
    const [clearingDatabase, setClearingDatabase] = useState(false);
    const [showClearWarning, setShowClearWarning] = useState(false);
    const [clearStatus, setClearStatus] = useState(null);
    const [databaseDebugInfo, setDatabaseDebugInfo] = useState({ logs: [], success: false, loading: false });

    // Database password modal states  
    const [showDatabasePasswordModal, setShowDatabasePasswordModal] = useState(false);
    const [databasePasswordInput, setDatabasePasswordInput] = useState('');
    const [databasePasswordError, setDatabasePasswordError] = useState('');
    const [isDatabaseAuthenticated, setIsDatabaseAuthenticated] = useState(false);
    const [showDatabasePassword, setShowDatabasePassword] = useState(false);
    
    // Clear database confirmation states
    const [showClearConfirmation, setShowClearConfirmation] = useState(false);
    
    // Analytics password modal states
    const [showAnalyticsPasswordModal, setShowAnalyticsPasswordModal] = useState(false);
    const [analyticsPasswordInput, setAnalyticsPasswordInput] = useState('');
    const [analyticsPasswordError, setAnalyticsPasswordError] = useState('');
    const [isAnalyticsAuthenticated, setIsAnalyticsAuthenticated] = useState(false);
    const [showAnalyticsPassword, setShowAnalyticsPassword] = useState(false);

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

    // Admin Analytics state
    const [analyticsData, setAnalyticsData] = useState({
        loading: false,
        data: null,
        error: null,
        lastUpdated: null
    });

    // Incremental fetch state
    const [selectedState, setSelectedState] = useState('');
    const [incrementalFetchStatus, setIncrementalFetchStatus] = useState({
        fetching: false,
        message: '',
        success: false,
        details: null
    });
    const [activeJob, setActiveJob] = useState(null);
    const [jobPolling, setJobPolling] = useState(null);
    
    // Automation report state
    const [automationReport, setAutomationReport] = useState({
        loading: false,
        data: null,
        error: null,
        lastUpdated: null
    });

    // Manual job execution state
    const [manualJobExecution, setManualJobExecution] = useState({
        loading: false,
        runningJob: null,
        lastExecution: null
    });

    // Execution expand/collapse state (tracking which executions are expanded)
    const [expandedExecutions, setExpandedExecutions] = useState({});

    // Toggle execution expansion
    const toggleExecutionExpanded = (jobName, executionName) => {
        const key = `${jobName}-${executionName}`;
        setExpandedExecutions(prev => ({
            ...prev,
            [key]: !prev[key]
        }));
    };

    // Track page view
    usePageTracking('Settings');

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

    // Fetch automation report
    const fetchAutomationReport = async () => {
        setAutomationReport(prev => ({ ...prev, loading: true, error: null }));
        
        try {
            const response = await fetch(`${API_URL}/api/admin/automation-report`);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch automation report: ${response.status}`);
            }
            
            const data = await response.json();
            
            setAutomationReport({
                loading: false,
                data: data,
                error: null,
                lastUpdated: new Date()
            });
        } catch (error) {
            console.error('Failed to fetch automation report:', error);
            setAutomationReport(prev => ({
                ...prev,
                loading: false,
                error: error.message
            }));
        }
    };

    // Manual job execution - runs both jobs
    const runAllJobsManually = async () => {
        // Prevent multiple executions
        if (manualJobExecution.loading) {
            return;
        }
        
        setManualJobExecution(prev => ({ ...prev, loading: true, runningJob: 'all' }));
        
        try {
            console.log('Starting manual job execution...');
            console.log('API_URL:', API_URL);
            
            // Test connection first
            console.log('Testing API connection...');
            const testResponse = await fetchWithErrorHandling('/api/status');
            console.log('API connection test successful:', testResponse);
            
            // Run executive orders job
            console.log('Starting executive orders job...');
            const eoResult = await fetchWithErrorHandling('/api/admin/run-job?job_name=executive-orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            console.log('Executive Orders result:', eoResult);
            
            // Small delay between jobs
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Run state bills job
            console.log('Starting state bills job...');
            const sbResult = await fetchWithErrorHandling('/api/admin/run-job?job_name=state-bills', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            console.log('State Bills result:', sbResult);
            
            const bothSuccessful = eoResult.success && sbResult.success;
            
            setManualJobExecution(prev => ({
                ...prev,
                loading: false,
                runningJob: null,
                lastExecution: {
                    jobName: 'both jobs',
                    startedAt: new Date().toISOString(),
                    status: bothSuccessful ? 'running' : 'partially-failed',
                    error: bothSuccessful ? null : 'One or both jobs failed to start'
                }
            }));
            
            // Refresh automation report after a short delay
            setTimeout(() => {
                fetchAutomationReport();
            }, 3000);
            
        } catch (error) {
            console.error('Failed to run jobs manually:', error);
            
            let errorMessage = error.message;
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                errorMessage = 'Cannot connect to backend server. Please check if the backend is running.';
            } else if (error.name === 'AbortError') {
                errorMessage = 'Request timed out after 30 seconds.';
            }
            
            setManualJobExecution(prev => ({
                ...prev,
                loading: false,
                runningJob: null,
                lastExecution: {
                    jobName: 'both jobs',
                    startedAt: new Date().toISOString(),
                    status: 'failed',
                    error: errorMessage
                }
            }));
        }
    };

    // Fetch analytics data with retry
    const fetchAnalyticsData = async (retryCount = 0) => {
        console.log('🚨 ANALYTICS FETCH CALLED - THIS SHOULD APPEAR IN CONSOLE');
        console.log('🔍 Starting analytics fetch...');
        console.log('API_URL:', API_URL);
        
        setAnalyticsData(prev => ({ ...prev, loading: true, error: null }));
        
        try {
            // Force direct connection to Docker backend for testing
            const apiUrl = API_URL || 'http://localhost:8000';
            const url = `${apiUrl}/api/admin/analytics`;
            console.log('🔍 Fetching from URL:', url);
            console.log('🔍 Original API_URL:', API_URL);
            console.log('🔍 Using apiUrl:', apiUrl);
            
            // Add timeout to the fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
            
            const response = await fetch(url, { 
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            console.log('🔍 Response received!');
            console.log('🔍 Response status:', response.status);
            console.log('🔍 Response ok:', response.ok);
            console.log('🔍 Response headers:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ Response error:', errorText);
                console.error('❌ Response content type:', response.headers.get('content-type'));
                throw new Error(`Failed to fetch analytics: ${response.status} - ${errorText}`);
            }
            
            const data = await response.json();
            console.log('✅ Analytics data received:', data);
            
            setAnalyticsData({
                loading: false,
                data: data.success ? data.data : data,
                error: null,
                lastUpdated: new Date()
            });
        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('❌ Request timed out after 30 seconds');
                // Retry once if this is the first attempt
                if (retryCount === 0) {
                    console.log('🔄 Retrying analytics fetch...');
                    return fetchAnalyticsData(1);
                }
                setAnalyticsData(prev => ({
                    ...prev,
                    loading: false,
                    error: 'Request timed out. The server may be busy processing the request.'
                }));
                return;
            }
            console.error('❌ Failed to fetch analytics:', error);
            // Retry once for other errors if this is the first attempt
            if (retryCount === 0 && !error.message.includes('Failed to fetch')) {
                console.log('🔄 Retrying analytics fetch after error...');
                setTimeout(() => fetchAnalyticsData(1), 2000); // Wait 2 seconds before retry
                return;
            }
            setAnalyticsData(prev => ({
                ...prev,
                loading: false,
                error: error.message
            }));
        }
    };

    const debugDatabaseConnection = async () => {
        try {
            setDatabaseDebugInfo({ ...databaseDebugInfo, loading: true });

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);
            
            const response = await fetch(`${API_URL}/api/debug/database-msi`, {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
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
            let errorMessage = error.message;
            if (error.name === 'AbortError' || error.message.includes('timeout')) {
                errorMessage = 'Database connection test timed out (>15s). Connection may be slow or unresponsive.';
            }
            setDatabaseDebugInfo({
                success: false,
                logs: [`Error: ${errorMessage}`],
                loading: false
            });
        }
    };

    // Database password handling functions
    const handleDatabasePasswordSubmit = () => {
        if (databasePasswordInput !== REQUIRED_PASSWORD) {
            setDatabasePasswordError('Incorrect password. Please try again.');
            return;
        }
        
        // Password correct - close modal and show database management
        setShowDatabasePasswordModal(false);
        setIsDatabaseAuthenticated(true);
        setDatabasePasswordInput('');
        setDatabasePasswordError('');
        setShowDatabaseSection(true);
    };
    
    const handleDatabaseExpand = () => {
        if (showDatabaseSection) {
            // Collapsing - reset authentication
            setShowDatabaseSection(false);
            setIsDatabaseAuthenticated(false);
        } else {
            // Expanding - show password modal
            setShowDatabasePasswordModal(true);
        }
    };
    
    const closeDatabasePasswordModal = () => {
        setShowDatabasePasswordModal(false);
        setDatabasePasswordInput('');
        setDatabasePasswordError('');
        setShowDatabasePassword(false);
    };
    
    // Analytics password handling functions
    const handleAnalyticsPasswordSubmit = () => {
        if (analyticsPasswordInput !== ANALYTICS_PASSWORD) {
            setAnalyticsPasswordError('Incorrect password. Please try again.');
            return;
        }
        
        // Password correct - close modal and show analytics
        console.log('✅ Analytics password correct, setting states...');
        setShowAnalyticsPasswordModal(false);
        setIsAnalyticsAuthenticated(true);
        setAnalyticsPasswordInput('');
        setAnalyticsPasswordError('');
        setShowAdminAnalytics(true);
        
        console.log('📊 Manually triggering analytics fetch after authentication...');
        // Auto-load analytics data when authenticated
        fetchAnalyticsData();
    };
    
    const handleAnalyticsExpand = () => {
        if (showAdminAnalytics) {
            // Collapsing - reset authentication
            setShowAdminAnalytics(false);
            setIsAnalyticsAuthenticated(false);
        } else {
            // Expanding - show password modal
            setShowAnalyticsPasswordModal(true);
        }
    };
    
    const closeAnalyticsPasswordModal = () => {
        setShowAnalyticsPasswordModal(false);
        setAnalyticsPasswordInput('');
        setAnalyticsPasswordError('');
        setShowAnalyticsPassword(false);
    };

    // Status icon and color mapping
    const getStatusDisplay = (status) => {
        switch (status) {
            case 'healthy':
            case 'connected':
            case 'operational':
                return {
                    icon: <CheckCircle size={16} className="text-green-600 dark:text-green-400" />,
                    text: 'Online ✓',
                    textColor: 'text-green-600 dark:text-green-400',
                    bgColor: 'bg-green-50 dark:bg-green-900/20',
                    borderColor: 'border-green-200 dark:border-green-700'
                };
            case 'unhealthy':
            case 'error':
            case 'failed':
                return {
                    icon: <X size={16} className="text-red-600 dark:text-red-400" />,
                    text: 'Offline ✗',
                    textColor: 'text-red-600 dark:text-red-400',
                    bgColor: 'bg-red-50 dark:bg-red-900/20',
                    borderColor: 'border-red-200 dark:border-red-700'
                };
            case 'checking':
            case 'loading':
                return {
                    icon: <RotateCw size={16} className="text-yellow-600 dark:text-yellow-400 animate-spin" />,
                    text: 'Checking...',
                    textColor: 'text-yellow-600 dark:text-yellow-400',
                    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
                    borderColor: 'border-yellow-200 dark:border-yellow-700'
                };
            default:
                return {
                    icon: <Info size={16} className="text-gray-600 dark:text-gray-400" />,
                    text: 'Unknown',
                    textColor: 'text-gray-600 dark:text-gray-400',
                    bgColor: 'bg-gray-50 dark:bg-gray-800',
                    borderColor: 'border-gray-200 dark:border-gray-600'
                };
        }
    };


    // Check all services health
    const checkAllIntegrations = async () => {
        setCheckingHealth(true);

        try {
            // Create timeout controller for older browsers
            const createTimeoutController = (timeoutMs) => {
                const controller = new AbortController();
                setTimeout(() => controller.abort(), timeoutMs);
                return controller;
            };

            // Call both endpoints with timeout
            const [statusResponse, dbDebugResponse] = await Promise.allSettled([
                fetch(`${API_URL}/api/status`, { 
                    signal: createTimeoutController(10000).signal // 10 second timeout
                }),
                fetch(`${API_URL}/api/debug/database-msi`, { 
                    signal: createTimeoutController(10000).signal // 10 second timeout
                })
            ]);

            // Initialize with default error status
            let newStatus = {
                database: { status: 'error', message: 'Connection failed', responseTime: null },
                legiscan: { status: 'error', message: 'Connection failed', responseTime: null },
                azureAI: { status: 'error', message: 'Connection failed', responseTime: null },
                federalRegister: { status: 'healthy', message: 'Federal Register API operational', responseTime: null }
            };

            // Process status data or fallback to root endpoint
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
            } else {
                // Fallback: Try the root endpoint for basic status
                try {
                    const rootResponse = await fetch(`${API_URL}/`, { 
                        signal: createTimeoutController(5000).signal
                    });
                    
                    if (rootResponse.ok) {
                        const rootData = await rootResponse.json();
                        
                        newStatus = {
                            database: {
                                status: rootData.database?.status === 'connected' ? 'healthy' : 'error',
                                message: rootData.database?.status === 'connected' ? 
                                    `Database connected (${rootData.database?.type})` : 
                                    'Database connection failed',
                                responseTime: null
                            },
                            legiscan: {
                                status: rootData.integrations?.legiscan === 'available' ? 'healthy' : 'error',
                                message: rootData.integrations?.legiscan === 'available' ? 
                                    'LegiScan API available' : 'LegiScan API not available',
                                responseTime: null
                            },
                            azureAI: {
                                status: rootData.integrations?.azure_ai === 'available' ? 'healthy' : 'error',
                                message: rootData.integrations?.azure_ai === 'available' ? 
                                    'Azure AI available' : 'Azure AI not available',
                                responseTime: null
                            },
                            federalRegister: {
                                status: 'healthy',
                                message: 'Federal Register API operational',
                                responseTime: null
                            }
                        };
                        
                        setIntegrationStatus(newStatus);
                        setLastHealthCheck(new Date());
                    }
                } catch (fallbackError) {
                    console.error('Fallback status check also failed:', fallbackError);
                }
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

    // Auto-load analytics when section is shown and authenticated
    useEffect(() => {
        console.log('🔍 Analytics useEffect triggered:', {
            showAdminAnalytics,
            isAnalyticsAuthenticated,
            hasData: !!analyticsData.data,
            isLoading: analyticsData.loading
        });
        
        if (showAdminAnalytics && isAnalyticsAuthenticated && !analyticsData.data && !analyticsData.loading) {
            console.log('📊 Auto-loading analytics data...');
            fetchAnalyticsData();
        }
    }, [showAdminAnalytics, isAnalyticsAuthenticated, analyticsData.data, analyticsData.loading]);

    // Clear database confirmation functions
    const showClearDatabaseConfirmation = () => {
        setShowClearConfirmation(true);
    };
    
    const closeClearConfirmation = () => {
        setShowClearConfirmation(false);
    };

    // Simplified database clear function - no password needed
    const handleClearDatabase = async () => {
        if (clearingDatabase) return;

        setClearingDatabase(true);
        setClearStatus('🗑️ Clearing database...');
        setShowClearConfirmation(false); // Close confirmation dialog

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

    // Poll job status
    const pollJobStatus = async (jobId) => {
        try {
            const response = await fetch(`${API_URL}/api/legiscan/job-status/${jobId}`);
            if (response.ok) {
                const jobData = await response.json();
                setActiveJob(jobData);
                
                // Stop polling if job is completed
                if (jobData.status === 'completed' || jobData.status === 'failed' || jobData.status === 'cancelled') {
                    if (jobPolling) {
                        clearInterval(jobPolling);
                        setJobPolling(null);
                    }
                    
                    setIncrementalFetchStatus({
                        fetching: false,
                        message: jobData.message,
                        success: jobData.status === 'completed',
                        details: jobData
                    });
                }
            }
        } catch (error) {
            console.error('Job polling error:', error);
        }
    };

    // Handle incremental state fetch (now async)
    const handleIncrementalFetch = async () => {
        if (!selectedState || incrementalFetchStatus.fetching) return;

        setIncrementalFetchStatus({
            fetching: true,
            message: `Starting background job for ${selectedState}...`,
            success: false,
            details: null
        });

        try {
            const response = await fetch(`${API_URL}/api/legiscan/incremental-state-fetch`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    state: selectedState,
                    batch_size: 10
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Job started successfully - begin polling
                setIncrementalFetchStatus({
                    fetching: true,
                    message: `✅ Background job started! Processing bills...`,
                    success: false,
                    details: data
                });
                
                // Start polling for job status
                const polling = setInterval(() => {
                    pollJobStatus(data.job_id);
                }, 2000); // Poll every 2 seconds
                
                setJobPolling(polling);
                
            } else {
                setIncrementalFetchStatus({
                    fetching: false,
                    message: `⚠️ ${data.message || data.detail || 'Failed to start job'}`,
                    success: false,
                    details: data
                });
            }
        } catch (error) {
            console.error('Incremental fetch error:', error);
            setIncrementalFetchStatus({
                fetching: false,
                message: `❌ Error: ${error.message}`,
                success: false,
                details: null
            });
        }
    };

    // Cleanup polling on component unmount
    useEffect(() => {
        return () => {
            if (jobPolling) {
                clearInterval(jobPolling);
            }
        };
    }, [jobPolling]);


    // Clear Database Confirmation Modal Component
    const ClearConfirmationModal = () => {
        if (!showClearConfirmation) return null;

        return (
            <div className="fixed inset-0 bg-black dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-dark-bg rounded-lg shadow-xl max-w-md w-full mx-4">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-dark-border">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                                <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Confirm Database Clear</h3>
                        </div>
                        <button
                            onClick={closeClearConfirmation}
                            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-4 sm:p-6">
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                            Are you sure you want to clear the database? This will permanently delete all executive orders, state legislation, and related data.
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                            This action cannot be undone.
                        </p>

                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3 justify-end mt-6">
                            <button
                                onClick={closeClearConfirmation}
                                disabled={clearingDatabase}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 min-h-[44px] w-full sm:w-auto"
                            >
                                No, Cancel
                            </button>
                            <button
                                onClick={handleClearDatabase}
                                disabled={clearingDatabase}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 min-h-[44px] w-full sm:w-auto ${
                                    clearingDatabase
                                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                        : 'bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-400'
                                }`}
                            >
                                <Trash2 size={14} />
                                {clearingDatabase ? 'Clearing...' : 'Yes, Clear Database'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Analytics Password Modal Component
    const AnalyticsPasswordModal = () => {
        if (!showAnalyticsPasswordModal) return null;

        return (
            <div className="fixed inset-0 bg-black dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
                <div className="bg-white dark:bg-dark-bg rounded-lg shadow-xl max-w-md w-full mx-4">
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-dark-border">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                <Lock size={20} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Access Admin Analytics</h3>
                        </div>
                        <button
                            onClick={closeAnalyticsPasswordModal}
                            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Modal Body */}
                    <div className="p-6 bg-white dark:bg-dark-bg">
                        <div className="mb-4">
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md p-4 mb-4">
                                <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">🔒 Protected Content</h4>
                                <p className="text-sm text-blue-700 dark:text-blue-400">
                                    Admin analytics contains sensitive user data and requires authentication to access.
                                </p>
                            </div>
                        </div>

                        {/* Password Input */}
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Enter Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showAnalyticsPassword ? "text" : "password"}
                                    value={analyticsPasswordInput}
                                    onChange={(e) => {
                                        setAnalyticsPasswordInput(e.target.value);
                                        if (analyticsPasswordError) setAnalyticsPasswordError(''); // Clear error when typing
                                    }}
                                    onKeyPress={(e) => {
                                        if (e.key === 'Enter') {
                                            handleAnalyticsPasswordSubmit();
                                        }
                                    }}
                                    className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                                        analyticsPasswordError 
                                            ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20' 
                                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg-secondary'
                                    }`}
                                    placeholder="Enter analytics password..."
                                    autoComplete="off"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowAnalyticsPassword(!showAnalyticsPassword)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
                                    tabIndex={-1}
                                >
                                    {showAnalyticsPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            {analyticsPasswordError && (
                                <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                                    <X size={14} />
                                    {analyticsPasswordError}
                                </p>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={closeAnalyticsPasswordModal}
                                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-h-[44px] w-full sm:w-auto"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAnalyticsPasswordSubmit}
                                disabled={!analyticsPasswordInput.trim()}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 min-h-[44px] w-full sm:w-auto ${
                                    !analyticsPasswordInput.trim()
                                        ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-400'
                                }`}
                            >
                                <BarChart3 size={14} />
                                Access Analytics
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-dark-bg dark:via-dark-bg-secondary dark:to-dark-bg-tertiary min-h-screen">
            {/* Header Section */}
            <section className="relative overflow-hidden px-4 sm:px-6 pt-8 sm:pt-12 pb-6 sm:pb-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-8">
                        
                        <h1 className={getTextClasses('primary', 'text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 leading-tight')}>
                            <span className="block bg-gradient-to-r from-gray-500 to-black dark:from-gray-300 dark:to-white bg-clip-text text-transparent py-2">Settings</span>
                        </h1>
                        
                        <p className={getTextClasses('secondary', 'text-base sm:text-lg md:text-xl mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed px-2 sm:px-0')}>
                            Monitor your system status and manage your database. Configure application settings and view system information.
                        </p>
                    </div>
                </div>
            </section>

            {/* Settings Content Section */}
            <section className="py-6 sm:py-8 px-4 sm:px-6">
                <div className="max-w-7xl mx-auto">
                    {/* Clear Status */}
                    {clearStatus && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md">
                    <p className="text-blue-800 dark:text-blue-300 text-sm font-medium">{clearStatus}</p>
                </div>
            )}

            {/* Version Update Status */}
            {versionUpdateStatus && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-md">
                    <p className="text-blue-800 dark:text-blue-300 text-sm font-medium">{versionUpdateStatus}</p>
                </div>
            )}

            <div className="space-y-6">
                {/* System Management Section */}
                <div className="bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg shadow-sm p-6">
                    <button
                        onClick={() => setShowSystemSection(!showSystemSection)}
                        className="w-full flex items-center justify-between text-left focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-800 rounded p-2 transition-colors"
                    >
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 dark:text-gray-200">
                            System Management
                        </h3>
                        <div className="flex items-center gap-2">
                            <ChevronDown
                                size={20}
                                className={`text-gray-500 dark:text-gray-400 transition-transform duration-200 ${showSystemSection ? 'rotate-180' : ''}`}
                            />
                        </div>
                    </button>

                    {showSystemSection && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-6">

                            {/* Integration Status */}
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">Integration Status</h4>
                                    {lastHealthCheck && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                            Last checked: {lastHealthCheck.toLocaleTimeString()}
                                        </p>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
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
                                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded">
                                        <h5 className="font-medium text-red-800 dark:text-red-300 mb-1">Service Issues:</h5>
                                        <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
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
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                                {/* Application Version */}
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-semibold text-blue-800 dark:text-blue-300">Application Version</h4>
                                        {!isEditingVersion && (
                                            <button
                                                onClick={() => setIsEditingVersion(true)}
                                                className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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
                                                className="w-full px-3 py-2 text-lg font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-dark-bg-secondary border border-blue-300 dark:border-blue-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                                                placeholder="e.g., 1.0.0"
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter') handleVersionUpdate();
                                                    if (e.key === 'Escape') handleCancelVersionEdit();
                                                }}
                                            />
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <button
                                                    onClick={handleVersionUpdate}
                                                    className="flex items-center justify-center gap-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white text-sm rounded hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors min-h-[44px] w-full sm:w-auto"
                                                >
                                                    <Save size={12} />
                                                    Save
                                                </button>
                                                <button
                                                    onClick={handleCancelVersionEdit}
                                                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors min-h-[44px] w-full sm:w-auto"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-2">v{appVersion}</p>
                                            <p className="text-sm text-blue-700 dark:text-blue-300">
                                                Azure SQL Enhanced Edition
                                            </p>
                                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
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
                                            bgColor: 'bg-orange-50 dark:bg-orange-900/20',
                                            borderColor: 'border-orange-200 dark:border-orange-700',
                                            titleColor: 'text-orange-800 dark:text-orange-300',
                                            valueColor: 'text-orange-600 dark:text-orange-400',
                                            messageColor: 'text-orange-700 dark:text-orange-300',
                                            message: 'Service issues detected - some features may be unavailable'
                                        };
                                    } else if (isChecking) {
                                        statusConfig = {
                                            bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
                                            borderColor: 'border-yellow-200 dark:border-yellow-700',
                                            titleColor: 'text-yellow-800 dark:text-yellow-300',
                                            valueColor: 'text-yellow-600 dark:text-yellow-400',
                                            messageColor: 'text-yellow-700 dark:text-yellow-300',
                                            message: 'System status check in progress...'
                                        };
                                    } else {
                                        statusConfig = {
                                            bgColor: 'bg-green-50 dark:bg-green-900/20',
                                            borderColor: 'border-green-200 dark:border-green-700',
                                            titleColor: 'text-green-800 dark:text-green-300',
                                            valueColor: 'text-green-600 dark:text-green-400',
                                            messageColor: 'text-green-700 dark:text-green-300',
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
                                                <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
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

                        </div>
                    )}
                </div>

                {/* Admin Analytics Section */}
                <div className="bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg shadow-sm p-6">
                    <button
                        onClick={handleAnalyticsExpand}
                        className="w-full flex items-center justify-between text-left focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-800 rounded p-2 transition-colors"
                    >
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <BarChart3 size={20} />
                            <span>Admin Analytics</span>
                        </h3>
                        <ChevronDown
                            size={20}
                            className={`text-gray-500 dark:text-gray-400 transition-transform duration-200 ${showAdminAnalytics ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {showAdminAnalytics && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                            {/* Dashboard Header */}
                            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                <h4 className="text-lg font-medium text-gray-700 dark:text-gray-300">Dashboard Overview</h4>
                                <button
                                    onClick={fetchAnalyticsData}
                                    disabled={analyticsData.loading}
                                    className={`px-4 py-2 text-sm rounded-md transition-colors min-h-[44px] flex items-center justify-center w-full sm:w-auto ${
                                        analyticsData.loading 
                                            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            : 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-400'
                                    }`}
                                >
                                    {analyticsData.loading ? (
                                        <div className="flex items-center gap-1">
                                            <RotateCw size={12} className="animate-spin" />
                                            Loading...
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1">
                                            <Activity size={12} />
                                            Refresh Data
                                        </div>
                                    )}
                                </button>
                            </div>

                            {/* Last Updated */}
                            {analyticsData.lastUpdated && (
                                <div className="mb-4 text-xs text-gray-500 dark:text-gray-400">
                                    Last updated: {analyticsData.lastUpdated.toLocaleString()}
                                </div>
                            )}

                            {/* Error State */}
                            {analyticsData.error && (
                                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md">
                                    <p className="text-red-700 dark:text-red-300 text-sm">
                                        Failed to load analytics: {analyticsData.error}
                                    </p>
                                </div>
                            )}

                            {/* Analytics Content */}
                            {analyticsData.loading ? (
                                <div className="text-center py-8">
                                    <RotateCw size={32} className="text-gray-400 dark:text-gray-500 animate-spin mx-auto mb-4" />
                                    <p className="text-gray-500 dark:text-gray-400">
                                        Loading analytics data...
                                    </p>
                                </div>
                            ) : analyticsData.data ? (
                                <div className="space-y-4">
                                    {/* Summary Cards */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        <div className="bg-blue-50 dark:bg-blue-950/30 p-4 sm:p-6 rounded-lg border border-blue-200 dark:border-blue-600/50">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-blue-600 dark:text-blue-300 mb-1 font-medium">Total Page Views</p>
                                                    <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                                                        {analyticsData.data.totalPageViews || 0}
                                                    </p>
                                                    <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                                                        {analyticsData.data.totalPageViews === 0 ? 'No pages tracked yet' : 'Total page visits tracked'}
                                                    </p>
                                                </div>
                                                <Activity size={24} className="text-blue-600 dark:text-blue-300" />
                                            </div>
                                        </div>

                                        <div className="bg-green-50 dark:bg-green-950/30 p-4 sm:p-6 rounded-lg border border-green-200 dark:border-green-600/50">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-green-600 dark:text-green-300 mb-1 font-medium">Unique Sessions</p>
                                                    <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                                                        {analyticsData.data.uniqueSessions || 0}
                                                    </p>
                                                    <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                                                        {analyticsData.data.uniqueSessions === 0 ? 'No sessions tracked yet' : 'Individual user sessions'}
                                                    </p>
                                                </div>
                                                <Users size={24} className="text-green-600 dark:text-green-300" />
                                            </div>
                                        </div>

                                        <div className="bg-purple-50 dark:bg-purple-950/30 p-4 sm:p-6 rounded-lg border border-purple-200 dark:border-purple-600/50">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-purple-600 dark:text-purple-300 mb-1 font-medium">Active Today</p>
                                                    <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                                                        {analyticsData.data.activeToday || 0}
                                                    </p>
                                                    <p className="text-xs text-purple-600 dark:text-purple-300 mt-1">
                                                        {analyticsData.data.activeToday === 0 ? 'No users active today' : 'Users who logged in today'}
                                                    </p>
                                                </div>
                                                <TrendingUp size={24} className="text-purple-600 dark:text-purple-300" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Most Active Users */}
                                    {analyticsData.data.topUsers && analyticsData.data.topUsers.length > 0 && (
                                        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-600/50 rounded-lg p-4">
                                            <h5 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Most Active Users</h5>
                                            <p className="text-xs text-gray-500 dark:text-gray-300 mb-3">Based on highlighted items in the database</p>
                                            <div className="space-y-2">
                                                {analyticsData.data.topUsers.map((user, index) => (
                                                    <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 px-4 bg-white dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600/30 gap-3 sm:gap-0">
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center border border-blue-200 dark:border-blue-600/50 flex-shrink-0">
                                                                <User size={16} className="text-blue-600 dark:text-blue-300" />
                                                            </div>
                                                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 flex-1 min-w-0">
                                                                <span className="text-sm font-medium text-gray-700 dark:text-gray-100 truncate">
                                                                    {user.displayName || user.userId || 'Anonymous'}
                                                                </span>
                                                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500 dark:text-gray-300">
                                                                    {user.loginCount !== undefined && user.loginCount > 0 && (
                                                                        <span className="bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded">{user.loginCount} logins</span>
                                                                    )}
                                                                    {user.highlightCount !== undefined && user.highlightCount > 0 && (
                                                                        <span className="bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded">{user.highlightCount} highlights</span>
                                                                    )}
                                                                    {user.mostActivePage && (
                                                                        <span className="bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">Most active: {user.mostActivePage}</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {user.lastLogin && (
                                                            <div className="text-xs text-gray-500 dark:text-gray-300 whitespace-nowrap sm:text-right">
                                                                Last: {new Date(user.lastLogin).toLocaleDateString()}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* State Analytics */}
                                    {analyticsData.data.stateAnalytics && analyticsData.data.stateAnalytics.length > 0 && (
                                        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-600/50 rounded-lg p-4">
                                            <h5 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">State-Specific Activity</h5>
                                            <div className="space-y-2">
                                                {analyticsData.data.stateAnalytics.map((item, index) => (
                                                    <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 px-4 bg-white dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600/30 gap-2 sm:gap-0">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center border border-indigo-200 dark:border-indigo-600/50">
                                                                <MapPin size={16} className="text-indigo-600 dark:text-indigo-300" />
                                                            </div>
                                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-100 truncate">
                                                                {item.pageName}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-gray-500 dark:text-gray-300 sm:text-right whitespace-nowrap">
                                                            {item.viewCount} views
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Page Performance */}
                                    {analyticsData.data.topPages && analyticsData.data.topPages.length > 0 && (
                                        <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-600/50 rounded-lg p-4">
                                            <h5 className="font-semibold text-gray-800 dark:text-gray-100 mb-3">Most Visited Pages</h5>
                                            <div className="space-y-2">
                                                {analyticsData.data.topPages.map((page, index) => (
                                                    <div key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-3 px-4 bg-white dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600/30 gap-2 sm:gap-0">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center border border-green-200 dark:border-green-600/50">
                                                                <Globe size={16} className="text-green-600 dark:text-green-300" />
                                                            </div>
                                                            <span className="text-sm font-medium text-gray-700 dark:text-gray-100 truncate">
                                                                {page.pageName}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-gray-500 dark:text-gray-300 sm:text-right whitespace-nowrap">
                                                            {page.viewCount} views
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <BarChart3 size={48} className="text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                                    <p className="text-gray-500 dark:text-gray-400">
                                        No analytics data available yet.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Technical Configuration Section */}
                <div className="bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg shadow-sm p-6">
                    <button
                        onClick={() => setShowTechnicalSection(!showTechnicalSection)}
                        className="w-full flex items-center justify-between text-left focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-800 rounded p-2 transition-colors"
                    >
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <Monitor size={20} />
                            <span>Technical Configuration</span>
                        </h3>
                        <ChevronDown
                            size={20}
                            className={`text-gray-500 dark:text-gray-400 transition-transform duration-200 ${showTechnicalSection ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {showTechnicalSection && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-4">

                            {/* API Configuration */}
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md p-4">
                                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">API Configuration</h4>
                                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                    <p>• <strong>Backend API:</strong> {API_URL}</p>
                                    <p>• <strong>Environment:</strong> {window.location.hostname === 'localhost' ? 'Development' : 'Production'}</p>
                                    <p>• <strong>Database Type:</strong> Azure SQL with SQLite fallback</p>
                                </div>
                            </div>

                            {/* Performance Settings */}
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md p-4">
                                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Performance Settings</h4>
                                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                    <p>• <strong>AI Processing:</strong> Batch processing enabled for efficiency</p>
                                    <p>• <strong>Data Caching:</strong> Local storage for improved load times</p>
                                    <p>• <strong>Rate Limiting:</strong> API calls optimized to prevent throttling</p>
                                    <p>• <strong>Auto-refresh:</strong> Background updates every 5 minutes</p>
                                </div>
                            </div>

                            {/* Technical Details */}
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md p-4">
                                <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">Technical Details</h4>
                                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                    <p>• <strong>Frontend:</strong> React 18 with Vite build system</p>
                                    <p>• <strong>Backend:</strong> FastAPI with Python async support</p>
                                    <p>• <strong>Database:</strong> Azure SQL Server with automatic failover</p>
                                    <p>• <strong>AI Engine:</strong> Azure OpenAI GPT-4 integration</p>
                                    <p>• <strong>Data Sources:</strong> Federal Register API, LegiScan API</p>
                                </div>
                            </div>

                            {/* Automation Report */}
                            <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md p-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 h-8">
                                        <Clock size={16} className="text-gray-600 dark:text-gray-400" />
                                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 leading-none text-sm">
                                            Automation Report
                                        </h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={fetchAutomationReport}
                                            disabled={automationReport.loading}
                                            className={`px-3 py-2 text-xs rounded-md transition-colors h-8 flex items-center justify-center ${
                                                automationReport.loading 
                                                    ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                                    : 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-400'
                                            }`}
                                        >
                                            {automationReport.loading ? (
                                                <div className="flex items-center gap-1">
                                                    <RotateCw size={10} className="animate-spin" />
                                                    Loading...
                                                </div>
                                            ) : (
                                                'Load Report'
                                            )}
                                        </button>
                                        
                                        {/* Manual trigger button */}
                                        <button
                                            onClick={runAllJobsManually}
                                            disabled={manualJobExecution.loading}
                                            title="Run both automation jobs now"
                                            className={`px-3 py-2 text-xs rounded-md transition-colors h-8 flex items-center justify-center gap-1 ${
                                                manualJobExecution.loading
                                                    ? 'bg-orange-300 dark:bg-orange-600 text-orange-800 dark:text-orange-200 cursor-not-allowed'
                                                    : 'bg-green-600 dark:bg-green-500 text-white hover:bg-green-700 dark:hover:bg-green-400'
                                            }`}
                                        >
                                            {manualJobExecution.loading ? (
                                                <div className="flex items-center gap-1">
                                                    <RotateCw size={10} className="animate-spin" />
                                                    Running...
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <Play size={10} />
                                                    Run Now
                                                </div>
                                            )}
                                        </button>
                                    </div>
                                </div>
                                
                                {automationReport.lastUpdated && (
                                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 mt-3">
                                        Last updated: {automationReport.lastUpdated.toLocaleTimeString()}
                                    </div>
                                )}
                                
                                {manualJobExecution.lastExecution && (
                                    <div className={`text-xs p-2 rounded mb-2 ${automationReport.lastUpdated ? '' : 'mt-3'} ${
                                        manualJobExecution.lastExecution.status === 'running'
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                                            : manualJobExecution.lastExecution.status === 'failed'
                                            ? 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300'
                                            : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300'
                                    }`}>
                                        Manual execution: {manualJobExecution.lastExecution.jobName} {manualJobExecution.lastExecution.status}
                                        {manualJobExecution.lastExecution.error && ` - ${manualJobExecution.lastExecution.error}`}
                                    </div>
                                )}
                                
                                {automationReport.error && (
                                    <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded text-xs text-red-700 dark:text-red-300 mt-3">
                                        Error: {automationReport.error}
                                    </div>
                                )}
                                
                                {automationReport.data && (
                                    <div className="space-y-3">
                                        {/* Summary */}
                                        {automationReport.data.summary && (
                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                                                <div className="bg-white dark:bg-gray-700 p-2 rounded border border-gray-200 dark:border-gray-600">
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Runs</p>
                                                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                                                        {automationReport.data.summary.total_executions}
                                                    </p>
                                                </div>
                                                <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded border border-green-200 dark:border-green-700">
                                                    <p className="text-xs text-green-600 dark:text-green-400">Successful</p>
                                                    <p className="text-sm font-bold text-green-800 dark:text-green-300">
                                                        {automationReport.data.summary.successful}
                                                    </p>
                                                </div>
                                                <div className="bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-700">
                                                    <p className="text-xs text-red-600 dark:text-red-400">Failed</p>
                                                    <p className="text-sm font-bold text-red-800 dark:text-red-300">
                                                        {automationReport.data.summary.failed}
                                                    </p>
                                                </div>
                                                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-700">
                                                    <p className="text-xs text-blue-600 dark:text-blue-400">Success Rate</p>
                                                    <p className="text-sm font-bold text-blue-800 dark:text-blue-300">
                                                        {automationReport.data.summary.success_rate}%
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        
                                        {/* Job Details */}
                                        {automationReport.data.jobs && automationReport.data.jobs.map((job, index) => (
                                            <div key={index} className="bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded p-3">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div>
                                                        <h5 className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                                            {job.description}
                                                        </h5>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                                            Schedule: {job.schedule} (Runs at {
                                                                job.schedule === "2:00 AM UTC" ? "9:00 PM CDT / 8:00 PM CST" :
                                                                job.schedule === "3:00 AM UTC" ? "10:00 PM CDT / 9:00 PM CST" :
                                                                job.schedule
                                                            })
                                                        </p>
                                                    </div>
                                                    {job.executions && job.executions.length > 0 && (
                                                        <span className={`text-xs px-2 py-1 rounded ${
                                                            job.executions[0].status === 'Succeeded' 
                                                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                                                : job.executions[0].status === 'Failed'
                                                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                                                : job.executions[0].status === 'Running'
                                                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                                                                : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                                                        }`}>
                                                            {job.executions[0].status}
                                                        </span>
                                                    )}
                                                </div>
                                                
                                                {job.error ? (
                                                    <p className="text-xs text-red-600 dark:text-red-400">
                                                        <AlertCircle size={12} className="inline mr-1" />
                                                        {job.error}
                                                    </p>
                                                ) : job.executions && job.executions.length > 0 ? (
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">
                                                            Recent Executions:
                                                        </p>
                                                        {job.executions.map((exec, execIndex) => {
                                                            const expandKey = `${job.name}-${exec.execution_name}`;
                                                            const isExpanded = expandedExecutions[expandKey];

                                                            return (
                                                                <div key={execIndex} className="bg-gray-50 dark:bg-gray-800 rounded overflow-hidden">
                                                                    {/* Collapsed View - Click to expand */}
                                                                    <button
                                                                        onClick={() => toggleExecutionExpanded(job.name, exec.execution_name)}
                                                                        className="w-full flex items-center justify-between text-xs p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                                                                    >
                                                                        <div className="flex items-center gap-2 flex-1">
                                                                            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                                                exec.status === 'Succeeded' ? 'bg-green-500'
                                                                                : exec.status === 'Failed' ? 'bg-red-500'
                                                                                : exec.status === 'Running' ? 'bg-yellow-500 animate-pulse'
                                                                                : 'bg-gray-400'
                                                                            }`} />
                                                                            <span className="text-gray-600 dark:text-gray-400">
                                                                                {exec.start_time ? new Date(exec.start_time).toLocaleString('en-US', {
                                                                                    month: 'short',
                                                                                    day: 'numeric',
                                                                                    hour: '2-digit',
                                                                                    minute: '2-digit'
                                                                                }) : 'N/A'}
                                                                            </span>
                                                                            {exec.is_manual && (
                                                                                <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[10px] font-medium">
                                                                                    Manual
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            {exec.duration && (
                                                                                <span className="text-gray-500 dark:text-gray-400">
                                                                                    {exec.duration}
                                                                                </span>
                                                                            )}
                                                                            {isExpanded ? (
                                                                                <ChevronUp size={14} className="text-gray-500 dark:text-gray-400" />
                                                                            ) : (
                                                                                <ChevronDown size={14} className="text-gray-500 dark:text-gray-400" />
                                                                            )}
                                                                        </div>
                                                                    </button>

                                                                    {/* Expanded View - Show details */}
                                                                    {isExpanded && (
                                                                        <div className="px-3 pb-2 space-y-1.5 border-t border-gray-200 dark:border-gray-700 pt-2">
                                                                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
                                                                                <div>
                                                                                    <span className="text-gray-500 dark:text-gray-400">Status:</span>
                                                                                    <span className={`ml-1 font-medium ${
                                                                                        exec.status === 'Succeeded' ? 'text-green-600 dark:text-green-400'
                                                                                        : exec.status === 'Failed' ? 'text-red-600 dark:text-red-400'
                                                                                        : exec.status === 'Running' ? 'text-yellow-600 dark:text-yellow-400'
                                                                                        : 'text-gray-600 dark:text-gray-400'
                                                                                    }`}>
                                                                                        {exec.status}
                                                                                    </span>
                                                                                </div>
                                                                                <div>
                                                                                    <span className="text-gray-500 dark:text-gray-400">Type:</span>
                                                                                    <span className="ml-1 text-gray-700 dark:text-gray-300">
                                                                                        {exec.is_manual ? 'Manual' : 'Scheduled'}
                                                                                    </span>
                                                                                </div>
                                                                                <div className="col-span-2">
                                                                                    <span className="text-gray-500 dark:text-gray-400">Execution ID:</span>
                                                                                    <span className="ml-1 text-gray-700 dark:text-gray-300 font-mono text-[10px]">
                                                                                        {exec.execution_name}
                                                                                    </span>
                                                                                </div>
                                                                                {exec.start_time && (
                                                                                    <div className="col-span-2">
                                                                                        <span className="text-gray-500 dark:text-gray-400">Started:</span>
                                                                                        <span className="ml-1 text-gray-700 dark:text-gray-300">
                                                                                            {new Date(exec.start_time).toLocaleString()}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                                {exec.end_time && (
                                                                                    <div className="col-span-2">
                                                                                        <span className="text-gray-500 dark:text-gray-400">Ended:</span>
                                                                                        <span className="ml-1 text-gray-700 dark:text-gray-300">
                                                                                            {new Date(exec.end_time).toLocaleString()}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                                {exec.duration && (
                                                                                    <div>
                                                                                        <span className="text-gray-500 dark:text-gray-400">Duration:</span>
                                                                                        <span className="ml-1 text-gray-700 dark:text-gray-300">
                                                                                            {exec.duration}
                                                                                        </span>
                                                                                    </div>
                                                                                )}
                                                                            </div>

                                                                            {/* Error Details */}
                                                                            {exec.error && exec.status === 'Failed' && (
                                                                                <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                                                                                    <div className="flex items-start gap-1">
                                                                                        <AlertTriangle size={12} className="text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                                                                                        <div className="flex-1 min-w-0">
                                                                                            <p className="text-[10px] font-medium text-red-700 dark:text-red-300 mb-1">Error Details:</p>
                                                                                            <p className="text-[11px] text-red-600 dark:text-red-400 break-words font-mono">
                                                                                                {exec.error}
                                                                                            </p>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        No execution history available
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                        
                                        {/* Recent Failures Alert */}
                                        {automationReport.data.summary && automationReport.data.summary.recent_failures && 
                                         automationReport.data.summary.recent_failures.length > 0 && (
                                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded p-3">
                                                <h5 className="text-sm font-medium text-red-800 dark:text-red-300 mb-2 flex items-center gap-1">
                                                    <AlertTriangle size={14} />
                                                    Recent Failures (Last 24 Hours)
                                                </h5>
                                                <div className="space-y-1">
                                                    {automationReport.data.summary.recent_failures.map((failure, idx) => (
                                                        <p key={idx} className="text-xs text-red-700 dark:text-red-300">
                                                            • {failure.job} - {new Date(failure.time).toLocaleString()}
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                        </div>
                    )}
                </div>

                {/* Database Management Section - SEPARATE CONTAINER */}
                <div className="bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg shadow-sm p-6">
                    <button
                        onClick={handleDatabaseExpand}
                        className="w-full flex items-center justify-between text-left focus:outline-none hover:bg-gray-50 dark:hover:bg-gray-800 rounded p-2 transition-colors"
                    >
                        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                            <Settings size={20} />
                            <span>Database Management</span>
                        </h3>
                        <ChevronDown
                            size={20}
                            className={`text-gray-500 dark:text-gray-400 transition-transform duration-200 ${showDatabaseSection ? 'rotate-180' : ''}`}
                        />
                    </button>

                    {showDatabaseSection && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md p-4 mb-4">
                                <h4 className="font-semibold text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
                                    <Trash2 size={16} />
                                    <span>Clear Database</span>
                                </h4>
                                <p className="text-red-700 dark:text-red-300 text-sm mb-3">
                                    This will permanently delete all executive orders and legislation from the database.
                                    This action cannot be undone.
                                </p>

                                <button
                                    onClick={showClearDatabaseConfirmation}
                                    disabled={clearingDatabase}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 min-h-[44px] flex items-center justify-center ${clearingDatabase
                                            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            : 'bg-red-600 dark:bg-red-500 text-white hover:bg-red-700 dark:hover:bg-red-400'
                                        }`}
                                >
                                    Clear Database
                                </button>
                            </div>

                            {/* Data Upload Section */}
                            <DataUploadSection />


                            {/* MSI Database Connection Debug */}
                            <div className="mt-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <h4 className="font-semibold text-gray-800 dark:text-gray-200">MSI Database Connection Debug</h4>
                                    <button
                                        onClick={debugDatabaseConnection}
                                        disabled={databaseDebugInfo.loading}
                                        className={`px-4 py-2 sm:px-3 sm:py-1 text-sm rounded-md min-h-[44px] sm:min-h-[auto] flex items-center justify-center ${databaseDebugInfo.loading ? 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300' : 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-400'}`}
                                    >
                                        {databaseDebugInfo.loading ? 'Testing...' : 'Test MSI Connection'}
                                    </button>
                                </div>

                                {databaseDebugInfo.logs.length > 0 && (
                                    <div className={`mt-3 p-3 rounded border text-sm font-mono ${databaseDebugInfo.success ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700'}`}>
                                        <div className="mb-2 flex items-center justify-between">
                                            <span className={`font-medium ${databaseDebugInfo.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                                                {databaseDebugInfo.success ? '✅ Connection Successful' : '❌ Connection Failed'}
                                            </span>
                                            {databaseDebugInfo.timestamp && (
                                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                                    {new Date(databaseDebugInfo.timestamp).toLocaleTimeString()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="bg-black dark:bg-gray-900 bg-opacity-10 dark:bg-opacity-50 p-2 rounded max-h-64 overflow-y-auto">
                                            {databaseDebugInfo.logs.map((log, index) => (
                                                <div key={index} className="whitespace-pre-wrap mb-1">
                                                    {log}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Help and Support */}
                <div className="bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-lg shadow-sm p-6">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                        <HelpCircle size={20} />
                        <span>Help & Support</span>
                    </h3>

                    <div className="grid grid-cols-1 gap-4">
                        <div className="border border-blue-100 dark:border-blue-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                    <Mail size={20} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <h5 className="font-medium text-blue-800 dark:text-blue-300">Email Support</h5>
                                    <p className="text-sm text-blue-600 dark:text-blue-400">For technical issues and questions</p>
                                </div>
                            </div>
                            <a
                                href="mailto:legal@moregroup-inc.com"
                                className="text-blue-700 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 font-medium text-sm flex items-center gap-1"
                            >
                                legal@moregroup-inc.com <ExternalLink size={12} />
                            </a>
                            <p className="text-xs text-blue-600 mt-1">Response time: 24-48 hours</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Database Password Modal */}
            {showDatabasePasswordModal && (
                <div className="fixed inset-0 bg-black dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-dark-bg rounded-lg shadow-xl max-w-md w-full">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-dark-border">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                    <Lock size={20} className="text-blue-600 dark:text-blue-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Database Management Access</h3>
                            </div>
                            <button
                                onClick={closeDatabasePasswordModal}
                                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            {/* Protected Content Notice */}
                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <Lock size={16} className="text-blue-600 dark:text-blue-400" />
                                    <h4 className="font-semibold text-blue-800 dark:text-blue-300">Protected Content</h4>
                                </div>
                                <p className="text-blue-700 dark:text-blue-300 text-sm">
                                    Database management contains sensitive administrative functions and requires authentication to access.
                                </p>
                            </div>

                            {/* Password Input */}
                            <div className="mb-6">
                                <label htmlFor="database-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Enter Password
                                </label>
                                <div className="relative">
                                    <input
                                        type={showDatabasePassword ? "text" : "password"}
                                        id="database-password"
                                        value={databasePasswordInput}
                                        onChange={(e) => {
                                            setDatabasePasswordInput(e.target.value);
                                            if (databasePasswordError) setDatabasePasswordError('');
                                        }}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                handleDatabasePasswordSubmit();
                                            }
                                        }}
                                        className={`w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 ${
                                            databasePasswordError 
                                                ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20' 
                                                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-dark-bg-secondary'
                                        }`}
                                        placeholder="Enter database password..."
                                        autoComplete="off"
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowDatabasePassword(!showDatabasePassword)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
                                        tabIndex={-1}
                                    >
                                        {showDatabasePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {databasePasswordError && (
                                    <p className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-center gap-1">
                                        <X size={14} />
                                        {databasePasswordError}
                                    </p>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={closeDatabasePasswordModal}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors min-h-[44px] w-full sm:w-auto"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDatabasePasswordSubmit}
                                    disabled={!databasePasswordInput.trim()}
                                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 min-h-[44px] w-full sm:w-auto ${
                                        !databasePasswordInput.trim()
                                            ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                                            : 'bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-400'
                                    }`}
                                >
                                    <Database size={14} />
                                    Access Database Management
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Clear Database Confirmation Modal */}
                    <ClearConfirmationModal />
            
            {/* Analytics Password Modal */}
                    <AnalyticsPasswordModal />
                </div>
            </section>
        </div>
    );
};

export default SettingsPage;

