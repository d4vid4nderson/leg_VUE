import React, { useState, useEffect, useRef } from 'react';
import { 
  Building, 
  Stethoscope, 
  GraduationCap, 
  Wrench, 
  FileText, 
  ChevronDown, 
  Check, 
  RotateCw 
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
    { key: 'civic', label: 'Civic', color: 'bg-blue-100 text-blue-800', icon: Building },
    { key: 'healthcare', label: 'Healthcare', color: 'bg-red-100 text-red-800', icon: Stethoscope },
    { key: 'education', label: 'Education', color: 'bg-orange-100 text-orange-800', icon: GraduationCap },
    { key: 'engineering', label: 'Engineering', color: 'bg-green-100 text-green-800', icon: Wrench },
    { key: 'not_applicable', label: 'Not Applicable', color: 'bg-gray-100 text-gray-800', icon: FileText }
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
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-all duration-200 ${
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
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[140px] max-h-48 overflow-y-auto">
          <div className="py-1">
            {availableCategories.map((cat) => {
              const CatIcon = cat.icon;
              const isSelected = cat.key === category;
              
              return (
                <button
                  key={cat.key}
                  onClick={() => handleCategorySelect(cat.key)}
                  disabled={isSelected || isLoading}
                  className={`w-full px-3 py-2 text-left text-xs hover:bg-gray-50 transition-colors duration-150 flex items-center gap-2 ${
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