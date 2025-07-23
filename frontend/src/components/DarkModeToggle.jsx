import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useDarkMode } from '../context/DarkModeContext';

const DarkModeToggle = ({ className = '' }) => {
  const { isDarkMode, toggleDarkMode } = useDarkMode();

  return (
    <button
      onClick={toggleDarkMode}
      className={`
        flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium 
        text-gray-600 dark:text-dark-text-secondary 
        hover:text-gray-800 dark:hover:text-dark-text 
        hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary 
        transition-all duration-300 border border-gray-200 dark:border-dark-border
        ${className}
      `}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="relative w-4 h-4">
        {/* Sun icon */}
        <Sun
          size={18}
          className={`
            absolute inset-0 text-yellow-500 dark:text-yellow-400
            transition-all duration-300 ease-in-out
            ${isDarkMode 
              ? 'rotate-90 scale-0 opacity-0' 
              : 'rotate-0 scale-100 opacity-100'
            }
          `}
        />
        
        {/* Moon icon */}
        <Moon
          size={18}
          className={`
            absolute inset-0 text-blue-600 dark:text-blue-400
            transition-all duration-300 ease-in-out
            ${isDarkMode 
              ? 'rotate-0 scale-100 opacity-100' 
              : '-rotate-90 scale-0 opacity-0'
            }
          `}
        />
      </div>
    </button>
  );
};

export default DarkModeToggle;