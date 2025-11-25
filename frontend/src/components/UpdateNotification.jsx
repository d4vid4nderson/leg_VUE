import React, { useState, useEffect, useCallback } from 'react';
import { Bell, RefreshCw, X, Check, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import API_URL from '../config/api';

const UpdateNotification = ({ 
    stateCode = null, 
    sessionId = null, 
    onRefresh = null,
    className = "" 
}) => {
    const [updateStatus, setUpdateStatus] = useState({
        last_update: null,
        update_in_progress: false,
        new_updates_available: false,
        notifications_count: 0,
        recent_updates: []
    });
    
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [error, setError] = useState(null);

    // Fetch update status
    const fetchUpdateStatus = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (stateCode) params.append('state_code', stateCode);
            if (sessionId) params.append('session_id', sessionId);
            
            const response = await fetch(`${API_URL}/api/updates/status?${params}`);
            if (!response.ok) {
                throw new Error('Failed to fetch update status');
            }
            
            const data = await response.json();
            setUpdateStatus(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching update status:', err);
            setError('Failed to check for updates');
        }
    }, [stateCode, sessionId]);

    // Fetch notifications
    const fetchNotifications = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (stateCode) params.append('state_code', stateCode);
            params.append('limit', '20');
            
            const response = await fetch(`${API_URL}/api/updates/notifications?${params}`);
            if (!response.ok) {
                throw new Error('Failed to fetch notifications');
            }
            
            const data = await response.json();
            setNotifications(data.notifications || []);
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    }, [stateCode]);

    // Handle manual refresh
    const handleManualRefresh = async () => {
        if (isRefreshing) return;
        
        setIsRefreshing(true);
        setError(null);
        
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
                throw new Error('Failed to start manual refresh');
            }
            
            const data = await response.json();
            
            // Poll for task completion
            await pollTaskStatus(data.task_id);
            
            // Refresh status and data
            await fetchUpdateStatus();
            if (onRefresh) {
                onRefresh();
            }
            
        } catch (err) {
            console.error('Error during manual refresh:', err);
            setError('Failed to refresh data');
        } finally {
            setIsRefreshing(false);
        }
    };

    // Poll task status
    const pollTaskStatus = async (taskId) => {
        const maxPolls = 60; // 5 minutes max
        let polls = 0;
        
        while (polls < maxPolls) {
            try {
                const response = await fetch(`${API_URL}/api/updates/task-status/${taskId}`);
                if (!response.ok) {
                    throw new Error('Failed to check task status');
                }
                
                const data = await response.json();
                
                if (data.status === 'completed') {
                    return;
                } else if (data.status === 'failed') {
                    throw new Error(data.error_message || 'Task failed');
                }
                
                // Wait 5 seconds before next poll
                await new Promise(resolve => setTimeout(resolve, 5000));
                polls++;
                
            } catch (err) {
                console.error('Error polling task status:', err);
                throw err;
            }
        }
        
        throw new Error('Refresh timed out');
    };

    // Mark notification as read
    const markAsRead = async (notificationId) => {
        try {
            const response = await fetch(`${API_URL}/api/updates/notifications/${notificationId}/mark-read`, {
                method: 'POST'
            });
            
            if (response.ok) {
                setNotifications(prev => 
                    prev.map(n => 
                        n.id === notificationId 
                            ? { ...n, notification_read: true }
                            : n
                    )
                );
                fetchUpdateStatus(); // Refresh status
            }
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    // Mark all notifications as read
    const markAllAsRead = async () => {
        try {
            const params = new URLSearchParams();
            if (stateCode) params.append('state_code', stateCode);
            
            const response = await fetch(`${API_URL}/api/updates/notifications/mark-all-read?${params}`, {
                method: 'POST'
            });
            
            if (response.ok) {
                setNotifications(prev => 
                    prev.map(n => ({ ...n, notification_read: true }))
                );
                fetchUpdateStatus(); // Refresh status
            }
        } catch (err) {
            console.error('Error marking all notifications as read:', err);
        }
    };

    // Format time ago
    const formatTimeAgo = (timestamp) => {
        if (!timestamp) return 'Unknown';
        
        const now = new Date();
        const time = new Date(timestamp);
        const diffInSeconds = Math.floor((now - time) / 1000);
        
        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        
        const days = Math.floor(diffInSeconds / 86400);
        if (days === 1) return 'Yesterday';
        if (days < 7) return `${days}d ago`;
        
        return time.toLocaleDateString();
    };

    // Get notification message
    const getNotificationMessage = (notification) => {
        if (notification.new_bills_count > 0 && notification.updated_bills_count > 0) {
            return `${notification.new_bills_count} new bills and ${notification.updated_bills_count} updated bills`;
        } else if (notification.new_bills_count > 0) {
            return `${notification.new_bills_count} new bills`;
        } else if (notification.updated_bills_count > 0) {
            return `${notification.updated_bills_count} updated bills`;
        }
        return 'Updates available';
    };

    // Initialize and set up polling
    useEffect(() => {
        fetchUpdateStatus();
        fetchNotifications();
        
        // Poll every 5 minutes
        const interval = setInterval(fetchUpdateStatus, 300000);
        
        return () => clearInterval(interval);
    }, [fetchUpdateStatus, fetchNotifications]);

    // Auto-expand if there are new updates
    useEffect(() => {
        if (updateStatus.new_updates_available && !expanded) {
            setExpanded(true);
        }
    }, [updateStatus.new_updates_available, expanded]);

    const hasUpdates = updateStatus.new_updates_available || updateStatus.notifications_count > 0;
    const isUpdating = updateStatus.update_in_progress || isRefreshing;

    return (
        <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
            {/* Header */}
            <div 
                className={`px-4 py-3 flex items-center justify-between cursor-pointer transition-colors ${
                    hasUpdates ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'
                }`}
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center space-x-3">
                    <div className="relative">
                        <Bell 
                            size={20} 
                            className={`${hasUpdates ? 'text-blue-600' : 'text-gray-500'}`}
                        />
                        {hasUpdates && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                                <span className="text-xs text-white font-bold">
                                    {updateStatus.notifications_count > 9 ? '9+' : updateStatus.notifications_count}
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <div>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">
                                Bill Updates
                            </span>
                            {isUpdating && (
                                <RefreshCw size={14} className="text-blue-500 animate-spin" />
                            )}
                        </div>
                        
                        <div className="text-xs text-gray-500">
                            {updateStatus.last_update ? (
                                `Last updated: ${formatTimeAgo(updateStatus.last_update)}`
                            ) : (
                                'No recent updates'
                            )}
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center space-x-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleManualRefresh();
                        }}
                        disabled={isUpdating}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors disabled:opacity-50"
                        title="Refresh now"
                    >
                        <RefreshCw size={16} className={isUpdating ? 'animate-spin' : ''} />
                    </button>
                    
                    {expanded ? (
                        <ChevronUp size={16} className="text-gray-400" />
                    ) : (
                        <ChevronDown size={16} className="text-gray-400" />
                    )}
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex items-center space-x-2">
                    <AlertCircle size={16} className="text-red-500" />
                    <span className="text-sm text-red-700">{error}</span>
                </div>
            )}

            {/* Expanded Content */}
            {expanded && (
                <div className="border-t border-gray-200">
                    {/* Update Status */}
                    <div className="px-4 py-3 bg-gray-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Clock size={16} className="text-gray-500" />
                                <span className="text-sm text-gray-700">
                                    {isUpdating ? 'Updating...' : 'Status'}
                                </span>
                            </div>
                            
                            {notifications.length > 0 && (
                                <button
                                    onClick={markAllAsRead}
                                    className="text-sm text-blue-600 hover:text-blue-700"
                                >
                                    Mark all read
                                </button>
                            )}
                        </div>
                        
                        <div className="mt-2 text-sm text-gray-600">
                            {updateStatus.recent_updates.length > 0 ? (
                                `${updateStatus.recent_updates.length} recent updates`
                            ) : (
                                'No recent activity'
                            )}
                        </div>
                    </div>

                    {/* Notifications */}
                    {notifications.length > 0 && (
                        <div className="max-h-64 overflow-y-auto">
                            {notifications.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`px-4 py-3 border-b border-gray-100 flex items-start justify-between ${
                                        !notification.notification_read ? 'bg-blue-50' : 'bg-white'
                                    }`}
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                            <div className={`w-2 h-2 rounded-full ${
                                                !notification.notification_read ? 'bg-blue-500' : 'bg-gray-300'
                                            }`} />
                                            <span className="text-sm font-medium text-gray-900">
                                                {getNotificationMessage(notification)}
                                            </span>
                                        </div>
                                        
                                        <div className="mt-1 text-xs text-gray-500 ml-4">
                                            {notification.session_id && (
                                                <span className="mr-2">
                                                    Session: {notification.session_id}
                                                </span>
                                            )}
                                            {formatTimeAgo(notification.notification_created)}
                                        </div>
                                    </div>
                                    
                                    {!notification.notification_read && (
                                        <button
                                            onClick={() => markAsRead(notification.id)}
                                            className="ml-2 p-1 text-gray-400 hover:text-blue-600 rounded"
                                            title="Mark as read"
                                        >
                                            <Check size={14} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* No Notifications */}
                    {notifications.length === 0 && !isUpdating && (
                        <div className="px-4 py-6 text-center text-gray-500">
                            <Bell size={32} className="mx-auto mb-2 text-gray-300" />
                            <p className="text-sm">No new updates</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default UpdateNotification;