// components/Header.jsx - Main navigation header
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ApplicationInfoModal from './ApplicationInfoModal';
import {
    Building,
    GraduationCap,
    Heart,
    Wrench,
    X as XIcon,
    ScrollText,
    Search,
    RotateCw as RefreshIcon,
    Settings,
    FileText,
    Trash2,
    ChevronDown,
    Download,
    ExternalLink,
    Copy,
    Menu as HamburgerIcon,
    Star,
    Home,
    Info,
    Book,
    Database,
    Globe,
    Zap,
    Shield,
    Users,
    ChevronRight,
    Play,
    BarChart3,
    Mail,
    MessageCircle,
    Phone,
    HelpCircle,
    Monitor,
    BookOpen,
    Map as MapIcon,
    RefreshCw,
    CheckCircle,
    XCircle,
    AlertCircle,
    Clock,
    LogIn,
    LogOut,
    User
} from 'lucide-react';

import { SUPPORTED_STATES } from '../utils/constants';
import { InformationModal } from './CommonComponents';
import byMOREgroupLogo from './byMOREgroup.PNG';

// Header Component with Login Button
const Header = ({
    showDropdown,
    setShowDropdown,
    dropdownRef,
    currentPage,
    isAuthenticated,
    currentUser,
    onLogout,
    onLogin,
    highlightedCount = 0 // Add this prop for highlighted items count
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Add state for information modal
    const [showInfoModal, setShowInfoModal] = useState(false);

    const handleMenuItemClick = (action) => {
        action();
        setShowDropdown(false);
    };

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

                        {/* Right Side Navigation - Info and Menu */}
                        <div className="flex items-center gap-3">
                            
                            {/* Information Button */}
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
                                        className="absolute top-full right-0 mt-2 w-72 bg-white rounded-md shadow-lg border border-gray-200 py-3 z-50"
                                    >
                                        
                                        {/* User Profile Section - Show when authenticated */}
                                        {isAuthenticated && (
                                            <>
                                                <div className="px-6 py-4 border-b border-gray-200">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                            <User size={18} className="text-blue-600" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-800 truncate">
                                                                {currentUser?.name || currentUser?.username || 'User'}
                                                            </p>
                                                            <p className="text-xs text-gray-500 truncate">
                                                                {currentUser?.email || currentUser?.username || ''}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                        
                                        {/* Highlighted Items */}
                                        <button
                                            onClick={() => handleMenuItemClick(() => navigate('/'))}
                                            className={
                                                "w-full text-left px-6 py-3 text-sm font-bold transition-all duration-300 flex items-center gap-3 " +
                                                (location.pathname === '/' || location.pathname === '/highlights'
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'text-gray-800 hover:bg-gray-100')
                                            }
                                        >
                                            <Star size={16} />
                                            <span>
                                                Highlighted Items
                                            </span>
                                        </button>

                                        {/* Separator */}
                                        <div className="border-t border-gray-200 my-2"></div>

                                        {/* Executive Orders */}
                                        <button
                                            onClick={() => handleMenuItemClick(() => navigate('/executive-orders'))}
                                            className={
                                                "w-full text-left px-6 py-3 text-sm font-bold transition-all duration-300 flex items-center gap-3 " +
                                                (location.pathname === '/executive-orders'
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'text-gray-800 hover:bg-gray-100')
                                            }
                                        >
                                            <ScrollText size={16} />
                                            <span>Executive Orders</span>
                                        </button>

                                        {/* Separator */}
                                        <div className="border-t border-gray-200 my-2"></div>

                                        {/* State Legislation Header */}
                                        <div className="px-6 py-3 text-sm font-bold text-gray-800 flex items-center gap-3">
                                            <FileText size={16} />
                                            <span>State Legislation</span>
                                        </div>

                                        {/* State Items */}
                                        {Object.keys(SUPPORTED_STATES).map(state => {
                                            const isActive = location.pathname === `/state/${state.toLowerCase().replace(' ', '-')}`;
                                            return (
                                                <button
                                                    key={state}
                                                    onClick={() => handleMenuItemClick(() => navigate(`/state/${state.toLowerCase().replace(' ', '-')}`))}
                                                    className={
                                                        "w-full text-left px-10 py-2.5 text-sm transition-all duration-300 " +
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
                                        <div className="border-t border-gray-200 my-2"></div>

                                        {/* Settings */}
                                        <button
                                            onClick={() => handleMenuItemClick(() => navigate('/settings'))}
                                            className={
                                                "w-full text-left px-6 py-3 text-sm font-bold transition-all duration-300 flex items-center gap-3 " +
                                                (location.pathname === '/settings'
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'text-gray-800 hover:bg-gray-100')
                                            }
                                        >
                                            <Settings size={16} />
                                            <span>Settings</span>
                                        </button>

                                        {/* Authentication Section */}
                                        <div className="border-t border-gray-200 my-2"></div>
                                        
                                        {isAuthenticated ? (
                                            <button
                                                onClick={() => handleMenuItemClick(onLogout)}
                                                className="w-full text-left px-6 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-all duration-300 flex items-center gap-3"
                                            >
                                                <LogOut size={16} />
                                                <span>Sign Out</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleMenuItemClick(onLogin)}
                                                className="w-full text-left px-6 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-all duration-300 flex items-center gap-3"
                                            >
                                                <LogIn size={16} />
                                                <span>Sign In</span>
                                            </button>
                                        )}

                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Information Modal */}
            <ApplicationInfoModal
                isOpen={showInfoModal}
                onClose={() => setShowInfoModal(false)}
            />
        </>
    );
};

export default Header;