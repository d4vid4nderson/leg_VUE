import React, { useState, useEffect } from 'react';
import { RefreshCw, Check, X, Clock, AlertCircle } from 'lucide-react';
import API_URL from '../config/api';

const ManualRefresh = ({ 
    stateCode = null, 
    sessionId = null, 
    onRefreshStart = null,
    onRefreshComplete = null,
    onRefreshError = null,
    className = "",
    size = "medium" // "small", "medium", "large"
}) => {
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [taskId, setTaskId] = useState(null);
    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState('idle'); // 'idle', 'starting', 'running', 'completed', 'failed'
    const [error, setError] = useState(null);
    const [estimatedDuration, setEstimatedDuration] = useState(0);
    const [elapsedTime, setElapsedTime] = useState(0);

    // Size variants
    const sizeClasses = {
        small: {
            button: "px-3 py-1.5 text-sm",
            icon: 14,
            progress: "h-1"
        },
        medium: {
            button: "px-4 py-2 text-sm",
            icon: 16,
            progress: "h-2"
        },
        large: {
            button: "px-6 py-3 text-base",
            icon: 20,
            progress: "h-3"
        }
    };

    const currentSize = sizeClasses[size] || sizeClasses.medium;

    // Start manual refresh
    const startRefresh = async () => {
        if (isRefreshing) return;

        setIsRefreshing(true);
        setStatus('starting');
        setError(null);
        setProgress(0);
        setElapsedTime(0);

        if (onRefreshStart) {
            onRefreshStart();
        }

        try {
            const requestBody = {
                state_code: stateCode,
                session_id: sessionId,
                force_update: false
            };

            const response = await fetch(`${API_URL}/api/updates/manual-refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                // Check if response is actually JSON before parsing
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    try {
                        const errorData = await response.json();
                        throw new Error(errorData.detail || `Failed to start refresh (${response.status})`);
                    } catch (jsonError) {
                        throw new Error(`Failed to start refresh (${response.status}): ${response.statusText}`);
                    }
                } else {
                    const textResponse = await response.text();
                    console.error('❌ Backend returned non-JSON error:', textResponse.substring(0, 200));
                    throw new Error(`Backend error (${response.status}): ${response.statusText}. Check if backend is running properly.`);
                }
            }

            // Check if response is actually JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.error('❌ Expected JSON but got:', contentType, 'Response:', textResponse.substring(0, 200));
                throw new Error(`API returned ${contentType || 'unknown content type'} instead of JSON. Check if backend is running properly.`);
            }

            const data = await response.json();
            setTaskId(data.task_id);
            setEstimatedDuration(data.estimated_duration);
            setStatus('running');

            // Start polling for task status
            await pollTaskStatus(data.task_id);

        } catch (err) {
            console.error('Error starting manual refresh:', err);
            setError(err.message);
            setStatus('failed');
            
            if (onRefreshError) {
                onRefreshError(err);
            }
        } finally {
            setIsRefreshing(false);
        }
    };

    // Poll task status
    const pollTaskStatus = async (taskId) => {
        const maxPolls = 120; // 10 minutes max
        let polls = 0;
        const startTime = Date.now();

        while (polls < maxPolls) {
            try {
                const response = await fetch(`${API_URL}/api/task-status/${taskId}`);
                if (!response.ok) {
                    throw new Error(`Failed to check task status (${response.status}): ${response.statusText}`);
                }

                // Check if response is actually JSON
                const contentType = response.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    const textResponse = await response.text();
                    console.error('❌ Expected JSON but got:', contentType, 'Response:', textResponse.substring(0, 200));
                    throw new Error(`Task status API returned ${contentType || 'unknown content type'} instead of JSON. Check if backend is running properly.`);
                }

                const data = await response.json();
                
                // Update elapsed time
                const elapsed = Math.floor((Date.now() - startTime) / 1000);
                setElapsedTime(elapsed);

                // Update progress based on elapsed time vs estimated duration
                if (estimatedDuration > 0) {
                    const progressPercent = Math.min(95, (elapsed / estimatedDuration) * 100);
                    setProgress(progressPercent);
                }

                if (data.status === 'completed') {
                    setStatus('completed');
                    setProgress(100);
                    
                    if (onRefreshComplete) {
                        onRefreshComplete(data);
                    }
                    return;
                    
                } else if (data.status === 'failed') {
                    setStatus('failed');
                    setError(data.error_message || 'Task failed');
                    
                    if (onRefreshError) {
                        onRefreshError(new Error(data.error_message || 'Task failed'));
                    }
                    return;
                }

                // Wait 5 seconds before next poll
                await new Promise(resolve => setTimeout(resolve, 5000));
                polls++;

            } catch (err) {
                console.error('Error polling task status:', err);
                setError(err.message);
                setStatus('failed');
                
                if (onRefreshError) {
                    onRefreshError(err);
                }
                return;
            }
        }

        // Timeout
        setError('Refresh timed out');
        setStatus('failed');
        
        if (onRefreshError) {
            onRefreshError(new Error('Refresh timed out'));
        }
    };

    // Reset state when not refreshing
    useEffect(() => {
        if (!isRefreshing && status === 'completed') {
            const timer = setTimeout(() => {
                setStatus('idle');
                setProgress(0);
                setElapsedTime(0);
                setTaskId(null);
                setError(null);
            }, 2000);

            return () => clearTimeout(timer);
        }
    }, [isRefreshing, status]);

    // Format time
    const formatTime = (seconds) => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    };

    // Get button text
    const getButtonText = () => {
        switch (status) {
            case 'starting':
                return 'Starting...';
            case 'running':
                return 'Updating Bills...';
            case 'completed':
                return 'Updated';
            case 'failed':
                return 'Failed';
            default:
                return 'Update Bills';
        }
    };

    // Get button icon
    const getButtonIcon = () => {
        switch (status) {
            case 'starting':
            case 'running':
                return <RefreshCw size={currentSize.icon} className="animate-spin" />;
            case 'completed':
                return <Check size={currentSize.icon} />;
            case 'failed':
                return <X size={currentSize.icon} />;
            default:
                return <RefreshCw size={currentSize.icon} />;
        }
    };

    // Get button color classes
    const getButtonClasses = () => {
        const baseClasses = `inline-flex items-center justify-center space-x-2 rounded-lg font-medium transition-all duration-200 ${currentSize.button}`;
        
        switch (status) {
            case 'completed':
                return `${baseClasses} bg-green-600 text-white`;
            case 'failed':
                return `${baseClasses} bg-red-600 text-white`;
            case 'starting':
            case 'running':
                return `${baseClasses} bg-blue-600 text-white cursor-not-allowed`;
            default:
                return `${baseClasses} bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800`;
        }
    };

    return (
        <div className={`space-y-2 ${className}`}>
            {/* Refresh Button */}
            <button
                onClick={startRefresh}
                disabled={isRefreshing}
                className={getButtonClasses()}
                title={error ? error : "Update bills with latest data from LegiScan"}
            >
                {getButtonIcon()}
                <span>{getButtonText()}</span>
            </button>

            {/* Progress Bar */}
            {(isRefreshing || status === 'completed') && (
                <div className="space-y-1">
                    <div className={`w-full bg-gray-200 rounded-full overflow-hidden ${currentSize.progress}`}>
                        <div 
                            className="h-full bg-blue-600 transition-all duration-500 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>
                            {status === 'running' ? 'Updating...' : 
                             status === 'completed' ? 'Complete' : 'Starting...'}
                        </span>
                        <span>
                            {estimatedDuration > 0 && elapsedTime > 0 ? (
                                `${formatTime(elapsedTime)}${estimatedDuration > elapsedTime ? ` / ${formatTime(estimatedDuration)}` : ''}`
                            ) : (
                                `${Math.round(progress)}%`
                            )}
                        </span>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="flex items-center space-x-2 text-red-600 text-sm">
                    <AlertCircle size={16} />
                    <span>{error}</span>
                </div>
            )}

            {/* Status Information */}
            {status === 'running' && taskId && (
                <div className="text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                        <Clock size={12} />
                        <span>Task ID: {taskId}</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManualRefresh;