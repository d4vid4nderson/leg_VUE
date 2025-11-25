// src/components/ApplicationInfoModal.jsx
import React, { useState } from 'react';
import { 
  X, 
  Info, 
  ScrollText, 
  FileText, 
  Star, 
  Building, 
  GraduationCap, 
  Heart, 
  Wrench,
  Play,
  Database,
  Globe,
  HelpCircle,
  Mail,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  Zap,
  Shield,
  BarChart3,
  Users,
  Sparkle,
  Lightbulb,
  Phone,
  MapPin,
  Calendar,
  Award,
  Target,
  Rocket,
  Terminal,     // Command line terminal
  GitBranch,    // Git/version control
  Laptop,       // Development machine
  Monitor,      // Computer screen
  Hammer,       // Building/construction
  Bug,          // Bug fixing/debugging
  Cpu,          // Processor/technical
  HardDrive,    // Technical/system
  Clock,        // Time/clock icon
  UserCheck,    // User/governor icon
  Users as UsersIcon, // Population icon
  Filter        // Filter icon
} from 'lucide-react';
import StateOutlineBackground from './StateOutlineBackground';

const ApplicationInfoModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen) return null;

  const tabs = [
    { id: 'overview', label: 'What is LegislationVUE', icon: Info },
    { id: 'technology', label: 'Technology & Data', icon: Database },
    { id: 'howto', label: 'How To Use', icon: Play },
    { id: 'faq', label: 'FAQ & Support', icon: HelpCircle }
  ];

  const TabButton = ({ tab, isActive, onClick }) => {
    const Icon = tab.icon;
    return (
      <button
        onClick={() => onClick(tab.id)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-all duration-300 text-sm ${
          isActive
            ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-lg'
            : 'text-gray-600 dark:text-dark-text-secondary dark:text-dark-text-secondary hover:text-gray-800 dark:hover:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg'
        }`}
      >
        <Icon className="w-4 h-4" />
        <span className="hidden sm:inline">{tab.label}</span>
      </button>
    );
  };

  const OverviewTab = () => (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 sm:p-6 md:p-8 border border-blue-200 dark:border-blue-700 shadow-lg">
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 mb-4 sm:mb-6 text-center sm:text-left">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
            <img src="/logo.png" alt="LegislationVUE" className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12" />
          </div>
          <div>
            <h3 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent">LegislationVUE</h3>
            <p className="text-base sm:text-lg text-indigo-700 dark:text-indigo-300 font-medium">AI-Powered Legislative Intelligence Platform</p>
          </div>
        </div>
        <div className="px-2 sm:px-4 md:px-6">
          <p className="text-gray-700 dark:text-dark-text-secondary text-base sm:text-lg md:text-xl leading-relaxed">
            Your comprehensive solution for tracking, analyzing, and understanding federal executive orders 
            and state legislation with advanced AI insights and business impact analysis.
          </p>
        </div>
      </div>

      {/* Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-6 shadow-sm border border-blue-200 dark:border-blue-700 hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-md">
              <ScrollText className="w-6 h-6 text-white" />
            </div>
            <h4 className="text-lg font-bold text-blue-800 dark:text-blue-300 dark:text-blue-300">Federal Executive Orders</h4>
          </div>
          <p className="text-gray-600 dark:text-dark-text-secondary dark:text-dark-text-secondary leading-relaxed">
            Real-time tracking of presidential executive orders with comprehensive AI analysis and business impact assessments.
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 shadow-sm border border-green-200 dark:border-green-700 hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-md">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h4 className="text-lg font-bold text-green-800 dark:text-green-300">State Legislation</h4>
          </div>
          <p className="text-gray-600 dark:text-dark-text-secondary leading-relaxed">
            Multi-state bill tracking across 6 key states with topic-based search and latest bill monitoring.
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-6 shadow-sm border border-purple-200 dark:border-purple-700 hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white text-sm font-bold">AI</span>
            </div>
            <h4 className="text-lg font-bold text-purple-800 dark:text-purple-300">AI-Powered Analysis</h4>
          </div>
          <p className="text-gray-600 dark:text-dark-text-secondary leading-relaxed">
            GPT-4o-mini powered summaries, key talking points, and detailed business impact analysis for every item.
          </p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl p-6 shadow-sm border border-yellow-200 dark:border-yellow-700 hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
              <Star className="w-6 h-6 text-white" />
            </div>
            <h4 className="text-lg font-bold text-yellow-800 dark:text-yellow-300">Smart Highlights</h4>
          </div>
          <p className="text-gray-600 dark:text-dark-text-secondary leading-relaxed">
            Save and organize important legislation with filtering, categorization, and export capabilities.
          </p>
        </div>
      </div>

      {/* Value Proposition */}
      <div className="bg-gradient-to-br from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 rounded-xl shadow-sm border border-red-200 dark:border-red-700 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
            <Target className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-red-800 dark:text-red-300">Why LegislationVUE?</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-2">Stay Compliant</h4>
            <p className="text-gray-600 dark:text-dark-text-secondary">Never miss critical legislative changes that affect your business</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-2">Make Informed Decisions</h4>
            <p className="text-gray-600 dark:text-dark-text-secondary">AI-powered insights help you understand business implications</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-400 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-2">Save Time</h4>
            <p className="text-gray-600 dark:text-dark-text-secondary">Automated tracking and analysis reduces research time by 90%</p>
          </div>
        </div>
      </div>
    </div>
  );

  const TechnologyTab = () => (
    <div className="space-y-8">
      {/* Tech Stack Overview */}
      <div className="bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 dark:from-cyan-900/20 dark:via-blue-900/20 dark:to-indigo-900/20 rounded-xl p-8 border border-cyan-200 dark:border-cyan-700 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">Technology Stack</h3>
        </div>
        <p className="text-gray-700 dark:text-dark-text-secondary text-lg leading-relaxed">
          LegislationVUE is built on cutting-edge technology to deliver reliable, fast, and intelligent legislative tracking.
        </p>
      </div>

      {/* Data Sources */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-900/20 dark:via-indigo-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-md">
            <Database className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-indigo-700 bg-clip-text text-transparent">Official Data Sources</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-md">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <h4 className="text-lg font-bold text-blue-800 dark:text-blue-300 dark:text-blue-300">Federal Register</h4>
            </div>
            <p className="text-gray-600 dark:text-dark-text-secondary mb-4 leading-relaxed">
              The official daily publication for rules, proposed rules, and notices of Federal agencies and organizations.
            </p>
            <a 
              href="https://www.federalregister.gov" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-300 font-medium transition-colors duration-200"
            >
              Visit Federal Register <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h4 className="text-lg font-bold text-green-800 dark:text-green-300">LegiScan API</h4>
            </div>
            <p className="text-gray-600 dark:text-dark-text-secondary mb-4 leading-relaxed">
              Comprehensive state legislation tracking service providing real-time updates on bills across all 50 states.
            </p>
            <a 
              href="https://legiscan.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 font-medium transition-colors duration-200"
            >
              Visit LegiScan <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* AI Technology */}
      <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-rose-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-rose-900/20 border border-purple-200 dark:border-purple-700 rounded-xl p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white text-sm font-bold">AI</span>
          </div>
          <h3 className="text-xl font-bold bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent">AI-Powered Analysis</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-3">Azure OpenAI Service</h4>
            <ul className="space-y-2 text-gray-600 dark:text-dark-text-secondary">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                GPT-4o-mini powered text analysis
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Advanced natural language processing
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Contextual understanding of legal documents
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-3">Analysis Capabilities</h4>
            <ul className="space-y-2 text-gray-600 dark:text-dark-text-secondary">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Automated executive summaries
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Key talking points extraction
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Business impact assessment
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Supported States */}
      <div className="bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-900/20 dark:via-green-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl flex items-center justify-center shadow-md">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-700 to-green-700 bg-clip-text text-transparent">Supported States & Jurisdictions</h3>
        </div>
        <div className="bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-xl p-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { name: 'California', code: 'CA', population: '39.5M', governor: 'Gavin Newsom', color: 'blue' },
              { name: 'Colorado', code: 'CO', population: '5.8M', governor: 'Jared Polis', color: 'green' },
              { name: 'Kentucky', code: 'KY', population: '4.5M', governor: 'Andy Beshear', color: 'purple' },
              { name: 'Nevada', code: 'NV', population: '3.2M', governor: 'Joe Lombardo', color: 'orange' },
              { name: 'South Carolina', code: 'SC', population: '5.2M', governor: 'Henry McMaster', color: 'red' },
              { name: 'Texas', code: 'TX', population: '30.0M', governor: 'Greg Abbott', color: 'indigo' }
            ].map((state) => {
              const getStateColors = (color) => {
                switch (color) {
                  case 'blue':
                    return {
                      bg: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20',
                      border: 'border-blue-200 dark:border-blue-700',
                      icon: 'bg-gradient-to-r from-blue-500 to-indigo-500',
                      text: 'text-blue-800 dark:text-blue-300 dark:text-blue-300',
                      code: 'text-blue-600 dark:text-blue-400',
                      iconSmall: 'text-blue-500 dark:text-blue-400'
                    };
                  case 'green':
                    return {
                      bg: 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
                      border: 'border-green-200 dark:border-green-700',
                      icon: 'bg-gradient-to-r from-green-500 to-emerald-500',
                      text: 'text-green-800 dark:text-green-300',
                      code: 'text-green-600 dark:text-green-400',
                      iconSmall: 'text-green-500 dark:text-green-400'
                    };
                  case 'purple':
                    return {
                      bg: 'bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-900/20 dark:to-violet-900/20',
                      border: 'border-purple-200 dark:border-purple-700',
                      icon: 'bg-gradient-to-r from-purple-500 to-violet-500',
                      text: 'text-purple-800 dark:text-purple-300',
                      code: 'text-purple-600 dark:text-purple-400',
                      iconSmall: 'text-purple-500 dark:text-purple-400'
                    };
                  case 'orange':
                    return {
                      bg: 'bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20',
                      border: 'border-orange-200 dark:border-orange-700',
                      icon: 'bg-gradient-to-r from-orange-500 to-amber-500',
                      text: 'text-orange-800 dark:text-orange-300',
                      code: 'text-orange-600 dark:text-orange-400',
                      iconSmall: 'text-orange-500 dark:text-orange-400'
                    };
                  case 'red':
                    return {
                      bg: 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20',
                      border: 'border-red-200 dark:border-red-700',
                      icon: 'bg-gradient-to-r from-red-500 to-rose-500',
                      text: 'text-red-800 dark:text-red-300',
                      code: 'text-red-600 dark:text-red-400',
                      iconSmall: 'text-red-500 dark:text-red-400'
                    };
                  case 'indigo':
                    return {
                      bg: 'bg-gradient-to-br from-indigo-50 to-slate-50 dark:from-indigo-900/20 dark:to-slate-900/20',
                      border: 'border-indigo-200 dark:border-indigo-700',
                      icon: 'bg-gradient-to-r from-indigo-500 to-slate-500',
                      text: 'text-indigo-800 dark:text-indigo-300',
                      code: 'text-indigo-600 dark:text-indigo-400',
                      iconSmall: 'text-indigo-500 dark:text-indigo-400'
                    };
                  default:
                    return {
                      bg: 'bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/20 dark:to-slate-900/20',
                      border: 'border-gray-200 dark:border-gray-700',
                      icon: 'bg-gradient-to-r from-gray-500 to-slate-500',
                      text: 'text-gray-800 dark:text-gray-300',
                      code: 'text-gray-600 dark:text-gray-400',
                      iconSmall: 'text-gray-500 dark:text-gray-400'
                    };
                }
              };
              const colors = getStateColors(state.color);
              return (
              <div key={state.code} className={`${colors.bg} border ${colors.border} rounded-xl p-4 hover:shadow-md transition-shadow duration-300 cursor-pointer group relative`} onClick={() => window.open(`/state/${state.name.toLowerCase().replace(' ', '-')}`, '_blank')}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-12 h-12 ${colors.icon} rounded-xl flex items-center justify-center shadow-md flex-shrink-0`}>
                    <StateOutlineBackground 
                      stateName={state.name} 
                      className="w-8 h-8 text-white"
                      isIcon={true}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className={`font-bold text-base ${colors.text} whitespace-nowrap`}>{state.name}</h4>
                    <p className={`text-sm ${colors.code}`}>{state.code}</p>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <ExternalLink size={16} className={colors.iconSmall} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-dark-text-secondary">
                    <UserCheck size={14} className={colors.iconSmall} />
                    <span>{state.governor}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-dark-text-secondary">
                    <UsersIcon size={14} className={colors.iconSmall} />
                    <span>{state.population} population</span>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
          <p className="text-gray-600 dark:text-dark-text-secondary text-center mt-6 font-medium">
            More states coming soon!
          </p>
        </div>
      </div>
    </div>
  );

  const HowToTab = () => (
    <div className="space-y-8">
      {/* Quick Start Guide */}
      <div className="bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-900/20 dark:via-green-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl flex items-center justify-center shadow-md">
            <Play className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-700 to-green-700 bg-clip-text text-transparent">Quick Start Guide</h3>
        </div>
        <p className="text-gray-700 dark:text-dark-text-secondary text-lg leading-relaxed">
          Get up and running with LegislationVUE in just a few steps. Follow this guide to start tracking legislation effectively.
        </p>
      </div>

      {/* Step-by-step Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Executive Orders */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-8 shadow-sm border border-blue-200 dark:border-blue-700">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">1</div>
            <div>
              <h4 className="text-xl font-bold text-blue-800 dark:text-blue-300 dark:text-blue-300">Executive Orders</h4>
              <p className="text-blue-600 dark:text-blue-400">Track federal executive orders</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <ScrollText className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">Click "Executive Orders" in the main navigation menu</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">View all executive orders - they auto-load on page visit</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">AI analysis is included with each order - click to expand details</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Star className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">Star important orders to prioritize them in your view</span>
            </div>
          </div>
        </div>

        {/* State Legislation */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-8 shadow-sm border border-green-200 dark:border-green-700">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">2</div>
            <div>
              <h4 className="text-xl font-bold text-green-800 dark:text-green-300">State Legislation</h4>
              <p className="text-green-600 dark:text-green-400">Monitor state bills and laws</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">Select a state from the navigation menu (CA, TX, CO, etc.)</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">View current legislative session bills automatically loaded</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lightbulb className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">Use filters to narrow by category (Civic, Education, etc.)</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">Review AI analysis and business impact assessments</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Star className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">Star important bills to prioritize them in your view</span>
            </div>
          </div>
        </div>


        {/* AI Analysis */}
        <div className="bg-white dark:bg-dark-bg-secondary rounded-xl p-8 shadow-sm border border-gray-200 dark:border-dark-border">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">3</div>
            <div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-dark-text">AI Analysis Features</h4>
              <p className="text-gray-600 dark:text-dark-text-secondary">Understand the impact</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">AI analysis included with every executive order and bill</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lightbulb className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">Click on any item to view full AI-generated insights</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <BarChart3 className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">Review detailed business and industry impact analysis</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">AI summaries appear inline - expand for full details</span>
            </div>
          </div>
        </div>
        {/* Best Practices */}
        <div className="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-8 shadow-sm border border-orange-200 dark:border-orange-700">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">4</div>
            <div>
              <h4 className="text-xl font-bold text-orange-800 dark:text-orange-300">Best Practices</h4>
              <p className="text-orange-600 dark:text-orange-400">Optimize your workflow</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-orange-400 to-amber-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">Check for updates weekly to stay current on new legislation</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-orange-400 to-amber-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Star className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">Use the star feature to track legislation relevant to your projects</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-orange-400 to-amber-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Filter className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">Apply category filters to focus on your areas of expertise</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-orange-400 to-amber-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Users className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700 dark:text-dark-text-secondary">Share insights with your team to keep everyone informed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const FAQTab = () => (
    <div className="space-y-8">
      {/* Common Issues */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-200 dark:border-red-700 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Troubleshooting</h3>
        </div>
        <p className="text-gray-700 dark:text-dark-text-secondary text-lg leading-relaxed">
          Having issues? Check these common solutions before contacting support.
        </p>
      </div>

      {/* FAQ Items */}
      <div className="space-y-6">
        <div className="bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-xl p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">App not loading or responding?</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 mt-0.5">1</span>
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">Check internet connection</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">Ensure stable internet access</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 mt-0.5">2</span>
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">Refresh the page</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">Press Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 mt-0.5">3</span>
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">Clear browser cache</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">Go to browser settings and clear cache/cookies</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 mt-0.5">4</span>
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">Try different browser</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">Chrome, Firefox, or Edge work best</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-xl p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Database className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">No data showing up?</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">All data loads automatically</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">Executive Orders and State Legislation load automatically when you visit each page</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">Verify state selection</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">Make sure you've selected the correct state from the navigation menu</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">Check your internet connection</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">A stable connection is needed to load data from the database</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">Try refreshing the page</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">If data doesn't appear, refresh and wait a moment for the page to load</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-xl p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">Page loading slowly?</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-purple-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">AI analysis is pre-processed</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">All AI summaries are generated in advance and load instantly</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-purple-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">Large lists may take a moment</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">States with many bills may take a few seconds to render</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">Check your connection</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">Slow loading usually indicates network issues</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">Use filters to narrow results</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">Filter by category to focus on relevant legislation</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-dark-border rounded-xl p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">Highlights not saving or missing?</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">Highlights sync across all pages</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">Stars are saved globally and appear on all pages including the Highlights page</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">Wait for API response</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">Highlights are saved to database - allow a moment for the API call to complete</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">Verify save action</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">Look for confirmation when clicking star icons</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900 dark:text-dark-text">Try incognito mode</strong>
                    <p className="text-gray-600 dark:text-dark-text-secondary">Test if browser extensions are causing issues</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Tips */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
            <Rocket className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text">Performance Tips</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">Optimize Loading</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-gray-700 dark:text-dark-text-secondary">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                All data loads automatically when you visit each page
              </li>
              <li className="flex items-center gap-2 text-gray-700 dark:text-dark-text-secondary">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Use category filters to narrow down results
              </li>
              <li className="flex items-center gap-2 text-gray-700 dark:text-dark-text-secondary">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Close unused browser tabs
              </li>
              <li className="flex items-center gap-2 text-gray-700 dark:text-dark-text-secondary">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Ensure stable internet connection
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-dark-text mb-4">Better Results</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-gray-700 dark:text-dark-text-secondary">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Use category filters (Engineering, Healthcare, Education, Civic)
              </li>
              <li className="flex items-center gap-2 text-gray-700 dark:text-dark-text-secondary">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Review AI analysis for key insights
              </li>
              <li className="flex items-center gap-2 text-gray-700 dark:text-dark-text-secondary">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Star important items to track them globally
              </li>
              <li className="flex items-center gap-2 text-gray-700 dark:text-dark-text-secondary">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Check the Highlights page to see all starred items
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Contact Support */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <Mail className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-dark-text">Still Need Help?</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-dark-bg-secondary rounded-xl p-6 shadow-sm border border-gray-200 dark:border-dark-border flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Wrench className="w-4 h-4 text-blue-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Technical Support</h4>
            </div>
            <p className="text-gray-600 dark:text-dark-text-secondary mb-4 flex-grow">
              For bugs, technical issues, or system problems
            </p>
            <a
              href="mailto:david4nderson@pm.me"
              className="inline-flex items-center gap-2 px-4 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-xl hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors duration-200 font-medium shadow-sm"
            >
              <Mail className="w-4 h-4" />
              Contact Support
            </a>
          </div>
          
          <div className="bg-white dark:bg-dark-bg-secondary rounded-xl p-6 shadow-sm border border-gray-200 dark:border-dark-border flex flex-col h-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-purple-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-dark-text">Feature Requests</h4>
            </div>
            <p className="text-gray-600 dark:text-dark-text-secondary mb-4 flex-grow">
              Ideas for new features or improvements
            </p>
            <a
              href="mailto:david4nderson@pm.me"
              className="inline-flex items-center gap-2 px-4 py-3 bg-purple-600 dark:bg-purple-500 text-white rounded-xl hover:bg-purple-700 dark:hover:bg-purple-400 transition-colors duration-200 font-medium shadow-sm"
            >
              <Star className="w-4 h-4" />
              Submit Feedback
            </a>
          </div>
        </div>
        
        <div className="bg-white dark:bg-dark-bg-secondary rounded-xl p-6 shadow-sm border border-gray-200 dark:border-dark-border">
          <p className="text-gray-700 dark:text-dark-text-secondary">
            <strong>Response Time:</strong> We typically respond within 24 hours during business days.
            Please include your browser type and any error messages for faster assistance.
          </p>
        </div>
      </div>
    </div>
  );

  const AboutTab = () => (
    <div className="space-y-8">
      {/* Company Hero */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl p-8">
        <div className="flex items-center gap-6 mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Terminal className="w-12 h-12 text-white" />
          </div>
          <div>
            <h3 className="text-3xl font-bold text-gray-900 dark:text-dark-text">MOREgroup Solutions Development</h3>
            <p className="text-lg text-gray-600 dark:text-dark-text-secondary">Changing our Business, One App at a Time.</p>
          </div>
        </div>
        <p className="text-gray-700 dark:text-dark-text-secondary text-xl leading-relaxed">
          MOREgroup Solutions Development is a team of visionary developers and experts dedicated to transforming how our organization interacts with data and each other.
          We leverage the latest technologies to build intelligent applications that empower our teams and clients to make informed decisions quickly and efficiently.
        </p>
      </div>

      {/* Mission & Vision */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white dark:bg-dark-bg-secondary rounded-xl p-8 shadow-sm border border-gray-200 dark:border-dark-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
            <h4 className="text-xl font-bold text-gray-900 dark:text-dark-text">Our Mission</h4>
          </div>
          <p className="text-gray-700 dark:text-dark-text-secondary leading-relaxed">
            Our mission is to revolutionize the way our organization consumes and understands data. Gaining insights from our users we aim to create intelligent applications, enabling proactive decision-making 
            and strategic planning. This allows our teams to focus on what matters most: delivering exceptional value to our clients and driving innovation in our industry.
          </p>
        </div>

        <div className="bg-white dark:bg-dark-bg-secondary rounded-xl p-8 shadow-sm border border-gray-200 dark:border-dark-border">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-purple-600" />
            </div>
            <h4 className="text-xl font-bold text-gray-900 dark:text-dark-text">Our VUE</h4>
          </div>
          <p className="text-gray-700 dark:text-dark-text-secondary leading-relaxed">
            Through a comprehensive suite of AI-powered 'VUE' platforms we not only accelerates our operational efficiency and scalability but position MOREgroup as the innovation leader in solutions and forward-thinking insights. 
            In an industry where manual processes limit profitability and growth, our VUE ecosystem ensures we can scale intelligently, deliver faster, and maintain our competitive edge while building a brand synonymous with technological excellence and strategic foresight.
          </p>
        </div>
      </div>

      {/* Product Portfolio */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
            <Rocket className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-dark-text">Product Portfolio</h3>
        </div>
        <div className="space-y-6">
          <div className="bg-white dark:bg-dark-bg-secondary rounded-xl p-6 shadow-sm border border-gray-200 dark:border-dark-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-green-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 dark:text-dark-text">PlanVUE</h4>
              <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 text-sm rounded-full font-medium">Available Now!</span>
            </div>
            <p className="text-gray-700 dark:text-dark-text-secondary mb-4 leading-relaxed">
              AI-powered planning tools and insights for our planners and architects.
              PlanVUE provides real-time data analysis and visualization, enabling our team to make informed decisions quickly.
              This tool streamlines our data capture of client preferences, allowing us to deliver better outcomes and client driven decisions.
            </p>
            <a 
              href="https://planvue.moregroupdev.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-600 hover:text-green-800 font-medium transition-colors duration-200"
            >
              Checkout PlanVUE! <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          
          <div className="bg-white dark:bg-dark-bg-secondary rounded-xl p-6 shadow-sm border border-gray-200 dark:border-dark-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 dark:text-dark-text">LegislationVUE</h4>
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 text-sm rounded-full font-medium">Current</span>
            </div>
            <p className="text-gray-700 dark:text-dark-text-secondary leading-relaxed">
              AI-powered legislative tracking and analysis platform for federal executive orders and state legislation. Giving MOREgroup a competitive edge in understanding legal and regulatory 
              changes that impact our projects and clients. Harnessing the power of AI to provide actionable insights and summaries, allowing our team to focus on strategic decision-making rather 
              than manual data processing.
            </p>
          </div>

          <div className="bg-white dark:bg-dark-bg-secondary rounded-xl p-6 shadow-sm border border-gray-200 dark:border-dark-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 dark:text-dark-text">RFQVUE</h4>
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 text-sm rounded-full font-medium">In Development</span>
            </div>
            <p className="text-gray-700 dark:text-dark-text-secondary leading-relaxed">
              AI-powered responses to Request for Quote (RFQ) / Request for Proposal (RFP) for architectural and engineering projects. Using historical 
              data and AI analysis, RFQVUE generates tailored responses that meet client needs and regulatory requirements, allowing for our team to focus on winning projects 
              rather than writing proposals.
            </p>
          </div>
        </div>
      </div>

      {/* Contact Block */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8 text-center">
        <p className="text-lg text-gray-700 dark:text-dark-text-secondary mb-6">
          Do you need a VUE or have an idea for MORE VUE's? Please reach out!
        </p>
        <a
          href="mailto:david4nderson@pm.me"
          className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-semibold shadow-lg text-lg"
        >
          <Mail className="w-5 h-5" />
          Contact Development
        </a>
      </div>
    </div>  
  );

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'technology':
        return <TechnologyTab />;
      case 'howto':
        return <HowToTab />;
      case 'faq':
        return <FAQTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-start justify-center z-[9999] p-4 pt-8 pb-8 overflow-y-auto">
      <div className="bg-white dark:bg-dark-bg-secondary rounded-md shadow-2xl max-w-4xl w-full min-h-0 flex flex-col my-auto">
        {/* Tab Navigation with Close Button */}
        <div className="border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg-tertiary p-4 flex-shrink-0 rounded-t-md">
          <div className="flex justify-between items-center">
            <div className="flex justify-center gap-2 flex-wrap flex-1">
              {tabs.map((tab) => (
                <TabButton
                  key={tab.id}
                  tab={tab}
                  isActive={activeTab === tab.id}
                  onClick={setActiveTab}
                />
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-dark-bg rounded-xl transition-colors duration-200 ml-4">
              <X className="w-5 h-5 text-gray-500 dark:text-dark-text-secondary" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 200px)' }}>
          {renderActiveTab()}
        </div>
      </div>
    </div>
  );
};

export default ApplicationInfoModal;