// src/components/OrderCard.jsx - More resilient version
import React, { useState } from 'react';
import { Mail, HeartPulse, GraduationCap, Building, Wrench, X as XIcon, ScrollText, FileDown, Clipboard, Key, TrendingUp, Scale, ChevronDown } from 'lucide-react';

// Sparkle SVG component
const SparkleIcon = ({ className }) => (
  <svg viewBox="0 0 512 512" className={className} fill="currentColor">
    <g>
      <path d="M247.355,106.9C222.705,82.241,205.833,39.18,197.46,0c-8.386,39.188-25.24,82.258-49.899,106.917 c-24.65,24.642-67.724,41.514-106.896,49.904c39.188,8.373,82.254,25.235,106.904,49.895c24.65,24.65,41.522,67.72,49.908,106.9 c8.373-39.188,25.24-82.258,49.886-106.917c24.65-24.65,67.724-41.514,106.896-49.904 C315.08,148.422,272.014,131.551,247.355,106.9z"></path>
      <path d="M407.471,304.339c-14.714-14.721-24.81-40.46-29.812-63.864c-5.011,23.404-15.073,49.142-29.803,63.872 c-14.73,14.714-40.464,24.801-63.864,29.812c23.408,5.01,49.134,15.081,63.864,29.811c14.73,14.722,24.81,40.46,29.82,63.864 c5.001-23.413,15.081-49.142,29.802-63.872c14.722-14.722,40.46-24.802,63.856-29.82 C447.939,329.14,422.201,319.061,407.471,304.339z"></path>
      <path d="M146.352,354.702c-4.207,19.648-12.655,41.263-25.019,53.626c-12.362,12.354-33.968,20.82-53.613,25.027 c19.645,4.216,41.251,12.656,53.613,25.027c12.364,12.362,20.829,33.96,25.036,53.618c4.203-19.658,12.655-41.255,25.023-53.626 c12.354-12.362,33.964-20.82,53.605-25.035c-19.64-4.2-41.251-12.656-53.613-25.019 C159.024,395.966,150.555,374.351,146.352,354.702z"></path>
    </g>
  </svg>
);

