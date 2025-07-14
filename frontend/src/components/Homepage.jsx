import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import HR1PolicyBanner from './HR1PolicyBanner';
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
  Stethoscope,
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
  PlayCircle
} from 'lucide-react';

const Homepage = () => {
  const navigate = useNavigate();
  const [hoveredFeature, setHoveredFeature] = useState(null);
  const [hoveredButton, setHoveredButton] = useState(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* HR1 Policy Banner */}
      <HR1PolicyBanner 
        onClick={() => {
          navigate('/hr1');
        }}
      />
      
      <style jsx>{`
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
      <section className="relative overflow-hidden pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Sparkles size={16} />
              Powered by AI Technology
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-8 leading-relaxed">
              <span className="block">Stay Ahead of</span>
              <span className="block bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent py-2">Legislative Changes</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto leading-relaxed">
              LegislationVUE automatically tracks Executive Orders and State Legislation, 
              then uses advanced AI to deliver instant summaries, key talking points, 
              and business impact analysis—so you never miss what matters.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button 
                onClick={() => navigate('/executive-orders')}
                className="gradient-button border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-lg font-semibold text-lg hover:border-transparent hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
              >
                <ScrollText size={20} />
                Get Started with Executive Orders
              </button>
              <button 
                onClick={() => navigate('/state-legislation')}
                className="gradient-button border-2 border-gray-300 text-gray-700 px-8 py-4 rounded-lg font-semibold text-lg hover:border-transparent hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
              >
                <FileText size={20} />
                Get Started with State Legislation
              </button>
            </div>
          </div>
          
          {/* Hero Dashboard Preview */}
          <div className="relative max-w-5xl mx-auto">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-4 flex items-center gap-3">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div className="text-gray-300 text-sm font-medium">LegislationVUE Dashboard</div>
              </div>
              
              <div className="p-8">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Executive Order Preview */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-600 rounded-full">
                          <FileText size={20} className="text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-purple-900">Executive Summary</h3>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-600 text-white text-xs font-medium rounded-md">
                        <Sparkles size={12} />
                        AI Generated
                      </div>
                    </div>
                    <div className="text-sm text-purple-800 leading-relaxed">
                      This executive order establishes new cybersecurity requirements for federal agencies, 
                      requiring enhanced security protocols and regular compliance audits...
                    </div>
                  </div>
                  
                  {/* Talking Points Preview */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600 rounded-full">
                          <Target size={20} className="text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-blue-900">Key Talking Points</h3>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white text-xs font-medium rounded-md">
                        <Sparkles size={12} />
                        AI Generated
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                        <p className="text-sm text-blue-800">Mandatory security upgrades required within 90 days</p>
                      </div>
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                        <p className="text-sm text-blue-800">Compliance costs estimated at $2.3M annually</p>
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
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Track Legislation
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From automatic data collection to AI-powered analysis, 
              LegislationVUE provides comprehensive legislative intelligence.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
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
                title: "Firm-Wide Highlights",
                description: "Mark critical legislation for firm-wide visibility and create a centralized reference for leadership",
                color: "yellow"
              },
              {
                icon: Bell,
                title: "Smart Alerts",
                description: "Intelligent notifications for legislation that matters to your industry and interests",
                color: "red"
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
                className={`p-8 rounded-xl border-2 transition-all duration-300 cursor-pointer transform hover:scale-105 ${
                  hoveredFeature === index
                    ? `border-${feature.color}-500 shadow-xl bg-${feature.color}-50`
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div className={`w-14 h-14 rounded-xl bg-${feature.color}-100 flex items-center justify-center mb-6`}>
                  <feature.icon size={28} className={`text-${feature.color}-600`} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Coverage Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Comprehensive Legislative Coverage
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Track legislation across multiple jurisdictions and practice areas 
              with our comprehensive monitoring system.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Federal Coverage */}
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Building size={32} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">Federal Executive Orders</h3>
                  <p className="text-gray-600">Complete coverage of presidential directives</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className="text-gray-700">Real-time monitoring of new orders</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className="text-gray-700">Historical archive access</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-500" />
                  <span className="text-gray-700">Impact analysis and summaries</span>
                </div>
              </div>
            </div>
            
            {/* State Coverage */}
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-green-100 rounded-xl">
                  <Globe size={32} className="text-green-600" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900">State Legislation</h3>
                  <p className="text-gray-600">Multi-state legislative tracking</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {['CA', 'CO', 'KY', 'NV', 'SC', 'TX'].map((state) => (
                  <div key={state} className="bg-green-100 text-green-800 px-3 py-2 rounded-lg text-center font-semibold">
                    {state}
                  </div>
                ))}
              </div>
              <p className="text-gray-600 text-sm">
                Currently monitoring 6 states with expansion planned for all 50 states
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights Feature Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-yellow-50 to-orange-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
                <Star size={16} />
                Firm-Wide Collaboration
              </div>
              
              <h2 className="text-4xl font-bold text-gray-900 mb-6">
                Highlight What Matters Most
              </h2>
              
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Mark critical legislation for firm-wide visibility. Create a centralized 
                highlights page where leadership can quickly reference the most important 
                regulatory changes affecting your organization.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mt-1">
                    <Star size={16} className="text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">One-Click Highlighting</h3>
                    <p className="text-gray-600 text-sm">Instantly mark executive orders and legislation that require leadership attention</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mt-1">
                    <Users size={16} className="text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Centralized Reference</h3>
                    <p className="text-gray-600 text-sm">All highlighted items appear on a dedicated page for easy firm-wide access</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center mt-1">
                    <Target size={16} className="text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">Priority Focus</h3>
                    <p className="text-gray-600 text-sm">Keep the most critical regulatory changes at your fingertips for strategic discussions</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-2xl p-8 shadow-xl">
              <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-4 py-3 rounded-t-lg flex items-center gap-3 -mx-8 -mt-8 mb-6">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                  <div className="w-3 h-3 rounded-full bg-green-400"></div>
                </div>
                <div className="text-gray-300 text-sm font-medium">Highlights Dashboard</div>
              </div>
              
              <div className="space-y-4">
                <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm">Executive Order #14028</h3>
                    <Star size={16} className="text-yellow-500 fill-current" />
                  </div>
                  <p className="text-xs text-gray-600 mb-2">Cybersecurity Requirements for Federal Agencies</p>
                  <div className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    <Building size={10} />
                    Civic
                  </div>
                </div>
                
                <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm">CA Senate Bill 1001</h3>
                    <Star size={16} className="text-yellow-500 fill-current" />
                  </div>
                  <p className="text-xs text-gray-600 mb-2">Data Privacy Protection Act</p>
                  <div className="inline-flex items-center gap-1 bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                    <Wrench size={10} />
                    Engineering
                  </div>
                </div>
                
                <div className="border border-yellow-200 bg-yellow-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-sm">TX House Bill 2847</h3>
                    <Star size={16} className="text-yellow-500 fill-current" />
                  </div>
                  <p className="text-xs text-gray-600 mb-2">Healthcare Infrastructure Modernization</p>
                  <div className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
                    <Stethoscope size={10} />
                    Healthcare
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-500 text-center">3 highlighted items • Updated 2 hours ago</p>
                <button 
                  onClick={() => navigate('/highlights')}
                  className="w-full mt-4 bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-all duration-200 transform hover:scale-105 flex items-center justify-center gap-2"
                >
                  <Star size={16} />
                  Visit Highlights
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Practice Areas */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Organized by Practice Areas
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
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
                color: "blue",
                count: "150+ Bills"
              },
              {
                icon: GraduationCap,
                title: "Education",
                description: "School policies, university regulations, and educational funding",
                color: "orange",
                count: "89+ Bills"
              },
              {
                icon: Wrench,
                title: "Engineering & Infrastructure",
                description: "Construction, technology standards, and infrastructure projects",
                color: "green",
                count: "124+ Bills"
              },
              {
                icon: Stethoscope,
                title: "Healthcare",
                description: "Medical regulations, public health policies, and healthcare funding",
                color: "red",
                count: "203+ Bills"
              }
            ].map((area, index) => (
              <div key={index} className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-all duration-300 hover:shadow-lg">
                <div className={`w-12 h-12 rounded-lg bg-${area.color}-100 flex items-center justify-center mb-4`}>
                  <area.icon size={24} className={`text-${area.color}-600`} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{area.title}</h3>
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">{area.description}</p>
                <div className={`inline-flex items-center gap-2 text-${area.color}-600 text-sm font-medium`}>
                  <BarChart3 size={16} />
                  {area.count}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI Features Deep Dive */}
      <section className="py-20 px-6 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Advanced AI Analysis
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our AI doesn't just collect data—it understands it. Get insights 
              that would take hours of manual analysis in seconds.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mb-6">
                <FileText size={32} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Executive Summaries</h3>
              <p className="text-gray-600 mb-6">
                Distills complex legislation into clear, actionable summaries that highlight the most important provisions and implications.
              </p>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-purple-800 text-sm italic">
                  "This bill establishes new data privacy requirements for companies handling personal information, 
                  with penalties up to $50,000 for violations..."
                </p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-6">
                <Target size={32} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Strategic Talking Points</h3>
              <p className="text-gray-600 mb-6">
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
            
            <div className="bg-white rounded-xl p-8 shadow-lg">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp size={32} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Business Impact Analysis</h3>
              <p className="text-gray-600 mb-6">
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
          
          <div className="mt-8 flex flex-wrap justify-center items-center gap-8 text-blue-100 text-sm">
            <div className="flex items-center gap-2">
              <Shield size={16} />
              SOC 2 Compliant
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} />
              24/7 Monitoring
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={16} />
              99.9% Uptime
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Homepage;