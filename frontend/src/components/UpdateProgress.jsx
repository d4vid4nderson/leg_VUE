import React, { useState, useEffect } from 'react';
import { RefreshCw, Check, X, Clock, BarChart3, AlertCircle, Minimize2 } from 'lucide-react';

const UpdateProgress = ({ 
    isVisible = false,
    taskId = null,
    onClose = null,
    position = "bottom-right", // "bottom-right", "bottom-left", "top-right", "top-left", "center"
    showStats = true,
    autoHide = true,
    autoHideDelay = 5000
}) => {
    const [taskStatus, setTaskStatus] = useState(null);
    const [isMinimized, setIsMinimized] = useState(false);
    const [startTime, setStartTime] = useState(null);
    const [elapsedTime, setElapsedTime] = useState(0);

    // Position classes
    const positionClasses = {
        'bottom-right': 'fixed bottom-4 right-4',
        'bottom-left': 'fixed bottom-4 left-4',
        'top-right': 'fixed top-4 right-4',
        'top-left': 'fixed top-4 left-4',
        'center': 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2'
    };

    // Fetch task status
    const fetchTaskStatus = async (id) => {
        try {
            const response = await fetch(`/api/updates/task-status/${id}`);
            if (!response.ok) {
                throw new Error('Failed to fetch task status');
            }
            
            const data = await response.json();
            setTaskStatus(data);
            
            // Update elapsed time
            if (data.start_time && !data.end_time) {
                const start = new Date(data.start_time);
                const now = new Date();
                setElapsedTime(Math.floor((now - start) / 1000));
            } else if (data.start_time && data.end_time) {
                const start = new Date(data.start_time);
                const end = new Date(data.end_time);
                setElapsedTime(Math.floor((end - start) / 1000));
            }
            
            return data;
        } catch (err) {
            console.error('Error fetching task status:', err);
            return null;
        }
    };

    // Poll task status
    useEffect(() => {
        if (!taskId || !isVisible) return;

        setStartTime(Date.now());
        
        const poll = async () => {
            const status = await fetchTaskStatus(taskId);
            if (status && (status.status === 'completed' || status.status === 'failed')) {
                // Auto-hide after completion
                if (autoHide) {
                    setTimeout(() => {
                        if (onClose) onClose();
                    }, autoHideDelay);
                }
                return; // Stop polling
            }
        };

        // Initial fetch
        poll();

        // Set up polling interval
        const interval = setInterval(poll, 2000);

        return () => clearInterval(interval);
    }, [taskId, isVisible, autoHide, autoHideDelay, onClose]);

    // Format time
    const formatTime = (seconds) => {
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    };

    // Get status icon
    const getStatusIcon = () => {
        if (!taskStatus) return <RefreshCw size={20} className="animate-spin text-blue-500" />;
        
        switch (taskStatus.status) {
            case 'running':
                return <RefreshCw size={20} className="animate-spin text-blue-500" />;
            case 'completed':
                return <Check size={20} className="text-green-500" />;
            case 'failed':
                return <X size={20} className="text-red-500" />;
            default:
                return <Clock size={20} className="text-gray-500" />;
        }
    };

    // Get status color
    const getStatusColor = () => {
        if (!taskStatus) return 'border-blue-200 bg-blue-50';
        
        switch (taskStatus.status) {
            case 'running':
                return 'border-blue-200 bg-blue-50';
            case 'completed':
                return 'border-green-200 bg-green-50';
            case 'failed':
                return 'border-red-200 bg-red-50';
            default:
                return 'border-gray-200 bg-gray-50';
        }
    };

    // Get status message
    const getStatusMessage = () => {
        if (!taskStatus) return 'Preparing update...';
        
        switch (taskStatus.status) {
            case 'running':
                return 'Updating bills...';
            case 'completed':
                return 'Update completed successfully';
            case 'failed':
                return 'Update failed';
            default:
                return 'Processing...';
        }
    };

    // Calculate progress percentage
    const getProgressPercentage = () => {
        if (!taskStatus) return 0;
        
        if (taskStatus.status === 'completed') return 100;
        if (taskStatus.status === 'failed') return 0;
        
        // Estimate progress based on elapsed time (rough estimate)
        const maxEstimatedTime = 300; // 5 minutes
        const progress = Math.min(95, (elapsedTime / maxEstimatedTime) * 100);
        return progress;
    };

    if (!isVisible) return null;

    return (
        <div className={`${positionClasses[position]} z-50 w-80 max-w-sm`}>
            <div className={`rounded-lg border-2 ${getStatusColor()} shadow-lg transition-all duration-300`}>
                {/* Header */}
                <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        {getStatusIcon()}
                        <div>
                            <h3 className="text-sm font-medium text-gray-900">
                                Bill Update
                            </h3>
                            <p className="text-xs text-gray-600">
                                {getStatusMessage()}
                            </p>
                        </div>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                        <button
                            onClick={() => setIsMinimized(!isMinimized)}
                            className="p-1 text-gray-400 hover:text-gray-600 rounded"
                            title={isMinimized ? "Expand" : "Minimize"}
                        >
                            <Minimize2 size={16} />
                        </button>
                        
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                title="Close"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Progress Content */}
                {!isMinimized && (
                    <div className="px-4 pb-4 space-y-3">
                        {/* Progress Bar */}
                        <div className="space-y-1">
                            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                <div 
                                    className={`h-full transition-all duration-500 ease-out ${
                                        taskStatus?.status === 'completed' ? 'bg-green-500' :
                                        taskStatus?.status === 'failed' ? 'bg-red-500' :
                                        'bg-blue-500'
                                    }`}
                                    style={{ width: `${getProgressPercentage()}%` }}
                                />
                            </div>
                            
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>
                                    {taskStatus?.status === 'running' ? 'In Progress' : 
                                     taskStatus?.status === 'completed' ? 'Complete' : 
                                     taskStatus?.status === 'failed' ? 'Failed' : 'Starting...'}
                                </span>
                                <span>
                                    {elapsedTime > 0 ? formatTime(elapsedTime) : '0s'}
                                </span>
                            </div>
                        </div>

                        {/* Statistics */}
                        {showStats && taskStatus && (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                                <div className="bg-white rounded p-2 border">
                                    <div className="flex items-center space-x-1">
                                        <BarChart3 size={12} className="text-green-500" />
                                        <span className="text-gray-600">Added</span>
                                    </div>
                                    <div className="text-lg font-semibold text-gray-900">
                                        {taskStatus.bills_added || 0}
                                    </div>
                                </div>
                                
                                <div className="bg-white rounded p-2 border">
                                    <div className="flex items-center space-x-1">
                                        <BarChart3 size={12} className="text-blue-500" />
                                        <span className="text-gray-600">Updated</span>
                                    </div>
                                    <div className="text-lg font-semibold text-gray-900">
                                        {taskStatus.bills_updated || 0}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error Message */}
                        {taskStatus?.status === 'failed' && taskStatus.error_message && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                <div className="flex items-start space-x-2">
                                    <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                        <p className="text-sm text-red-800 font-medium">
                                            Update Failed
                                        </p>
                                        <p className="text-xs text-red-700 mt-1">
                                            {taskStatus.error_message}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Task ID */}
                        {taskStatus?.task_id && (
                            <div className="text-xs text-gray-500 font-mono bg-gray-100 rounded p-2">
                                Task ID: {taskStatus.task_id}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpdateProgress;