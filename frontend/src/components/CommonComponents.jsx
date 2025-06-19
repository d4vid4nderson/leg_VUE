// components/CommonComponents.jsx - Shared components used across pages
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building,
  GraduationCap,
  Heart,
  Wrench,
  ScrollText,
  FileText,
  Star,
  Settings,
  Menu as HamburgerIcon,
  ChevronDown,
  Info,
  X as XIcon,
  Home,
  Book,
  Zap,
  Play,
  ChevronRight,
  Database,
  HelpCircle,
  Globe,
  ExternalLink,
  Monitor,
  Shield,
  BarChart3,
  Search,
  Download,
  Users
} from 'lucide-react';

import { FILTERS, filterStyles, SUPPORTED_STATES } from '../utils/constants';

// Category Tag Component
export const CategoryTag = ({ category }) => {
  if (!category) return null;
  
  const filter = FILTERS.find(f => f.key === category);
  
  if (!filter) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
        <ScrollText size={12} />
        <span>Unknown</span>
      </span>
    );
  }
  
  // Get pill-style backgrounds based on category
  const getPillStyles = (cat) => {
    switch (cat) {
      case 'civic':
        return 'bg-blue-100 text-blue-800';
      case 'education':
        return 'bg-orange-100 text-orange-800';
      case 'engineering':
        return 'bg-green-100 text-green-800';
      case 'healthcare':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  const IconComponent = filter.icon;
  const pillStyles = getPillStyles(category);
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 ${pillStyles} text-xs font-medium rounded-full`}>
      <IconComponent size={12} />
      <span>{filter.label}</span>
    </span>
  );
};

// Pagination Component
export const Pagination = ({
  paginationPage,
  totalPages,
  onPageChange,
  loading
}) => (
  <div className="flex items-center justify-between px-4 py-6 bg-white border-t border-gray-200 mt-6 rounded-lg shadow-sm">
    <div className="flex justify-between w-full">
      <button
        onClick={() => onPageChange(paginationPage - 1)}
        disabled={paginationPage <= 1 || loading}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
          paginationPage <= 1 || loading
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-600 hover:text-white hover:shadow-lg'
        }`}
      >
        Previous
      </button>
      <div className="flex items-center text-sm text-gray-700">
        <span>Page</span>
        <span className="mx-2 font-medium">{paginationPage}</span>
        <span>of</span>
        <span className="mx-2 font-medium">{totalPages || '?'}</span>
      </div>
      <button
        onClick={() => onPageChange(paginationPage + 1)}
        disabled={paginationPage >= totalPages || loading}
        className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 ${
          paginationPage >= totalPages || loading
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
            : 'bg-gray-200 text-gray-700 hover:bg-gray-600 hover:text-white hover:shadow-lg'
        }`}
      >
        Next
      </button>
    </div>
  </div>
);

// Information Modal Component
export const InformationModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('getting-started');

  if (!isOpen) return null;

  const tabs = [
    { id: 'getting-started', label: 'Getting Started', icon: Play },
    { id: 'data-sources', label: 'Data Sources', icon: Database },
    { id: 'features', label: 'Features', icon: Zap },
    { id: 'support', label: 'Support', icon: HelpCircle }
  ];

  const renderGettingStarted = () => (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
          <Star className="text-yellow-500" size={24} />
          Welcome to LegislationVUE
        </h3>
        <p className="text-gray-700 mb-4">
          Your AI-powered legislative intelligence platform that helps you track, analyze, and understand 
          federal executive orders and state legislation with advanced AI analysis.
        </p>
        <div className="bg-white rounded-md p-4 border border-blue-100">
          <p className="text-sm text-blue-800 font-medium">
            💡 <strong>New User Tip:</strong> Start by visiting the Executive Orders page to see federal data, 
            or explore state legislation by clicking any state in the menu.
          </p>
        </div>
      </div>

      {/* How to Use */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Book size={20} className="text-green-600" />
          How to Use LegislationVUE
        </h4>
        
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">1</div>
            <div>
              <h5 className="font-medium text-gray-800">Fetch Executive Orders</h5>
              <p className="text-sm text-gray-600">Visit the Executive Orders page → Use the "Fetch Fresh Data" section → Select a date range → Click "Fetch Executive Orders"</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-green-100 text-green-600 rounded-full flex items-center justify-center font-bold text-sm">2</div>
            <div>
              <h5 className="font-medium text-gray-800">Explore State Legislation</h5>
              <p className="text-sm text-gray-600">Choose a state from the menu → Use "Fetch Fresh Data" → Search by topic or fetch the latest bills → AI analysis included</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center font-bold text-sm">3</div>
            <div>
              <h5 className="font-medium text-gray-800">Save Your Favorites</h5>
              <p className="text-sm text-gray-600">Click the star icon on any item to save it to your highlights → Access all starred items from the Highlights page</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="w-8 h-8 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-sm">4</div>
            <div>
              <h5 className="font-medium text-gray-800">Use AI Analysis</h5>
              <p className="text-sm text-gray-600">Every item includes AI-generated summaries, key points, and business impact analysis → Copy reports or download for sharing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Start Actions */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Zap size={20} className="text-yellow-600" />
          Quick Start Actions
        </h4>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button 
            onClick={() => {
              onClose();
              window.location.href = '/executive-orders';
            }}
            className="p-3 bg-blue-50 hover:bg-blue-100 rounded-lg text-left transition-colors flex items-center gap-3"
          >
            <ScrollText size={18} className="text-blue-600" />
            <div>
              <div className="font-medium text-blue-800">Try Executive Orders</div>
              <div className="text-xs text-blue-600">Fetch federal data</div>
            </div>
            <ChevronRight size={16} className="text-blue-400 ml-auto" />
          </button>
          
          <button 
            onClick={() => {
              onClose();
              window.location.href = '/state/california';
            }}
            className="p-3 bg-green-50 hover:bg-green-100 rounded-lg text-left transition-colors flex items-center gap-3"
          >
            <FileText size={18} className="text-green-600" />
            <div>
              <div className="font-medium text-green-800">Try State Legislation</div>
              <div className="text-xs text-green-600">Explore California bills</div>
            </div>
            <ChevronRight size={16} className="text-green-400 ml-auto" />
          </button>
        </div>
      </div>
    </div>
  );

  // Additional render functions would go here for other tabs...

  const renderDataSources = () => (
    <div className="space-y-6">
      {/* Primary Sources */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Database size={20} className="text-blue-600" />
          Official Data Sources
        </h4>
        
        <div className="space-y-4">
          <div className="border border-gray-100 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h5 className="font-medium text-gray-800 flex items-center gap-2">
                  <Globe size={16} className="text-blue-500" />
                  Federal Register API
                </h5>
                <p className="text-sm text-gray-600 mt-1">
                  Official source for federal executive orders and presidential documents
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  <strong>Coverage:</strong> All federal executive orders since 1994
                </p>
              </div>
              <a 
                href="https://www.federalregister.gov/developers" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
              >
                Visit API <ExternalLink size={12} />
              </a>
            </div>
          </div>
          
          <div className="border border-gray-100 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h5 className="font-medium text-gray-800 flex items-center gap-2">
                  <FileText size={16} className="text-green-500" />
                  LegiScan API
                </h5>
                <p className="text-sm text-gray-600 mt-1">
                  Comprehensive state legislature tracking and bill information
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  <strong>Coverage:</strong> All 50 states, real-time legislative data
                </p>
              </div>
              <a 
                href="https://legiscan.com/legiscan" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-green-600 hover:text-green-800 flex items-center gap-1 text-sm"
              >
                Visit API <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* AI Analysis */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Zap size={20} className="text-purple-600" />
          AI Analysis Engine
        </h4>
        
        <div className="border border-purple-100 rounded-lg p-4 bg-purple-50">
          <h5 className="font-medium text-purple-800 flex items-center gap-2">
            <Monitor size={16} />
            Azure OpenAI GPT-4
          </h5>
          <p className="text-sm text-purple-700 mt-1">
            Advanced AI analysis providing summaries, key talking points, and business impact assessments
          </p>
          <div className="mt-3 text-xs text-purple-600">
            <p><strong>Analysis includes:</strong></p>
            <ul className="list-disc list-inside mt-1 space-y-1">
              <li>Executive summaries in plain language</li>
              <li>Key talking points for stakeholder discussions</li>
              <li>Business impact and market implications</li>
              <li>Long-term potential effects</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Supported States */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <BarChart3 size={20} className="text-orange-600" />
          Supported States ({Object.keys(SUPPORTED_STATES).length})
        </h4>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {Object.entries(SUPPORTED_STATES).map(([state, abbr]) => (
            <div key={abbr} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
              <span>{state}</span>
              <span className="text-gray-500 font-mono">{abbr}</span>
            </div>
          ))}
        </div>
        
        <p className="text-xs text-gray-500 mt-3">
          More states can be added based on demand. Contact support to request additional coverage.
        </p>
      </div>

      {/* Data Quality */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Shield size={20} className="text-green-600" />
          Data Quality & Reliability
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h5 className="font-medium text-gray-700 mb-2">Update Frequency</h5>
            <ul className="space-y-1 text-gray-600">
              <li>• Executive Orders: Real-time via Federal Register</li>
              <li>• State Legislation: Daily updates via LegiScan</li>
              <li>• AI Analysis: Generated on-demand</li>
            </ul>
          </div>
          <div>
            <h5 className="font-medium text-gray-700 mb-2">Data Accuracy</h5>
            <ul className="space-y-1 text-gray-600">
              <li>• 100% official government sources</li>
              <li>• AI analysis accuracy: ~95%</li>
              <li>• Real-time validation and verification</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFeatures = () => (
    <div className="space-y-6">
      {/* Core Features */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Star size={20} className="text-yellow-600" />
          Core Features
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <ScrollText size={16} className="text-blue-600" />
              </div>
              <div>
                <h5 className="font-medium text-gray-800">Executive Order Tracking</h5>
                <p className="text-sm text-gray-600">Real-time federal executive order monitoring with custom date ranges</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <FileText size={16} className="text-green-600" />
              </div>
              <div>
                <h5 className="font-medium text-gray-800">State Legislation Analysis</h5>
                <p className="text-sm text-gray-600">Multi-state bill tracking with topic-based search capabilities</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Zap size={16} className="text-purple-600" />
              </div>
              <div>
                <h5 className="font-medium text-gray-800">AI-Powered Analysis</h5>
                <p className="text-sm text-gray-600">Automated summaries, talking points, and impact assessments</p>
              </div>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                <Star size={16} className="text-yellow-600" />
              </div>
              <div>
                <h5 className="font-medium text-gray-800">Highlights & Bookmarks</h5>
                <p className="text-sm text-gray-600">Save important items for quick access across all pages</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <Search size={16} className="text-orange-600" />
              </div>
              <div>
                <h5 className="font-medium text-gray-800">Advanced Search & Filtering</h5>
                <p className="text-sm text-gray-600">Filter by category, state, date, and search across all content</p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <Download size={16} className="text-red-600" />
              </div>
              <div>
                <h5 className="font-medium text-gray-800">Export & Sharing</h5>
                <p className="text-sm text-gray-600">Copy reports, download documents, and share analysis</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Technical Features */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Monitor size={20} className="text-blue-600" />
          Technical Capabilities
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h5 className="font-medium text-gray-800 mb-2">Real-time Data</h5>
            <p className="text-sm text-gray-600">Live data fetching from official government APIs</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h5 className="font-medium text-gray-800 mb-2">Cloud Database</h5>
            <p className="text-sm text-gray-600">Azure SQL with automatic backups and scaling</p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <h5 className="font-medium text-gray-800 mb-2">Responsive Design</h5>
            <p className="text-sm text-gray-600">Works on desktop, tablet, and mobile devices</p>
          </div>
        </div>
      </div>

      {/* Upcoming Features */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
        <h4 className="font-semibold text-purple-800 mb-4 flex items-center gap-2">
          <Zap size={20} />
          Coming Soon
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-purple-700">
            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
            <span>Email alerts for new legislation</span>
          </div>
          <div className="flex items-center gap-2 text-purple-700">
            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
            <span>Custom report generation</span>
          </div>
          <div className="flex items-center gap-2 text-purple-700">
            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
            <span>API access for developers</span>
          </div>
          <div className="flex items-center gap-2 text-purple-700">
            <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
            <span>Advanced analytics dashboard</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSupport = () => (
    <div className="space-y-6">
      {/* FAQ Section */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Book size={20} className="text-purple-600" />
          Frequently Asked Questions
        </h4>
        
        <div className="space-y-4">
          <div className="border-b border-gray-100 pb-4">
            <h5 className="font-medium text-gray-800 mb-2">How often is the data updated?</h5>
            <p className="text-sm text-gray-600">
              Executive orders are updated in real-time from the Federal Register. State legislation 
              is updated daily from LegiScan. AI analysis is generated fresh for each new item.
            </p>
          </div>
          
          <div className="border-b border-gray-100 pb-4">
            <h5 className="font-medium text-gray-800 mb-2">Can I export the AI analysis?</h5>
            <p className="text-sm text-gray-600">
              Yes! You can copy reports to clipboard, download as text files, or share via email. 
              Each item has export options when expanded.
            </p>
          </div>
          
          <div className="border-b border-gray-100 pb-4">
            <h5 className="font-medium text-gray-800 mb-2">How accurate is the AI analysis?</h5>
            <p className="text-sm text-gray-600">
              Our Azure OpenAI integration provides approximately 95% accuracy. The AI is trained 
              on legislative documents and provides summaries, but always verify important details 
              with the original sources.
            </p>
          </div>
          
          <div>
            <h5 className="font-medium text-gray-800 mb-2">Can I request additional states?</h5>
            <p className="text-sm text-gray-600">
              Yes! We currently support 6 states and are expanding. Contact support to request 
              coverage for specific states based on your needs.
            </p>
          </div>
        </div>
      </div>

      {/* Technical Support */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Settings size={20} className="text-orange-600" />
          Technical Support
        </h4>
        
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Monitor size={16} className="text-gray-500 mt-1" />
            <div>
              <h5 className="font-medium text-gray-800">System Requirements</h5>
              <p className="text-sm text-gray-600">
                Works on any modern web browser (Chrome, Firefox, Safari, Edge). 
                No installation required.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Shield size={16} className="text-gray-500 mt-1" />
            <div>
              <h5 className="font-medium text-gray-800">Data Security</h5>
              <p className="text-sm text-gray-600">
                All data is encrypted in transit and at rest. We follow SOC 2 Type II 
                compliance standards for data protection.
              </p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <Globe size={16} className="text-gray-500 mt-1" />
            <div>
              <h5 className="font-medium text-gray-800">Service Status</h5>
              <p className="text-sm text-gray-600">
                Check our service status and uptime at{' '}
                <a href="https://status.legislationvue.com" className="text-blue-600 hover:text-blue-800">
                  status.legislationvue.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Company Information */}
      <div className="bg-gradient-to-r from-gray-50 to-blue-50 border border-gray-200 rounded-lg p-6">
        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <Users size={20} className="text-blue-600" />
          About MOREgroup
        </h4>
        
        <div className="space-y-3 text-sm">
          <p className="text-gray-700">
            LegislationVUE is developed by MOREgroup a collective of architecture, design, and 
            engineering brands dedicated to shaping impactful environments across the United States.
          </p>
          
          <div className="flex items-center gap-4 text-gray-600">
            <span>📧 legal@moregroup-inc.com</span>
            <span>🌐 www.moregroup-inc.com</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Info size={24} className="text-blue-600" />
            Help & Information
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
          >
            <XIcon size={24} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200">
          {tabs.map(tab => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <IconComponent size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'getting-started' && renderGettingStarted()}
          {activeTab === 'data-sources' && renderDataSources()}
          {activeTab === 'features' && renderFeatures()}
          {activeTab === 'support' && renderSupport()}
        </div>

        {/* Modal Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Need immediate help? Email{' '}
            <a href="mailto:legal@moregroup-inc.com" className="text-blue-600 hover:text-blue-800">
              legal@moregroup-inc.com
            </a>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};