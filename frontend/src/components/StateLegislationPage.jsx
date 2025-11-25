import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  MapPin,
  Users,
  Calendar,
  TrendingUp,
  Search,
  Filter,
  ExternalLink,
  ArrowRight,
  BarChart3,
  Building,
  GraduationCap,
  HeartPulse,
  Wrench,
  ChevronRight,
  Sparkles,
  Target,
  Globe,
  Star,
  AlertCircle,
  UserCheck,
  Activity,
  CalendarDays,
  Clock
} from 'lucide-react';
import StateOutlineBackground from './StateOutlineBackground';
import { getTextClasses, getPageContainerClasses, getCardClasses } from '../utils/darkModeClasses';
import { usePageTracking } from '../hooks/usePageTracking';
import { trackPageView } from '../utils/analytics';
import API_URL from '../config/api';

const StateLegislationOverview = () => {
  const navigate = useNavigate();
  
  // Track page view for state legislation overview
  usePageTracking('State Legislation Overview');
  
  // Handle state navigation with analytics tracking
  const handleStateNavigation = (stateName) => {
    // Track the state selection
    trackPageView(`State Selection - ${stateName}`, `/state/${stateName.toLowerCase().replace(' ', '-')}`);
    
    // Navigate to the state page
    navigate(`/state/${stateName.toLowerCase().replace(' ', '-')}`);
  };
  
  const [sessionData, setSessionData] = useState({});
  const [billSessionData, setBillSessionData] = useState({});
  const [loadingSessions, setLoadingSessions] = useState(true);

  // Supported states data
  const supportedStates = [
    {
      name: 'California',
      code: 'CA',
      region: 'West',
      population: '39.5M',
      governor: 'Gavin Newsom',
      activeBills: 1247,
      recentActivity: '2 hours ago',
      description: 'Comprehensive coverage of California state legislation including environmental, tech, and healthcare policies.',
      color: 'bg-blue-500',
      stats: {
        civic: 324,
        education: 189,
        engineering: 298,
        healthcare: 436
      }
    },
    {
      name: 'Colorado',
      code: 'CO',
      region: 'West',
      population: '5.8M',
      governor: 'Jared Polis',
      activeBills: 592,
      recentActivity: '4 hours ago',
      description: 'Track Colorado legislation covering energy, environmental regulations, and social policies.',
      color: 'bg-green-500',
      stats: {
        civic: 156,
        education: 98,
        engineering: 142,
        healthcare: 196
      }
    },
    {
      name: 'Kentucky',
      code: 'KY',
      region: 'South',
      population: '4.5M',
      governor: 'Andy Beshear',
      activeBills: 378,
      recentActivity: '6 hours ago',
      description: 'Monitor Kentucky state bills focusing on agriculture, healthcare, and economic development.',
      color: 'bg-purple-500',
      stats: {
        civic: 98,
        education: 67,
        engineering: 89,
        healthcare: 124
      }
    },
    {
      name: 'Nevada',
      code: 'NV',
      region: 'West',
      population: '3.2M',
      governor: 'Joe Lombardo',
      activeBills: 445,
      recentActivity: '3 hours ago',
      description: 'Coverage of Nevada legislation including gaming regulations, energy, and tourism policies.',
      color: 'bg-orange-500',
      stats: {
        civic: 112,
        education: 78,
        engineering: 98,
        healthcare: 157
      }
    },
    {
      name: 'South Carolina',
      code: 'SC',
      region: 'South',
      population: '5.2M',
      governor: 'Henry McMaster',
      activeBills: 521,
      recentActivity: '5 hours ago',
      description: 'Track South Carolina bills covering manufacturing, agriculture, and coastal regulations.',
      color: 'bg-red-500',
      stats: {
        civic: 134,
        education: 89,
        engineering: 124,
        healthcare: 174
      }
    },
    {
      name: 'Texas',
      code: 'TX',
      region: 'South',
      population: '30.0M',
      governor: 'Greg Abbott',
      activeBills: 1856,
      recentActivity: '1 hour ago',
      description: 'Comprehensive Texas legislation tracking including energy, border policies, and business regulations.',
      color: 'bg-indigo-500',
      stats: {
        civic: 485,
        education: 298,
        engineering: 412,
        healthcare: 661
      }
    }
  ];

  // Fetch session data for all states
  useEffect(() => {
    const fetchSessionData = async () => {
      setLoadingSessions(true);
      try {
        const stateCodes = supportedStates.map(state => state.code);
        const response = await fetch(`${API_URL}/api/legiscan/session-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            states: stateCodes,
            include_all_sessions: true
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          // Session response processed successfully
          
          if (data.success && data.active_sessions) {
            setSessionData(data.active_sessions);
          }
        }
      } catch (error) {
        console.error('Failed to fetch session data:', error);
      } finally {
        setLoadingSessions(false);
      }
    };
    
    fetchSessionData();
    
    // Also fetch sessions from bills data for all states
    const fetchBillSessions = async () => {
      // Add a small delay to ensure bills are available
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        // Fetch bills for each state to see what sessions are in the data
        for (const state of supportedStates) {
          const response = await fetch(`${API_URL}/api/state-legislation?state=${state.name}&page=1&per_page=25`);
          if (response.ok) {
            const data = await response.json();
            const sessions = new Set();
            
            if (data.orders && Array.isArray(data.orders)) {
              data.orders.forEach(bill => {
                const sessionName = bill.session || bill.session_name;
                if (sessionName && sessionName !== 'Unknown Session') {
                  sessions.add(sessionName);
                }
              });
            }
            
            if (sessions.size > 0) {
              // Sessions extracted from bills data
              setBillSessionData(prev => ({ ...prev, [state.code]: Array.from(sessions) }));
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch bill sessions:', error);
      }
    };
    
    fetchBillSessions();
  }, []);

  // Helper function to get session info for a state
  const getStateSessionInfo = (stateCode) => {
    const apiSessions = sessionData[stateCode] || [];
    const billSessions = billSessionData[stateCode] || [];
    
    // Create a map to merge sessions
    const sessionMap = new Map();
    
    // Add API sessions
    apiSessions.forEach(session => {
      sessionMap.set(session.session_id || session.session_name, session);
    });
    
    // Add sessions from bills that aren't in the API
    billSessions.forEach(sessionName => {
      if (!Array.from(sessionMap.values()).some(s => s.session_name === sessionName)) {
        // Extract year from session name
        const yearMatch = sessionName.match(/(\d{2,4})/);
        let year = yearMatch ? parseInt(yearMatch[1]) : new Date().getFullYear();
        
        // Handle legislature numbers (e.g., "88th Legislature" = 2023-2024)
        if (yearMatch && yearMatch[1].length === 2 && parseInt(yearMatch[1]) > 50) {
          // For Texas, 88th Legislature is 2023-2024
          const legislatureNum = parseInt(yearMatch[1]);
          year = 1789 + (legislatureNum - 1) * 2; // Texas legislature starts in 1789, biennial
        } else if (year < 100) {
          year = 2000 + year; // Handle 2-digit years
        }
        
        sessionMap.set(sessionName, {
          session_id: sessionName,
          session_name: sessionName,
          year_start: sessionName.toLowerCase().includes('special') ? new Date().getFullYear() : year,
          is_active: true, // Assume active if found in recent bills
          is_likely_active: true,
          state: stateCode
        });
      }
    });
    
    const allSessions = Array.from(sessionMap.values());
    
    // More inclusive check for active sessions
    const currentYear = new Date().getFullYear();
    const activeSessions = allSessions.filter(s => {
      // Check explicit active flags
      if (s.is_active || s.is_likely_active) return true;
      
      // Special sessions are always considered active if recent
      if (s.session_name && s.session_name.toLowerCase().includes('special')) {
        // Check if it's from current or previous year
        if (!s.year_start || s.year_start >= currentYear - 1) {
          return true;
        }
      }
      
      // Check if session is recent (current or previous year)
      if (s.year_start && (s.year_start === currentYear || s.year_start === currentYear - 1)) {
        return true;
      }
      
      // For Texas specifically, include 88th and 89th legislature sessions
      if (stateCode === 'TX' && s.session_name) {
        if (s.session_name.includes('88th') || s.session_name.includes('89th')) {
          return true;
        }
      }
      
      return false;
    });
    
    const regularSessions = activeSessions.filter(s => !s.session_name.toLowerCase().includes('special'));
    const specialSessions = activeSessions.filter(s => s.session_name.toLowerCase().includes('special'));
    
    // Combined sessions processed successfully
    
    return {
      totalActive: activeSessions.length,
      regular: regularSessions.length,
      special: specialSessions.length,
      sessions: activeSessions
    };
  };

  // Show all states (removed region filter)
  const filteredStates = supportedStates;

  // Calculate totals
  const totalStates = supportedStates.length;

  return (
    <div className={getPageContainerClasses()}>
      {/* Header Section */}
      <section className="relative overflow-hidden px-6 pt-12 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <h1 className={getTextClasses('primary', 'text-4xl md:text-6xl font-bold mb-6 leading-tight')}>
              <span className="block">State Legislation</span>
              <span className="block bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent py-2">Overview</span>
            </h1>
            
            <p className={getTextClasses('secondary', 'text-xl mb-8 max-w-3xl mx-auto leading-relaxed')}>
              Access comprehensive legislative tracking across {totalStates} states with AI-powered analysis and real-time updates.
            </p>
          </div>
          
        </div>
      </section>

      {/* States Grid */}
      <section className="py-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredStates.map((state, index) => (
              <div
                key={state.code}
                className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-500 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full"
              >
                {/* State Header */}
                <div className="p-8 flex-grow flex flex-col">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 ${state.color} rounded-2xl flex items-center justify-center shadow-lg`}>
                        <StateOutlineBackground 
                          stateName={state.name} 
                          className="w-10 h-10 text-white"
                          isIcon={true}
                        />
                      </div>
                      <div>
                        <h3 className={`text-2xl font-bold mb-1 ${getTextClasses('primary')}`}>{state.name}</h3>
                        <div className={`flex items-center gap-2 text-sm mb-1 ${getTextClasses('secondary')}`}>
                          <UserCheck size={14} />
                          <span>{state.governor}</span>
                        </div>
                        <div className={`flex items-center gap-2 text-sm ${getTextClasses('secondary')}`}>
                          <Users size={14} />
                          <span>{state.population} population</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  
                  <p className={`leading-relaxed mb-6 flex-grow ${getTextClasses('secondary')}`}>
                    {state.description}
                  </p>
                  
                  {/* Legislative Sessions - Fixed position from bottom */}
                  <div className="space-y-3 mb-6">
                    <h4 className={`text-sm font-semibold mb-3 ${getTextClasses('primary')}`}>Legislative Sessions</h4>
                    {loadingSessions ? (
                      <div className="animate-pulse space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
                      </div>
                    ) : (() => {
                      const sessionInfo = getStateSessionInfo(state.code);
                      
                      if (sessionInfo.totalActive === 0) {
                        return (
                          <div className={`text-sm ${getTextClasses('secondary')} italic`}>
                            No active sessions
                          </div>
                        );
                      }
                      
                      return (
                        <div className="space-y-2">
                          {sessionInfo.sessions.slice(0, 3).map((session, idx) => (
                            <div key={idx} className="flex items-start gap-2">
                              <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                                session.session_name.toLowerCase().includes('special') 
                                  ? 'bg-purple-500 animate-pulse' 
                                  : 'bg-green-500 animate-pulse'
                              }`}></div>
                              <div className="flex-1">
                                <div className={`text-sm font-medium ${getTextClasses('primary')}`}>
                                  {session.session_name}
                                </div>
                                {session.year_start && (
                                  <div className={`text-xs ${getTextClasses('secondary')}`}>
                                    {session.year_start}{session.year_end && session.year_end !== session.year_start ? `-${session.year_end}` : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {sessionInfo.totalActive > 3 && (
                            <div className={`text-xs ${getTextClasses('secondary')} italic`}>
                              +{sessionInfo.totalActive - 3} more session{sessionInfo.totalActive - 3 > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Action Button */}
                  <div>
                    <button
                      onClick={() => handleStateNavigation(state.name)}
                      className="w-full bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-400 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                    >
                      <span>{state.name} Legislation</span>
                      <ArrowRight size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* No Results */}
          {filteredStates.length === 0 && (
            <div className="text-center py-12">
              <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
              <h3 className={`text-lg font-semibold mb-2 ${getTextClasses('primary')}`}>No States Found</h3>
              <p className={getTextClasses('secondary')}>
                No states are currently available.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Request Another State Section */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-500 rounded-2xl p-8 shadow-lg">
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <MapPin size={32} className="text-blue-600 dark:text-blue-400" />
            </div>
            
            <h2 className={`text-3xl font-bold mb-4 ${getTextClasses('primary')}`}>
              Need Coverage for Another State?
            </h2>
            
            <p className={`text-xl mb-8 leading-relaxed ${getTextClasses('secondary')}`}>
              Don't see your state listed? We're continuously expanding our coverage. 
              Let us know which state you'd like us to prioritize next.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={() => window.location.href = 'mailto:david4nderson@pm.me?subject=State Coverage Request'}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                <Globe size={20} />
                Request State Coverage
              </button>

              <button
                onClick={() => window.location.href = 'mailto:david4nderson@pm.me?subject=General Inquiry'}
                className="border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 px-8 py-4 rounded-xl font-semibold hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300 flex items-center gap-2"
              >
                <Users size={20} />
                Contact Support
              </button>
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p className={`text-sm ${getTextClasses('muted')}`}>
                Current expansion timeline: New states added quarterly based on user requests and legislative activity.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default StateLegislationOverview;