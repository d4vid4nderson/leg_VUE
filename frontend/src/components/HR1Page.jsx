import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building, Shield, HeartPulse, Wheat, DollarSign, GraduationCap, Landmark, Cog, ChevronDown, ChevronUp } from 'lucide-react';

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
      <div className="bg-white rounded-lg shadow-md mb-4 overflow-hidden">
        <button
          onClick={() => toggleSection(id)}
          className="w-full px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 flex items-center justify-between hover:from-blue-100 hover:to-indigo-100 transition-colors"
        >
          <div className="flex items-center space-x-3">
            <Icon className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          </div>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-gray-600" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-600" />
          )}
        </button>
        {isExpanded && (
          <div className="px-6 py-4 border-t border-gray-100">
            {children}
          </div>
        )}
      </div>
    );
  };

  const ImpactCard = ({ title, status, opportunity, action, bgColor }) => (
    <div className={`${bgColor} rounded-lg p-4 mb-4`}>
      <h4 className="font-bold text-gray-800 mb-2">{title}</h4>
      <div className="space-y-2 text-sm">
        <div><span className="font-medium">Status:</span> {status}</div>
        <div><span className="font-medium">Opportunity:</span> {opportunity}</div>
        <div><span className="font-medium">Action:</span> {action}</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-lg mb-8">
          <div className="px-6 py-6">
            <div className="flex items-center space-x-3 mb-4">
              <Landmark className="h-8 w-8" />
              <h1 className="text-3xl font-bold">H.R. 1 - Major Policy Changes</h1>
            </div>
            
            <p className="text-blue-100 text-lg leading-relaxed">
              A comprehensive analysis of the massive budget reconciliation bill that redirects federal priorities, 
              cuts spending in certain areas, and boosts others across government, energy, and defense sectors.
            </p>
          </div>
        </div>

        {/* What This Bill Does */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg p-6 mb-8 border-l-4 border-amber-400">
          <h2 className="text-2xl font-bold text-gray-800 mb-3">🤔 What This Bill Does</h2>
          <p className="text-gray-700 leading-relaxed">
            H.R. 1 is a massive budget reconciliation bill that makes major changes across government spending, 
            taxes, and energy policy. Think of it as Congress's way to redirect federal priorities and cut 
            spending in certain areas while boosting others!
          </p>
        </div>

        {/* Key Changes */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="mr-3">🔥</span>
            Key Changes That Matter
          </h2>

          <PolicySection id="energy" icon={Building} title="Energy & Environment - Major Shift Away from Green Programs" defaultExpanded={true}>
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start space-x-2">
                <span className="text-red-500 mt-1">•</span>
                <span>Eliminates most clean energy tax credits (electric vehicles, solar panels, wind energy)</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-green-500 mt-1">•</span>
                <span>Boosts traditional energy production - requires more oil and gas lease sales</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-red-500 mt-1">•</span>
                <span>Cuts funding for climate and environmental programs</span>
              </li>
            </ul>
          </PolicySection>

          <PolicySection id="defense" icon={Shield} title="Defense - Big Spending Increases">
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start space-x-2">
                <span className="text-green-500 mt-1">•</span>
                <span>Major military investment in shipbuilding, weapons, missile defense</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-green-500 mt-1">•</span>
                <span>Border security funding increases</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-green-500 mt-1">•</span>
                <span>Focus on China competition (Indo-Pacific Command resources)</span>
              </li>
            </ul>
          </PolicySection>

          <PolicySection id="healthcare" icon={HeartPulse} title="Healthcare - Stricter Rules, Less Spending">
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start space-x-2">
                <span className="text-red-500 mt-1">•</span>
                <span>Tighter Medicaid eligibility - harder to qualify, shorter coverage periods</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-blue-500 mt-1">•</span>
                <span>More fraud prevention and audits</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-red-500 mt-1">•</span>
                <span>Reduced federal health program costs</span>
              </li>
            </ul>
          </PolicySection>

          <PolicySection id="agriculture" icon={Wheat} title="Agriculture - Mixed Changes">
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start space-x-2">
                <span className="text-red-500 mt-1">•</span>
                <span>Stricter food stamp work requirements</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-green-500 mt-1">•</span>
                <span>Higher crop insurance support for farmers</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-green-500 mt-1">•</span>
                <span>More agriculture disaster assistance</span>
              </li>
            </ul>
          </PolicySection>

          <PolicySection id="taxes" icon={DollarSign} title="Taxes - Less Support for Individuals, More Business Incentives">
            <ul className="space-y-2 text-gray-700">
              <li className="flex items-start space-x-2">
                <span className="text-red-500 mt-1">•</span>
                <span>Ends clean energy tax breaks for homeowners and businesses</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-red-500 mt-1">•</span>
                <span>Makes charitable giving less attractive (higher minimum requirements)</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-green-500 mt-1">•</span>
                <span>Helps small businesses with expanded tax benefits</span>
              </li>
            </ul>
          </PolicySection>
        </div>

        {/* Impact by Practice Area */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="mr-3">🎯</span>
            Impact by Practice Area
          </h2>

          <ImpactCard
            title="📚 Education - The Challenge Zone"
            status="Federal education budgets getting tighter, green programs cut"
            opportunity="Focus on state/local funded projects"
            action="Pause aggressive expansion, diversify client base"
            bgColor="bg-red-50 border border-red-200"
          />

          <ImpactCard
            title="🏛️ Civic & Public Architecture - The Mixed Bag"
            status="Major military construction increase, less federal green building money"
            opportunity="BIG opportunity in military base projects and defense facilities"
            action="Build relationships with defense contractors"
            bgColor="bg-yellow-50 border border-yellow-200"
          />

          <ImpactCard
            title="⚙️ Engineering - The Winner's Circle"
            status="Massive defense spending, oil & gas ramping up, clean energy losing support"
            opportunity="MAJOR opportunity in defense engineering and traditional energy infrastructure"
            action="Hire defense-experienced staff, build oil/gas client pipeline"
            bgColor="bg-green-50 border border-green-200"
          />
        </div>

        {/* Strategic Takeaways */}
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 border-l-4 border-indigo-400">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center">
            <span className="mr-3">🚀</span>
            Quick Strategic Takeaways
          </h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-indigo-200">
                  <th className="text-left py-2 px-3 font-semibold text-gray-800">Practice Area</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-800">Immediate Action</th>
                  <th className="text-left py-2 px-3 font-semibold text-gray-800">6-Month Goal</th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr className="border-b border-indigo-100">
                  <td className="py-2 px-3 font-medium">Education</td>
                  <td className="py-2 px-3">Pause aggressive expansion plans</td>
                  <td className="py-2 px-3">Diversify to state/local clients</td>
                </tr>
                <tr className="border-b border-indigo-100">
                  <td className="py-2 px-3 font-medium">Civic</td>
                  <td className="py-2 px-3">Target defense sector networking</td>
                  <td className="py-2 px-3">Secure first military project</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium">Engineering</td>
                  <td className="py-2 px-3">Hire defense-experienced staff</td>
                  <td className="py-2 px-3">Build oil/gas client pipeline</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Bottom Line */}
        <div className="mt-8 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold mb-2">🎯 BOTTOM LINE</h2>
          <p className="text-lg">
            Pivot toward defense and traditional energy. Reduce dependence on federal education and green energy work!
          </p>
        </div>
    </div>
  );
};

export default HR1PolicyPage;