import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDarkMode } from '../context/DarkModeContext';

const Footer = ({ appVersion }) => {
  const navigate = useNavigate();
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  const handleSupportClick = () => {
    window.location.href = 'mailto:support@moregroup.com?subject=LegislationVUE Support Request';
  };

  return (
    <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 transition-colors mt-auto">
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6 md:pt-10 pb-12 md:pb-16">
        {/* Footer Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

          {/* Left Column: About */}
          <div className="flex flex-col items-start w-full">
            {/* LegislativeVUE Branding */}
            <h3 className="text-lg font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent mb-3">
              LegislativeVUE
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 break-words">
              Strategic initiative tracking and management platform for modern organizations.
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 break-words">
              &copy; 2025 Built with <span>❤️</span> by <a href="https://moregroup-inc.com/" target="_blank" rel="noopener noreferrer" className="text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors">MOREgroup Solutions Development</a>. All rights reserved. Version: <span className="font-mono">{appVersion}</span>
            </p>
          </div>

          {/* Right Column: Quick Actions */}
          <div className="flex flex-col items-start md:items-end w-full">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 text-left md:text-right w-full">
              Quick Actions
            </h3>
            <div className="flex flex-col space-y-2 items-start md:items-end w-full">

              {/* Dark Mode Toggle Link */}
              <a
                href="javascript:void(0)"
                onClick={toggleDarkMode}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2 justify-start md:justify-end w-full"
                aria-label="Toggle dark mode"
              >
                {/* Moon icon - shown in light mode */}
                {!isDarkMode && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                  </svg>
                )}
                {/* Sun icon - shown in dark mode */}
                {isDarkMode && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                )}
                <span>{isDarkMode ? 'Toggle Light Mode' : 'Toggle Dark Mode'}</span>
              </a>

              {/* Support Link */}
              <a
                href="mailto:support@moregroup.com?subject=LegislationVUE Support Request"
                onClick={(e) => {
                  e.preventDefault();
                  handleSupportClick();
                }}
                className="text-xs text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2 justify-start md:justify-end w-full"
                aria-label="Contact support"
              >
                {/* Mail icon */}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Support</span>
              </a>

            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
