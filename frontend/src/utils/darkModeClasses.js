// Utility functions for consistent dark mode styling

export const getCardClasses = (additional = '') => `
  bg-white dark:bg-gray-800 
  border-gray-200 dark:border-gray-600
  text-gray-900 dark:text-gray-100
  ${additional}
`;

export const getButtonClasses = (variant = 'primary', additional = '') => {
  const variants = {
    primary: `
      bg-blue-600 dark:bg-blue-700 
      hover:bg-blue-700 dark:hover:bg-blue-600
      text-white
    `,
    secondary: `
      bg-gray-200 dark:bg-gray-700
      hover:bg-gray-300 dark:hover:bg-gray-600
      text-gray-700 dark:text-gray-200
    `,
    danger: `
      bg-red-600 dark:bg-red-700
      hover:bg-red-700 dark:hover:bg-red-600
      text-white
    `
  };
  
  return `${variants[variant]} ${additional}`;
};

export const getInputClasses = (additional = '') => `
  bg-white dark:bg-gray-700
  border-gray-300 dark:border-gray-600
  text-gray-900 dark:text-gray-100
  placeholder-gray-400 dark:placeholder-gray-400
  focus:border-blue-500 dark:focus:border-blue-400
  ${additional}
`;

export const getModalClasses = (additional = '') => `
  bg-white dark:bg-gray-800
  border-gray-200 dark:border-gray-600
  ${additional}
`;

export const getTextClasses = (variant = 'primary', additional = '') => {
  const variants = {
    primary: 'text-gray-900 dark:text-gray-100',
    secondary: 'text-gray-600 dark:text-gray-300',
    muted: 'text-gray-500 dark:text-gray-400'
  };
  
  return `${variants[variant]} ${additional}`;
};

export const getHeaderClasses = (additional = '') => `
  bg-white dark:bg-gray-900
  border-gray-200 dark:border-gray-700
  ${additional}
`;

export const getPageContainerClasses = (additional = '') => `
  bg-gradient-to-br from-blue-50 via-white to-purple-50
  dark:from-gray-900 dark:via-gray-800 dark:to-gray-900
  ${additional}
`;

export const getCategoryTagClasses = (category) => {
  const baseClasses = 'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border';
  
  switch (category) {
    case 'civic':
      return `${baseClasses} bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-700`;
    case 'education':
      return `${baseClasses} bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-700`;
    case 'engineering':
      return `${baseClasses} bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200 border-green-200 dark:border-green-700`;
    case 'healthcare':
      return `${baseClasses} bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 border-red-200 dark:border-red-700`;
    default:
      return `${baseClasses} bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-600`;
  }
};