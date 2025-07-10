import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Star,
  Copy,
  Download,
  ExternalLink,
  FileText,
  ScrollText,
  Compass,
  Loader,
  RefreshCw,
  ChevronDown,
  Check,
  AlertTriangle,
  RotateCw,
  Building,
  GraduationCap,
  Stethoscope,
  Wrench,
  Settings,
  Database,
  Eye,
  XCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  ArrowUp
} from 'lucide-react';

import { FILTERS, getFilterActiveClass, getFilterIconClass } from '../utils/constants';
import API_URL from '../config/api';
import FilterDropdown from '../components/FilterDropdown';
import ShimmerLoader from '../components/ShimmerLoader';

// Extended filters including order types
const EXTENDED_FILTERS = [
  ...FILTERS,
  {
    key: 'executive_order',
    label: 'Executive Orders',
    icon: ScrollText,
    type: 'order_type'
  },
  {
    key: 'state_legislation',
    label: 'State Legislation',
    icon: FileText,
    type: 'order_type'
  }
];

// Helper functions
const getExecutiveOrderNumber = (order) => {
  if (order.executive_order_number) return order.executive_order_number;
  if (order.document_number) return order.document_number;
  if (order.eo_number) return order.eo_number;
  if (order.bill_number) return order.bill_number;
  
  if (order.title) {
    const titleMatch = order.title.match(/Executive Order\s*#?\s*(\d+)/i);
    if (titleMatch) return titleMatch[1];
  }
  
  if (order.ai_summary) {
    const summaryMatch = order.ai_summary.match(/Executive Order\s*#?\s*(\d{4,5})/i);
    if (summaryMatch) return summaryMatch[1];
  }
  
  if (order.id && /^\d+$/.test(order.id)) return order.id;
  if (order.bill_id && /^\d+$/.test(order.bill_id)) return order.bill_id;
  
  return 'Unknown';
};

const formatDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return dateStr;
  }
};

const getOrderId = (order) => {
  if (!order) return `fallback-${Math.random().toString(36).substr(2, 9)}`;
  
  if (order.executive_order_number && typeof order.executive_order_number === 'string') {
    return `eo-${order.executive_order_number}`;
  }
  if (order.document_number && typeof order.document_number === 'string') {
    return `eo-doc-${order.document_number}`;
  }
  if (order.bill_id && typeof order.bill_id === 'string') return order.bill_id;
  if (order.id && typeof order.id === 'string') return order.id;
  if (order.bill_number) return `eo-${order.bill_number}`;
  if (order.eo_number) return `eo-${order.eo_number}`;
  
  if (order.title) {
    const titleHash = order.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    return `eo-title-${titleHash}`;
  }
  
  if (order.index !== undefined) return `eo-index-${order.index}`;
  return `eo-fallback-${Math.random().toString(36).substr(2, 9)}`;
};

const getStateBillId = (bill) => {
  if (!bill) return null;
  
  if (bill.bill_id && typeof bill.bill_id === 'string') return bill.bill_id;
  if (bill.id && typeof bill.id === 'string') return bill.id;
  
  if (bill.bill_number && bill.state) {
    return `${bill.state}-${bill.bill_number}`;
  }
  if (bill.bill_number) {
    return `${bill.state || 'unknown'}-${bill.bill_number}`;
  }
  
  if (bill.title) {
    const titleHash = bill.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
    return `state-bill-${titleHash}`;
  }
  
  return `state-bill-${Math.random().toString(36).substr(2, 9)}`;
};

const getUniversalOrderId = (order) => {
  if (!order) return null;
  
  const isExecutiveOrder = !!(order.executive_order_number || order.document_number || order.eo_number);
  const isStateLegislation = !!(order.bill_number && !isExecutiveOrder);
  
  if (isExecutiveOrder || order.order_type === 'executive_order') {
    return getOrderId(order);
  } else if (isStateLegislation || order.order_type === 'state_legislation') {
    return getStateBillId(order);
  } else {
    return getOrderId(order);
  }
};

const stripHtmlTags = (content) => {
  if (!content) return '';
  return content.replace(/<[^>]*>/g, '');
};

