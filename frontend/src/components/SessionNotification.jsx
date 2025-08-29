import React, { useState, useEffect } from 'react';
import { AlertCircle, X, Calendar, MapPin, ExternalLink, RotateCw, Clock, ChevronUp, ChevronDown, CalendarDays } from 'lucide-react';
import API_URL from '../config/api';

console.log('📦 SessionNotification.jsx module loaded');

const SessionNotification = ({ 
    stateName, 
    stateAbbr, 
    visible = true, 
    onRefreshNeeded = null,
    hasUpdates = false,
    onSessionRefresh = null,
    sessionRefreshing = false
}) => {
  console.log('🚀 SessionNotification component called with:', { stateName, stateAbbr, visible });
  
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
    // IMPORTANT: Check sine_die flag first - if it's 1, session is CLOSED
    if (session.sine_die === 1 || session.sine_die === '1') {
      console.log(`Session ${session.session_name} is CLOSED (sine_die=1)`);
      return false; // Session is closed per LegiScan API
    }
    
    // Check if session has is_active flag from backend
    if (session.is_active !== undefined && session.is_active !== null) {
      console.log(`Session ${session.session_name} is_active flag: ${session.is_active}`);
      return session.is_active;
    }
    
    // For sessions with sine_die = 0, they are active
    if (session.sine_die === 0 || session.sine_die === '0') {
      console.log(`Session ${session.session_name} is ACTIVE (sine_die=0)`);
      return true;
    }
    
    // Fallback for sessions without sine_die info
    const now = new Date();
    const currentYear = now.getFullYear();
    const isRecent = session.year_start === currentYear || session.year_start === currentYear - 1;
    console.log(`Session ${session.session_name} fallback: isRecent=${isRecent}`);
    return isRecent;
  };
  
  // Helper function to determine if session is closed
  const isSessionClosed = (session) => {
    // Session is closed if sine_die flag is 1
    const isClosed = session.sine_die === 1 || session.sine_die === '1';
    console.log(`Session ${session.session_name} closed check: sine_die=${session.sine_die}, isClosed=${isClosed}`);
    return isClosed;
  };

  // Check for active sessions when component mounts or state changes
  useEffect(() => {
    if (!stateAbbr || dismissed) return;
    
    const checkActiveSessions = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Session checking in progress
        
        const response = await fetch(`${API_URL}/api/legiscan/session-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            states: [stateAbbr],
            include_all_sessions: true  // Changed to true to get all sessions including special
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        // Removed verbose session logging to reduce console noise
        
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
    console.log('❌ SessionNotification early return:', { dismissed, visible, stateAbbr });
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

  // Debug logging to see what data we have
  console.log('SessionNotification sessionData:', sessionData);
  console.log('stateAbbr:', stateAbbr);
  if (sessionData) {
    console.log('active_sessions keys:', Object.keys(sessionData.active_sessions || {}));
    console.log('all_sessions keys:', Object.keys(sessionData.all_sessions || {}));
    console.log(`Sessions for ${stateAbbr}:`, {
      active: sessionData.active_sessions?.[stateAbbr],
      all: sessionData.all_sessions?.[stateAbbr]
    });
  }

  // Don't render if no session data
  if (!sessionData) {
    console.log('No sessionData - returning null');
    return null;
  }

  // Get all sessions (both active and closed) to display them properly
  const activeSessions = sessionData.active_sessions?.[stateAbbr] || [];
  const allSessions = sessionData.all_sessions?.[stateAbbr] || [];
  
  // Use all_sessions if available (includes both active and closed), otherwise fall back to active_sessions
  const rawSessions = allSessions.length > 0 ? allSessions : activeSessions;
  
  // Filter out specific closed sessions that we don't want to display
  const sessionsToDisplay = rawSessions.filter(session => 
    session.session_name !== '89th Legislature 1st Special Session'
  );
  
  console.log(`Sessions to display for ${stateAbbr}:`, sessionsToDisplay);
  
  // Show a message when there are no sessions instead of hiding component
  const showNoSessionsMessage = sessionsToDisplay.length === 0;

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleToggleExpanded = () => {
    setExpanded(!expanded);
  };

  // Check if any session is currently active
  const hasActiveSession = sessionsToDisplay.some(session => isSessionCurrentlyActive(session));
  
  return (
    <div className="bg-gray-50 dark:bg-slate-700 border-gray-300 dark:border-slate-500 border rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        {/* Left content - left aligned */}
        <div className="flex items-center gap-3">
          <div className="bg-gray-100 dark:bg-slate-600 rounded-full p-1">
            <Calendar size={14} className="text-gray-600 dark:text-gray-300" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white whitespace-nowrap">
              Legislative Session{sessionsToDisplay.length > 1 ? 's' : ''} Status
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1" title={hasActiveSession ? "Legislative session is currently in progress" : "Legislative session is scheduled/planned"}>
                <div className={`w-2 h-2 rounded-full ${hasActiveSession ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className={`text-xs font-medium ${hasActiveSession ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                  {hasActiveSession ? 'ACTIVE SESSIONS' : 'SESSIONS'}
                </span>
              </div>
              {sessionsToDisplay.length > 1 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  ({sessionsToDisplay.length} sessions)
                </span>
              )}
            </div>
          </div>
        </div>
        
        {/* Right buttons - Expand/Collapse */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Expand/Collapse Button */}
          <button
            onClick={handleToggleExpanded}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors p-1"
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
            {showNoSessionsMessage ? (
              <div className="text-sm text-gray-600 dark:text-gray-300 text-center py-4">
                <Calendar size={16} className="mx-auto mb-2 text-gray-400" />
                <p>No legislative sessions detected for {stateName}</p>
                <p className="text-xs mt-1">Sessions may not be available in our current data</p>
              </div>
            ) : (
              sessionsToDisplay.map((session, index) => {
                  // Debug logging
                  console.log(`Session ${session.session_name}: sine_die=${session.sine_die}, is_active=${session.is_active}, closed=${isSessionClosed(session)}, active=${isSessionCurrentlyActive(session)}`);
                  
                  return (
                  <div key={session.session_id || index} className="text-sm text-gray-700 dark:text-gray-200">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin size={12} className="text-gray-600 dark:text-gray-300" />
                      <span className="font-medium">{stateName}</span>
                      <span className={session.session_name.toLowerCase().includes('special') ? 'text-purple-700 dark:text-purple-300' : 'text-blue-700 dark:text-blue-300'}>{session.session_name}</span>
                    </div>
                    
                    <div className="ml-5 space-y-1">
                      {/* Session Status Indicator with colored dots */}
                      <div className="flex items-center gap-2 text-xs">
                        {/* Bigger status dot with better alignment */}
                        <div className="flex items-center justify-center w-4 h-4">
                          <div 
                            className={`w-3 h-3 rounded-full flex-shrink-0 ${
                              isSessionClosed(session) 
                                ? 'bg-red-500' 
                                : isSessionCurrentlyActive(session)
                                  ? session.session_name.toLowerCase().includes('special') 
                                    ? 'bg-purple-500' 
                                    : 'bg-green-500'
                                  : 'bg-gray-400'
                            }`}
                            style={{
                              animation: isSessionCurrentlyActive(session) && !isSessionClosed(session) 
                                ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' 
                                : 'none'
                            }}
                            title={
                            isSessionClosed(session) 
                              ? 'Session closed' 
                              : isSessionCurrentlyActive(session) 
                                ? 'Session active' 
                                : 'Session scheduled'
                          }></div>
                        </div>
                        
                        <span className="font-medium text-gray-700 dark:text-gray-200">Status:</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          isSessionClosed(session)
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200'
                            : isSessionCurrentlyActive(session) 
                              ? session.session_name.toLowerCase().includes('special') 
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200' 
                                : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}>
                          {isSessionClosed(session) 
                            ? 'CLOSED' 
                            : isSessionCurrentlyActive(session) 
                              ? session.session_name.toLowerCase().includes('special')
                                ? 'ACTIVE (Special)'
                                : 'ACTIVE' 
                              : 'SCHEDULED'}
                        </span>
                      </div>

                      {/* Session Years */}
                      {session.year_start && (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <Calendar size={10} />
                          <span className="font-medium">Session Year:</span>
                          <span>
                            {session.year_start}
                            {session.year_end && session.year_end !== session.year_start && session.year_end > 0 
                              ? ` - ${session.year_end}`
                              : ''
                            }
                          </span>
                        </div>
                      )}
                      
                      {/* Specific Session Dates */}
                      {(session.session_start_date || session.session_end_date) ? (
                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <Calendar size={10} />
                          <span className="font-medium">Session Period:</span>
                          <span>
                            {formatDate(session.session_start_date) || 'Start TBD'}
                            {session.session_start_date && session.session_end_date ? ' - ' : ''}
                            {session.session_end_date ? formatDate(session.session_end_date) : ''}
                            {session.session_start_date && !session.session_end_date && !session.sine_die ? ' (ongoing)' : ''}
                          </span>
                        </div>
                      ) : null}
                      
                      {/* Sine Die Date (adjournment) */}
                      {session.sine_die && formatDate(session.sine_die) ? (
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
                      ) : null}
                    </div>
                  </div>
                  );
              })
            )}
                
            {/* Show session summary only if there are sessions */}
            {!showNoSessionsMessage && (
              <div className="mt-3 text-xs text-gray-600 dark:text-gray-300">
                <p>
                  📋 Legislative activity is currently ongoing. 
                  {sessionsToDisplay.length > 1 
                    ? ` ${sessionsToDisplay.length} sessions detected.`
                    : ' New bills and updates may be available.'
                  }
                </p>
              </div>
            )}
            
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