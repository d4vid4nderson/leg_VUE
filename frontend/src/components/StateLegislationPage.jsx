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
  UserCheck
} from 'lucide-react';
import StateOutlineBackground from './StateOutlineBackground';

const StateLegislationOverview = () => {
  const navigate = useNavigate();

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

  // Show all states (removed region filter)
  const filteredStates = supportedStates;

  // Calculate totals
  const totalStates = supportedStates.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-blue-50">
      {/* Header Section */}
      <section className="relative overflow-hidden px-6 pt-20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <FileText size={16} />
              State Legislative Tracking
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              <span className="block">State Legislation</span>
              <span className="block bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent py-2">Overview</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
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
                className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300 flex flex-col h-full"
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
                        <h3 className="text-2xl font-bold text-gray-900 mb-1">{state.name}</h3>
                        <div className="flex items-center gap-2 text-gray-600 text-sm mb-1">
                          <UserCheck size={14} />
                          <span>{state.governor}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                          <Users size={14} />
                          <span>{state.population} population</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  
                  <p className="text-gray-600 leading-relaxed mb-6 flex-grow">
                    {state.description}
                  </p>
                  
                  {/* Practice Areas Stats - Fixed position from bottom */}
                  <div className="space-y-3 mb-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Bills by Practice Area</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building size={16} className="text-blue-600" />
                          <span className="text-sm text-gray-700">Civic</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{state.stats.civic}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GraduationCap size={16} className="text-orange-600" />
                          <span className="text-sm text-gray-700">Education</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{state.stats.education}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Wrench size={16} className="text-green-600" />
                          <span className="text-sm text-gray-700">Engineering</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{state.stats.engineering}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <HeartPulse size={16} className="text-red-600" />
                          <span className="text-sm text-gray-700">Healthcare</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{state.stats.healthcare}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  <div>
                    <button
                      onClick={() => navigate(`/state/${state.name.toLowerCase().replace(' ', '-')}`)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
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
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No States Found</h3>
              <p className="text-gray-600">
                No states are currently available.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Request Another State Section */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <MapPin size={32} className="text-blue-600" />
            </div>
            
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Need Coverage for Another State?
            </h2>
            
            <p className="text-xl text-gray-600 mb-8 leading-relaxed">
              Don't see your state listed? We're continuously expanding our coverage. 
              Let us know which state you'd like us to prioritize next.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={() => window.location.href = 'mailto:support@legislationvue.com?subject=State Coverage Request'}
                className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                <Globe size={20} />
                Request State Coverage
              </button>
              
              <button 
                onClick={() => window.location.href = 'mailto:support@legislationvue.com?subject=General Inquiry'}
                className="border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-xl font-semibold hover:border-blue-500 hover:text-blue-600 transition-all duration-300 flex items-center gap-2"
              >
                <Users size={20} />
                Contact Support
              </button>
            </div>
            
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-gray-500 text-sm">
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