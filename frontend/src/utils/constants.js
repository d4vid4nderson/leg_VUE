// utils/constants.js - Application constants and configuration

import {
  Building,
  GraduationCap,
  Stethoscope,
  Wrench,
  ScrollText,
  FileText
} from 'lucide-react';

// Filter configuration
export const FILTERS = [
  { key: 'civic', icon: Building, label: 'Civic' },
  { key: 'education', icon: GraduationCap, label: 'Education' },
  { key: 'engineering', icon: Wrench, label: 'Engineering' },
  { key: 'healthcare', icon: Stethoscope, label: 'Healthcare' },
  { key: 'not-applicable', icon: ScrollText, label: 'Not Applicable' },
];

export const filterStyles = {
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
  { key: 'civic', icon: Building, label: 'Civic' },
  { key: 'education', icon: GraduationCap, label: 'Education' },
  { key: 'engineering', icon: Wrench, label: 'Engineering' },
  { key: 'healthcare', icon: Stethoscope, label: 'Healthcare' },
  { key: 'executive-orders', icon: ScrollText, label: 'Executive Orders' },
  { key: 'state-legislation', icon: FileText, label: 'State Legislation' },
];

export const highlightsFilterStyles = {
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
export { ScrollText, FileText } from 'lucide-react';