export default function OrderCard({ order, isExpanded, onToggle }) {
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [toEmail, setToEmail] = useState('');
  
  // Debug logging to see the structure of the order
  console.log("Rendering OrderCard with order:", order);

  // Safely access order properties with fallbacks
  const orderNumber = order?.executive_order_number || 'N/A';
  const title = order?.title || 'Untitled Order';
  const category = order?.category || 'not-applicable';
  const htmlUrl = order?.html_url || '';
  const pdfUrl = order?.pdf_url || '';
  const signingDate = order?.signing_date ? new Date(order.signing_date).toLocaleDateString() : 'N/A';
  
  // Safely get AI content
  const getAISummary = () => {
    try {
      return order?.ai_executive_summary || order?.ai_summary || '<p>No AI summary available.</p>';
    } catch (error) {
      console.error("Error getting AI summary:", error);
      return '<p>Error loading AI summary.</p>';
    }
  };

  const getKeyPoints = () => {
    try {
      return order?.ai_talking_points || order?.ai_key_points || '<p>No AI key points available.</p>';
    } catch (error) {
      console.error("Error getting key points:", error);
      return '<p>Error loading key points.</p>';
    }
  };

  const getBusinessImpact = () => {
    try {
      return order?.ai_business_impact || order?.ai_potential_impact || '<p>No AI business impact available.</p>';
    } catch (error) {
      console.error("Error getting business impact:", error);
      return '<p>Error loading business impact.</p>';
    }
  };

  const getAIVersion = () => {
    if (!order) return 'Standard AI';
    if (order.ai_version === 'v2') return 'Enhanced AI';
    if (order.ai_version === 'v1_migrated') return 'Updated AI';
    if (order.ai_version) return order.ai_version;
    return 'Standard AI';
  };

  // This function is used for the email body and needs plain text
  const getEmailContentForDisplay = (order) => {
    if (!order) return 'No order details available.';
    
    let body = `Executive Order Title: ${title}\n`;
    body += `Order Number: ${orderNumber}\n`;
    body += `Signed Date: ${signingDate}\n`;
    body += `Category: ${category}\n`;
    body += `AI Version: ${getAIVersion()}\n\n`;

    if (order.abstract) {
      body += `Abstract:\n${order.abstract}\n\n`;
    }

    // Strip HTML tags for the email body
    const stripHtml = (htmlString) => (htmlString || '').replace(/<[^>]*>/g, '');

    body += `AI Summary:\n${stripHtml(getAISummary())}\n\n`;

    const keyPoints = getKeyPoints();
    body += `Key Points:\n${stripHtml(keyPoints)}\n\n`;

    const businessImpact = getBusinessImpact();
    body += `Business Impact:\n${stripHtml(businessImpact)}\n\n`;

    if (htmlUrl) {
      body += `Read Full Text: ${htmlUrl}\n`;
    }
    return body;
  };

  const emailSubjectForDisplay = title || 'Executive Order Details';
  const emailBodyForDisplay = getEmailContentForDisplay(order);

  const categoryStyles = {
    'healthcare': {
      bgColor: 'bg-red-100 text-red-700',
      icon: HeartPulse,
    },
    'education': {
      bgColor: 'bg-yellow-100 text-yellow-700',
      icon: GraduationCap,
    },
    'civic': {
      bgColor: 'bg-blue-100 text-blue-700',
      icon: Building,
    },
    'engineering': {
      bgColor: 'bg-green-100 text-green-700',
      icon: Wrench,
    },
    'not-applicable': {
      bgColor: 'bg-gray-100 text-gray-700',
      icon: XIcon,
    },
  };

  const currentCategoryStyle = categoryStyles[category] || categoryStyles['not-applicable'];
  const IconComponent = currentCategoryStyle.icon;

  const handleSendEmail = async () => {
    if (!toEmail) {
      alert("Please enter a recipient email address.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(toEmail)) {
      alert("Please enter a valid email address.");
      return;
    }

    try {
      const base = import.meta.env.VITE_API_URL;
      const response = await fetch(`${base}/api/send-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to_email: toEmail,
          subject: emailSubjectForDisplay,
          body: emailBodyForDisplay, // This is plain text now
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to send email.');
      }

      alert("Email sent successfully!");
      setShowEmailModal(false);
      setToEmail('');
    } catch (error) {
      console.error("Error sending email:", error);
      alert(`Error sending email: ${error.message}`);
    }
  };

  return (
    <div className="bg-white border rounded-md shadow-sm overflow-hidden">
      <div className="p-4 flex justify-between items-center">
        <h3 className="font-semibold text-xl text-gray-800">
          {title}
        </h3>
        <button
          onClick={onToggle}
          className="p-2 hover:bg-gray-100 rounded-full transition-all duration-200"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronDown
            size={24}
            className={`text-violet-600 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md ${currentCategoryStyle.bgColor}`}>
            {IconComponent && <IconComponent size={16} />}
            {category === 'not-applicable'
              ? 'Not Applicable'
              : category.charAt(0).toUpperCase() + category.slice(1)}
          </span>

          {order?.ai_version && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md ${
              order.ai_version === 'v2' ? 'bg-green-100 text-green-700' :
              order.ai_version === 'v1_migrated' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {getAIVersion()}
            </span>
          )}
        </div>

        <p className="mt-2 text-sm text-gray-600">
          Signed: {signingDate}
          {' • '}
          Order #: {orderNumber}
        </p>

        {/* AI Summary Section - Render HTML directly */}
        <div className="mt-2 bg-violet-50 py-4 px-6 rounded">
          <h4 className="font-semibold text-violet-900 mb-2 flex items-center gap-2">
            <SparkleIcon className="w-5 h-5 text-violet-900" />
            AI Summary
          </h4>
          {/* dangerouslySetInnerHTML is used to render the HTML string from the backend */}
          <div className="text-violet-900 ai-content" dangerouslySetInnerHTML={{ __html: getAISummary() }} />
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            {/* Key Talking Points Section - Render HTML directly */}
            <div className="bg-violet-50 py-4 px-6 rounded">
              <h5 className="font-semibold text-violet-900 mb-2 flex items-center gap-2">
                <Key className="w-5 h-5 text-violet-900" />
                Key Talking Points
              </h5>
              <div className="text-violet-900 ai-content" dangerouslySetInnerHTML={{ __html: getKeyPoints() }} />
            </div>

            {/* Business Impact Section - Render HTML directly */}
            <div className="bg-violet-50 py-4 px-6 rounded">
              <h5 className="font-semibold text-violet-900 mb-2 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-violet-900" />
                Business Impact
              </h5>
              <div className="text-violet-900 ai-content" dangerouslySetInnerHTML={{ __html: getBusinessImpact() }} />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end mt-4 gap-2">
              {htmlUrl && (
                <a
                  href={htmlUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors"
                >
                  <ScrollText size={16} />
                  <span>Read Full Text</span>
                </a>
              )}
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors"
                >
                  <FileDown size={16} />
                  <span>Download PDF</span>
                </a>
              )}
              <button
                onClick={() => { setShowEmailModal(true); setToEmail(''); }}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              >
                <Mail size={16} />
                <span>Send Email</span>
              </button>
            </div>
          </div>
        )}

        {/* Email Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
              <div className="flex justify-between items-center border-b pb-3 mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Send Email</h2>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XIcon size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                <div>
                  <label htmlFor="email-to" className="block text-sm font-medium text-gray-700">To:</label>
                  <input
                    id="email-to"
                    type="email"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter recipient email address (e.g., name@example.com)"
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="email-subject" className="block text-sm font-medium text-gray-700">Subject:</label>
                  <input
                    id="email-subject"
                    type="text"
                    value={emailSubjectForDisplay}
                    readOnly
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-50 text-gray-600"
                  />
                </div>
                <div>
                  <label htmlFor="email-body" className="block text-sm font-medium text-gray-700">Body:</label>
                   {/* The email body textarea should display plain text */}
                  <textarea
                    id="email-body"
                    value={emailBodyForDisplay} // This is plain text thanks to stripHtml
                    readOnly
                    rows="15"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-gray-50 text-gray-700 font-mono text-sm resize-y"
                  ></textarea>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t pt-4">
                <button
                  onClick={() => {
                    const contentToCopy = `Subject: ${emailSubjectForDisplay}\n\n${emailBodyForDisplay}`;
                    navigator.clipboard.writeText(contentToCopy);
                    alert('Email content copied to clipboard!');
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors"
                >
                  <Clipboard size={16} />
                  <span>Copy Email</span>
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={!toEmail}
                  className="flex items-center gap-2 px-4 py-2 rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Mail size={16} />
                  <span>Send Email</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}