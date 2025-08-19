// utils/constants.js - Fixed imports

import {
  Building,
  GraduationCap,
  HeartPulse,      
  Wrench,
  Ban,
  ScrollText,
  FileText,
  LayoutGrid,
  Shield,
  Zap,
  Leaf,
  DollarSign,
  Cpu,
  TrendingUp,
  Globe,
  HelpCircle
} from 'lucide-react';

// Filter configuration - Updated to match new database categories
export const FILTERS = [
  { key: 'all_practice_areas', icon: LayoutGrid, label: 'All Practice Areas' },
  { key: 'civic', icon: Building, label: 'Civic' },
  { key: 'education', icon: GraduationCap, label: 'Education' },
  { key: 'engineering', icon: Wrench, label: 'Engineering' },
  { key: 'healthcare', icon: HeartPulse, label: 'Healthcare' },
  { key: 'not-applicable', icon: Ban, label: 'Not Applicable' },
];

// Centralized filter styling - ACTIVE STATES (when filter is selected)
export const getFilterActiveClass = (filterKey) => {
  const styles = {
    'all_practice_areas': 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium',
    'civic': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium',
    'education': 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 font-medium',
    'engineering': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium',
    'healthcare': 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 font-medium',
    'not-applicable': 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium',
  };
  return styles[filterKey] || 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium';
};

// Centralized icon styling - ICON COLORS
export const getFilterIconClass = (filterKey) => {
  const styles = {
    'all_practice_areas': 'text-teal-600',
    'civic': 'text-blue-600',
    'education': 'text-orange-600',
    'engineering': 'text-green-600',
    'healthcare': 'text-pink-600',
    'not-applicable': 'text-gray-600',
  };
  return styles[filterKey] || 'text-gray-600';
};

// Category tag styling (for pills/badges)
export const getCategoryTagClass = (filterKey) => {
  const styles = {
    'all_practice_areas': 'bg-teal-100 dark:bg-teal-900/30 text-teal-800 dark:text-teal-300',
    'civic': 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    'education': 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
    'engineering': 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    'healthcare': 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300',
    'not-applicable': 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300',
  };
  return styles[filterKey] || 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
};

// Get category icon component (returns the component, not JSX)
export const getCategoryIcon = (category) => {
  switch (category?.toLowerCase()) {
    case 'civic':
      return Building;
    case 'education':
      return GraduationCap;
    case 'engineering':
      return Wrench;
    case 'healthcare':
      return HeartPulse;
    case 'defense':
      return Shield;
    case 'energy':
      return Zap;
    case 'environment':
      return Leaf;
    case 'finance':
      return DollarSign;
    case 'technology':
      return Cpu;
    case 'trade':
      return TrendingUp;
    case 'international':
      return Globe;
    case 'not-applicable':
      return Ban;
    default:
      return HelpCircle;
  }
};

export const filterStyles = {
  'all_practice_areas': 'text-teal-700',
  civic: 'text-blue-700',
  education: 'text-orange-700',
  engineering: 'text-green-700',
  healthcare: 'text-red-700',
  'not-applicable': 'text-gray-700'
};

// Supported states configuration
export const SUPPORTED_STATES = {
  'California': 'CA',
  'Colorado': 'CO',
  'Kentucky': 'KY', 
  'Nevada': 'NV',
  'South Carolina': 'SC',
  'Texas': 'TX',
};

// Highlights filter configuration
export const HIGHLIGHTS_FILTERS = [
  { key: 'all-practice-areas', icon: LayoutGrid, label: 'All Practice Areas' },
  { key: 'civic', icon: Building, label: 'Civic' },
  { key: 'education', icon: GraduationCap, label: 'Education' },
  { key: 'engineering', icon: Wrench, label: 'Engineering' },
  { key: 'healthcare', icon: HeartPulse, label: 'Healthcare' },
  { key: 'executive-orders', icon: ScrollText, label: 'Executive Orders' },
  { key: 'state-legislation', icon: FileText, label: 'State Legislation' },
];

export const highlightsFilterStyles = {
  'all-practice-areas': 'text-teal-600',
  civic: 'text-blue-600',
  education: 'text-orange-600',
  engineering: 'text-green-600',
  healthcare: 'text-red-600',
  'executive-orders': 'text-purple-600',
  'state-legislation': 'text-indigo-600'
};

// Loading stages for different data types
export const LOADING_STAGES = {
  'Executive Orders': [
    "Fetching Executive Orders...",
    "Sending Executive Orders to AI for Analysis...",
    "AI Processing Executive Orders...",
    "AI Getting Executive Orders ready to display...",
    "Making final preparations and formatting..."
  ],
  'State Legislation': [
    "Fetching State Legislation...",
    "Sending State Bills to AI for Analysis...",
    "AI Processing State Bills...",
    "AI Getting State Bills ready to display...",
    "Making final preparations and formatting..."
  ]
};

// API endpoints
export const API_ENDPOINTS = {
  STATUS: '/api/status',
  EXECUTIVE_ORDERS: '/api/executive-orders',
  EXECUTIVE_ORDERS_FETCH: '/api/executive-orders/fetch',
  STATE_LEGISLATION: '/api/state-legislation',
  STATE_LEGISLATION_FETCH: '/api/state-legislation/fetch',
  LEGISCAN_SEARCH: '/api/legiscan/search-and-analyze',
  DATABASE_CLEAR: '/api/database/clear-all'
};

// Default pagination settings
export const PAGINATION_DEFAULTS = {
  ITEMS_PER_PAGE: 25,
  DEFAULT_PAGE: 1
};

// Additional exports that might be needed
export { ScrollText, FileText, LayoutGrid } from 'lucide-react';