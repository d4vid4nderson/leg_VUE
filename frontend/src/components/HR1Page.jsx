import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building, Shield, HeartPulse, Wheat, DollarSign, GraduationCap, Landmark, Cog, ChevronDown, ChevronUp, FileText, ExternalLink } from 'lucide-react';
import { getTextClasses, getPageContainerClasses, getCardClasses } from '../utils/darkModeClasses';

const HR1PolicyPage = () => {
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState({});

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  const PolicySection = ({ id, icon: Icon, title, children, defaultExpanded = false }) => {
    const isExpanded = expandedSections[id] ?? defaultExpanded;
    
    return (
      <div className={getCardClasses('rounded-xl shadow-sm mb-4 sm:mb-6 overflow-hidden hover:shadow-md transition-all duration-300')}>
        <button
          onClick={() => toggleSection(id)}
          className="w-full px-4 sm:px-6 py-3 sm:py-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 flex items-center justify-between hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/30 dark:hover:to-indigo-900/30 transition-colors min-h-[60px] sm:min-h-[auto]"
        >
          <div className="flex items-center space-x-3">
            <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h3 className={getTextClasses('primary', 'text-base sm:text-lg font-semibold')}>{title}</h3>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-6 w-6 sm:h-5 sm:w-5 text-gray-600 dark:text-dark-text-secondary" />
          ) : (
            <ChevronDown className="h-6 w-6 sm:h-5 sm:w-5 text-gray-600 dark:text-dark-text-secondary" />
          )}
        </button>
        {isExpanded && (
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-gray-100 dark:border-dark-border">
            {children}
          </div>
        )}
      </div>
    );
  };

  const ImpactCard = ({ title, status, opportunity, action, bgColor, iconColor }) => (
    <div className={`${bgColor} dark:bg-dark-bg-secondary rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 shadow-sm border border-gray-200 dark:border-dark-border hover:shadow-md transition-shadow duration-300`}>
      <h4 className={getTextClasses('primary', 'font-bold mb-3 sm:mb-4 text-lg sm:text-xl leading-tight')}>{title}</h4>
      <div className="space-y-3 sm:space-y-4">
        <div className="bg-white/50 dark:bg-dark-bg-tertiary/50 rounded-lg p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <div className={`w-3 h-3 sm:w-2 sm:h-2 ${iconColor} rounded-full mt-1 sm:mt-2 flex-shrink-0`}></div>
            <div>
              <span className={getTextClasses('primary', 'font-semibold block mb-1')}>Current Status</span>
              <p className={getTextClasses('secondary', 'leading-relaxed')}>{status}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white/50 dark:bg-dark-bg-tertiary/50 rounded-lg p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-green-500 dark:bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <span className={getTextClasses('primary', 'font-semibold block mb-1')}>Market Opportunity</span>
              <p className={getTextClasses('secondary', 'leading-relaxed')}>{opportunity}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white/50 dark:bg-dark-bg-tertiary/50 rounded-lg p-3 sm:p-4">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
            <div>
              <span className={getTextClasses('primary', 'font-semibold block mb-1')}>Recommended Action</span>
              <p className={getTextClasses('secondary', 'leading-relaxed font-medium')}>{action}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={getPageContainerClasses()}>
      {/* Header Section */}
      <section className="relative overflow-hidden px-4 sm:px-6 pt-8 sm:pt-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6 sm:mb-8">
            
            <h1 className={getTextClasses('primary', 'text-3xl sm:text-4xl md:text-6xl font-bold mb-4 sm:mb-6 leading-tight')}>
              <span className="block">H.R.1 - One Big Beautiful</span>
              <span className="block bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent py-2">Bill Act</span>
            </h1>
            
            <p className={getTextClasses('secondary', 'text-base sm:text-lg md:text-xl mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed px-2 sm:px-0')}>
              A comprehensive analysis of the massive budget reconciliation bill that redirects federal priorities, 
              cuts spending in certain areas, and boosts others across government, energy, and defense sectors.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-6 sm:py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          {/* What This Bill Does */}
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 border-l-4 border-amber-400 dark:border-amber-500">
            <h2 className={getTextClasses('primary', 'text-xl sm:text-2xl font-bold mb-3 flex items-center')}>
              <span className="mr-3">🤔</span>
              What This Bill Does
            </h2>
            <p className={getTextClasses('secondary', 'leading-relaxed')}>
              H.R. 1 is a massive budget reconciliation bill that makes major changes across government spending, 
              taxes, and energy policy. Think of it as Congress's way to redirect federal priorities and cut 
              spending in certain areas while boosting others!
            </p>
          </div>

          {/* Key Changes */}
          <div className="mb-8">
            <h2 className={getTextClasses('primary', 'text-2xl font-bold mb-6 flex items-center')}>
              <span className="mr-3">🔥</span>
              Key Changes That Matter
            </h2>

            <PolicySection id="energy" icon={Building} title="Energy & Environment - Major Shift Away from Green Programs" defaultExpanded={true}>
              <ul className={getTextClasses('secondary', 'space-y-3')}>
                <li className="flex items-start space-x-3">
                  <span className="text-red-500 mt-1 text-lg">•</span>
                  <span>Eliminates most clean energy tax credits (electric vehicles, solar panels, wind energy)</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-green-500 mt-1 text-lg">•</span>
                  <span>Boosts traditional energy production - requires more oil and gas lease sales</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-red-500 mt-1 text-lg">•</span>
                  <span>Cuts funding for climate and environmental programs</span>
                </li>
              </ul>
            </PolicySection>

            <PolicySection id="defense" icon={Shield} title="Defense - Big Spending Increases">
              <ul className={getTextClasses('secondary', 'space-y-3')}>
                <li className="flex items-start space-x-3">
                  <span className="text-green-500 mt-1 text-lg">•</span>
                  <span>Major military investment in shipbuilding, weapons, missile defense</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-green-500 mt-1 text-lg">•</span>
                  <span>Border security funding increases</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-green-500 mt-1 text-lg">•</span>
                  <span>Focus on China competition (Indo-Pacific Command resources)</span>
                </li>
              </ul>
            </PolicySection>

            <PolicySection id="healthcare" icon={HeartPulse} title="Healthcare - Stricter Rules, Less Spending">
              <ul className={getTextClasses('secondary', 'space-y-3')}>
                <li className="flex items-start space-x-3">
                  <span className="text-red-500 mt-1 text-lg">•</span>
                  <span>Tighter Medicaid eligibility - harder to qualify, shorter coverage periods</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-blue-500 mt-1 text-lg">•</span>
                  <span>More fraud prevention and audits</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-red-500 mt-1 text-lg">•</span>
                  <span>Reduced federal health program costs</span>
                </li>
              </ul>
            </PolicySection>

            <PolicySection id="agriculture" icon={Wheat} title="Agriculture - Mixed Changes">
              <ul className={getTextClasses('secondary', 'space-y-3')}>
                <li className="flex items-start space-x-3">
                  <span className="text-red-500 mt-1 text-lg">•</span>
                  <span>Stricter food stamp work requirements</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-green-500 mt-1 text-lg">•</span>
                  <span>Higher crop insurance support for farmers</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-green-500 mt-1 text-lg">•</span>
                  <span>More agriculture disaster assistance</span>
                </li>
              </ul>
            </PolicySection>

            <PolicySection id="taxes" icon={DollarSign} title="Taxes - Less Support for Individuals, More Business Incentives">
              <ul className={getTextClasses('secondary', 'space-y-3')}>
                <li className="flex items-start space-x-3">
                  <span className="text-red-500 mt-1 text-lg">•</span>
                  <span>Ends clean energy tax breaks for homeowners and businesses</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-red-500 mt-1 text-lg">•</span>
                  <span>Makes charitable giving less attractive (higher minimum requirements)</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-green-500 mt-1 text-lg">•</span>
                  <span>Helps small businesses with expanded tax benefits</span>
                </li>
              </ul>
            </PolicySection>
          </div>

          {/* Impact by Practice Area */}
          <div className="mb-8">
            <h2 className={getTextClasses('primary', 'text-2xl font-bold mb-6 flex items-center')}>
              <span className="mr-3">🎯</span>
              Impact by Practice Area
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              <ImpactCard
                title="📚 Education - The Challenge Zone"
                status="Federal education budgets getting tighter, green programs cut"
                opportunity="Focus on state/local funded projects"
                action="Pause aggressive expansion, diversify client base"
                bgColor="bg-red-50 border border-red-200"
                iconColor="bg-red-500"
              />

              <ImpactCard
                title="🏛️ Civic & Public Architecture - The Mixed Bag"
                status="Major military construction increase, less federal green building money"
                opportunity="BIG opportunity in military base projects and defense facilities"
                action="Build relationships with defense contractors"
                bgColor="bg-yellow-50 border border-yellow-200"
                iconColor="bg-yellow-500"
              />

              <ImpactCard
                title="⚙️ Engineering - The Winner's Circle"
                status="Massive defense spending, oil & gas ramping up, clean energy losing support"
                opportunity="MAJOR opportunity in defense engineering and traditional energy infrastructure"
                action="Hire defense-experienced staff, build oil/gas client pipeline"
                bgColor="bg-green-50 border border-green-200"
                iconColor="bg-green-500"
              />
            </div>
          </div>

          {/* Strategic Takeaways */}
          <div className={getCardClasses('rounded-xl shadow-sm p-4 sm:p-6 mb-6 sm:mb-8')}>
            <h2 className={getTextClasses('primary', 'text-xl sm:text-2xl font-bold mb-4 sm:mb-6 flex items-center')}>
              <span className="mr-3">🚀</span>
              Quick Strategic Takeaways
            </h2>
            
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-dark-border">
                    <th className={getTextClasses('primary', 'text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold')}>Practice Area</th>
                    <th className={getTextClasses('primary', 'text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold')}>Immediate Action</th>
                    <th className={getTextClasses('primary', 'text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold')}>6-Month Goal</th>
                  </tr>
                </thead>
                <tbody className={getTextClasses('secondary')}>
                  <tr className="border-b border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary">
                    <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium">Education</td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4">Pause aggressive expansion plans</td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4">Diversify to state/local clients</td>
                  </tr>
                  <tr className="border-b border-gray-100 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary">
                    <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium">Civic</td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4">Target defense sector networking</td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4">Secure first military project</td>
                  </tr>
                  <tr className="hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary">
                    <td className="py-2 sm:py-3 px-2 sm:px-4 font-medium">Engineering</td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4">Hire defense-experienced staff</td>
                    <td className="py-2 sm:py-3 px-2 sm:px-4">Build oil/gas client pipeline</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Line */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-700 dark:to-indigo-700 text-white rounded-xl p-6 sm:p-8 text-center shadow-lg mb-6 sm:mb-8">
            <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 flex items-center justify-center">
              <span className="mr-3">🎯</span>
              BOTTOM LINE
            </h2>
            <p className="text-xl leading-relaxed">
              Pivot toward defense and traditional energy. Reduce dependence on federal education and green energy work!
            </p>
          </div>

          {/* Source Data */}
          <div className={getCardClasses('rounded-xl shadow-sm p-6 text-center')}>
            <h3 className={getTextClasses('primary', 'text-lg font-bold mb-3 flex items-center justify-center')}>
              <span className="mr-2">📄</span>
              Official Source Data
            </h3>
            <p className={getTextClasses('secondary', 'mb-4 leading-relaxed')}>
              This analysis is based on the official H.R. 1 bill text from the 119th Congress. 
              Review the complete legislation and official details on Congress.gov.
            </p>
            <a
              href="https://www.congress.gov/bill/119th-congress/house-bill/1"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white px-6 py-4 sm:py-3 rounded-lg font-semibold transition-all duration-300 shadow-sm hover:shadow-md w-full sm:w-auto min-h-[48px] text-sm sm:text-base"
            >
              <ExternalLink size={18} />
              View H.R. 1 on Congress.gov
            </a>
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-dark-border">
              <p className={getTextClasses('muted', 'text-sm')}>
                Last updated: January 2025 • Source: U.S. House of Representatives
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HR1PolicyPage;