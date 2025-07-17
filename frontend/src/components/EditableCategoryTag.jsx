import React, { useState, useEffect, useRef } from 'react';
import { 
  Building, 
  HeartPulse, 
  GraduationCap, 
  Wrench, 
  Ban, 
  ChevronDown, 
  Check, 
  RotateCw,
  LayoutGrid
} from 'lucide-react';

const EditableCategoryTag = ({ 
  category, 
  itemId, 
  itemType = 'executive_order', // 'executive_order', 'state_legislation', or 'highlight'
  onCategoryChange, 
  disabled = false,
  isUpdating = false 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Available categories - you can customize this list
  const availableCategories = [
    { key: 'all_practice_areas', label: 'All Practice Areas', color: 'bg-teal-50 text-teal-700 border border-teal-200', icon: LayoutGrid },
    { key: 'civic', label: 'Civic', color: 'bg-blue-50 text-blue-700 border border-blue-200', icon: Building },
    { key: 'education', label: 'Education', color: 'bg-orange-50 text-orange-700 border border-orange-200', icon: GraduationCap },
    { key: 'engineering', label: 'Engineering', color: 'bg-green-50 text-green-700 border border-green-200', icon: Wrench },
    { key: 'healthcare', label: 'Healthcare', color: 'bg-red-50 text-red-700 border border-red-200', icon: HeartPulse },
    { key: 'not_applicable', label: 'Not Applicable', color: 'bg-gray-50 text-gray-700 border border-gray-200', icon: Ban }
  ];

  const getCurrentCategory = () => {
    return availableCategories.find(cat => cat.key === category) || availableCategories[0];
  };

  const handleCategorySelect = async (newCategory) => {
    if (newCategory === category || disabled || isLoading) return;
    
    setIsLoading(true);
    
    try {
      // Call the parent function to handle the API update
      if (onCategoryChange) {
        await onCategoryChange(itemId, newCategory, itemType);
      }
      console.log(`✅ Category updated from ${category} to ${newCategory}`);
    } catch (error) {
      console.error('❌ Failed to update category:', error);
    } finally {
      setIsLoading(false);
      setIsEditing(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsEditing(false);
      }
    };

    if (isEditing) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isEditing]);

  const currentCategory = getCurrentCategory();
  const IconComponent = currentCategory.icon;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <span 
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-all duration-200 ${
          currentCategory.color
        } ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-sm'
        } ${
          isUpdating || isLoading ? 'animate-pulse' : ''
        }`}
        onClick={() => !disabled && !isLoading && setIsEditing(!isEditing)}
        title={disabled ? 'Category editing disabled' : 'Click to change category'}
      >
        <IconComponent
          size={12}
          className={
            category === 'civic' ? 'text-blue-600' :
            category === 'education' ? 'text-orange-600' :
            category === 'engineering' ? 'text-green-600' :
            category === 'healthcare' ? 'text-red-600' :
            'text-gray-600'
          }
        />
        <span>{currentCategory.label}</span>
        {!disabled && !isLoading && (
          <ChevronDown 
            size={10} 
            className={`transition-transform duration-200 ${isEditing ? 'rotate-180' : ''}`}
          />
        )}
        {(isUpdating || isLoading) && (
          <RotateCw size={10} className="animate-spin" />
        )}
      </span>

      {/* Dropdown Menu */}
      {isEditing && !disabled && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-[120] min-w-[140px]">
          <div className="py-1">
            {availableCategories.map((cat) => {
              const CatIcon = cat.icon;
              const isSelected = cat.key === category;
              
              return (
                <button
                  key={cat.key}
                  onClick={() => handleCategorySelect(cat.key)}
                  disabled={isSelected || isLoading}
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 transition-colors duration-150 flex items-center gap-2 ${
                    isSelected ? 'bg-gray-100 cursor-not-allowed opacity-75' : 'cursor-pointer'
                  }`}
                >
                  <CatIcon size={12} className="flex-shrink-0" />
                  <span className="truncate">{cat.label}</span>
                  {isSelected && (
                    <Check size={10} className="ml-auto text-green-600 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default EditableCategoryTag;