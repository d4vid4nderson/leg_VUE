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
  HardDrive     // Technical/system
} from 'lucide-react';

const ApplicationInfoModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen) return null;

  const tabs = [
    { id: 'overview', label: 'What is LegislationVUE', icon: Info },
    { id: 'technology', label: 'Technology & Data', icon: Database },
    { id: 'howto', label: 'How To Use', icon: Play },
    { id: 'faq', label: 'FAQ & Support', icon: HelpCircle },
    { id: 'about', label: 'MOREgroup Development', icon: Terminal }
  ];

  const TabButton = ({ tab, isActive, onClick }) => {
    const Icon = tab.icon;
    return (
      <button
        onClick={() => onClick(tab.id)}
        className={`flex items-center gap-2 px-4 py-3 rounded-xl font-medium transition-all duration-300 ${
          isActive
            ? 'bg-blue-600 text-white shadow-lg'
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
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
      <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl p-8 border border-blue-200 shadow-lg">
        <div className="flex items-center gap-6 mb-6">
          <div className="w-20 h-20 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <img src="/logo.png" alt="LegislationVUE" className="w-12 h-12" />
          </div>
          <div>
            <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-purple-700 bg-clip-text text-transparent">LegislationVUE</h3>
            <p className="text-lg text-indigo-700 font-medium">AI-Powered Legislative Intelligence Platform</p>
          </div>
        </div>
        <p className="text-gray-700 text-xl leading-relaxed">
          Your comprehensive solution for tracking, analyzing, and understanding federal executive orders 
          and state legislation with advanced AI insights and business impact analysis.
        </p>
      </div>

      {/* Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 shadow-sm border border-blue-200 hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-md">
              <ScrollText className="w-6 h-6 text-white" />
            </div>
            <h4 className="text-lg font-bold text-blue-800">Federal Executive Orders</h4>
          </div>
          <p className="text-gray-600 leading-relaxed">
            Real-time tracking of presidential executive orders with comprehensive AI analysis and business impact assessments.
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 shadow-sm border border-green-200 hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-md">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h4 className="text-lg font-bold text-green-800">State Legislation</h4>
          </div>
          <p className="text-gray-600 leading-relaxed">
            Multi-state bill tracking across 6 key states with topic-based search and latest bill monitoring.
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 shadow-sm border border-purple-200 hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white text-sm font-bold">AI</span>
            </div>
            <h4 className="text-lg font-bold text-purple-800">AI-Powered Analysis</h4>
          </div>
          <p className="text-gray-600 leading-relaxed">
            GPT-4 powered summaries, key talking points, and detailed business impact analysis for every item.
          </p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 shadow-sm border border-yellow-200 hover:shadow-md transition-shadow duration-300">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center shadow-md">
              <Star className="w-6 h-6 text-white" />
            </div>
            <h4 className="text-lg font-bold text-yellow-800">Smart Highlights</h4>
          </div>
          <p className="text-gray-600 leading-relaxed">
            Save and organize important legislation with filtering, categorization, and export capabilities.
          </p>
        </div>
      </div>

      {/* Value Proposition */}
      <div className="bg-gradient-to-br from-red-50 to-pink-50 rounded-xl shadow-sm border border-red-200 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
            <Target className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-red-800">Why LegislationVUE?</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Stay Compliant</h4>
            <p className="text-gray-600">Never miss critical legislative changes that affect your business</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Make Informed Decisions</h4>
            <p className="text-gray-600">AI-powered insights help you understand business implications</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-emerald-400 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Rocket className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">Save Time</h4>
            <p className="text-gray-600">Automated tracking and analysis reduces research time by 90%</p>
          </div>
        </div>
      </div>
    </div>
  );

  const TechnologyTab = () => (
    <div className="space-y-8">
      {/* Tech Stack Overview */}
      <div className="bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 rounded-xl p-8 border border-cyan-200 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center shadow-md">
            <Wrench className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-cyan-700 to-blue-700 bg-clip-text text-transparent">Technology Stack</h3>
        </div>
        <p className="text-gray-700 text-lg leading-relaxed">
          LegislationVUE is built on cutting-edge technology to deliver reliable, fast, and intelligent legislative tracking.
        </p>
      </div>

      {/* Data Sources */}
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-gradient-to-r from-purple-400 to-indigo-400 rounded-lg flex items-center justify-center shadow-md">
            <Database className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-bold text-purple-800">Official Data Sources</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-md">
                <Globe className="w-6 h-6 text-white" />
              </div>
              <h4 className="text-lg font-bold text-blue-800">Federal Register</h4>
            </div>
            <p className="text-gray-600 mb-4 leading-relaxed">
              The official daily publication for rules, proposed rules, and notices of Federal agencies and organizations.
            </p>
            <a 
              href="https://www.federalregister.gov" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium transition-colors duration-200"
            >
              Visit Federal Register <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h4 className="text-lg font-bold text-green-800">LegiScan API</h4>
            </div>
            <p className="text-gray-600 mb-4 leading-relaxed">
              Comprehensive state legislation tracking service providing real-time updates on bills across all 50 states.
            </p>
            <a 
              href="https://legiscan.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-600 hover:text-green-800 font-medium transition-colors duration-200"
            >
              Visit LegiScan <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* AI Technology */}
      <div className="bg-gradient-to-r from-purple-50 via-pink-50 to-rose-50 border border-purple-200 rounded-xl p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
            <span className="text-white text-sm font-bold">AI</span>
          </div>
          <h3 className="text-xl font-bold bg-gradient-to-r from-purple-700 to-pink-700 bg-clip-text text-transparent">AI-Powered Analysis</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Azure OpenAI Service</h4>
            <ul className="space-y-2 text-gray-600">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                GPT-4 powered text analysis
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
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Analysis Capabilities</h4>
            <ul className="space-y-2 text-gray-600">
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
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-gradient-to-r from-red-400 to-pink-400 rounded-lg flex items-center justify-center shadow-md">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <h3 className="text-xl font-bold text-red-800">Supported States & Jurisdictions</h3>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { name: 'California', code: 'CA', color: 'bg-blue-100 text-blue-800 border-blue-300' },
              { name: 'Colorado', code: 'CO', color: 'bg-green-100 text-green-800 border-green-300' },
              { name: 'Kentucky', code: 'KY', color: 'bg-purple-100 text-purple-800 border-purple-300' },
              { name: 'Nevada', code: 'NV', color: 'bg-orange-100 text-orange-800 border-orange-300' },
              { name: 'South Carolina', code: 'SC', color: 'bg-red-100 text-red-800 border-red-300' },
              { name: 'Texas', code: 'TX', color: 'bg-indigo-100 text-indigo-800 border-indigo-300' }
            ].map((state) => (
              <div key={state.code} className={`px-4 py-3 rounded-xl text-center ${state.color} border`}>
                <div className="font-bold text-lg">{state.code}</div>
                <div className="text-sm">{state.name}</div>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-center mt-6 font-medium">
            More states coming soon!
          </p>
        </div>
      </div>
    </div>
  );

  const HowToTab = () => (
    <div className="space-y-8">
      {/* Quick Start Guide */}
      <div className="bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 border border-emerald-200 rounded-xl p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl flex items-center justify-center shadow-md">
            <Play className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-2xl font-bold bg-gradient-to-r from-emerald-700 to-green-700 bg-clip-text text-transparent">Quick Start Guide</h3>
        </div>
        <p className="text-gray-700 text-lg leading-relaxed">
          Get up and running with LegislationVUE in just a few steps. Follow this guide to start tracking legislation effectively.
        </p>
      </div>

      {/* Step-by-step Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Executive Orders */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 shadow-sm border border-blue-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">1</div>
            <div>
              <h4 className="text-xl font-bold text-blue-800">Executive Orders</h4>
              <p className="text-blue-600">Track federal executive orders</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <ScrollText className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700">Click "Executive Orders" in the main navigation menu</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Calendar className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700">Expand "Fetch Fresh Data" section and choose your date range</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700">Click "Fetch Executive Orders" and wait for AI analysis</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-400 to-indigo-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Star className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700">Save important orders using the star icon</span>
            </div>
          </div>
        </div>

        {/* State Legislation */}
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-8 shadow-sm border border-green-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">2</div>
            <div>
              <h4 className="text-xl font-bold text-green-800">State Legislation</h4>
              <p className="text-green-600">Monitor state bills and laws</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700">Select a state from the navigation menu (CA, TX, CO, etc.)</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700">Choose "Search by Topic" or "Latest Bills" in fetch section</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lightbulb className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700">Enter search terms or fetch latest bills automatically</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-400 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <BarChart3 className="w-4 h-4 text-white" />
              </div>
              <span className="text-gray-700">Review AI analysis and business impact assessments</span>
            </div>
          </div>
        </div>

        {/* Highlights Management */}
        <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-8 shadow-sm border border-yellow-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">3</div>
            <div>
              <h4 className="text-xl font-bold text-yellow-800">Manage Highlights</h4>
              <p className="text-yellow-600">Organize important items</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Star className="w-4 h-4 text-yellow-600" />
              </div>
              <span className="text-gray-700">Click star icons to save important bills and orders</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Users className="w-4 h-4 text-yellow-600" />
              </div>
              <span className="text-gray-700">Access all highlights from the "Highlights" menu</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Database className="w-4 h-4 text-yellow-600" />
              </div>
              <span className="text-gray-700">Filter by category, source, or date range</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <ExternalLink className="w-4 h-4 text-yellow-600" />
              </div>
              <span className="text-gray-700">Export highlights or share with your team</span>
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg">4</div>
            <div>
              <h4 className="text-xl font-bold text-gray-900">AI Analysis Features</h4>
              <p className="text-gray-600">Understand the impact</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <span className="text-gray-700">Every item automatically gets AI-powered summaries</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lightbulb className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-gray-700">Expand items to view key talking points</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <BarChart3 className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-gray-700">Review detailed business and industry impact analysis</span>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-purple-600" />
              </div>
              <span className="text-gray-700">Copy analysis or download comprehensive reports</span>
            </div>
          </div>
        </div>
      </div>

      {/* Best Practices */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Award className="w-6 h-6 text-indigo-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Best Practices</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Getting Started</h4>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Start with a small date range to test the system
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Be patient - AI analysis takes 1-3 minutes per batch
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Use specific search terms for better state bill results
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Ongoing Usage</h4>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Fetch fresh data weekly for latest updates
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Regularly review and organize your highlights
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Set up a routine for checking key states and topics
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const FAQTab = () => (
    <div className="space-y-8">
      {/* Common Issues */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">Troubleshooting</h3>
        </div>
        <p className="text-gray-700 text-lg leading-relaxed">
          Having issues? Check these common solutions before contacting support.
        </p>
      </div>

      {/* FAQ Items */}
      <div className="space-y-6">
        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">App not loading or responding?</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 mt-0.5">1</span>
                  <div>
                    <strong className="text-gray-900">Check internet connection</strong>
                    <p className="text-gray-600">Ensure stable internet access</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 mt-0.5">2</span>
                  <div>
                    <strong className="text-gray-900">Refresh the page</strong>
                    <p className="text-gray-600">Press Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 mt-0.5">3</span>
                  <div>
                    <strong className="text-gray-900">Clear browser cache</strong>
                    <p className="text-gray-600">Go to browser settings and clear cache/cookies</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 mt-0.5">4</span>
                  <div>
                    <strong className="text-gray-900">Try different browser</strong>
                    <p className="text-gray-600">Chrome, Firefox, or Edge work best</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Database className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">No data showing up?</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900">Use "Fetch Fresh Data" sections</strong>
                    <p className="text-gray-600">Data must be actively fetched</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900">Check date ranges</strong>
                    <p className="text-gray-600">Ensure your date range includes relevant periods</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900">Verify state selection</strong>
                    <p className="text-gray-600">Make sure you've selected the correct state</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900">Try broader search terms</strong>
                    <p className="text-gray-600">Start with general topics, then narrow down</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">AI analysis taking too long?</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-purple-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900">Normal processing time</strong>
                    <p className="text-gray-600">AI analysis typically takes 1-3 minutes</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-purple-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900">Large batches take longer</strong>
                    <p className="text-gray-600">Processing 20+ items may take 5-10 minutes</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900">Don't refresh during analysis</strong>
                    <p className="text-gray-600">Let the process complete naturally</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900">Try smaller batches</strong>
                    <p className="text-gray-600">Fetch fewer items at once for faster results</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
              <Star className="w-5 h-5 text-yellow-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Highlights not saving or missing?</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900">Check browser storage</strong>
                    <p className="text-gray-600">Ensure cookies/local storage is enabled</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900">Clear filters</strong>
                    <p className="text-gray-600">Remove any active filters in highlights view</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900">Verify save action</strong>
                    <p className="text-gray-600">Look for confirmation when clicking star icons</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-1" />
                  <div>
                    <strong className="text-gray-900">Try incognito mode</strong>
                    <p className="text-gray-600">Test if browser extensions are causing issues</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Tips */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Rocket className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Performance Tips</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Optimize Loading</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Use shorter date ranges (1-2 weeks max)
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Fetch data in smaller batches
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Close unused browser tabs
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Ensure stable internet connection
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Better Results</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Use specific, targeted search terms
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Review AI analysis for key insights
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Organize highlights by category
              </li>
              <li className="flex items-center gap-2 text-gray-700">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                Regularly update your saved searches
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Contact Support */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
            <Mail className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Still Need Help?</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Wrench className="w-4 h-4 text-blue-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900">Technical Support</h4>
            </div>
            <p className="text-gray-600 mb-4">
              For bugs, technical issues, or system problems
            </p>
            <a 
              href="mailto:legal@moregroup-inc.com" 
              className="inline-flex items-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors duration-200 font-medium shadow-sm"
            >
              <Mail className="w-4 h-4" />
              Contact Support
            </a>
          </div>
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-purple-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-900">Feature Requests</h4>
            </div>
            <p className="text-gray-600 mb-4">
              Ideas for new features or improvements
            </p>
            <a 
              href="mailto:legal@moregroup-inc.com" 
              className="inline-flex items-center gap-2 px-4 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors duration-200 font-medium shadow-sm"
            >
              <Star className="w-4 h-4" />
              Submit Feedback
            </a>
          </div>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <p className="text-gray-700">
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
            <h3 className="text-3xl font-bold text-gray-900">MOREgroup Development</h3>
            <p className="text-lg text-gray-600">Changing our Business, One App at a Time.</p>
          </div>
        </div>
        <p className="text-gray-700 text-xl leading-relaxed">
          MOREgroup Development is a team of visionary developers and experts dedicated to transforming how our organization interacts with data and each other. 
          We leverage the latest technologies to build intelligent applications that empower our teams and clients to make informed decisions quickly and efficiently.       
        </p>
      </div>

      {/* Mission & Vision */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-blue-600" />
            </div>
            <h4 className="text-xl font-bold text-gray-900">Our Mission</h4>
          </div>
          <p className="text-gray-700 leading-relaxed">
            Our mission is to revolutionize the way our organization consumes and understands data. Gaining insights from our users we aim to create intelligent applications, enabling proactive decision-making 
            and strategic planning. This allows our teams to focus on what matters most: delivering exceptional value to our clients and driving innovation in our industry.
          </p>
        </div>

        <div className="bg-white rounded-xl p-8 shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Lightbulb className="w-6 h-6 text-purple-600" />
            </div>
            <h4 className="text-xl font-bold text-gray-900">Our VUE</h4>
          </div>
          <p className="text-gray-700 leading-relaxed">
            Through a comprehensive suite of AI-powered 'VUE' platforms we not only accelerates our operational efficiency and scalability but position MOREgroup as the innovation leader in solutions and forward-thinking insights. 
            In an industry where manual processes limit profitability and growth, our VUE ecosystem ensures we can scale intelligently, deliver faster, and maintain our competitive edge while building a brand synonymous with technological excellence and strategic foresight.
          </p>
        </div>
      </div>

      {/* Product Portfolio */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
            <Rocket className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900">Product Portfolio</h3>
        </div>
        <div className="space-y-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-green-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900">PlanVUE</h4>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full font-medium">Available Now!</span>
            </div>
            <p className="text-gray-700 mb-4 leading-relaxed">
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
          
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900">LegislationVUE</h4>
              <span className="px-3 py-1 bg-purple-100 text-purple-800 text-sm rounded-full font-medium">Current</span>
            </div>
            <p className="text-gray-700 leading-relaxed">
              AI-powered legislative tracking and analysis platform for federal executive orders and state legislation. Giving MOREgroup a competitive edge in understanding legal and regulatory 
              changes that impact our projects and clients. Harnessing the power of AI to provide actionable insights and summaries, allowing our team to focus on strategic decision-making rather 
              than manual data processing.
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900">RFQVUE</h4>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium">In Development</span>
            </div>
            <p className="text-gray-700 leading-relaxed">
              AI-powered responses to Request for Quote (RFQ) / Request for Proposal (RFP) for architectural and engineering projects. Using historical 
              data and AI analysis, RFQVUE generates tailored responses that meet client needs and regulatory requirements, allowing for our team to focus on winning projects 
              rather than writing proposals.
            </p>
          </div>
        </div>
      </div>

      {/* Contact Block */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-8 text-center">
        <p className="text-lg text-gray-700 mb-6">
          Do you need a VUE or have an idea for MORE VUE's? Please reach out!
        </p>
        <a 
          href="mailto:legal@moregroup-inc.com" 
          className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-semibold shadow-lg text-lg"
        >
          <Mail className="w-5 h-5" />
          MOREgroup Development
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
      case 'about':
        return <AboutTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-8 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 flex items-center justify-center rounded-xl shadow-lg">
              <Info className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900">
              LegislationVUE Guide
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-gray-100 rounded-xl transition-colors duration-200"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 bg-gray-50 p-6">
          <div className="flex justify-center gap-4 flex-wrap">
            {tabs.map((tab) => (
              <TabButton
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                onClick={setActiveTab}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-200px)]">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  );
};

export default ApplicationInfoModal;