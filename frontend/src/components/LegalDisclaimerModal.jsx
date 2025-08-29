import React, { useState, useEffect } from 'react';
import { X, Scale } from 'lucide-react';

const LegalDisclaimerModal = ({ stateName, stateAbbr }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Show modal after a brief delay to avoid jarring experience
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [stateName, stateAbbr]); // Re-show when state changes

  const handleDismiss = () => {
    setIsVisible(false);
  };

  const handleBackdropClick = (e) => {
    // Only close if clicking the backdrop, not the modal content
    if (e.target === e.currentTarget) {
      handleDismiss();
    }
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[200] p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-dark-bg-primary rounded-lg shadow-xl max-w-md w-full mx-4 relative">
        {/* Close Button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 z-10"
          aria-label="Close disclaimer"
        >
          <X size={20} />
        </button>

        {/* Header with centered icon */}
        <div className="text-center pt-8 pb-6 px-6">
          <div className="bg-yellow-100 dark:bg-yellow-900/30 p-3 rounded-full inline-flex mb-4">
            <Scale size={24} className="text-yellow-600 dark:text-yellow-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
            Disclaimer
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {stateName} Legislation
          </p>
        </div>

        {/* Content */}
        <div className="px-6 pb-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              <strong>Please note:</strong> Legislative information may be incomplete, outdated, or subject to change. 
              For official and complete legislative records, please consult the official {stateName} state legislature website 
              or contact your representatives directly.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-2 bg-gray-50 dark:bg-dark-bg-secondary rounded-b-lg">
          <button
            onClick={handleDismiss}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};

export default LegalDisclaimerModal;