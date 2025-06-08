// src/components/ApplicationInfoModal.jsx
import React from 'react';
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
  ExternalLink
} from 'lucide-react';

const ApplicationInfoModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-violet-600 to-blue-600 rounded-full flex items-center justify-center">
              <Info className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              How to Use LegislationVUE
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
          >
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          
          {/* Getting Started Section */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Play className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-bold text-gray-800">Getting Started</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <ScrollText className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-800">1. Executive Orders</h4>
                </div>
                <ul className="space-y-2 text-sm text-blue-700">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>Click "Executive Orders" in the menu</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>Expand "Fetch Fresh Data" section</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>Choose date range or use quick picks</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>Click "Fetch Executive Orders"</span>
                  </li>
                </ul>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <FileText className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-green-800">2. State Legislation</h4>
                </div>
                <ul className="space-y-2 text-sm text-green-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Choose a state from the menu (CA, TX, etc.)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Expand "Fetch Fresh Data" section</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Choose "Search by Topic" or "Latest Bills"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    <span>Click fetch button and wait for AI analysis</span>
                  </li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Star className="w-5 h-5 text-yellow-600" />
                  <h4 className="font-semibold text-yellow-800">3. Save Highlights</h4>
                </div>
                <ul className="space-y-2 text-sm text-yellow-700">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>Click the star icon on any bill or order</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>Access all highlights from the main menu</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>Filter highlights by category or source</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-1">•</span>
                    <span>Export or share your highlighted items</span>
                  </li>
                </ul>
              </div>

              <div className="bg-purple-50 border border-purple-200 rounded-lg p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Building className="w-5 h-5 text-purple-600" />
                  <h4 className="font-semibold text-purple-800">4. AI Analysis</h4>
                </div>
                <ul className="space-y-2 text-sm text-purple-700">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">•</span>
                    <span>Every item gets AI summary automatically</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">•</span>
                    <span>Expand items to see key talking points</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">•</span>
                    <span>View business impact analysis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">•</span>
                    <span>Copy or download detailed reports</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Data Sources Section */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Database className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-800">Data Sources & Technology</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <Globe className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-800">Federal Register</h4>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Official source for executive orders and federal regulations
                </p>
                <a 
                  href="https://www.federalregister.gov" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 text-xs hover:text-blue-800 flex items-center gap-1"
                >
                  federalregister.gov <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <FileText className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-gray-800">LegiScan API</h4>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Comprehensive state legislation tracking and analysis
                </p>
                <a 
                  href="https://legiscan.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-green-600 text-xs hover:text-green-800 flex items-center gap-1"
                >
                  legiscan.com <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-5 h-5 bg-gradient-to-r from-violet-500 to-blue-500 rounded flex items-center justify-center">
                    <span className="text-white text-xs font-bold">AI</span>
                  </div>
                  <h4 className="font-semibold text-gray-800">Azure OpenAI</h4>
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  Advanced AI analysis for summaries and business impact
                </p>
                <span className="text-purple-600 text-xs">
                  GPT-4 powered analysis
                </span>
              </div>
            </div>

            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-semibold text-gray-800 mb-2">Supported States</h4>
              <div className="flex flex-wrap gap-2">
                {['California (CA)', 'Colorado (CO)', 'Kentucky (KY)', 'Nevada (NV)', 'South Carolina (SC)', 'Texas (TX)'].map((state) => (
                  <span key={state} className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                    {state}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Troubleshooting Section */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="w-6 h-6 text-orange-600" />
              <h3 className="text-xl font-bold text-gray-800">Troubleshooting & Support</h3>
            </div>
            
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-red-800 mb-2">App Not Working?</h4>
                    <div className="space-y-2 text-sm text-red-700">
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 mt-1">1.</span>
                        <span><strong>Check your internet connection</strong> - The app requires internet to fetch data</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 mt-1">2.</span>
                        <span><strong>Refresh the page</strong> - Sometimes a simple refresh solves loading issues</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 mt-1">3.</span>
                        <span><strong>Clear browser cache</strong> - Old cached data might cause conflicts</span>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-red-500 mt-1">4.</span>
                        <span><strong>Try a different browser</strong> - Chrome, Firefox, or Edge work best</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-yellow-800 mb-2">Common Issues</h4>
                    <div className="space-y-2 text-sm text-yellow-700">
                      <div><strong>No data showing:</strong> Use the "Fetch Fresh Data" sections to load content</div>
                      <div><strong>Slow loading:</strong> AI analysis takes 1-3 minutes - please be patient</div>
                      <div><strong>Search not working:</strong> Make sure to expand the fetch section first</div>
                      <div><strong>Highlights missing:</strong> Check if you're on the right page or clear filters</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-green-800 mb-2">Best Practices</h4>
                    <div className="space-y-2 text-sm text-green-700">
                      <div><strong>Start small:</strong> Fetch a few items first to test the system</div>
                      <div><strong>Be patient:</strong> AI analysis provides better results but takes time</div>
                      <div><strong>Use highlights:</strong> Save important items for quick access later</div>
                      <div><strong>Regular updates:</strong> Fetch fresh data weekly for latest information</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Support */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-bold text-gray-800">Need Help?</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">Technical Support</h4>
                <p className="text-sm text-gray-600 mb-3">
                  For technical issues, bugs, or system problems
                </p>
                <a 
                  href="mailto:support@legislationvue.com" 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm font-medium"
                >
                  <Mail className="w-4 h-4" />
                  support@legislationvue.com
                </a>
              </div>
              
              <div>
                <h4 className="font-semibold text-gray-800 mb-2">Feature Requests</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Suggestions for new features or improvements
                </p>
                <a 
                  href="mailto:feedback@legislationvue.com" 
                  className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors duration-200 text-sm font-medium"
                >
                  <Star className="w-4 h-4" />
                  feedback@legislationvue.com
                </a>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-white bg-opacity-60 rounded-lg">
              <p className="text-sm text-gray-700">
                <strong>Response Time:</strong> We typically respond within 24 hours during business days.
                Include your browser type and any error messages for faster assistance.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              LegislationVUE v2.0 • Built by MORE Group
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors duration-200 font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApplicationInfoModal;