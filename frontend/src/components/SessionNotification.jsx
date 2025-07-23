import React, { useState, useEffect } from 'react';
import { AlertCircle, X, Calendar, MapPin, ExternalLink, RotateCw, Clock, ChevronUp, ChevronDown } from 'lucide-react';
import API_URL from '../config/api';

const SessionNotification = ({ 
    stateName, 
    stateAbbr, 
    visible = true, 
    onRefreshNeeded = null,
    hasUpdates = false 
}) => {
  const [sessionData, setSessionData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Helper function to safely format dates
  const formatDate = (dateString) => {
    if (!dateString) return null;
    
    // Handle numeric values that might be Unix timestamps or invalid dates
    if (typeof dateString === 'number') {
      // If it's 0, 1, or other small numbers, it's likely an invalid date flag
      if (dateString <= 1) return null;
      // If it's a potential Unix timestamp (seconds), convert to milliseconds
      if (dateString < 10000000000) {
        dateString = dateString * 1000;
      }
    }
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      
      // Check if the date is in a reasonable range (after 1970 and before 2100)
      const year = date.getFullYear();
      if (year < 1970 || year > 2100) return null;
      
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
    } catch (e) {
      return null;
    }
  };

  // Helper function to determine if session is currently active
  const isSessionCurrentlyActive = (session) => {
    const now = new Date();
    const startDate = session.session_start_date ? new Date(session.session_start_date) : null;
    const endDate = session.session_end_date ? new Date(session.session_end_date) : null;
    const sineDate = session.sine_die ? new Date(session.sine_die) : null;
    
    // If we have specific dates, use them
    if (startDate && !isNaN(startDate.getTime())) {
      if (endDate && !isNaN(endDate.getTime())) {
        return now >= startDate && now <= endDate;
      } else if (sineDate && !isNaN(sineDate.getTime())) {
        return now >= startDate && now <= sineDate;
      } else {
        // Only start date available, assume ongoing if started
        return now >= startDate;
      }
    }
    
    // Fallback: assume active if it's in the current year
    const currentYear = now.getFullYear();
    return session.year_start === currentYear || session.year_start === currentYear - 1;
  };

  // Check for active sessions when component mounts or state changes
  useEffect(() => {
    if (!stateAbbr || dismissed) return;
    
    const checkActiveSessions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        console.log(`🔍 Checking sessions for ${stateAbbr}`);
        
        const response = await fetch(`${API_URL}/api/legiscan/session-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            states: [stateAbbr],
            include_all_sessions: false
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📊 Session check response:', data);
        
        if (data.success) {
          setSessionData(data);
        } else {
          setError(data.error || 'Failed to check session status');
        }
        
      } catch (err) {
        console.error('❌ Session check failed:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    checkActiveSessions();
  }, [stateAbbr, dismissed]);

  // Don't render if dismissed, not visible, or no state
  if (dismissed || !visible || !stateAbbr) {
    return null;
  }

  // Don't render during loading unless there's an error
  if (loading && !error) {
    return (
      <div className="bg-gray-50 dark:bg-slate-700 border border-gray-300 dark:border-slate-500 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3">
          <RotateCw size={16} className="text-gray-600 dark:text-gray-300 animate-spin" />
          <span className="text-sm text-gray-700 dark:text-gray-200">Checking for active legislative sessions...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle size={16} className="text-yellow-600 dark:text-yellow-400 mt-0.5" />
            <div>
              <p className="text-sm text-yellow-700 dark:text-yellow-200 font-medium">
                Unable to check session status
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-300 mt-1">
                {error}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="text-yellow-400 dark:text-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-400 ml-4"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    );
  }

  // Don't render if no session data or no active sessions
  if (!sessionData || !sessionData.active_sessions || Object.keys(sessionData.active_sessions).length === 0) {
    return null;
  }

  const activeSessions = sessionData.active_sessions[stateAbbr] || [];
  
  if (activeSessions.length === 0) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleToggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Check if any session is currently active
  const hasActiveSession = activeSessions.some(session => isSessionCurrentlyActive(session));
  
  return (
    <div className="bg-gray-50 dark:bg-slate-700 border-gray-300 dark:border-slate-500 border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        {/* Left content - left aligned */}
        <div className="flex items-center gap-3">
          <div className="bg-gray-100 dark:bg-slate-600 rounded-full p-1">
            <Calendar size={14} className="text-gray-600 dark:text-gray-300" />
          </div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
              Active Legislative Session
            </h3>
            <div className="flex items-center gap-1" title={hasActiveSession ? "Legislative session is currently in progress" : "Legislative session is scheduled/planned"}>
              <div className={`w-2 h-2 rounded-full ${hasActiveSession ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className={`text-xs font-medium ${hasActiveSession ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {hasActiveSession ? 'IN SESSION' : 'SCHEDULED'}
              </span>
            </div>
          </div>
        </div>
        
        {/* Right expand button */}
        <div className="flex items-center justify-center flex-shrink-0">
          <button
            onClick={handleToggleExpanded}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
            title={expanded ? "Collapse details" : "Expand details"}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>
      
      {/* Expanded content */}
      {expanded && (
        <div className="mt-4">
          <div className="space-y-2">
                {activeSessions.map((session, index) => (
                  <div key={session.session_id || index} className="text-sm text-gray-700 dark:text-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin size={12} className="text-gray-600 dark:text-gray-300" />
                      <span className="font-medium">{stateName}</span>
                      <span className={session.session_name.toLowerCase().includes('special') ? 'text-purple-600' : 'text-blue-600'}>•</span>
                      <span className={session.session_name.toLowerCase().includes('special') ? 'text-purple-700 dark:text-purple-300' : 'text-blue-700 dark:text-blue-300'}>{session.session_name}</span>
                    </div>
                    
                    <div className="ml-5 space-y-1">
                      {/* Session Status Indicator */}
                      <div className="flex items-center gap-2 text-xs">
                        <Clock size={10} />
                        <span className="font-medium text-gray-700 dark:text-gray-200">Status:</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          isSessionCurrentlyActive(session) 
                            ? session.session_name.toLowerCase().includes('special') ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}>
                          {isSessionCurrentlyActive(session) ? 'Currently Active' : 'Scheduled/Planned'}
                        </span>
                      </div>

                      {/* Session Years */}
                      {session.year_start && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <Calendar size={10} />
                          <span className="font-medium">Session Year:</span>
                          <span>
                            {session.year_start}
                            {session.year_end && session.year_end !== session.year_start && 
                              ` - ${session.year_end}`
                            }
                          </span>
                        </div>
                      )}
                      
                      {/* Specific Session Dates */}
                      {(session.session_start_date || session.session_end_date) && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <Calendar size={10} />
                          <span className="font-medium">Session Period:</span>
                          <span>
                            {formatDate(session.session_start_date) || 'Start TBD'}
                            {session.session_start_date && session.session_end_date && ' - '}
                            {session.session_end_date && formatDate(session.session_end_date)}
                            {session.session_start_date && !session.session_end_date && !session.sine_die && ' (ongoing)'}
                          </span>
                        </div>
                      )}
                      
                      {/* Sine Die Date (adjournment) */}
                      {session.sine_die && formatDate(session.sine_die) && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <Calendar size={10} />
                          <span className="font-medium">Adjournment:</span>
                          <span>
                            {formatDate(session.sine_die)}
                            {(() => {
                              const formattedDate = formatDate(session.sine_die);
                              if (!formattedDate) return '';
                              const sineDate = new Date(session.sine_die);
                              return sineDate > new Date() ? ' (scheduled)' : '';
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-300">
                  <p>
                    📋 Legislative activity is currently ongoing. 
                    {activeSessions.length > 1 
                      ? ` ${activeSessions.length} active sessions detected.`
                      : ' New bills and updates may be available.'
                    }
                  </p>
                </div>
            
            {/* Refresh invitation when updates available */}
            {hasUpdates && onRefreshNeeded && (
              <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-blue-700 dark:text-blue-200 font-medium">
                    📢 New updates available
                  </span>
                  <button
                    onClick={onRefreshNeeded}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline font-medium"
                  >
                    Refresh now
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionNotification;