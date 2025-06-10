// components/Header.jsx - Main navigation header
import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Info,
  Menu as HamburgerIcon,
  ChevronDown,
  Star,
  ScrollText,
  FileText,
  Settings
} from 'lucide-react';

import { SUPPORTED_STATES } from '../utils/constants';
import { InformationModal } from './CommonComponents';
import byMOREgroupLogo from './byMOREgroup.PNG';

const Header = ({ showDropdown, setShowDropdown, dropdownRef, currentPage, highlightedCount }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Add state for information modal
  const [showInfoModal, setShowInfoModal] = useState(false);

  return (
    <>
      <header className="bg-white shadow-sm z-10 relative">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex items-center justify-between h-16 sm:h-24">
            
           {/* Logo Section - Clickable to Homepage */}
            <div 
              className="flex items-center cursor-pointer hover:opacity-80 transition-opacity duration-300"
              onClick={() => navigate('/')}
            >
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent leading-none">
                  LegislativeVUE
                </h1>
                <div className="flex justify-end mb-1">
                  <img 
                    src={byMOREgroupLogo} 
                    alt="byMOREgroup Logo" 
                    className="h-3 sm:h-4 w-auto"
                  />
                </div>
              </div>
            </div>

            {/* Right Side Navigation */}
            <div className="flex items-center gap-3">
              
              {/* Information Button - NEW */}
              <button
                onClick={() => setShowInfoModal(true)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-300 border border-gray-200"
                title="Application Information"
              >
                <Info size={20} />
                <span className="hidden sm:inline">Info</span>
              </button>

              {/* Navigation Menu */}
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-300 border border-gray-200"
                >
                  <HamburgerIcon size={20} />
                  <span>Menu</span>
                  <ChevronDown 
                    size={14} 
                    className={
                      "transition-transform duration-200 " + 
                      (showDropdown ? 'rotate-180' : '')
                    }
                  />
                </button>

                {showDropdown && (
                  <div 
                    ref={dropdownRef}
                    className="absolute top-full right-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 py-2 z-50"
                  >
                    
                    {/* Highlighted Items */}
                    <button
                      onClick={() => {
                        navigate('/');
                        setShowDropdown(false);
                      }}
                      className={
                        "w-full text-left px-4 py-3 text-sm font-bold transition-all duration-300 flex items-center gap-3 " +
                        (location.pathname === '/' || location.pathname === '/highlights'
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-800 hover:bg-gray-100')
                      }
                    >
                      <Star size={16} />
                      <span>
                        Highlighted Items
                        {highlightedCount > 0 && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold">
                            {highlightedCount}
                            </span>
                        )}
                        </span>
                    </button>

                    {/* Separator */}
                    <div className="border-t border-gray-200 my-1"></div>

                    {/* Executive Orders */}
                    <button
                      onClick={() => {
                        navigate('/executive-orders');
                        setShowDropdown(false);
                      }}
                      className={
                        "w-full text-left px-4 py-3 text-sm font-bold transition-all duration-300 flex items-center gap-3 " +
                        (location.pathname === '/executive-orders'
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-800 hover:bg-gray-100')
                      }
                    >
                      <ScrollText size={16} />
                      <span>Executive Orders</span>
                    </button>

                    {/* Separator */}
                    <div className="border-t border-gray-200 my-1"></div>

                    {/* State Legislation Header */}
                    <div className="px-4 py-2 text-sm font-bold text-gray-800 flex items-center gap-3">
                      <FileText size={16} />
                      <span>State Legislation</span>
                    </div>

                    {/* State Items */}
                    {Object.keys(SUPPORTED_STATES).map(state => {
                      const isActive = location.pathname === `/state/${state.toLowerCase().replace(' ', '-')}`;
                      return (
                        <button
                          key={state}
                          onClick={() => {
                            navigate(`/state/${state.toLowerCase().replace(' ', '-')}`);
                            setShowDropdown(false);
                          }}
                          className={
                            "w-full text-left px-8 py-2 text-sm transition-all duration-300 " +
                            (isActive
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-600 hover:bg-gray-100')
                          }
                        >
                          {state} ({SUPPORTED_STATES[state]})
                        </button>
                      );
                    })}

                    {/* Separator */}
                    <div className="border-t border-gray-200 my-1"></div>

                    {/* Settings */}
                    <button
                      onClick={() => {
                        navigate('/settings');
                        setShowDropdown(false);
                      }}
                      className={
                        "w-full text-left px-4 py-3 text-sm font-bold transition-all duration-300 flex items-center gap-3 " +
                        (location.pathname === '/settings'
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-800 hover:bg-gray-100')
                      }
                    >
                      <Settings size={16} />
                      <span>Settings</span>
                    </button>

                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </header>

      {/* Information Modal */}
      <InformationModal 
        isOpen={showInfoModal} 
        onClose={() => setShowInfoModal(false)} 
      />
    </>
  );
};

export default Header;