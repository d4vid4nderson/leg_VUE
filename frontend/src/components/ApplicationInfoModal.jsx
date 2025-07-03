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
        className={`flex items-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
          isActive
            ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg'
            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
        }`}
      >
        <Icon className="w-4 h-4" />
        <span className="hidden sm:inline">{tab.label}</span>
      </button>
    );
  };

  const OverviewTab = () => (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl flex items-center justify-center">
            <img src="/logo.png" alt="LegislationVUE" className="w-10 h-10" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-800">LegislationVUE</h3>
            <p className="text-gray-600">AI-Powered Legislative Intelligence Platform</p>
          </div>
        </div>
        <p className="text-gray-700 text-lg leading-relaxed">
          Your comprehensive solution for tracking, analyzing, and understanding federal executive orders 
          and state legislation with advanced AI insights and business impact analysis.
        </p>
      </div>

      {/* Key Features */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-3">
            <ScrollText className="w-6 h-6 text-blue-600" />
            <h4 className="font-bold text-blue-800">Federal Executive Orders</h4>
          </div>
          <p className="text-blue-700 text-sm">
            Real-time tracking of presidential executive orders with comprehensive AI analysis and business impact assessments.
          </p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="w-6 h-6 text-green-600" />
            <h4 className="font-bold text-green-800">State Legislation</h4>
          </div>
          <p className="text-green-700 text-sm">
            Multi-state bill tracking across 6 key states with topic-based search and latest bill monitoring.
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-6 h-6 bg-gradient-to-r from-violet-600 to-purple-600 rounded flex items-center justify-center">
              <span className="text-white text-xs font-bold">AI</span>
            </div>
            <h4 className="font-bold text-purple-800">AI-Powered Analysis</h4>
          </div>
          <p className="text-purple-700 text-sm">
            GPT-4 powered summaries, key talking points, and detailed business impact analysis for every item.
          </p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
          <div className="flex items-center gap-3 mb-3">
            <Star className="w-6 h-6 text-yellow-600" />
            <h4 className="font-bold text-yellow-800">Smart Highlights</h4>
          </div>
          <p className="text-yellow-700 text-sm">
            Save and organize important legislation with filtering, categorization, and export capabilities.
          </p>
        </div>
      </div>

      {/* Value Proposition */}
      <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-lg p-6 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <Target className="w-6 h-6 text-red-600" />
          <h3 className="text-xl font-bold text-gray-800">Why LegislationVUE?</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center">
            <Shield className="w-8 h-8 text-violet-600 mx-auto mb-2" />
            <h4 className="font-semibold text-violet-800 mb-1">Stay Compliant</h4>
            <p className="text-violet-700 text-sm">Never miss critical legislative changes that affect your business</p>
          </div>
          <div className="text-center">
            <BarChart3 className="w-8 h-8 text-indigo-600 mx-auto mb-2" />
            <h4 className="font-semibold text-indigo-800 mb-1">Make Informed Decisions</h4>
            <p className="text-indigo-700 text-sm">AI-powered insights help you understand business implications</p>
          </div>
          <div className="text-center">
            <Rocket className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h4 className="font-semibold text-blue-800 mb-1">Save Time</h4>
            <p className="text-blue-700 text-sm">Automated tracking and analysis reduces research time by 90%</p>
          </div>
        </div>
      </div>
    </div>
  );

  const TechnologyTab = () => (
    <div className="space-y-6">
      {/* Tech Stack Overview */}
      <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Wrench className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-800">Technology Stack</h3>
        </div>
        <p className="text-gray-700 mb-4">
          LegislationVUE is built on cutting-edge technology to deliver reliable, fast, and intelligent legislative tracking.
        </p>
      </div>

      {/* Data Sources */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Database className="w-5 h-5 text-purple-600" />
          Official Data Sources
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <Globe className="w-6 h-6 text-blue-600" />
              <h4 className="font-bold text-gray-800">Federal Register</h4>
            </div>
            <p className="text-gray-600 text-sm mb-3">
              The official daily publication for rules, proposed rules, and notices of Federal agencies and organizations.
            </p>
            <a 
              href="https://www.federalregister.gov" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Visit Federal Register <ExternalLink className="w-4 h-4" />
            </a>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-3">
              <FileText className="w-6 h-6 text-green-600" />
              <h4 className="font-bold text-gray-800">LegiScan API</h4>
            </div>
            <p className="text-gray-600 text-sm mb-3">
              Comprehensive state legislation tracking service providing real-time updates on bills across all 50 states.
            </p>
            <a 
              href="https://legiscan.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-600 hover:text-green-800 text-sm font-medium"
            >
              Visit LegiScan <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* AI Technology */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-gradient-to-r from-violet-600 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">AI</span>
          </div>
          <h3 className="text-lg font-bold text-gray-800">AI-Powered Analysis</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-purple-800 mb-2">Azure OpenAI Service</h4>
            <ul className="space-y-1 text-sm text-purple-700">
              <li>• GPT-4 powered text analysis</li>
              <li>• Advanced natural language processing</li>
              <li>• Contextual understanding of legal documents</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-purple-800 mb-2">Analysis Capabilities</h4>
            <ul className="space-y-1 text-sm text-purple-700">
              <li>• Automated executive summaries</li>
              <li>• Key talking points extraction</li>
              <li>• Business impact assessment</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Supported States */}
      <div>
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-red-600" />
          Supported States & Jurisdictions
        </h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { name: 'California', code: 'CA', color: 'bg-blue-100 text-blue-800' },
              { name: 'Colorado', code: 'CO', color: 'bg-blue-100 text-blue-800' },
              { name: 'Kentucky', code: 'KY', color: 'bg-blue-100 text-blue-800' },
              { name: 'Nevada', code: 'NV', color: 'bg-blue-100 text-blue-800' },
              { name: 'South Carolina', code: 'SC', color: 'bg-blue-100 text-blue-800' },
              { name: 'Texas', code: 'TX', color: 'bg-blue-100 text-blue-800' }
            ].map((state) => (
              <div key={state.code} className={`px-4 py-2 rounded-lg text-center ${state.color}`}>
                <div className="font-bold">{state.code}</div>
                <div className="text-sm">{state.name}</div>
              </div>
            ))}
          </div>
          <p className="text-gray-600 text-sm mt-4 text-center">
            More states coming soon!
          </p>
        </div>
      </div>
    </div>
  );

  const HowToTab = () => (
    <div className="space-y-6">
      {/* Quick Start Guide */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Play className="w-6 h-6 text-green-600" />
          <h3 className="text-xl font-bold text-gray-800">Quick Start Guide</h3>
        </div>
        <p className="text-gray-700">
          Get up and running with LegislationVUE in just a few steps. Follow this guide to start tracking legislation effectively.
        </p>
      </div>

      {/* Step-by-step Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Executive Orders */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">1</div>
            <div>
              <h4 className="font-bold text-blue-800">Executive Orders</h4>
              <p className="text-blue-600 text-sm">Track federal executive orders</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <ScrollText className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
              <span className="text-blue-700 text-sm">Click "Executive Orders" in the main navigation menu</span>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
              <span className="text-blue-700 text-sm">Expand "Fetch Fresh Data" section and choose your date range</span>
            </div>
            <div className="flex items-start gap-3">
              <Zap className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
              <span className="text-blue-700 text-sm">Click "Fetch Executive Orders" and wait for AI analysis</span>
            </div>
            <div className="flex items-start gap-3">
              <Star className="w-4 h-4 text-blue-600 mt-1 flex-shrink-0" />
              <span className="text-blue-700 text-sm">Save important orders using the star icon</span>
            </div>
          </div>
        </div>

        {/* State Legislation */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-white font-bold">2</div>
            <div>
              <h4 className="font-bold text-green-800">State Legislation</h4>
              <p className="text-green-600 text-sm">Monitor state bills and laws</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
              <span className="text-green-700 text-sm">Select a state from the navigation menu (CA, TX, CO, etc.)</span>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
              <span className="text-green-700 text-sm">Choose "Search by Topic" or "Latest Bills" in fetch section</span>
            </div>
            <div className="flex items-start gap-3">
              <Lightbulb className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
              <span className="text-green-700 text-sm">Enter search terms or fetch latest bills automatically</span>
            </div>
            <div className="flex items-start gap-3">
              <BarChart3 className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
              <span className="text-green-700 text-sm">Review AI analysis and business impact assessments</span>
            </div>
          </div>
        </div>

        {/* Highlights Management */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-yellow-600 rounded-full flex items-center justify-center text-white font-bold">3</div>
            <div>
              <h4 className="font-bold text-yellow-800">Manage Highlights</h4>
              <p className="text-yellow-600 text-sm">Organize important items</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Star className="w-4 h-4 text-yellow-600 mt-1 flex-shrink-0" />
              <span className="text-yellow-700 text-sm">Click star icons to save important bills and orders</span>
            </div>
            <div className="flex items-start gap-3">
              <Users className="w-4 h-4 text-yellow-600 mt-1 flex-shrink-0" />
              <span className="text-yellow-700 text-sm">Access all highlights from the "Highlights" menu</span>
            </div>
            <div className="flex items-start gap-3">
              <Database className="w-4 h-4 text-yellow-600 mt-1 flex-shrink-0" />
              <span className="text-yellow-700 text-sm">Filter by category, source, or date range</span>
            </div>
            <div className="flex items-start gap-3">
              <ExternalLink className="w-4 h-4 text-yellow-600 mt-1 flex-shrink-0" />
              <span className="text-yellow-700 text-sm">Export highlights or share with your team</span>
            </div>
          </div>
        </div>

        {/* AI Analysis */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold">4</div>
            <div>
              <h4 className="font-bold text-purple-800">AI Analysis Features</h4>
              <p className="text-purple-600 text-sm">Understand the impact</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 bg-gradient-to-r from-violet-600 to-purple-600 rounded flex items-center justify-center">
                <span className="text-white text-xs font-bold">AI</span>
              </div>
              <span className="text-purple-700 text-sm">Every item automatically gets AI-powered summaries</span>
            </div>
            <div className="flex items-start gap-3">
              <Lightbulb className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />
              <span className="text-purple-700 text-sm">Expand items to view key talking points</span>
            </div>
            <div className="flex items-start gap-3">
              <BarChart3 className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />
              <span className="text-purple-700 text-sm">Review detailed business and industry impact analysis</span>
            </div>
            <div className="flex items-start gap-3">
              <FileText className="w-4 h-4 text-purple-600 mt-1 flex-shrink-0" />
              <span className="text-purple-700 text-sm">Copy analysis or download comprehensive reports</span>
            </div>
          </div>
        </div>
      </div>

      {/* Best Practices */}
      <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Award className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-gray-800">Best Practices</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-semibold text-indigo-800">Getting Started</h4>
            <ul className="space-y-1 text-sm text-indigo-700">
              <li>• Start with a small date range to test the system</li>
              <li>• Be patient - AI analysis takes 1-3 minutes per batch</li>
              <li>• Use specific search terms for better state bill results</li>
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-indigo-800">Ongoing Usage</h4>
            <ul className="space-y-1 text-sm text-indigo-700">
              <li>• Fetch fresh data weekly for latest updates</li>
              <li>• Regularly review and organize your highlights</li>
              <li>• Set up a routine for checking key states and topics</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const FAQTab = () => (
    <div className="space-y-6">
      {/* Common Issues */}
      <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-6 h-6 text-red-600" />
          <h3 className="text-xl font-bold text-gray-800">Troubleshooting</h3>
        </div>
        <p className="text-gray-700">
          Having issues? Check these common solutions before contacting support.
        </p>
      </div>

      {/* FAQ Items */}
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">App not loading or responding?</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <div><strong>1. Check internet connection</strong> - Ensure stable internet access</div>
                <div><strong>2. Refresh the page</strong> - Press Ctrl+F5 (Windows) or Cmd+Shift+R (Mac)</div>
                <div><strong>3. Clear browser cache</strong> - Go to browser settings and clear cache/cookies</div>
                <div><strong>4. Try different browser</strong> - Chrome, Firefox, or Edge work best</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">No data showing up?</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <div><strong>Use "Fetch Fresh Data" sections</strong> - Data must be actively fetched</div>
                <div><strong>Check date ranges</strong> - Ensure your date range includes relevant periods</div>
                <div><strong>Verify state selection</strong> - Make sure you've selected the correct state</div>
                <div><strong>Try broader search terms</strong> - Start with general topics, then narrow down</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Zap className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">AI analysis taking too long?</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <div><strong>Normal processing time</strong> - AI analysis typically takes 1-3 minutes</div>
                <div><strong>Large batches take longer</strong> - Processing 20+ items may take 5-10 minutes</div>
                <div><strong>Don't refresh during analysis</strong> - Let the process complete naturally</div>
                <div><strong>Try smaller batches</strong> - Fetch fewer items at once for faster results</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Star className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="font-semibold text-gray-800 mb-2">Highlights not saving or missing?</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <div><strong>Check browser storage</strong> - Ensure cookies/local storage is enabled</div>
                <div><strong>Clear filters</strong> - Remove any active filters in highlights view</div>
                <div><strong>Verify save action</strong> - Look for confirmation when clicking star icons</div>
                <div><strong>Try incognito mode</strong> - Test if browser extensions are causing issues</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Tips */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Rocket className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-bold text-gray-800">Performance Tips</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-semibold text-green-800 mb-2">Optimize Loading</h4>
            <ul className="space-y-1 text-sm text-green-700">
              <li>• Use shorter date ranges (1-2 weeks max)</li>
              <li>• Fetch data in smaller batches</li>
              <li>• Close unused browser tabs</li>
              <li>• Ensure stable internet connection</li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-green-800 mb-2">Better Results</h4>
            <ul className="space-y-1 text-sm text-green-700">
              <li>• Use specific, targeted search terms</li>
              <li>• Review AI analysis for key insights</li>
              <li>• Organize highlights by category</li>
              <li>• Regularly update your saved searches</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Contact Support */}
      <div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Mail className="w-6 h-6 text-blue-600" />
          <h3 className="text-lg font-bold text-gray-800">Still Need Help?</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white bg-opacity-70 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-blue-600" />
              Technical Support
            </h4>
            <p className="text-sm text-gray-600 mb-3">
              For bugs, technical issues, or system problems
            </p>
            <a 
              href="mailto:legal@moregroup-inc.com" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
            >
              <Mail className="w-4 h-4" />
              Reach out to Support
            </a>
          </div>
          
          <div className="bg-white bg-opacity-70 rounded-lg p-4">
            <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-purple-600" />
              Feature Requests
            </h4>
            <p className="text-sm text-gray-600 mb-3">
              Ideas for new features or improvements
            </p>
            <a 
              href="mailto:legal@moregroup-inc.com" 
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 text-sm font-medium"
            >
              <Star className="w-4 h-4" />
              Submit Feedback/Requests
            </a>
          </div>
        </div>
        
        <div className="mt-4 p-3 bg-white bg-opacity-60 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>Response Time:</strong> We typically respond within 24 hours during business days.
            Please include your browser type and any error messages for faster assistance.
          </p>
        </div>
      </div>
    </div>
  );

  const AboutTab = () => (
    <div className="space-y-6">
      {/* Company Hero */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl flex items-center justify-center">
            <Terminal className="w-10 h-10 text-white" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-800">MOREgroup Development</h3>
            <p className="text-gray-600">Changing our Business, One App at a Time.</p>
          </div>
        </div>
        <p className="text-gray-700 text-lg leading-relaxed">
          MOREgroup Development is a team of visionary developers and experts dedicated to transforming how our organization interacts with data and each other. 
          We leverage the latest technologies to build intelligent applications that empower our teams and clients to make informed decisions quickly and efficiently.       
          </p>
      </div>

      {/* Mission & Vision */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-6 h-6 text-blue-600" />
            <h4 className="font-bold text-blue-800">Our Mission</h4>
          </div>
          <p className="text-blue-700 text-sm leading-relaxed">
            Our mission is to revolutionize the way our organization consumes and understands data. Gaining insights from our users we aim to create intelligent applications, enabling proactive decision-making 
            and strategic planning. This allows our teams to focus on what matters most: delivering exceptional value to our clients and driving innovation in our industry.
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Lightbulb className="w-6 h-6 text-purple-600" />
            <h4 className="font-bold text-purple-800">Our VUE</h4>
          </div>
          <p className="text-purple-700 text-sm leading-relaxed">
          Through a comprehensive suite of AI-powered 'VUE' platforms we not only accelerates our operational efficiency and scalability but position MOREgroup as the innovation leader in solutions and forward-thinking insights. 
          In an industry where manual processes limit profitability and growth, our VUE ecosystem ensures we can scale intelligently, deliver faster, and maintain our competitive edge while building a brand synonymous with technological excellence and strategic foresight.
          </p>
        </div>
      </div>



      {/* Product Portfolio */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Rocket className="w-6 h-6 text-green-600" />
          <h3 className="text-lg font-bold text-gray-800">Product Portfolio</h3>
        </div>
        <div className="space-y-4">
        <div className="bg-white bg-opacity-100 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <BarChart3 className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold text-gray-800">PlanVUE</h4>
            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">Available Now!</span>
          </div>
        <p className="text-gray-700 text-sm">
            AI-powered planning tools and insights for our planners and architects.
            PlanVUE provides real-time data analysis and visualization, enabling our team to make informed decisions quickly.
            This tool streamlines our data capture of client preferences, allowing us to deliver better outcomes and client driven decisions.
          <p>
            <a 
              href="https://planvue.moregroupdev.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-green-600 hover:text-green-800 text-sm font-medium"
            >
              Checkout PlanVUE! <ExternalLink className="w-4 h-4" />
            </a>
          </p>
        </p>
        </div>
        
          <div className="bg-white bg-opacity-100 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-5 h-5 text-violet-600" />
              <h4 className="font-semibold text-gray-800">LegislationVUE</h4>
              <span className="px-2 py-1 bg-violet-100 text-violet-800 text-xs rounded-full font-medium">Current</span>
            </div>
            <p className="text-gray-700 text-sm">
              AI-powered legislative tracking and analysis platform for federal executive orders and state legislation. Giving MOREgroup a competitive edge in understanding legal and regulatory 
              changes that impact our projects and clients. Harnessing the power of AI to provide actionable insights and summaries, allowing our team to focus on strategic decision-making rather 
              than manual data processing.
            </p>
          </div>
          <div className="bg-white bg-opacity-100 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-gray-800">RFQVUE</h4>
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full font-medium">In Development</span>
            </div>
            <p className="text-gray-700 text-sm">
            AI-powered responses to Request for Quote (RFQ) / Request for Proposal (RFP) for archtiectural and engineering projects. Using historical 
            data and AI analysis, RFQVUE generates tailored responses that meet client needs and regulatory requirements, allowing for our team to focus on winning projects 
            rather than writing proposals.
            </p>
          </div>
        </div>
      </div>

      {/* MORE Vue's Contact Block */}
<div className="bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-200 rounded-lg p-6 mt-6">
  <div className="text-center">
    <p className="text-sm text-gray-700 mb-8 flex items-center justify-center gap-2">
      Do you need a VUE or have an idea for MORE VUE's? 
      Please reach out!
    </p>
    <a 
      href="mailto:legal@moregroup-inc.com" 
      className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg hover:from-violet-700 hover:to-blue-700 transition-all duration-200 font-medium shadow-lg"
    >
      <Mail className="w-4 h-4" />
      MOREgroup Development
    </a>
  </div>
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
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-violet-50 to-blue-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-violet-600 to-blue-600 flex items-center justify-center rounded-lg">
              <Info className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              LegislationVUE Guide
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 bg-gray-50 p-4">
          <div className="flex justify-center gap-6">
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
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  );
};

export default ApplicationInfoModal;