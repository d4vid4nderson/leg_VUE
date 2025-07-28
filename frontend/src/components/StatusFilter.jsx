import React, { useState, useRef, useEffect } from 'react';
import { Flag, ChevronDown, Check } from 'lucide-react';

const StatusFilter = ({ 
  statusOptions = [], 
  selectedStatus = null, 
  onStatusChange, 
  disabled = false,
  loading = false,
  statusCounts = {}
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStatusToggle = (statusKey) => {
    if (disabled) return;
    
    // If clicking the same status, deselect it
    if (selectedStatus === statusKey) {
      onStatusChange(null);
    } else {
      onStatusChange(statusKey);
    }
    
    setIsOpen(false);
  };

  const getButtonLabel = () => {
    if (!selectedStatus) {
      return 'All Statuses';
    }
    const status = statusOptions.find(s => s.key === selectedStatus);
    return status ? status.label : 'Status Filter';
  };

  const getButtonIcon = () => {
    if (!selectedStatus) {
      return Flag;
    }
    const status = statusOptions.find(s => s.key === selectedStatus);
    return status ? status.icon : Flag;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={`flex items-center px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium bg-white dark:bg-dark-bg-secondary text-gray-900 dark:text-white transition-all duration-300 w-full sm:w-auto h-[42px] ${
          disabled || loading 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
        } ${selectedStatus ? 'ring-2 ring-blue-500 dark:ring-blue-400 border-blue-500 dark:border-blue-400' : ''}`}
      >
        <div className="flex items-center gap-2">
          {(() => {
            const IconComponent = getButtonIcon();
            return <IconComponent size={16} className="text-gray-500 dark:text-gray-300" />;
          })()}
          <span className="whitespace-nowrap">{getButtonLabel()}</span>
        </div>
        <ChevronDown 
          size={16} 
          className={`ml-4 text-gray-500 dark:text-gray-300 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute top-full mt-2 bg-white dark:bg-dark-bg-secondary border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-[120] w-full sm:w-auto sm:min-w-[220px] max-h-[400px] overflow-hidden left-0 sm:left-auto sm:right-0">
          <div className="sticky top-0 bg-gray-50 dark:bg-dark-bg-secondary px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Filter by Bill Status
              </span>
              {selectedStatus && (
                <button
                  onClick={() => {
                    onStatusChange(null);
                    setIsOpen(false);
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          
          <div className="overflow-y-auto max-h-[320px]">
            <div className="py-1">
              {statusOptions.map((status) => {
                const isSelected = selectedStatus === status.key;
                const StatusIcon = status.icon;
                const count = statusCounts[status.key] || 0;
                
                return (
                  <button
                    key={status.key}
                    onClick={() => handleStatusToggle(status.key)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 flex items-center justify-between group ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                    title={status.description}
                  >
                    <div className="flex items-center gap-3">
                      <StatusIcon size={16} className={isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-300'} />
                      <span className={`text-sm ${isSelected ? 'text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-900 dark:text-white'}`}>
                        {status.label}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">({count})</span>
                      <div className={`flex-shrink-0 ${
                        isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-50'
                      }`}>
                        <Check size={16} className="text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusFilter;