import React, { useState, useRef, useEffect } from 'react';
import { Calendar, CalendarDays, ChevronDown, Check } from 'lucide-react';

const SessionFilter = ({ 
  sessions = [], 
  selectedSessions = [], 
  onSessionChange, 
  disabled = false,
  loading = false,
  sessionCounts = {}
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get unique sessions from bills
  const uniqueSessions = Array.from(
    new Map(sessions.map(session => [session.session_id, session])).values()
  ).sort((a, b) => {
    // Sort by year (descending) then by session type
    const yearDiff = (b.year_start || 0) - (a.year_start || 0);
    if (yearDiff !== 0) return yearDiff;
    
    // Regular sessions before special sessions
    if (a.session_name.includes('Special') && !b.session_name.includes('Special')) return 1;
    if (!a.session_name.includes('Special') && b.session_name.includes('Special')) return -1;
    
    return a.session_name.localeCompare(b.session_name);
  });

  const handleSessionToggle = (sessionId) => {
    if (disabled) return;
    
    const newSelection = selectedSessions.includes(sessionId)
      ? selectedSessions.filter(id => id !== sessionId)
      : [...selectedSessions, sessionId];
    
    onSessionChange(newSelection);
  };

  const getButtonLabel = () => {
    if (selectedSessions.length === 0) {
      return 'All Sessions';
    } else if (selectedSessions.length === 1) {
      const session = uniqueSessions.find(s => s.session_id === selectedSessions[0]);
      if (session) {
        // Shorten long session names for button display
        let shortName = session.session_name;
        
        // Extract year and session type for shorter display
        const yearMatch = shortName.match(/(\d{2,4})/);
        const year = yearMatch ? yearMatch[1] : '';
        
        if (shortName.toLowerCase().includes('special')) {
          return year ? `${year} Special` : 'Special Session';
        } else if (shortName.toLowerCase().includes('regular')) {
          return year ? `${year} Regular` : 'Regular Session';
        } else {
          // Fallback: truncate if still too long
          return shortName.length > 20 ? shortName.substring(0, 17) + '...' : shortName;
        }
      }
      return 'Session Filter';
    } else {
      return `${selectedSessions.length} Sessions`;
    }
  };

  const getButtonIconColor = () => {
    if (selectedSessions.length === 1) {
      const session = uniqueSessions.find(s => s.session_id === selectedSessions[0]);
      if (session && session.session_name.toLowerCase().includes('special')) {
        return 'text-purple-600 dark:text-purple-400';
      }
      return 'text-blue-600 dark:text-blue-400';
    }
    return 'text-gray-500 dark:text-gray-300';
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={`flex items-center justify-center xl:justify-between px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium bg-white dark:bg-dark-bg-secondary text-gray-900 dark:text-white transition-all duration-300 w-full xl:w-auto h-[44px] ${
          disabled || loading 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
        } ${selectedSessions.length > 0 ? 'ring-2 ring-blue-500 dark:ring-blue-400 border-blue-500 dark:border-blue-400' : ''}`}
      >
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className={getButtonIconColor()} />
          <span className="whitespace-nowrap">{getButtonLabel()}</span>
        </div>
        <ChevronDown 
          size={16} 
          className={`ml-4 text-gray-500 dark:text-gray-300 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute top-full mt-2 bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[120] w-full xl:w-max xl:min-w-[480px] xl:max-w-[600px] max-h-[400px] overflow-hidden left-0 xl:left-auto xl:right-0">
          <div className="sticky top-0 bg-gray-50 dark:bg-dark-bg-secondary px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Filter by Legislative Session
              </span>
              {selectedSessions.length > 0 && (
                <button
                  onClick={() => onSessionChange([])}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          
          <div className="overflow-y-auto max-h-[320px]">
            {uniqueSessions.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No sessions available
              </div>
            ) : (
              <div className="py-1">
                {uniqueSessions.map((session) => {
                  const isSelected = selectedSessions.includes(session.session_id);
                  const isSpecial = session.session_name.includes('Special');
                  const isActive = session.is_active || session.is_likely_active;
                  
                  return (
                    <button
                      key={session.session_id}
                      onClick={() => handleSessionToggle(session.session_id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 flex items-center justify-between group ${
                        isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium whitespace-nowrap ${
                            isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
                          }`}>
                            {session.session_name}
                          </span>
                          {isSpecial && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                              Special
                            </span>
                          )}
                          {isActive && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        {session.year_start && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {session.year_start}
                            {session.year_end && session.year_end !== session.year_start && 
                              ` - ${session.year_end}`
                            }
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        {/* Bill Count */}
                        <span className={`text-sm px-2 py-1 rounded-full font-medium ${
                          isSelected 
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
                        }`}>
                          {(sessionCounts[session.session_id] || 0).toLocaleString()}
                        </span>
                        
                        {/* Check Mark */}
                        <div className={`${
                          isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
                        }`}>
                          <Check size={16} className="text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionFilter;