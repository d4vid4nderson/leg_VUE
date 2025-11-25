// FilterButton.jsx - Reusable filter button component with standardized styling
import React from 'react';

const FilterButton = ({ 
  isActive, 
  onClick, 
  icon, 
  label, 
  count, 
  colorClasses,
  className = ""
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md transition-all duration-200 ${
        isActive 
          ? `${colorClasses.bg} ${colorClasses.text} font-medium` 
          : 'hover:bg-gray-50 text-gray-700'
      } ${className}`}
    >
      <div className="flex items-center gap-2.5">
        <span className={isActive ? colorClasses.icon : 'text-gray-500'}>
          {icon}
        </span>
        <span className="text-sm">{label}</span>
      </div>
      <span className={`text-sm px-2 py-1 rounded-full ${
        isActive 
          ? colorClasses.count 
          : 'bg-gray-50 text-gray-500 border border-gray-200'
      }`}>
        {count}
      </span>
    </button>
  );
};

export default FilterButton;