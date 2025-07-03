// utils/constants.js - Fixed imports

import {
  Building,
  GraduationCap,
  HeartPulse,      
  Wrench,
  ScrollText,
  FileText,
  LayoutGrid      
} from 'lucide-react';

// Filter configuration
export const FILTERS = [
  { key: 'all-practice-areas', icon: LayoutGrid, label: 'All Practice Areas' },
  { key: 'civic', icon: Building, label: 'Civic' },
  { key: 'education', icon: GraduationCap, label: 'Education' },
  { key: 'engineering', icon: Wrench, label: 'Engineering' },
  { key: 'healthcare', icon: HeartPulse, label: 'Healthcare' },
  { key: 'not-applicable', icon: ScrollText, label: 'Not Applicable' },
];

// Centralized filter styling - ACTIVE STATES (when filter is selected)
export const getFilterActiveClass = (filterKey) => {
  const styles = {
    'all-practice-areas': 'bg-teal-100 text-teal-700 font-medium',
    'civic': 'bg-blue-100 text-blue-700 font-medium',
    'education': 'bg-orange-100 text-orange-700 font-medium',
    'engineering': 'bg-green-100 text-green-700 font-medium',
    'healthcare': 'bg-red-100 text-red-700 font-medium',
    'not-applicable': 'bg-gray-100 text-gray-700 font-medium',
  };
  return styles[filterKey] || 'bg-gray-100 text-gray-700 font-medium';
};

// Centralized icon styling - ICON COLORS
export const getFilterIconClass = (filterKey) => {
  const styles = {
    'all-practice-areas': 'text-teal-600',
    'civic': 'text-blue-600',
    'education': 'text-orange-600',
    'engineering': 'text-green-600',
    'healthcare': 'text-red-600',
    'not-applicable': 'text-gray-600',
  };
  return styles[filterKey] || 'text-gray-600';
};

// Category tag styling (for pills/badges)
export const getCategoryTagClass = (filterKey) => {
  const styles = {
    'all-practice-areas': 'bg-teal-100 text-teal-800',
    'civic': 'bg-blue-100 text-blue-800',
    'education': 'bg-orange-100 text-orange-800',
    'engineering': 'bg-green-100 text-green-800',
    'healthcare': 'bg-red-100 text-red-800',
    'not-applicable': 'bg-gray-100 text-gray-800',
  };
  return styles[filterKey] || 'bg-gray-100 text-gray-800';
};

export const filterStyles = {
  'all-practice-areas': 'text-teal-700',
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