const cleanOrderTitle = (title) => {
  if (!title) return 'Untitled Executive Order';
  
  let cleaned = title
    .replace(/^\s*["'"']|["'"']\s*$/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\.\s*\.\s*\.+/g, '...')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '')
    .trim();
  
  if (cleaned.endsWith('.') && !cleaned.includes('etc.') && !cleaned.includes('Inc.')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  
  return cleaned || 'Untitled Executive Order';
};

const capitalizeFirstLetter = (text) => {
  if (!text || typeof text !== 'string') return text;
  const trimmed = text.trim();
  if (trimmed.length === 0) return text;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

// Category Tag Component
const CategoryTag = ({ category }) => {
  const getTagInfo = (cat) => {
    const filter = FILTERS.find(f => f.key === cat);
    if (!filter) return { color: 'bg-gray-100 text-gray-800', icon: FileText, label: cat };
    
    const colors = {
      civic: 'bg-blue-100 text-blue-800',
      healthcare: 'bg-red-100 text-red-800',
      education: 'bg-orange-100 text-orange-800',
      engineering: 'bg-green-100 text-green-800'
    };
    
    return {
      color: colors[cat] || 'bg-gray-100 text-gray-800',
      icon: filter.icon,
      label: filter.label
    };
  };

  const tagInfo = getTagInfo(category);
  const IconComponent = tagInfo.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${tagInfo.color}`}>
      <IconComponent size={12} />
      {tagInfo.label}
    </span>
  );
};

// Order Type Tag Component
const OrderTypeTag = ({ orderType }) => {
  if (orderType === 'executive_order') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
        <ScrollText size={12} />
        Executive Order
      </span>
    );
  }
  
  if (orderType === 'state_legislation') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
        <FileText size={12} />
        State Legislation
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
      <FileText size={12} />
      Unknown Type
    </span>
  );
};

// State Tag Component
const StateTag = ({ state }) => {
  if (!state || state === 'Unknown') return null;
  
  const stateAbbreviations = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'Florida': 'FL', 'Georgia': 'GA',
    'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
    'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS', 'Missouri': 'MO',
    'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ',
    'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
    'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
    'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
  };
  
  const stateAbbr = stateAbbreviations[state] || state.toUpperCase();
  
  return (
    <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
      {stateAbbr}
    </span>
  );
};

// Format talking points
const formatTalkingPoints = (content) => {
  if (!content) return null;

  let textContent = content.replace(/<[^>]*>/g, '');
  
  const points = [];
  const numberedMatches = textContent.match(/\d+\.\s*[^.]*(?:\.[^0-9][^.]*)*(?=\s*\d+\.|$)/g);
  
  if (numberedMatches && numberedMatches.length > 1) {
    numberedMatches.forEach((match) => {
      let cleaned = match.replace(/^\d+\.\s*/, '').trim();
      if (cleaned.length > 10) {
        points.push(cleaned);
      }
    });
  } else {
    const sentences = textContent.split(/(?=\d+\.\s)/).filter(s => s.trim().length > 0);
    
    sentences.forEach((sentence) => {
      const cleaned = sentence.replace(/^\d+\.\s*/, '').trim();
      if (cleaned.length > 10) {
        points.push(cleaned);
      }
    });
  }

  if (points.length > 0) {
    return (
      <div className="universal-numbered-content">
        {points.slice(0, 5).map((point, idx) => (
          <div key={idx} className="numbered-item">
            <span className="number-bullet">{idx + 1}.</span>
            <span className="numbered-text">{point}</span>
          </div>
        ))}
      </div>
    );
  }

  return <div className="universal-text-content">{textContent}</div>;
};

// Format universal content
const formatUniversalContent = (content) => {
  if (!content) return null;

  let textContent = content.replace(/<(?!\/?(strong|b)\b)[^>]*>/g, '');
  textContent = textContent.replace(/<(strong|b)>(.*?)<\/(strong|b)>/g, '*$2*');
  
  const sectionKeywords = [
    'Risk Assessment', 
    'Market Opportunity', 
    'Implementation Requirements', 
    'Financial Implications', 
    'Competitive Implications', 
    'Timeline Pressures',
    'Summary'
  ];
  
  const inlinePattern = new RegExp(`(${sectionKeywords.join('|')})[:.]?\\s*([^]*?)(?=\\s*(?:${sectionKeywords.join('|')}|$))`, 'gi');
  
  const inlineMatches = [];
  let match;
  while ((match = inlinePattern.exec(textContent)) !== null) {
    inlineMatches.push({
      header: match[1].trim(),
      content: match[2].trim(),
      fullMatch: match[0]
    });
  }
  
  if (inlineMatches.length > 0) {
    const sections = [];
    
    inlineMatches.forEach(({ header, content }) => {
      if (header && content && content.length > 5) {
        let cleanHeader = header.trim();
        if (!cleanHeader.endsWith(':')) {
          cleanHeader += ':';
        }
        
        const items = [];
        
        if (content.includes('•') || (content.includes('-') && content.match(/^\s*-/m)) || (content.includes('*') && content.match(/^\s*\*/m))) {
          const bulletPattern = /(?:^|\n)\s*[•\-*]\s*(.+?)(?=(?:\n\s*[•\-*]|\n\s*$|$))/gs;
          const bulletMatches = [...content.matchAll(bulletPattern)];
          
          if (bulletMatches.length > 0) {
            bulletMatches.forEach(bulletMatch => {
              const bulletContent = bulletMatch[1].trim();
              if (bulletContent.length > 5) {
                items.push(capitalizeFirstLetter(bulletContent));
              }
            });
          } else {
            const lines = content.split(/\n/).map(line => line.trim()).filter(line => line.length > 5);
            lines.forEach(line => {
              const cleanLine = line.replace(/^[•\-*]\s*/, '').trim();
              if (cleanLine.length > 5) {
                items.push(capitalizeFirstLetter(cleanLine));
              }
            });
          }
        } else {
          const sentences = content.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 5);
          
          if (sentences.length === 1 || content.length < 200) {
            items.push(capitalizeFirstLetter(content.trim()));
          } else {
            sentences.forEach(sentence => {
              if (sentence.length > 10) {
                items.push(capitalizeFirstLetter(sentence));
              }
            });
          }
        }
        
        if (items.length > 0) {
          sections.push({
            title: cleanHeader,
            items: items
          });
        }
      }
    });
    
    if (sections.length > 0) {
      return (
        <div>
          {sections.map((section, idx) => (
            <div key={idx} style={{ marginBottom: '16px' }}>
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '8px',
                fontSize: '14px',
                color: 'inherit'
              }}>
                {section.title}
              </div>
              {section.items.map((item, itemIdx) => (
                <div key={itemIdx} style={{ 
                  marginBottom: '6px',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: 'inherit',
                  paddingLeft: section.items.length === 1 ? '0px' : '0px',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word'
                }}>
                  {section.items.length === 1 ? item : `• ${item}`}
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }
  }

  return <div className="universal-text-content" style={{ 
    fontSize: '14px', 
    lineHeight: '1.6',
    wordWrap: 'break-word',
    overflowWrap: 'break-word'
  }}>{textContent}</div>;
};

// API service for highlights
class HighlightsAPI {
  static async getHighlights(userId = 1) {
    try {
      console.log('🔍 Fetching highlights for user:', userId);
      
      const endpoints = [
        `${API_URL}/api/highlights?user_id=${userId}`,
        `${API_URL}/api/user-highlights?user_id=${userId}`
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint);
          if (response.ok) {
            const data = await response.json();
            
            let highlights = [];
            if (Array.isArray(data)) {
              highlights = data;
            } else if (data.highlights && Array.isArray(data.highlights)) {
              highlights = data.highlights;
            } else if (data.results && Array.isArray(data.results)) {
              highlights = data.results;
            }
            
            console.log('✅ Found highlights:', highlights.length, 'from', endpoint);
            return highlights;
          }
        } catch (err) {
          console.warn('Endpoint failed:', endpoint, err.message);
          continue;
        }
      }
      
      console.warn('⚠️ No working highlights endpoint found');
      return [];
    } catch (error) {
      console.error('Error fetching highlights:', error);
      return [];
    }
  }

  static async removeHighlight(orderId, userId = 1) {
    try {
      console.log('🗑️ Removing highlight:', orderId);
      
      const response = await fetch(`${API_URL}/api/highlights/${orderId}?user_id=${userId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to remove highlight');
      console.log('✅ Successfully removed highlight');
      return true;
    } catch (error) {
      console.error('Error removing highlight:', error);
      throw error;
    }
  }

  static async getAllExecutiveOrders() {
    try {
      console.log('🔍 Fetching ALL executive orders from database...');
      
      const response = await fetch(`${API_URL}/api/executive-orders?per_page=50`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`❌ Executive orders API failed: ${response.status}`);
        
        const fallbackResponse = await fetch(`${API_URL}/api/executive-orders?per_page=25`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (!fallbackResponse.ok) {
          console.error(`❌ Fallback also failed: ${fallbackResponse.status}`);
          
          const basicResponse = await fetch(`${API_URL}/api/executive-orders`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          if (!basicResponse.ok) {
            throw new Error(`HTTP ${basicResponse.status}: ${basicResponse.statusText}`);
          }
          
          const basicData = await basicResponse.json();
          console.log('🔍 Basic API Response:', basicData);
          
          let ordersArray = [];
          if (Array.isArray(basicData)) {
            ordersArray = basicData;
          } else if (basicData.results && Array.isArray(basicData.results)) {
            ordersArray = basicData.results;
          } else if (basicData.data && Array.isArray(basicData.data)) {
            ordersArray = basicData.data;
          } else if (basicData.executive_orders && Array.isArray(basicData.executive_orders)) {
            ordersArray = basicData.executive_orders;
          }
          
          console.log(`✅ Basic endpoint returned ${ordersArray.length} executive orders`);
          return ordersArray;
        }
        
        const fallbackData = await fallbackResponse.json();
        console.log('🔍 Fallback API Response:', fallbackData);
        
        let ordersArray = [];
        if (Array.isArray(fallbackData)) {
          ordersArray = fallbackData;
        } else if (fallbackData.results && Array.isArray(fallbackData.results)) {
          ordersArray = fallbackData.results;
        } else if (fallbackData.data && Array.isArray(fallbackData.data)) {
          ordersArray = fallbackData.data;
        } else if (fallbackData.executive_orders && Array.isArray(fallbackData.executive_orders)) {
          ordersArray = fallbackData.executive_orders;
        }
        
        console.log(`✅ Fallback returned ${ordersArray.length} executive orders`);
        return ordersArray;
      }

      const data = await response.json();
      console.log('🔍 Main API Response:', data);

      let ordersArray = [];
      
      if (Array.isArray(data)) {
        ordersArray = data;
      } else if (data.results && Array.isArray(data.results)) {
        ordersArray = data.results;
      } else if (data.data && Array.isArray(data.data)) {
        ordersArray = data.data;
      } else if (data.executive_orders && Array.isArray(data.executive_orders)) {
        ordersArray = data.executive_orders;
      }

      console.log(`✅ Main endpoint returned ${ordersArray.length} executive orders`);
      return ordersArray;
    } catch (error) {
      console.error('❌ Error fetching executive orders:', error);
      console.log('🔄 Returning empty array to prevent loading loop');
      return [];
    }
  }

  static async getAllStateLegislation() {
    try {
      console.log('🔍 Fetching ALL state legislation from database...');
      
      const response = await fetch(`${API_URL}/api/state-legislation?per_page=100`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`❌ State legislation API failed: ${response.status}`);
        
        const basicResponse = await fetch(`${API_URL}/api/state-legislation`, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (!basicResponse.ok) {
          console.error(`❌ Basic state legislation endpoint also failed: ${basicResponse.status}`);
          return [];
        }
        
        const basicData = await basicResponse.json();
        let ordersArray = [];
        
        if (Array.isArray(basicData)) {
          ordersArray = basicData;
        } else if (basicData.results && Array.isArray(basicData.results)) {
          ordersArray = basicData.results;
        } else if (basicData.data && Array.isArray(basicData.data)) {
          ordersArray = basicData.data;
        }
        
        console.log(`✅ Basic state legislation endpoint returned ${ordersArray.length} bills`);
        return ordersArray;
      }

      const data = await response.json();
      console.log('🔍 State Legislation API Response:', data);

      let ordersArray = [];
      
      if (Array.isArray(data)) {
        ordersArray = data;
      } else if (data.results && Array.isArray(data.results)) {
        ordersArray = data.results;
      } else if (data.data && Array.isArray(data.data)) {
        ordersArray = data.data;
      }

      console.log(`✅ State legislation endpoint returned ${ordersArray.length} bills`);
      return ordersArray;
    } catch (error) {
      console.error('❌ Error fetching state legislation:', error);
      return [];
    }
  }

  static async getAllOrders() {
    try {
      console.log('🔍 Fetching ALL orders (executive orders + state legislation)...');
      
      const executiveOrders = await this.getAllExecutiveOrders();
      console.log(`📊 Got ${executiveOrders.length} executive orders`);
      
      const stateLegislation = await this.getAllStateLegislation();
      console.log(`📊 Got ${stateLegislation.length} state bills`);
      
      const allOrders = [...executiveOrders, ...stateLegislation];
      console.log(`📊 Total combined orders: ${allOrders.length}`);
      
      return allOrders;
    } catch (error) {
      console.error('❌ Error fetching all orders:', error);
      return [];
    }
  }
}

// Enhanced hook for managing highlights
const useHighlights = (userId = 1) => {
  const [highlights, setHighlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const loadHighlights = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 useHighlights: Starting highlights load process...');
      
      // Step 1: Get highlighted order IDs from backend
      const fetchedHighlights = await HighlightsAPI.getHighlights(userId);
      console.log('📋 useHighlights: Raw highlights from API:', fetchedHighlights);
      
      if (fetchedHighlights.length === 0) {
        console.log('📋 useHighlights: No highlights found in backend');
        setHighlights([]);
        setLastRefresh(Date.now());
        return;
      }
      
      // Step 2: Get ALL orders (executive orders + state legislation)
      const allOrders = await HighlightsAPI.getAllOrders();
      console.log(`📊 useHighlights: Got ${allOrders.length} total orders from database`);
      
      if (allOrders.length === 0) {
        console.log('⚠️ No orders found in database - this might be an API issue');
        setHighlights([]);
        setLastRefresh(Date.now());
        return;
      }
      
      // Step 3: Transform ALL orders using appropriate logic
      const allTransformedOrders = allOrders.map((order, index) => {
        // Determine order type based on available fields
        const isExecutiveOrder = !!(order.executive_order_number || order.document_number || order.eo_number);
        const isStateLegislation = !!(order.bill_number && !isExecutiveOrder);
        
        let orderType = 'unknown';
        if (isExecutiveOrder) {
          orderType = 'executive_order';
        } else if (isStateLegislation) {
          orderType = 'state_legislation';
        }
        
        // Use appropriate ID generation based on type
        let uniqueId;
        if (orderType === 'executive_order') {
          uniqueId = order.executive_order_number || order.document_number || order.id || order.bill_id || `eo-${index}`;
        } else {
          // State legislation ID generation
          if (order.bill_id && typeof order.bill_id === 'string') {
            uniqueId = order.bill_id;
          } else if (order.id && typeof order.id === 'string') {
            uniqueId = order.id;
          } else if (order.bill_number && order.state) {
            uniqueId = `${order.state}-${order.bill_number}`;
          } else if (order.bill_number) {
            uniqueId = `${order.state || 'unknown'}-${order.bill_number}`;
          } else if (order.title) {
            const titleHash = order.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
            uniqueId = `state-bill-${titleHash}`;
          } else {
            uniqueId = `state-bill-${index}`;
          }
        }
        
        const transformedOrder = {
          id: uniqueId,
          bill_id: uniqueId,
          
          // Common fields
          title: order.title || order.bill_title || 'Untitled',
          category: order.category || 'civic',
          ai_summary: order.ai_summary || order.ai_executive_summary || '',
          ai_talking_points: order.ai_talking_points || order.ai_key_points || '',
          ai_business_impact: order.ai_business_impact || order.ai_potential_impact || '',
          ai_processed: !!(order.ai_summary || order.ai_executive_summary),
          
          // Order type specific fields
          order_type: orderType,
          
          // Executive Order specific
          ...(orderType === 'executive_order' && {
            eo_number: order.executive_order_number || order.document_number || 'Unknown',
            executive_order_number: order.executive_order_number || order.document_number || 'Unknown',
            summary: order.description || order.summary || '',
            signing_date: order.signing_date || order.introduced_date || '',
            publication_date: order.publication_date || order.last_action_date || '',
            html_url: order.html_url || order.legiscan_url || '',
            pdf_url: order.pdf_url || '',
            formatted_publication_date: formatDate(order.publication_date || order.last_action_date),
            formatted_signing_date: formatDate(order.signing_date || order.introduced_date),
            president: order.president || 'Donald Trump',
            source: 'Database (Federal Register + Azure AI)'
          }),
          
          // State Legislation specific
          ...(orderType === 'state_legislation' && {
            bill_number: order.bill_number,
            state: order.state || 'Unknown',
            status: order.status || 'Active',
            description: order.description || order.ai_summary || 'No description available',
            legiscan_url: order.legiscan_url || '',
            introduced_date: order.introduced_date,
            last_action_date: order.last_action_date,
            formatted_signing_date: formatDate(order.introduced_date),
            source: order.state ? `${order.state} Legislature` : 'State Legislature'
          }),
          
          is_highlighted: true,
          index: index
        };
        
        return transformedOrder;
      });
      
      console.log(`📊 useHighlights: Transformed ${allTransformedOrders.length} orders`);
      
      // Step 4: Get highlighted order IDs
      const highlightedOrderIds = new Set();
      fetchedHighlights.forEach((highlight) => {
        if (highlight.order_id) {
          highlightedOrderIds.add(highlight.order_id);
        }
      });
      
      console.log('📋 Highlighted order IDs from backend:', Array.from(highlightedOrderIds));
      
      // Step 5: Find matching orders using ID matching
      const matchedOrders = [];
      
      allTransformedOrders.forEach((order) => {
        const orderId = getUniversalOrderId(order);
        
        if (highlightedOrderIds.has(orderId)) {
          console.log(`✅ MATCH FOUND: Order "${order.title}" with ID "${orderId}" (type: ${order.order_type})`);
          matchedOrders.push(order);
        }
      });
      
      console.log(`✅ useHighlights: Found ${matchedOrders.length} matching highlighted orders`);
      
      if (matchedOrders.length === 0) {
        console.log('⚠️ No matches found! Debugging ID mismatch...');
        console.log('Backend highlighted IDs:', Array.from(highlightedOrderIds));
        console.log('Sample order IDs from database:', 
          allTransformedOrders.slice(0, 5).map(order => ({
            title: order.title,
            type: order.order_type,
            id: getUniversalOrderId(order)
          }))
        );
      }
      
      setHighlights(matchedOrders);
      setLastRefresh(Date.now());
      
    } catch (error) {
      console.error('❌ Error loading highlights:', error);
      setHighlights([]);
      setLastRefresh(Date.now());
    } finally {
      setLoading(false);
    }
  };

  const removeHighlight = async (highlight) => {
    try {
      const orderId = getUniversalOrderId(highlight);
      console.log('🗑️ Removing highlight with ID:', orderId);
      
      await HighlightsAPI.removeHighlight(orderId, userId);
      setHighlights(prev => prev.filter(item => getUniversalOrderId(item) !== orderId));
      setLastRefresh(Date.now());
      
      console.log('✅ Successfully removed highlight');
    } catch (error) {
      console.error('❌ Failed to remove highlight:', error);
      throw error;
    }
  };

  const refreshHighlights = async () => {
    console.log('🔄 Refreshing highlights...');
    await loadHighlights();
  };

  useEffect(() => {
    loadHighlights();
  }, [userId]);

  return {
    highlights,
    loading,
    removeHighlight,
    refreshHighlights,
    lastRefresh
  };
};

// Scroll to Top Button Component
const ScrollToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      setIsVisible(scrollTop > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={scrollToTop}
      className={`fixed right-6 bottom-6 z-50 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-all duration-300 transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
      title="Scroll to top"
      aria-label="Scroll to top"
    >
      <ArrowUp size={20} />
    </button>
  );
};

// Pagination Controls Component
const PaginationControls = ({ 
  currentPage, 
  totalPages, 
  totalItems, 
  itemsPerPage, 
  onPageChange,
  itemType = 'highlights'
}) => {
  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 7;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      const startPage = Math.max(1, currentPage - 3);
      const endPage = Math.min(totalPages, currentPage + 3);
      
      if (startPage > 1) {
        pages.push(1);
        if (startPage > 2) pages.push('...');
      }
      
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }
      
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-gray-50 border-t border-gray-200">
      {/* Results info */}
      <div className="text-sm text-gray-700">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{totalItems}</span> {itemType}
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-2">
        {/* Previous button */}
        {totalPages > 1 && (
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`p-2 rounded-md text-sm font-medium transition-all duration-200 ${
              currentPage === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Page numbers */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            {getPageNumbers().map((page, index) => (
              <button
                key={index}
                onClick={() => typeof page === 'number' && onPageChange(page)}
                disabled={page === '...'}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 min-w-[40px] ${
                  page === currentPage
                    ? 'bg-blue-600 text-white'
                    : page === '...'
                    ? 'text-gray-400 cursor-default'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
        )}

        {/* Next button */}
        {totalPages > 1 && (
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`p-2 rounded-md text-sm font-medium transition-all duration-200 ${
              currentPage === totalPages
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

// Main HighlightsPage Component
const HighlightsPage = ({ makeApiCall, copyToClipboard, stableHandlers }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  
  // Filter state
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  
  // Highlight management
  const [localHighlights, setLocalHighlights] = useState(new Set());
  const [highlightLoading, setHighlightLoading] = useState(new Set());
  
  const navigate = useNavigate();
  const filterDropdownRef = useRef(null);

  // Use enhanced highlights hook
  const {
    highlights,
    loading,
    removeHighlight,
    refreshHighlights,
    lastRefresh
  } = useHighlights(1);

  // Load existing highlights on component mount
  useEffect(() => {
    const loadExistingHighlights = async () => {
      try {
        console.log('🔍 HighlightsPage: Loading existing highlights...');
        const response = await fetch(`${API_URL}/api/highlights?user_id=1`);
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 HighlightsPage: Raw highlights response:', data);
          
          let highlightsArray = [];
          if (Array.isArray(data)) {
            highlightsArray = data;
          } else if (data.highlights && Array.isArray(data.highlights)) {
            highlightsArray = data.highlights;
          } else if (data.results && Array.isArray(data.results)) {
            highlightsArray = data.results;
          } else {
            console.log('🔍 No valid highlights array found, using empty array');
            highlightsArray = [];
          }
          
          console.log('🔍 HighlightsPage: Extracted highlights array:', highlightsArray);
          
          const orderIds = new Set();
          
          if (highlightsArray.length > 0) {
            for (let i = 0; i < highlightsArray.length; i++) {
              const highlight = highlightsArray[i];
              console.log(`🔍 HighlightsPage: Processing highlight ${i + 1}:`, highlight);
              
              if (highlight && highlight.order_id && 
                  (highlight.order_type === 'executive_order' || highlight.order_type === 'state_legislation')) {
                orderIds.add(highlight.order_id);
                console.log(`   Added to local state: ${highlight.order_id} (${highlight.order_type})`);
              }
            }
          }
          
          setLocalHighlights(orderIds);
          console.log('🌟 HighlightsPage: Final local highlights set:', Array.from(orderIds));
        } else {
          console.error('🔍 HighlightsPage: Failed to load highlights, status:', response.status);
        }
      } catch (error) {
        console.error('Error loading existing highlights:', error);
      }
    };
    
    loadExistingHighlights();
  }, []);

  // Filter functions
  const isFilterActive = (filterKey) => selectedFilters.includes(filterKey);

  const toggleFilter = (filterKey) => {
    setSelectedFilters(prev => {
      const newFilters = prev.includes(filterKey)
        ? prev.filter(f => f !== filterKey)
        : [...prev, filterKey];
      
      console.log('🔄 Filter toggled:', filterKey, 'New filters:', newFilters);
      setCurrentPage(1);
      return newFilters;
    });
  };

  const clearAllFilters = () => {
    console.log('🔄 Clearing all filters');
    setSelectedFilters([]);
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Fixed filter counts calculation - using highlights instead of undefined allOrders
  const filterCounts = useMemo(() => {
    const counts = {
      civic: 0,
      healthcare: 0,
      education: 0,
      engineering: 0,
      executive_order: 0,
      state_legislation: 0
    };

    highlights.forEach(highlight => {
      // Count categories
      if (highlight.category && counts.hasOwnProperty(highlight.category)) {
        counts[highlight.category]++;
      }
      
      // Count order types
      if (highlight.order_type === 'executive_order') {
        counts.executive_order++;
      } else if (highlight.order_type === 'state_legislation') {
        counts.state_legislation++;
      }
    });

    return counts;
  }, [highlights]);

  // Comprehensive filtering logic
  const filteredHighlights = useMemo(() => {
    let filtered = [...highlights];

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(highlight => 
        highlight.title?.toLowerCase().includes(term) ||
        highlight.ai_summary?.toLowerCase().includes(term) ||
        highlight.summary?.toLowerCase().includes(term) ||
        highlight.ai_talking_points?.toLowerCase().includes(term) ||
        highlight.ai_business_impact?.toLowerCase().includes(term) ||
        highlight.executive_order_number?.toString().toLowerCase().includes(term) ||
        highlight.bill_number?.toString().toLowerCase().includes(term)
      );
    }

    // Apply category filters
    const categoryFilters = selectedFilters.filter(f => !['executive_order', 'state_legislation'].includes(f));
    if (categoryFilters.length > 0) {
      filtered = filtered.filter(highlight => 
        categoryFilters.includes(highlight.category)
      );
    }

    // Apply order type filters
    const hasExecutiveOrderFilter = selectedFilters.includes('executive_order');
    const hasStateLegislationFilter = selectedFilters.includes('state_legislation');
    
    if (hasExecutiveOrderFilter && !hasStateLegislationFilter) {
      filtered = filtered.filter(highlight => highlight.order_type === 'executive_order');
    } else if (hasStateLegislationFilter && !hasExecutiveOrderFilter) {
      filtered = filtered.filter(highlight => highlight.order_type === 'state_legislation');
    }

    console.log(`🔍 Filtered highlights: ${filtered.length} of ${highlights.length} total`);
    return filtered;
  }, [highlights, searchTerm, selectedFilters]);

  // Pagination logic
  const totalItems = filteredHighlights.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedHighlights = filteredHighlights.slice(startIndex, endIndex);

  // Manual refresh handler
  const handleManualRefresh = async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      console.log('🔄 Starting manual refresh...');
      
      await refreshHighlights();
      
      const response = await fetch(`${API_URL}/api/highlights?user_id=1`);
      if (response.ok) {
        const data = await response.json();
        console.log('🔄 Manual refresh - highlights from API:', data);
        
        let highlightsArray = [];
        if (Array.isArray(data)) {
          highlightsArray = data;
        } else if (data.highlights && Array.isArray(data.highlights)) {
          highlightsArray = data.highlights;
        } else if (data.results && Array.isArray(data.results)) {
          highlightsArray = data.results;
        }
        
        const orderIds = new Set();
        
        for (let i = 0; i < highlightsArray.length; i++) {
          const highlight = highlightsArray[i];
          console.log(`🔄 Processing highlight ${i + 1}:`, highlight);
          
          if (highlight && highlight.order_id && 
              (highlight.order_type === 'executive_order' || highlight.order_type === 'state_legislation')) {
            orderIds.add(highlight.order_id);
            console.log(`   Added to local highlights: ${highlight.order_id} (${highlight.order_type})`);
          }
        }
        
        setLocalHighlights(orderIds);
        console.log('🔄 Manual refresh - updated local highlights:', Array.from(orderIds));
      }
      
      console.log('🔄 Manual refresh completed');
    } catch (error) {
      console.error('Error during manual refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Handle page change
  const handlePageChange = useCallback((newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [totalPages]);

  // Enhanced highlighting function
  const handleOrderHighlight = useCallback(async (order) => {
    console.log('🌟 HighlightsPage highlight handler called for:', order.title);
    
    const orderId = getUniversalOrderId(order);
    if (!orderId) {
      console.error('❌ No valid order ID found for highlighting');
      return;
    }
    
    console.log('🌟 HighlightsPage: Order details for highlighting:', {
      title: order.title,
      id: order.id,
      bill_id: order.bill_id,
      order_type: order.order_type,
      calculatedOrderId: orderId
    });
    
    const isCurrentlyHighlighted = localHighlights.has(orderId);
    console.log('🌟 Current highlight status:', isCurrentlyHighlighted, 'Order ID:', orderId, 'Type:', order.order_type);
    
    // Add to loading state
    setHighlightLoading(prev => new Set([...prev, orderId]));
    
    try {
      if (isCurrentlyHighlighted) {
        // REMOVE highlight
        console.log('🗑️ Attempting to remove highlight for:', orderId);
        
        setLocalHighlights(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
        
        const response = await fetch(`${API_URL}/api/highlights/${orderId}?user_id=1`, {
          method: 'DELETE',
        });
        
        if (!response.ok) {
          console.error('❌ Failed to remove highlight from backend');
          setLocalHighlights(prev => new Set([...prev, orderId]));
        } else {
          console.log('✅ Successfully removed highlight from backend');
          await refreshHighlights();
          if (stableHandlers?.handleItemHighlight) {
            stableHandlers.handleItemHighlight(order, order.order_type);
          }
        }
      } else {
        // ADD highlight
        console.log('⭐ Attempting to add highlight for:', orderId);
        
        setLocalHighlights(prev => new Set([...prev, orderId]));
        
        const requestBody = {
          user_id: 1,
          order_id: orderId,
          order_type: order.order_type,
          notes: null,
          priority_level: 1,
          tags: null,
          is_archived: false
        };
        
        console.log('⭐ Sending highlight request with body:', requestBody);
        
        const response = await fetch(`${API_URL}/api/highlights`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
          console.error('❌ Failed to add highlight');
          if (response.status !== 409) {
            setLocalHighlights(prev => {
              const newSet = new Set(prev);
              newSet.delete(orderId);
              return newSet;
            });
          } else {
            console.log('ℹ️ Highlight already exists (409), but updating local state anyway');
          }
        } else {
          console.log('✅ Successfully added highlight to backend');
          if (stableHandlers?.handleItemHighlight) {
            stableHandlers.handleItemHighlight(order, order.order_type);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Error managing highlight:', error);
      // Revert optimistic update on error
      if (isCurrentlyHighlighted) {
        setLocalHighlights(prev => new Set([...prev, orderId]));
      } else {
        setLocalHighlights(prev => {
          const newSet = new Set(prev);
          newSet.delete(orderId);
          return newSet;
        });
      }
    } finally {
      setHighlightLoading(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  }, [localHighlights, stableHandlers, refreshHighlights]);

  // Enhanced remove highlight handler
  const handleRemoveHighlight = async (highlight) => {
    try {
      const orderId = getUniversalOrderId(highlight);
      
      // Remove from local state immediately
      setLocalHighlights(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
      
      // Remove from backend
      await removeHighlight(highlight);
      
      // Also update global state if available
      if (stableHandlers?.refreshGlobalHighlights) {
        stableHandlers.refreshGlobalHighlights();
      }
    } catch (error) {
      console.error('Failed to remove highlight:', error);
      // Re-add to local state if backend removal failed
      const orderId = getUniversalOrderId(highlight);
      setLocalHighlights(prev => new Set([...prev, orderId]));
    }
  };

  // Check if order is highlighted
  const isOrderHighlighted = useCallback((order) => {
    const orderId = getUniversalOrderId(order);
    if (!orderId) return false;
    
    // Check local state first for immediate UI feedback
    const localHighlighted = localHighlights.has(orderId);
    
    // Also check stable handlers as fallback
    const stableHighlighted = stableHandlers?.isItemHighlighted?.(order) || false;
    
    const isHighlighted = localHighlighted || stableHighlighted;
    
    if (isHighlighted) {
      console.log(`🌟 Order is highlighted: ${order.title}, orderId: ${orderId}`);
    }
    
    return isHighlighted;
  }, [localHighlights, stableHandlers]);

  // Check if order is currently being highlighted/unhighlighted
  const isOrderHighlightLoading = useCallback((order) => {
    const orderId = getUniversalOrderId(order);
    return orderId ? highlightLoading.has(orderId) : false;
  }, [highlightLoading]);

  // Search handler
  const handleSearch = useCallback(() => {
    console.log(`🔍 Searching for: "${searchTerm}"`);
    setCurrentPage(1);
  }, [searchTerm]);

  // Format last refresh time
  const formatLastRefresh = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    
    if (minutes > 0) {
      return `${minutes}m ago`;
    } else if (seconds > 0) {
      return `${seconds}s ago`;
    } else {
      return 'just now';
    }
  };

  const hasHighlights = highlights && highlights.length > 0;

  return (
    <div className="pt-6">
      {/* Scroll to Top Button */}
      <ScrollToTopButton />
      
      {/* Header with Refresh Button */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Star />
          <h2 className="text-2xl font-bold text-gray-800">Highlights</h2>
        </div>
        <p className="text-gray-600">
          Manage a collection of important legislation and executive orders. View, organize, and analyze your highlighted items with comprehensive AI insights including executive summaries, key talking points, and business impact assessments. Filter by practice area or jurisdiction, and keep track of the legislative developments most relevant to your interests and responsibilities.
        </p>
        
        {/* Manual Refresh Button */}
        <div className="mt-4">
          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 flex items-center gap-2 ${
              isRefreshing
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
            title="Refresh highlights from server"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
        
        {/* Status Display */}
        {lastRefresh && (
          <div className="mt-2 text-xs text-gray-500">
            Last updated: {formatLastRefresh(lastRefresh)}
          </div>
        )}
      </div>

      {/* Search Bar and Filter */}
      <div className="mb-8">
        <div className="flex gap-4 items-center">
          <FilterDropdown
            selectedFilters={selectedFilters}
            showFilterDropdown={showFilterDropdown}
            onToggleDropdown={() => setShowFilterDropdown(!showFilterDropdown)}
            onToggleFilter={toggleFilter}
            onClearAllFilters={clearAllFilters}
            counts={filterCounts}
            ref={filterDropdownRef}
            showContentTypes={true}
          />

          {/* Search Bar */}
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search highlighted items..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300"
            />
            {searchTerm && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  {filteredHighlights.length} found
                </span>
              </div>
            )}
          </div>

          {/* Clear Filters Button */}
          {(selectedFilters.length > 0 || searchTerm) && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="px-4 py-3 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-all duration-300 flex-shrink-0"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Enhanced Highlights Display */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          {loading ? (
            <ShimmerLoader 
              variant="highlights" 
              count={5} 
              showHeader={false} 
            />
          ) : paginatedHighlights.length === 0 ? (
            <div className="text-center py-12">
              <Star size={48} className="mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {hasHighlights ? 'No matching highlights found' : 'No Highlights Yet'}
              </h3>
              <p className="text-gray-600 mb-4">
                {hasHighlights 
                  ? selectedFilters.length > 0 || searchTerm
                    ? `No highlights match your current filters and search criteria.`
                    : `No highlights match your search for "${searchTerm}".`
                  : "Start by highlighting executive orders or legislation from other pages."
                }
              </p>
              {selectedFilters.length > 0 || searchTerm ? (
                <button
                  onClick={clearAllFilters}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300"
                >
                  Clear Filters & Search
                </button>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                  <button 
                    onClick={() => navigate('/executive-orders')}
                    className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg text-left transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <ScrollText size={20} className="text-blue-600" />
                      <span className="font-semibold text-blue-800">Executive Orders</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      Browse and highlight federal executive orders
                    </p>
                  </button>
                  
                  <button 
                    onClick={() => navigate('/state/california')}
                    className="p-4 bg-green-50 hover:bg-green-100 rounded-lg text-left transition-colors"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <FileText size={20} className="text-green-600" />
                      <span className="font-semibold text-green-800">State Legislation</span>
                    </div>
                    <p className="text-sm text-green-700">
                      Find and highlight state bills and legislation
                    </p>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedHighlights.map((highlight, index) => {
                // Add index to highlight for unique ID generation
                const globalIndex = (currentPage - 1) * itemsPerPage + index;
                const highlightWithIndex = { ...highlight, index: globalIndex };
                const orderId = getUniversalOrderId(highlightWithIndex);
                const isExpanded = expandedOrders.has(orderId);
                
                return (
                  <div key={`highlight-${orderId}-${globalIndex}`} className="border rounded-lg overflow-hidden transition-all duration-300 border-gray-200">
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div 
                          className="flex-1 cursor-pointer hover:bg-gray-50 transition-all duration-300 rounded-md p-2 -ml-2 -mt-2 -mb-1"
                          onClick={() => {
                            setExpandedOrders(prev => {
                              const newSet = new Set(prev);
                              if (newSet.has(orderId)) {
                                newSet.delete(orderId);
                              } else {
                                newSet.add(orderId);
                              }
                              return newSet;
                            });
                          }}
                        >
                          <h3 className="text-lg font-semibold text-gray-800 mb-2">
                            {globalIndex + 1}. {cleanOrderTitle(highlight.title)}
                          </h3>
                          
                          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600 mb-2">
                            <span className="font-medium">
                              {highlight.order_type === 'executive_order' 
                                ? `Executive Order #: ${getExecutiveOrderNumber(highlight)}`
                                : `Bill #: ${highlight.bill_number || 'Unknown'}`
                              }
                            </span>
                            <span>-</span>
                            <span className="font-medium">
                              {highlight.order_type === 'executive_order' 
                                ? `Signed Date: ${highlight.formatted_signing_date || highlight.formatted_publication_date || 'Unknown'}`
                                : `Date: ${highlight.formatted_signing_date || formatDate(highlight.introduced_date) || formatDate(highlight.last_action_date) || 'Unknown'}`
                              }
                            </span>
                            <span>-</span>
                            <CategoryTag category={highlight.category} />
                            <span>-</span>
                            <OrderTypeTag orderType={highlight.order_type} />
                            {/* State Tag for State Legislation */}
                            {highlight.order_type === 'state_legislation' && highlight.state && (
                              <>
                                <span>-</span>
                                <StateTag state={highlight.state} />
                              </>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 ml-4">
                          {/* Enhanced Highlight button with loading state */}
                          <button
                            type="button"
                            className={`p-2 rounded-md transition-all duration-300 ${
                              isOrderHighlighted(highlightWithIndex)
                                ? 'text-yellow-500 bg-yellow-100 hover:bg-yellow-200'
                                : 'text-gray-400 hover:bg-gray-100 hover:text-yellow-500'
                            } ${isOrderHighlightLoading(highlightWithIndex) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!isOrderHighlightLoading(highlightWithIndex)) {
                                await handleOrderHighlight(highlightWithIndex);
                              }
                            }}
                            disabled={isOrderHighlightLoading(highlightWithIndex)}
                            title={
                              isOrderHighlightLoading(highlightWithIndex) 
                                ? "Processing..." 
                                : isOrderHighlighted(highlightWithIndex) 
                                  ? "Remove from highlights" 
                                  : "Add to highlights"
                            }
                          >
                            {isOrderHighlightLoading(highlightWithIndex) ? (
                              <RotateCw size={16} className="animate-spin" />
                            ) : (
                              <Star 
                                size={16} 
                                className={isOrderHighlighted(highlightWithIndex) ? "fill-current" : ""} 
                              />
                            )}
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setExpandedOrders(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(orderId)) {
                                  newSet.delete(orderId);
                                } else {
                                  newSet.add(orderId);
                                }
                                return newSet;
                              });
                            }}
                            className="p-2 hover:bg-gray-100 rounded-md transition-all duration-300"
                            title={isExpanded ? "Collapse details" : "Expand details"}
                          >
                            <ChevronDown 
                              size={20} 
                              className={`text-gray-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Azure AI Summary (always visible if available) */}
                      {highlight.ai_processed && highlight.ai_summary && (
                        <div className="mb-4 mt-4">
                          <div className="bg-purple-50 p-4 rounded-md border border-purple-200">
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-purple-800">Azure AI Executive Summary</h4>
                              <span className="text-purple-800">-</span>
                              <span className="inline-flex items-center justify-center px-2 py-1 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[11px] rounded-full leading-tight">
                                ✦ AI Generated
                              </span>
                            </div>
                            <div className="text-sm text-violet-800 leading-relaxed">
                              <div className="universal-text-content" style={{
                                fontSize: '14px',
                                lineHeight: '1.6',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word',
                                whiteSpace: 'normal'
                              }}>
                                {stripHtmlTags(highlight.ai_summary)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Expanded Content */}
                      {isExpanded && (
                        <div>
                          {/* Azure AI Talking Points */}
                          {highlight.ai_processed && highlight.ai_talking_points && (
                            <div className="mb-4 mt-4">
                              <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold text-blue-800">Key Talking Points</h4>
                                  <span className="text-blue-800">-</span>
                                  <span className="inline-flex items-center justify-center px-2 py-1 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[11px] rounded-full leading-tight">
                                    ✦ AI Generated
                                  </span>
                                </div>
                                <div className="text-sm text-blue-800 leading-relaxed">
                                  {formatTalkingPoints(highlight.ai_talking_points)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Azure AI Business Impact */}
                          {highlight.ai_processed && highlight.ai_business_impact && (
                            <div className="mb-4 mt-4">
                              <div className="bg-green-50 p-4 rounded-md border border-green-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <h4 className="font-semibold text-green-800">Business Impact Analysis</h4>
                                  <span className="text-green-800">-</span>
                                  <span className="inline-flex items-center justify-center px-2 py-1 bg-gradient-to-r from-violet-500 to-blue-500 text-white text-[11px] rounded-full leading-tight">
                                    ✦ AI Generated
                                  </span>
                                </div>
                                <div className="text-sm text-green-800 leading-relaxed">
                                  {formatUniversalContent(highlight.ai_business_impact)}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* No AI Analysis Message */}
                          {!highlight.ai_processed && (
                            <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h4 className="font-medium text-yellow-800">No AI Analysis Available</h4>
                                  <p className="text-yellow-700 text-sm">
                                    This item was highlighted before AI processing was available.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* External Links */}
                          <div className="flex flex-wrap gap-2 pt-2">
                            {highlight.html_url && (
                              <a
                                href={highlight.html_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-all duration-300 text-sm flex items-center gap-2"
                              >
                                <ExternalLink size={14} />
                                {highlight.order_type === 'executive_order' ? 'Federal Register' : 'Official Source'}
                              </a>
                            )}
                            
                            {highlight.pdf_url && (
                              <a
                                href={highlight.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-all duration-300 text-sm flex items-center gap-2"
                              >
                                <FileText size={14} />
                                View PDF
                              </a>
                            )}

                            {highlight.legiscan_url && (
                              <a
                                href={highlight.legiscan_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-all duration-300 text-sm flex items-center gap-2"
                              >
                                <ExternalLink size={14} />
                                View on LegiScan
                              </a>
                            )}

                            <button 
                              type="button"
                              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200 transition-all duration-300"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                
                                // Create comprehensive report
                                const orderReport = [
                                  highlight.title,
                                  highlight.order_type === 'executive_order' 
                                    ? `Executive Order #${getExecutiveOrderNumber(highlight)}`
                                    : `Bill #${highlight.bill_number || 'Unknown'}`,
                                  highlight.president ? `President: ${highlight.president}` : '',
                                  highlight.state ? `State: ${highlight.state}` : '',
                                  highlight.formatted_signing_date ? `Date: ${highlight.formatted_signing_date}` : '',
                                  highlight.category ? `Category: ${highlight.category}` : '',
                                  '',
                                  highlight.ai_summary ? `AI Summary: ${stripHtmlTags(highlight.ai_summary)}` : '',
                                  highlight.summary ? `Basic Summary: ${highlight.summary}` : '',
                                  highlight.ai_talking_points ? `Key Talking Points: ${stripHtmlTags(highlight.ai_talking_points)}` : '',
                                  highlight.ai_business_impact ? `Business Impact: ${stripHtmlTags(highlight.ai_business_impact)}` : '',
                                  highlight.html_url ? `Official URL: ${highlight.html_url}` : '',
                                  highlight.pdf_url ? `PDF URL: ${highlight.pdf_url}` : '',
                                  highlight.legiscan_url ? `LegiScan URL: ${highlight.legiscan_url}` : ''
                                ].filter(line => line.length > 0).join('\n');
                                
                                // Try to copy to clipboard
                                if (copyToClipboard && typeof copyToClipboard === 'function') {
                                  copyToClipboard(orderReport);
                                  console.log('✅ Copied highlight report to clipboard');
                                } else if (navigator.clipboard) {
                                  navigator.clipboard.writeText(orderReport).catch(console.error);
                                  console.log('✅ Copied highlight report to clipboard (fallback)');
                                } else {
                                  console.log('❌ Copy to clipboard not available');
                                }
                              }}
                            >
                              <Copy size={14} />
                              Copy Details
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {/* Pagination Controls */}
        {paginatedHighlights.length > 0 && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={handlePageChange}
            itemType="highlights"
          />
        )}
      </div>

      {/* Universal CSS Styles */}
      <style>{`
        .bg-purple-50 .text-violet-800,
        .bg-blue-50 .text-blue-800, 
        .bg-green-50 .text-green-800 {
          word-break: normal;
          overflow-wrap: anywhere;
          white-space: pre-wrap;
          text-align: justify;
        }

        .numbered-item {
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .numbered-text {
          word-break: normal;
          overflow-wrap: anywhere;
        }

        .universal-ai-content,
        .universal-structured-content,
        .universal-text-content {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: inherit;
        }

        .universal-numbered-content {
          margin: 8px 0;
        }

        .numbered-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 6px;
          font-size: 14px;
          line-height: 1.5;
        }

        .numbered-item:last-child {
          margin-bottom: 0;
        }

        .number-bullet {
          font-weight: 600;
          font-size: 14px;
          color: currentColor;
          min-width: 20px;
          flex-shrink: 0;
        }

        .numbered-text {
          flex: 1;
          font-size: 14px;
          line-height: 1.5;
          color: inherit;
        }

        .universal-bullet-content {
          margin: 8px 0;
        }

        .bullet-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 6px;
          font-size: 14px;
          line-height: 1.5;
        }

        .bullet-item:last-child {
          margin-bottom: 0;
        }

        .bullet-point {
          font-weight: 600;
          font-size: 16px;
          color: currentColor;
          min-width: 12px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .bullet-text {
          flex: 1;
          font-size: 14px;
          line-height: 1.5;
          color: inherit;
        }

        .numbered-list-content ol {
          margin: 8px 0;
          padding-left: 0;
          list-style: none;
          counter-reset: talking-points;
        }

        .numbered-list-content li {
          position: relative;
          padding-left: 24px;
          margin-bottom: 6px;
          font-size: 14px;
          line-height: 1.5;
          color: inherit;
          counter-increment: talking-points;
        }

        .numbered-list-content li:before {
          content: counter(talking-points) ".";
          position: absolute;
          left: 0;
          top: 0;
          font-weight: 600;
          font-size: 14px;
          color: currentColor;
          min-width: 20px;
        }

        .numbered-list-content li:last-child {
          margin-bottom: 0;
        }

        .universal-ai-content p {
          margin: 0 0 8px 0;
          font-size: 14px;
          line-height: 1.5;
        }

        .universal-ai-content p:last-child {
          margin-bottom: 0;
        }

        .universal-ai-content ol,
        .universal-ai-content ul {
          margin: 8px 0;
          padding-left: 20px;
          font-size: 14px;
        }

        .universal-ai-content li {
          margin-bottom: 4px;
          font-size: 14px;
          line-height: 1.5;
          color: inherit;
        }

        .universal-ai-content li:last-child {
          margin-bottom: 0;
        }

        .universal-ai-content strong {
          font-weight: 600;
          font-size: 14px;
        }

        .business-impact-sections {
          margin: 8px 0;
        }

        .business-impact-section {
          margin-bottom: 12px;
        }

        .business-impact-section:last-child {
          margin-bottom: 0;
        }

        .section-header {
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 600;
          color: inherit;
        }

        .section-items {
          margin: 0;
          padding: 0;
          list-style: none;
        }

        .section-item {
          margin-bottom: 4px;
          font-size: 14px;
          line-height: 1.5;
          color: inherit;
        }

        .section-item:last-child {
          margin-bottom: 0;
        }

        .text-purple-800 .universal-ai-content,
        .text-purple-800 .universal-structured-content,
        .text-purple-800 .universal-text-content,
        .text-purple-800 .number-bullet,
        .text-purple-800 .numbered-text,
        .text-purple-800 .bullet-point,
        .text-purple-800 .bullet-text {
          color: #5b21b6;
        }

        .text-blue-800 .universal-ai-content,
        .text-blue-800 .universal-structured-content,
        .text-blue-800 .universal-text-content,
        .text-blue-800 .number-bullet,
        .text-blue-800 .numbered-text,
        .text-blue-800 .bullet-point,
        .text-blue-800 .bullet-text {
          color: #1e40af;
        }

        .text-green-800 .universal-ai-content,
        .text-green-800 .universal-structured-content,
        .text-green-800 .universal-text-content,
        .text-green-800 .number-bullet,
        .text-green-800 .numbered-text,
        .text-green-800 .bullet-point,
        .text-green-800 .bullet-text {
          color: #166534;
        }

        .section-header {
          margin-bottom: 8px;
          font-size: 14px;
          font-weight: 600;
          color: inherit;
        }

        .section-item {
          margin-bottom: 4px;
          font-size: 14px;
          line-height: 1.5;
          color: inherit;
        }
      `}</style>
    </div>
  );
};

export default HighlightsPage;