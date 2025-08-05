import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HR1PolicyBanner from './HR1PolicyBanner';
import { getPageContainerClasses, getCardClasses, getTextClasses } from '../utils/darkModeClasses';
import { usePageTracking } from '../hooks/usePageTracking';
import {
  ScrollText,
  Star,
  FileText,
  Sparkles,
  TrendingUp,
  Target,
  ChevronRight,
  Building,
  GraduationCap,
  HeartPulse,
  Wrench,
  Search,
  Bell,
  BarChart3,
  Users,
  Clock,
  Shield,
  ArrowRight,
  CheckCircle,
  Zap,
  Globe,
  Brain,
  Eye,
  Download,
  PlayCircle,
  Flag,
  Check,
  Hash,
  Calendar,
  ChevronDown,
  LayoutGrid
} from 'lucide-react';

const Homepage = () => {
  const navigate = useNavigate();
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);

  // Track page view
  usePageTracking('Homepage');

  return (
    <div className={getPageContainerClasses()}>
      {/* HR1 Policy Banner */}
      <HR1PolicyBanner 
        onClick={() => {
          navigate('/hr1');
        }}
        expirationDate="2025-08-15" // Banner will expire on August 15, 2025
      />
      
      <style jsx="true">{`
        .gradient-button {
          background: transparent;
          transition: all 0.3s ease;
        }
        .gradient-button:hover {
          background: linear-gradient(to right, #2563eb, #9333ea) !important;
          color: white !important;
        }
        .gradient-button:hover svg {
          color: white !important;
          stroke: white !important;
        }
        .gradient-button:hover svg path {
          stroke: white !important;
        }
        .gradient-button:hover svg rect {
          stroke: white !important;
          fill: none !important;
        }
        .gradient-button:hover svg line {
          stroke: white !important;
        }
        .cta-button-secondary {
          background: transparent;
          transition: all 0.3s ease;
        }
        .cta-button-secondary:hover {
          background: white !important;
          color: #2563eb !important;
        }
        .cta-button-secondary:hover svg {
          color: #2563eb !important;
          stroke: #2563eb !important;
        }
        .cta-button-secondary:hover svg path {
          stroke: #2563eb !important;
        }
        .cta-button-secondary:hover svg rect {
          stroke: #2563eb !important;
          fill: none !important;
        }
        .cta-button-secondary:hover svg line {
          stroke: #2563eb !important;
        }
        .cta-button-container:hover .cta-button-primary {
          background: transparent !important;
          color: white !important;
          border: 2px solid white !important;
        }
        .cta-button-container:hover .cta-button-primary svg {
          color: white !important;
          stroke: white !important;
        }
        .cta-button-container:hover .cta-button-primary svg path {
          stroke: white !important;
        }
        .cta-button-container:hover .cta-button-primary svg rect {
          stroke: white !important;
          fill: none !important;
        }
        .cta-button-container:hover .cta-button-primary svg line {
          stroke: white !important;
        }
        .cta-button-container .cta-button-secondary:hover ~ .cta-button-primary {
          background: transparent !important;
          color: white !important;
          border: 2px solid white !important;
        }
      `}</style>
      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            
            <h1 className={getTextClasses('primary', 'text-4xl md:text-6xl font-bold mb-8 leading-tight')}>
              <span className="block">Track Policy &</span>
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent py-2">Legislative Changes</span>
            </h1>
            
            <p className={getTextClasses('secondary', 'text-lg mb-10 max-w-2xl mx-auto leading-relaxed')}>
              LegislationVUE automatically tracks Executive Orders and State Legislation, 
              then uses advanced AI to deliver instant summaries and business impact analysis.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
              <button 
                onClick={() => navigate('/executive-orders')}
                className="gradient-button border-2 border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text px-6 py-3 rounded-lg font-semibold hover:border-transparent hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
              >
                <ScrollText size={18} />
                Get Started with Executive Orders
              </button>
              <button 
                onClick={() => navigate('/state-legislation')}
                className="gradient-button border-2 border-gray-300 dark:border-dark-border text-gray-700 dark:text-dark-text px-6 py-3 rounded-lg font-semibold hover:border-transparent hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
              >
                <FileText size={18} />
                Get Started with State Legislation
              </button>
            </div>
          </div>
          
          {/* Hero Dashboard Preview */}
          <div className="relative max-w-5xl mx-auto">
            <div className="bg-white dark:bg-dark-bg-secondary rounded-2xl shadow-2xl border border-gray-200 dark:border-dark-border overflow-hidden">
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-4 flex items-center gap-3">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div className="text-gray-300 dark:text-dark-text-secondary text-sm font-medium">LegislationVUE Dashboard</div>
              </div>
              
              <div className="p-8">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Executive Order Preview */}
                  <div className="bg-gray-50 dark:bg-dark-bg-secondary border-2 border-gray-200 dark:border-dark-border rounded-lg p-2">
                    <div className={getCardClasses('rounded-lg p-4')}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ScrollText size={16} className="text-purple-600 dark:text-purple-400" />
                          <span className={getTextClasses('primary', 'font-semibold text-sm')}>Executive Orders</span>
                        </div>
                        <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs mb-3">
                        <Hash size={12} className="text-blue-600 dark:text-blue-400" />
                        <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-8"></div>
                        <Calendar size={12} className="text-green-600 dark:text-green-400" />
                        <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-12"></div>

                      </div>
                      
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* State Legislation Preview */}
                  <div className="bg-gray-50 dark:bg-dark-bg-secondary border-2 border-gray-200 dark:border-dark-border rounded-lg p-2">
                    <div className={getCardClasses("rounded-lg p-4")}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText size={16} className="text-green-600 dark:text-green-400" />
                          <span className={getTextClasses("primary", "font-semibold text-sm")}>State Legislation</span>
                        </div>
                        <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs mb-3">
                        <Hash size={12} className="text-blue-600 dark:text-blue-400" />
                        <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-8"></div>
                        <Calendar size={12} className="text-green-600 dark:text-green-400" />
                        <div className="h-2 bg-gray-300 dark:bg-gray-600 rounded w-12"></div>
                      </div>
                      
                      <div className="w-full mb-3">
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div className="h-2 rounded-full bg-gradient-to-r from-cyan-600 to-teal-500" style={{ width: '75%' }}></div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-white dark:bg-dark-bg">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className={getTextClasses('primary', 'text-4xl font-bold mb-4')}>
              Everything You Need to Track Legislation
            </h2>
            <p className={getTextClasses('secondary', 'text-xl max-w-3xl mx-auto')}>
              From automatic data collection to AI-powered analysis, 
              LegislationVUE provides comprehensive legislative intelligence.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Download,
                title: "Automatic Collection",
                description: "Continuously monitors and collects Executive Orders and State Legislation from official sources",
                color: "blue"
              },
              {
                icon: Brain,
                title: "AI-Powered Analysis",
                description: "Advanced natural language processing extracts key insights and generates comprehensive summaries",
                color: "purple"
              },
              {
                icon: TrendingUp,
                title: "Business Impact Assessment",
                description: "Identifies potential risks, opportunities, and regulatory implications for your organization",
                color: "green"
              },
              {
                icon: Target,
                title: "Strategic Talking Points",
                description: "Generates clear, actionable talking points for stakeholder communications and decision-making",
                color: "orange"
              },
              {
                icon: Star,
                title: "Smart Highlighting",
                description: "Mark important items on respective pages for easier recall and tracking with integrated filtering",
                color: "yellow"
              },
              {
                icon: BarChart3,
                title: "Trend Analysis",
                description: "Track legislative patterns and emerging themes across different states and categories",
                color: "indigo"
              }
            ].map((feature, index) => (
              <div
                key={index}
                className={getCardClasses('p-6 rounded-xl border-2 border-gray-200 transition-all duration-300 cursor-pointer hover:border-gray-300 dark:hover:border-dark-border hover:shadow-lg')}
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${
                  feature.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  feature.color === 'purple' ? 'bg-purple-100 dark:bg-purple-900/30' :
                  feature.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                  feature.color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
                  feature.color === 'yellow' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                  feature.color === 'indigo' ? 'bg-indigo-100 dark:bg-indigo-900/30' :
                  'bg-gray-100 dark:bg-gray-900/30'
                }`}>
                  <feature.icon size={24} className={
                    feature.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                    feature.color === 'purple' ? 'text-purple-600 dark:text-purple-400' :
                    feature.color === 'green' ? 'text-green-600 dark:text-green-400' :
                    feature.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                    feature.color === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' :
                    feature.color === 'indigo' ? 'text-indigo-600 dark:text-indigo-400' :
                    'text-gray-600 dark:text-gray-400'
                  } />
                </div>
                <h3 className={getTextClasses('primary', 'text-lg font-semibold mb-2')}>{feature.title}</h3>
                <p className={getTextClasses('secondary', 'text-sm leading-relaxed')}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-dark-bg-secondary dark:to-dark-bg">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className={getTextClasses('primary', 'text-4xl font-bold mb-4')}>
              Comprehensive Legislative Coverage
            </h2>
            <p className={getTextClasses('secondary', 'text-xl max-w-3xl mx-auto')}>
              Track legislation across multiple jurisdictions and practice areas 
              with our comprehensive monitoring system.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-start">
            {/* Federal Coverage */}
            <div className={getCardClasses('rounded-2xl p-8 shadow-lg h-full')}>
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                  <ScrollText size={32} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className={getTextClasses('primary', 'text-2xl font-bold')}>Federal Executive Orders</h3>
                  <p className={getTextClasses('secondary')}>Complete coverage of presidential directives</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className={getTextClasses('secondary')}>Real-time monitoring of new orders</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className={getTextClasses('secondary')}>Historical archive access</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className={getTextClasses('secondary')}>Impact analysis and summaries</span>
                </div>
              </div>
            </div>
            
            {/* State Coverage */}
            <div className={getCardClasses('rounded-2xl p-8 shadow-lg h-full')}>
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl">
                  <FileText size={32} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h3 className={getTextClasses('primary', 'text-2xl font-bold')}>State Legislation</h3>
                  <p className={getTextClasses('secondary')}>Session tracking and bill progress monitoring</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className={getTextClasses('secondary')}>Multi-state legislative tracking</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className={getTextClasses('secondary')}>Bill progress monitoring</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className={getTextClasses('secondary')}>Visual status updates</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights Feature Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              
              <h2 className={getTextClasses('primary', 'text-4xl font-bold mb-6')}>
                Highlight What Matters Most
              </h2>
              
              <p className={getTextClasses('secondary', 'text-xl mb-8 leading-relaxed')}>
                Highlight important items directly on Executive Orders and State Legislation pages 
                for easier recall and tracking. Combined with other filters, it makes tracking 
                those important items a breeze.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mt-1">
                    <Star size={16} className="text-yellow-600" />
                  </div>
                  <div>
                    <h3 className={getTextClasses('primary', 'font-semibold mb-1')}>One-Click Highlighting</h3>
                    <p className={getTextClasses('secondary', 'text-sm')}>Instantly mark executive orders and legislation that require leadership attention</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mt-1">
                    <Users size={16} className="text-yellow-600" />
                  </div>
                  <div>
                    <h3 className={getTextClasses('primary', 'font-semibold mb-1')}>Smart Filtering</h3>
                    <p className={getTextClasses('secondary', 'text-sm')}>Use highlight filters on respective pages to quickly find your marked items</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mt-1">
                    <Target size={16} className="text-yellow-600" />
                  </div>
                  <div>
                    <h3 className={getTextClasses('primary', 'font-semibold mb-1')}>Priority Focus</h3>
                    <p className={getTextClasses('secondary', 'text-sm')}>Keep the most critical regulatory changes at your fingertips for strategic discussions</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={getCardClasses('rounded-2xl p-8 shadow-xl')}>
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 dark:from-dark-bg-tertiary dark:to-dark-bg-secondary px-4 py-3 rounded-t-lg flex items-center gap-3 -mx-8 -mt-8 mb-6">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div className="text-gray-300 dark:text-dark-text-secondary text-sm font-medium">Executive Orders - Smart Filtering</div>
              </div>
              
              {/* Filter Controls */}
              <div className="mb-4 p-3 bg-gray-50 dark:bg-dark-bg-tertiary rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Search size={14} className="text-gray-500" />
                  <span className={getTextClasses('secondary', 'text-xs font-medium')}>Active Filters:</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs border border-yellow-200">
                    <Star size={10} />
                    Highlighted Only
                  </div>
                  <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs border border-blue-200">
                    <Building size={10} />
                    Civic
                  </div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="border border-gray-200 dark:border-dark-border rounded-lg p-3 hover:border-yellow-300 dark:hover:border-yellow-400 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={getTextClasses('primary', 'font-semibold text-xs')}>Executive Order #14028</h3>
                    <Star size={14} className="text-yellow-500 fill-current" />
                  </div>
                  <p className={getTextClasses('secondary', 'text-xs mb-2')}>Cybersecurity Requirements for Federal Agencies</p>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                      <Building size={8} />
                      Civic
                    </div>
                    <button className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs">View Details</button>
                  </div>
                </div>
                
                <div className="border border-gray-200 dark:border-dark-border rounded-lg p-3 hover:border-yellow-300 dark:hover:border-yellow-400 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={getTextClasses('primary', 'font-semibold text-xs')}>Executive Order #14029</h3>
                    <Star size={14} className="text-yellow-500 fill-current" />
                  </div>
                  <p className={getTextClasses('secondary', 'text-xs mb-2')}>Infrastructure Security Enhancement</p>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                      <Building size={8} />
                      Civic
                    </div>
                    <button className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs">View Details</button>
                  </div>
                </div>
                
                <div className="border border-gray-200 dark:border-dark-border rounded-lg p-3 hover:border-yellow-300 dark:hover:border-yellow-400 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={getTextClasses('primary', 'font-semibold text-xs')}>Executive Order #14030</h3>
                    <Star size={14} className="text-yellow-500 fill-current" />
                  </div>
                  <p className={getTextClasses('secondary', 'text-xs mb-2')}>Federal Building Standards Update</p>
                  <div className="flex items-center justify-between">
                    <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                      <Building size={8} />
                      Civic
                    </div>
                    <button className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-xs">View Details</button>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-dark-border">
                <p className={getTextClasses('muted', 'text-xs text-center')}>3 highlighted items found • Filter applied</p>
                <button 
                  onClick={() => {
                    navigate('/executive-orders');
                    window.scrollTo(0, 0);
                  }}
                  className="w-full mt-4 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <ScrollText size={16} />
                  Try Executive Orders
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Practice Areas */}
      <section className="py-20 px-6 bg-white dark:bg-dark-bg">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className={getTextClasses('primary', 'text-4xl font-bold mb-4')}>
              Organized by Practice Areas
            </h2>
            <p className={getTextClasses('secondary', 'text-xl max-w-3xl mx-auto')}>
              Filter and organize legislation by relevant practice areas 
              to focus on what matters most to your organization.
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                icon: Building,
                title: "Civic & Government",
                description: "Public policy, municipal regulations, and government operations",
                color: "blue"
              },
              {
                icon: GraduationCap,
                title: "Education",
                description: "School policies, university regulations, and educational funding",
                color: "orange"
              },
              {
                icon: Wrench,
                title: "Engineering & Infrastructure",
                description: "Construction, technology standards, and infrastructure projects",
                color: "green"
              },
              {
                icon: HeartPulse,
                title: "Healthcare",
                description: "Medical regulations, public health policies, and healthcare funding",
                color: "red"
              }
            ].map((area, index) => (
              <div key={index} className={getCardClasses('border-2 border-gray-200 rounded-xl p-6 hover:border-gray-300 dark:hover:border-dark-border transition-all duration-300 hover:shadow-lg')}>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${
                  area.color === 'blue' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  area.color === 'orange' ? 'bg-orange-100 dark:bg-orange-900/30' :
                  area.color === 'green' ? 'bg-green-100 dark:bg-green-900/30' :
                  area.color === 'red' ? 'bg-red-100 dark:bg-red-900/30' :
                  'bg-gray-100 dark:bg-gray-900/30'
                }`}>
                  <area.icon size={24} className={
                    area.color === 'blue' ? 'text-blue-600 dark:text-blue-400' :
                    area.color === 'orange' ? 'text-orange-600 dark:text-orange-400' :
                    area.color === 'green' ? 'text-green-600 dark:text-green-400' :
                    area.color === 'red' ? 'text-red-600 dark:text-red-400' :
                    'text-gray-600 dark:text-gray-400'
                  } />
                </div>
                <h3 className={getTextClasses('primary', 'text-lg font-semibold mb-2')}>{area.title}</h3>
                <p className={getTextClasses('secondary', 'text-sm leading-relaxed')}>{area.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Features Deep Dive */}
      <section className="py-20 px-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className={getTextClasses('primary', 'text-4xl font-bold mb-4')}>
              Advanced AI Analysis
            </h2>
            <p className={getTextClasses('secondary', 'text-xl max-w-3xl mx-auto')}>
              Our AI doesn't just collect data—it understands it. Get insights 
              that would take hours of manual analysis in seconds.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className={getCardClasses('rounded-xl p-8 shadow-lg')}>
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mb-6">
                <FileText size={32} className="text-white" />
              </div>
              <h3 className={getTextClasses('primary', 'text-xl font-semibold mb-4')}>Executive Summaries</h3>
              <p className={getTextClasses('secondary', 'mb-6')}>
                Distills complex legislation into clear, actionable summaries that highlight the most important provisions and implications.
              </p>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-purple-800 text-sm italic">
                  "This bill establishes new data privacy requirements for companies handling personal information, 
                  with penalties up to $50,000 for violations..."
                </p>
              </div>
            </div>
            
            <div className={getCardClasses('rounded-xl p-8 shadow-lg')}>
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-6">
                <Target size={32} className="text-white" />
              </div>
              <h3 className={getTextClasses('primary', 'text-xl font-semibold mb-4')}>Strategic Talking Points</h3>
              <p className={getTextClasses('secondary', 'mb-6')}>
                Generates key discussion points for leadership meetings, stakeholder communications, and strategic planning sessions.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-700 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Compliance deadline: 180 days
                </div>
                <div className="flex items-center gap-2 text-blue-700 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Estimated implementation cost: $125K
                </div>
                <div className="flex items-center gap-2 text-blue-700 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Competitive advantage opportunity
                </div>
              </div>
            </div>
            
            <div className={getCardClasses('rounded-xl p-8 shadow-lg')}>
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp size={32} className="text-white" />
              </div>
              <h3 className={getTextClasses('primary', 'text-xl font-semibold mb-4')}>Business Impact Analysis</h3>
              <p className={getTextClasses('secondary', 'mb-6')}>
                Identifies specific risks, opportunities, and operational changes your organization needs to consider.
              </p>
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-red-800 text-sm font-medium">Risk Assessment</div>
                  <div className="text-red-700 text-xs">High compliance burden</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-green-800 text-sm font-medium">Opportunity</div>
                  <div className="text-green-700 text-xs">Market differentiation potential</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Transform Your Legislative Intelligence?
          </h2>
          <p className="text-xl text-blue-100 mb-10 leading-relaxed">
            Empower your leadership team with comprehensive legislative intelligence. 
            Stay informed about regulatory changes that impact your organization with 
            AI-powered analysis and insights.
          </p>
          
        </div>
      </section>
    </div>
  );
};

export default Homepage;