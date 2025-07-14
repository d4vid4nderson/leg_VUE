import React, { useState } from 'react';
import {
  FileText,
  Building,
  GraduationCap,
  HeartPulse,
  Wrench,
  Sparkles,
  Target,
  TrendingUp,
  Globe,
  Users,
  Calendar,
  Clock,
  BarChart3,
  ArrowRight,
  ExternalLink,
  Bell,
  Eye,
  Shield,
  Scale,
  Briefcase,
  AlertCircle,
  CheckCircle,
  Star
} from 'lucide-react';

const FederalLegislationPage = () => {
  const [hoveredFeature, setHoveredFeature] = useState(null);

  // Federal legislation data - to be populated from API
  const featuredBills = [];

  const totalBills = 0;
  const totalCommittees = 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      {/* Header Section */}
      <section className="relative overflow-hidden px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-purple-100 text-purple-800 px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Building size={16} />
              Federal Coverage
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
              <span className="block">Federal Legislation</span>
              <span className="block bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent py-2">Intelligence</span>
            </h1>
            
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Track all federal bills and resolutions with comprehensive AI analysis. 
              Monitor federal legislation across congressional committees with real-time updates and strategic insights.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-6 mb-12">
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <FileText size={24} className="text-purple-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{totalBills}</div>
                  <div className="text-gray-600 text-sm">Active Bills</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Building size={24} className="text-blue-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{totalCommittees}</div>
                  <div className="text-gray-600 text-sm">Committees</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <Sparkles size={24} className="text-green-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">100%</div>
                  <div className="text-gray-600 text-sm">AI Analyzed</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-lg border border-gray-200">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-xl">
                  <Clock size={24} className="text-orange-600" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">Real-time</div>
                  <div className="text-gray-600 text-sm">Updates</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Comprehensive Federal Legislative Intelligence
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Stay informed about federal legislation that impacts your organization 
              with AI-powered analysis and strategic insights.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: FileText,
                title: "Complete Bill Tracking",
                description: "Monitor all House and Senate bills from introduction through final passage with detailed legislative history",
                color: "purple"
              },
              {
                icon: Sparkles,
                title: "AI-Powered Analysis", 
                description: "Advanced natural language processing provides executive summaries, talking points, and impact assessments",
                color: "blue"
              },
              {
                icon: Bell,
                title: "Committee Monitoring",
                description: "Track bills through committee processes with alerts for markups, hearings, and votes",
                color: "green"
              },
              {
                icon: TrendingUp,
                title: "Impact Assessment",
                description: "Understand how federal legislation affects your industry, operations, and strategic planning",
                color: "orange"
              },
              {
                icon: Target,
                title: "Strategic Insights",
                description: "Get actionable intelligence for regulatory compliance, advocacy, and business planning",
                color: "red"
              },
              {
                icon: BarChart3,
                title: "Trend Analysis",
                description: "Identify legislative patterns, emerging themes, and policy directions across Congress",
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

      {/* Featured Bills Section */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Featured Federal Legislation
            </h2>
            <p className="text-xl text-gray-600">
              High-priority bills currently moving through Congress with comprehensive AI analysis
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {featuredBills.length > 0 ? featuredBills.map((bill, index) => (
              <div
                key={bill.number}
                className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300"
              >
                <div className="p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 ${
                        bill.category === 'civic' ? 'bg-blue-500' :
                        bill.category === 'healthcare' ? 'bg-red-500' :
                        bill.category === 'engineering' ? 'bg-green-500' :
                        'bg-purple-500'
                      } rounded-2xl flex items-center justify-center shadow-lg`}>
                        <span className="text-white font-bold text-sm">{bill.chamber === 'House' ? 'HR' : 'S'}</span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">{bill.number}</h3>
                        <div className="flex items-center gap-2 text-gray-600 text-sm">
                          <Calendar size={14} />
                          <span>{new Date(bill.introduced).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">{bill.title}</h4>
                  
                  <div className="bg-gray-50 rounded-xl p-4 mb-6">
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                          bill.status === 'Committee Review' ? 'bg-yellow-100 text-yellow-800' :
                          bill.status === 'Floor Vote Scheduled' ? 'bg-blue-100 text-blue-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          <Clock size={12} />
                          {bill.status}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-green-600">
                          <Sparkles size={14} />
                          <span className="text-sm font-medium">AI Analyzed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-gray-600 leading-relaxed mb-6">
                    {bill.description}
                  </p>
                  
                  {/* Practice Area Tag */}
                  <div className="mb-6">
                    <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
                      bill.category === 'civic' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                      bill.category === 'healthcare' ? 'bg-red-50 text-red-700 border border-red-200' :
                      bill.category === 'engineering' ? 'bg-green-50 text-green-700 border border-green-200' :
                      'bg-purple-50 text-purple-700 border border-purple-200'
                    }`}>
                      {bill.category === 'civic' && <Building size={16} />}
                      {bill.category === 'healthcare' && <HeartPulse size={16} />}
                      {bill.category === 'engineering' && <Wrench size={16} />}
                      {bill.category === 'education' && <GraduationCap size={16} />}
                      <span className="capitalize">{bill.category}</span>
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  <button
                    onClick={() => {
                      if (bill.number === 'HR 1') {
                        window.location.href = '/federal-legislation/hr1';
                      } else {
                        window.location.href = `/federal-legislation/${bill.number.toLowerCase().replace(' ', '')}`;
                      }
                    }}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-4 rounded-xl font-semibold transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
                  >
                    <span>View {bill.number} Analysis</span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )) : (
              <div className="col-span-full text-center py-12">
                <AlertCircle size={48} className="mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Federal Legislation Coming Soon</h3>
                <p className="text-gray-600">
                  We're working on bringing you comprehensive federal legislation tracking. Check back soon!
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* AI Analysis Showcase */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              AI-Powered Legislative Analysis
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our advanced AI provides comprehensive analysis of every federal bill, 
              giving you the insights you need to make informed decisions.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-200">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mb-6">
                <FileText size={32} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Executive Summaries</h3>
              <p className="text-gray-600 mb-6">
                Concise summaries that cut through legislative complexity to highlight key provisions, 
                impacts, and implementation requirements.
              </p>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-purple-800 text-sm italic">
                  "This bill establishes new federal cybersecurity standards for critical infrastructure, 
                  requiring compliance within 18 months with potential penalties up to $1M..."
                </p>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-200">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center mb-6">
                <Target size={32} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Strategic Talking Points</h3>
              <p className="text-gray-600 mb-6">
                Key discussion points for leadership briefings, stakeholder meetings, 
                and strategic planning sessions.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-blue-700 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  18-month implementation timeline
                </div>
                <div className="flex items-center gap-2 text-blue-700 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  $500M in federal funding allocated
                </div>
                <div className="flex items-center gap-2 text-blue-700 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  Bipartisan support in committee
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-200">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center mb-6">
                <TrendingUp size={32} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Business Impact Analysis</h3>
              <p className="text-gray-600 mb-6">
                Detailed assessment of how federal legislation affects your industry, 
                operations, and bottom line.
              </p>
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-red-800 text-sm font-medium">Compliance Requirements</div>
                  <div className="text-red-700 text-xs">New reporting obligations</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="text-green-800 text-sm font-medium">Market Opportunities</div>
                  <div className="text-green-700 text-xs">Federal contract eligibility</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-6 bg-gradient-to-r from-purple-600 to-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Stay Ahead of Federal Legislative Changes
          </h2>
          <p className="text-xl text-purple-100 mb-10 leading-relaxed">
            Empower your leadership team with comprehensive federal legislative intelligence. 
            Monitor congressional activity that impacts your organization with AI-powered analysis.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <button 
              onClick={() => window.location.href = '/federal-legislation/hr1'}
              className="bg-white text-purple-600 px-8 py-4 rounded-xl font-semibold hover:shadow-xl transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
            >
              <FileText size={20} />
              View HR 1 Analysis
            </button>
            <button 
              onClick={() => window.location.href = '/federal-legislation/browse'}
              className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold hover:bg-white hover:text-purple-600 transition-all duration-300 flex items-center gap-2"
            >
              <Eye size={20} />
              Browse All Federal Bills
            </button>
          </div>
          
          <div className="mt-8 flex flex-wrap justify-center items-center gap-8 text-purple-100 text-sm">
            <div className="flex items-center gap-2">
              <Shield size={16} />
              Secure & Reliable
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} />
              Real-time Updates
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={16} />
              Comprehensive Coverage
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default FederalLegislationPage;