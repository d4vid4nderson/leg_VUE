import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  Building,
  GraduationCap,
  Heart,
  Wrench,
  X as XIcon,
  ScrollText,
  Search,
  RotateCw as RefreshIcon,
  Settings,
  FileText,
  Trash2,
  ChevronDown,
  Download,
  ExternalLink,
  Copy,
  Menu as HamburgerIcon,
  Star,
  Home
} from 'lucide-react';
import byMOREgroupLogo from './components/byMOREgroup.PNG';

// API Configuration with proper fallbacks
const getApiUrl = () => {
  // Check for Vite environment variables
  if (import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Check for process.env (for some build systems)
  if (typeof process !== 'undefined' && process.env?.VITE_API_URL) {
    return process.env.VITE_API_URL;
  }
  
  // Development fallback
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  
  // Production fallback - adjust as needed
  return 'https://your-api-domain.com';
};

const API_URL = getApiUrl();
console.log('Using API URL:', API_URL);

// Filter pill definitions
const FILTERS = [
  { key: 'civic', icon: Building, label: 'Civic' },
  { key: 'education', icon: GraduationCap, label: 'Education' },
  { key: 'healthcare', icon: Heart, label: 'Healthcare' },
  { key: 'engineering', icon: Wrench, label: 'Engineering' },
  { key: 'not-applicable', icon: ScrollText, label: 'Not Applicable' },
];

// Filter styles
const filterStyles = {
  civic: 'text-blue-700',
  education: 'text-yellow-700',
  healthcare: 'text-red-700',
  engineering: 'text-green-700',
  'not-applicable': 'text-gray-700'
};

// Supported states mapping
const SUPPORTED_STATES = {
  'California': 'CA',
  'Colorado': 'CO',
  'Kentucky': 'KY', 
  'Nevada': 'NV',
  'South Carolina': 'SC',
  'Texas': 'TX',
};

// Helper function to convert page slugs back to state names
const getStateNameFromSlug = (slug) => {
  const stateMapping = {
    'california': 'California',
    'colorado': 'Colorado',
    'kentucky': 'Kentucky', 
    'nevada': 'Nevada',
    'south-carolina': 'South Carolina',
    'texas': 'Texas',
  };
  return stateMapping[slug] || null;
};

// ...All helper constants and functions go here (e.g., FILTERS, filterStyles, getApiUrl, etc.)...

// ...CategoryTag, Pagination, EnhancedBillSearch, MultiStateBillProcessor, EnhancedDashboard, etc...

/** --- MAIN APP ENTRY --- */
const App = () => (
  <Router>
    <AppContent />
  </Router>
);

/** --- APP CONTENT WITH ALL LOGIC, STATE, AND ROUTES --- */
const AppContent = () => {
  // --- All your useState, useRef, useEffect, useCallback hooks go here ---
  // ...no changes from your structure...

  // For brevity, see your own uploaded code above (all logic remains!)

  // --- All component helpers and state go here ---

  // --- All Route Components here (ExecutiveOrdersPage, HighlightsPage, StatePage, SettingsPage, etc) ---

  // --- Render Header and Routes ---
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header
        showDropdown={showDropdown}
        setShowDropdown={setShowDropdown}
        dropdownRef={dropdownRef}
        currentPage={location.pathname.substring(1).split('/')[0] || 'highlights'}
      />
      <div className="container mx-auto px-4 sm:px-6 lg:px-12 flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<HighlightsPage /* ...props... */ />} />
          <Route path="/highlights" element={<HighlightsPage /* ...props... */ />} />
          <Route path="/executive-orders" element={<ExecutiveOrdersPage /* ...props... */ />} />
          <Route path="/settings" element={<SettingsPage /* ...props... */ />} />
          {/* State pages */}
          {Object.keys(SUPPORTED_STATES).map((state) => {
            const slug = state.toLowerCase().replace(' ', '-');
            return (
              <Route key={state} path={`/state/${slug}`} element={<StatePage stateName={state} />} />
            );
          })}
          {/* Feature pages */}
          <Route path="/enhanced-bill-search" element={<EnhancedBillSearch />} />
          <Route path="/multi-state-processor" element={<MultiStateBillProcessor />} />
          <Route path="/enhanced-dashboard" element={<EnhancedDashboard />} />
        </Routes>
      </div>
    </div>
  );
};

export default App;