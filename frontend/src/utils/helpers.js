import { FILTERS } from './constants';

// API URL configuration
export const getApiUrl = () => {
  if (import.meta.env?.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof process !== 'undefined' && process.env?.VITE_API_URL) return process.env.VITE_API_URL;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') return 'http://localhost:8000';
  return 'https://your-api-domain.com';
};

// Get Order ID - works for both executive orders and state bills
export const getOrderId = (order) => {
  if (!order) return null;
  
  // For state bills, try these fields first
  if (order.bill_id) return order.bill_id;
  if (order.id && typeof order.id === 'string') return order.id;
  
  // For executive orders, try these fields
  if (order.executive_order_number) return order.executive_order_number;
  if (order.eo_number) return order.eo_number;
  if (order.document_number) return order.document_number;
  
  // Fallback
  return `order-${order.title?.slice(0, 10) || Math.random()}`;
};

// Get Executive Order Number - enhanced version
export const getExecutiveOrderNumber = (order) => {
  if (!order) return 'N/A';
  
  const possibleFields = [
    'executive_order_number',
    'eo_number', 
    'order_number',
    'document_number'
  ];
  
  for (const field of possibleFields) {
    const value = order[field];
    if (value && value !== '' && value !== null && value !== undefined) {
      // Clean up the value
      const cleanValue = String(value).trim();
      if (cleanValue && cleanValue !== '0') {
        return cleanValue;
      }
    }
  }

  // If no explicit number found, try to extract from title
  const title = order.title || '';
  const titleMatch = title.match(/(?:executive\s+order\s+(?:no\.?\s+)?|eo\s+)(\d+)/i);
  if (titleMatch) {
    console.log(`🎯 Extracted EO number from title: ${titleMatch[1]}`);
    return titleMatch[1];
  }
  
  console.log('⚠️ No executive order number found for order:', order);
  return 'N/A';
};

// Strip HTML Tags
export const stripHtmlTags = (html) => {
  if (!html) return '';
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  let text = tempDiv.textContent || tempDiv.innerText || '';
  text = text.replace(/\s+/g, ' ').trim();
  return text;
};

// ENHANCED FORMAT CONTENT - Updated for better bullet handling
export const formatContent = (content) => {
  if (!content) return [];

  // If it's already HTML with proper tags, return as-is for HTML rendering
  if (content.includes('<ol>') || content.includes('<ul>') || content.includes('<li>')) {
    return [{ type: 'html', content: content }];
  }

  // Split by common delimiters and clean up
  const lines = content
    .split(/[\n\r]+/)
    .map(line => line.trim())
    .filter(line => line.length > 0);

  if (lines.length === 0) return [{ type: 'text', content: content }];

  const formattedItems = [];

  lines.forEach(line => {
    // Remove various bullet indicators and numbering
    let cleanLine = line
      .replace(/^\d+\.\s*/, '') // Remove "1. "
      .replace(/^[•\-*]\s*/, '') // Remove "• ", "- ", "* "
      .replace(/^[→→]\s*/, '') // Remove arrow bullets
      .replace(/^[\u2022\u2023\u25E6\u2043\u2219]\s*/, '') // Remove various Unicode bullets
      .trim();

    if (cleanLine) {
      formattedItems.push({ type: 'text', content: cleanLine });
    }
  });

  return formattedItems.length > 0 ? formattedItems : [{ type: 'text', content: content }];
};

// ENHANCED FORMAT CONTENT - Alternative function name for backward compatibility
export const formatContentEnhanced = (content) => {
  return formatContent(content);
};

// Format Content for Copy - Updated to work with new format
export const formatContentForCopy = (content, title = '') => {
  if (!content) return '';
  
  // Use the enhanced formatting
  const items = formatContent(content);
  let formatted = '';
  
  if (title) {
    formatted += `${title}:\n`;
  }
  
  items.forEach((item) => {
    if (item.type === 'html') {
      // Strip HTML for copy format
      const cleanText = stripHtmlTags(item.content);
      formatted += `• ${cleanText}\n`;
    } else {
      formatted += `• ${item.content}\n`;
    }
  });
  
  return formatted + '\n';
};

// Create Formatted Report
export const createFormattedReport = (order) => {
  let report = '';
  report += `EXECUTIVE ORDER #${order.executive_order_number}\n`;
  report += `${order.title}\n`;
  report += `Date: ${order.signing_date ? new Date(order.signing_date).toLocaleDateString() : 'N/A'}\n`;
  report += `Category: ${FILTERS.find(f => f.key === order.category)?.label || order.category || 'Uncategorized'}\n`;
  report += `${'='.repeat(60)}\n\n`;
  
  if (order.ai_summary) {
    report += `AI SUMMARY:\n`;
    report += `${stripHtmlTags(order.ai_summary)}\n\n`;
  }
  
  if (order.ai_talking_points) {
    report += formatContentForCopy(order.ai_talking_points, 'KEY TALKING POINTS');
  }
  
  if (order.ai_business_impact) {
    report += formatContentForCopy(order.ai_business_impact, 'BUSINESS IMPACT ANALYSIS');
  }
  
  if (order.ai_potential_impact) {
    report += formatContentForCopy(order.ai_potential_impact, 'LONG-TERM IMPACT');
  }
  
  if (order.abstract) {
    report += `ABSTRACT:\n`;
    report += `${stripHtmlTags(order.abstract)}\n\n`;
  }
  
  report += `LINKS:\n`;
  report += `• Federal Register: ${getFederalRegisterUrl(order)}\n`;
  if (order.pdf_url) report += `• PDF Document: ${order.pdf_url}\n`;
  if (order.html_url) report += `• HTML Version: ${order.html_url}\n`;
  
  return report;
};

// Get Federal Register URL
export const getFederalRegisterUrl = (order) => {
  if (order.html_url && order.html_url.includes('federalregister.gov')) return order.html_url;
  if (order.document_number) return `https://www.federalregister.gov/documents/${order.document_number}`;
  if (order.executive_order_number) return `https://www.federalregister.gov/presidential-documents/executive-orders?conditions%5Bterm%5D=${order.executive_order_number}`;
  return 'https://www.federalregister.gov/presidential-documents/executive-orders';
};

// Date formatting helper
export const formatDate = (dateString) => {
  if (!dateString) return 'No date';
  try {
    return new Date(dateString).toLocaleDateString();
  } catch (error) {
    return 'Invalid date';
  }
};

// Generate unique ID for bills/orders
export const generateUniqueId = (item, index = 0) => {
  if (item.bill_id) return item.bill_id;
  if (item.id && typeof item.id === 'string') return item.id;
  if (item.bill_number) return `state-bill-${item.bill_number}`;
  if (item.executive_order_number) return `eo-${item.executive_order_number}`;
  return `fallback-${item.title?.slice(0, 10) || index}`;
};