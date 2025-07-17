// components/Header.jsx - Main navigation header with mobile optimization
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
    ChevronUp,
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

// Mobile Navigation Components
const MobileMenuItem = ({ icon: Icon, label, badge, onClick, active = false, className = "" }) => {
    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 p-3 text-left rounded-lg transition-all duration-200
                ${active 
                    ? 'bg-blue-50 text-blue-700 font-medium border-l-4 border-blue-600' 
                    : 'text-gray-700 hover:bg-gray-50'
                }
                ${className}
            `}
        >
            <Icon size={20} className="flex-shrink-0" />
            <span className="flex-1 truncate">{label}</span>
            {badge > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                    {badge}
                </span>
            )}
        </button>
    );
};

const MobileFederalSubmenu = ({ onNavigate }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    
    const isFederalPageActive = location.pathname === '/executive-orders' || 
                              location.pathname === '/hr1';
    
    return (
        <div>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`
                    w-full flex items-center gap-3 p-3 text-left rounded-lg transition-all duration-200
                    ${isFederalPageActive 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }
                `}
            >
                <ScrollText size={20} className="flex-shrink-0" />
                <span className="flex-1">Federal Legislation</span>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            
            {isExpanded && (
                <div className="ml-8 mt-2 space-y-1">
                    {/* Executive Orders */}
                    <button
                        onClick={() => {
                            navigate('/executive-orders');
                            onNavigate();
                        }}
                        className={`
                            w-full text-left p-2 text-sm rounded transition-all duration-200
                            ${location.pathname === '/executive-orders' 
                                ? 'bg-blue-50 text-blue-700 font-medium' 
                                : 'text-gray-600 hover:bg-gray-50'
                            }
                        `}
                    >
                        Executive Orders
                    </button>
                    
                    {/* HR1 Policy Analysis */}
                    <button
                        onClick={() => {
                            navigate('/hr1');
                            onNavigate();
                        }}
                        className={`
                            w-full text-left p-2 text-sm rounded transition-all duration-200
                            ${location.pathname === '/hr1' 
                                ? 'bg-blue-50 text-blue-700 font-medium' 
                                : 'text-gray-600 hover:bg-gray-50'
                            }
                        `}
                    >
                        HR1 Policy Analysis
                    </button>
                </div>
            )}
        </div>
    );
};

const MobileStateSubmenu = ({ onNavigate }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    
    const isStatePageActive = location.pathname.startsWith('/state/');
    
    return (
        <div>
            <div className="flex items-center w-full">
                <button
                    onClick={() => {
                        navigate('/state-legislation');
                        onNavigate();
                    }}
                    className={`
                        flex items-center gap-3 p-3 text-left rounded-lg transition-all duration-200 flex-1
                        ${location.pathname === '/state-legislation'
                            ? 'bg-blue-50 text-blue-700 font-medium' 
                            : 'text-gray-700 hover:bg-gray-50'
                        }
                    `}
                >
                    <MapIcon size={20} className="flex-shrink-0" />
                    <span className="flex-1">State Legislation</span>
                </button>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                    }}
                    className="p-2 hover:bg-gray-200 rounded ml-1"
                >
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
            </div>
            
            {isExpanded && (
                <div className="ml-8 mt-2 space-y-1 max-h-48 overflow-y-auto">
                    {Object.keys(SUPPORTED_STATES).map(state => {
                        const statePath = `/state/${state.toLowerCase().replace(' ', '-')}`;
                        const isActive = location.pathname === statePath;
                        return (
                            <button
                                key={state}
                                onClick={() => {
                                    navigate(statePath);
                                    onNavigate();
                                }}
                                className={`
                                    w-full text-left p-2 text-sm rounded transition-all duration-200
                                    ${isActive 
                                        ? 'bg-blue-50 text-blue-700 font-medium' 
                                        : 'text-gray-600 hover:bg-gray-50'
                                    }
                                `}
                            >
                                {state} ({SUPPORTED_STATES[state]})
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const MobileNavigationMenu = ({ isOpen, onClose, currentUser, isAuthenticated, highlightedCount, onLogout, onLogin }) => {
    const navigate = useNavigate();
    const location = useLocation();
    
    const handleNavigate = (path) => {
        navigate(path);
        onClose();
    };
    
    return (
        <>
            {/* Overlay */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-[200] lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Slide-out Menu */}
            <div className={`
                fixed top-0 right-0 h-full w-80 max-w-[90vw] bg-white shadow-xl z-[210] 
                transform transition-transform duration-300 ease-in-out lg:hidden
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
            `}>
                {/* Menu Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800">Menu</h3>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <XIcon size={20} />
                    </button>
                </div>

                {/* User Profile Section */}
                {isAuthenticated && (
                    <div className="p-4 border-b border-gray-200 bg-gray-50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <User size={18} className="text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800 truncate">
                                    {currentUser?.name || currentUser?.username || 'User'}
                                </p>
                                <p className="text-sm text-gray-500 truncate">
                                    {currentUser?.email || currentUser?.username || ''}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {/* Home Link */}
                    <MobileMenuItem
                        icon={Home}
                        label="Home"
                        onClick={() => handleNavigate('/')}
                        active={location.pathname === '/'}
                    />

                    <MobileMenuItem
                        icon={Star}
                        label="Highlighted Items"
                        badge={highlightedCount}
                        onClick={() => handleNavigate('/highlights')}
                        active={location.pathname === '/highlights'}
                    />
                    
                    <MobileFederalSubmenu onNavigate={onClose} />

                    <MobileStateSubmenu onNavigate={onClose} />

                    <MobileMenuItem
                        icon={Settings}
                        label="Settings"
                        onClick={() => handleNavigate('/settings')}
                        active={location.pathname === '/settings'}
                    />
                </div>

                {/* Bottom Actions */}
                <div className="p-4 border-t border-gray-200 bg-gray-50">
                    {isAuthenticated ? (
                        <button
                            onClick={() => { onLogout(); onClose(); }}
                            className="w-full flex items-center gap-3 p-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                            <LogOut size={18} />
                            <span>Sign Out</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => { onLogin(); onClose(); }}
                            className="w-full flex items-center gap-3 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <LogIn size={18} />
                            <span>Sign In</span>
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

// Header Component with Mobile Optimization
const Header = ({
    showDropdown,
    setShowDropdown,
    desktopFederalExpanded,
    setDesktopFederalExpanded,
    desktopStateExpanded,
    setDesktopStateExpanded,
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
    
    // State management
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const handleMenuItemClick = (action) => {
        action();
        setShowDropdown(false);
    };

    return (
        <>
            <header className="bg-white shadow-sm sticky top-0 z-[100]">
                <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12">
                    <div className="flex items-center justify-between h-16 lg:h-24">
                        
                        {/* Logo Section - Responsive sizing */}
                        <div 
                            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity duration-300"
                            onClick={() => navigate('/')}
                        >
                            <div>
                                <h1 className="text-lg sm:text-xl lg:text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent leading-none">
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
                        <div className="flex items-center gap-2">
                            
                            {/* Highlights Badge - Mobile optimized */}
                            <button
                                onClick={() => navigate('/highlights')}
                                className="relative p-2 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors lg:hidden"
                                title="Highlighted Items"
                            >
                                <Star size={18} className="text-blue-600" />
                                {highlightedCount > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                        {highlightedCount}
                                    </span>
                                )}
                            </button>

                            {/* Information Button - Mobile friendly */}
                            <button
                                onClick={() => setShowInfoModal(true)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-300 border border-gray-200"
                                title="Application Information"
                            >
                                <Info size={18} />
                                <span className="hidden sm:inline">Info</span>
                            </button>

                            {/* Mobile Hamburger Menu */}
                            <button
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors lg:hidden"
                                title="Open Menu"
                            >
                                <HamburgerIcon size={20} />
                            </button>

                            {/* Desktop Navigation Menu */}
                            <div className="relative hidden lg:block">
                                <button
                                    onClick={() => setShowDropdown(!showDropdown)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-all duration-300 border border-gray-200"
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
                                        className="absolute top-full right-0 mt-2 w-72 bg-white rounded-md shadow-lg border border-gray-200 py-3 z-[9999] max-h-[80vh] overflow-y-auto"
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
                                        
                                        {/* Home */}
                                        <button
                                            onClick={() => handleMenuItemClick(() => navigate('/'))}
                                            className={
                                                "w-full text-left px-6 py-3 text-sm font-bold transition-all duration-300 flex items-center gap-3 " +
                                                (location.pathname === '/'
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'text-gray-800 hover:bg-gray-100')
                                            }
                                        >
                                            <Home size={16} />
                                            <span>Home</span>
                                        </button>

                                        {/* Highlighted Items */}
                                        <button
                                            onClick={() => handleMenuItemClick(() => navigate('/highlights'))}
                                            className={
                                                "w-full text-left px-6 py-3 text-sm font-bold transition-all duration-300 flex items-center gap-3 " +
                                                (location.pathname === '/highlights'
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

                                        {/* Federal Legislation - Expandable Header */}
                                        <button
                                            onClick={() => setDesktopFederalExpanded(!desktopFederalExpanded)}
                                            className="w-full flex items-center justify-between px-6 py-3 text-sm font-bold text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <ScrollText size={16} />
                                                <span>Federal Legislation</span>
                                            </div>
                                            <ChevronDown 
                                                size={14} 
                                                className={`transition-transform duration-200 ${desktopFederalExpanded ? 'rotate-180' : ''}`}
                                            />
                                        </button>

                                        {/* Federal Submenu Items */}
                                        {desktopFederalExpanded && (
                                            <div className="mt-1">
                                                {/* Executive Orders - Sub-item under Federal Legislation */}
                                                <button
                                                    onClick={() => handleMenuItemClick(() => navigate('/executive-orders'))}
                                                    className={
                                                        "w-full text-left px-10 py-2.5 text-sm transition-all duration-300 " +
                                                        (location.pathname === '/executive-orders'
                                                            ? 'bg-blue-50 text-blue-700 font-medium'
                                                            : 'text-gray-600 hover:bg-gray-100')
                                                    }
                                                >
                                                    Executive Orders
                                                </button>

                                                {/* HR1 Page - Sub-item under Federal Legislation */}
                                                <button
                                                    onClick={() => handleMenuItemClick(() => navigate('/hr1'))}
                                                    className={
                                                        "w-full text-left px-10 py-2.5 text-sm transition-all duration-300 " +
                                                        (location.pathname === '/hr1'
                                                            ? 'bg-blue-50 text-blue-700 font-medium'
                                                            : 'text-gray-600 hover:bg-gray-100')
                                                    }
                                                >
                                                    HR1 Policy Analysis
                                                </button>
                                            </div>
                                        )}

                                        {/* Separator */}
                                        <div className="border-t border-gray-200 my-2"></div>

                                        {/* State Legislation - Expandable Header */}
                                        <button
                                            onClick={() => setDesktopStateExpanded(!desktopStateExpanded)}
                                            className="w-full flex items-center justify-between px-6 py-3 text-sm font-bold text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <FileText size={16} />
                                                <span>State Legislation</span>
                                            </div>
                                            <ChevronDown 
                                                size={14} 
                                                className={`transition-transform duration-200 ${desktopStateExpanded ? 'rotate-180' : ''}`}
                                            />
                                        </button>

                                        {/* State Submenu Items */}
                                        {desktopStateExpanded && (
                                            <div className="mt-1 max-h-48 overflow-y-auto">
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
                                            </div>
                                        )}

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

            {/* Mobile Navigation Menu */}
            <MobileNavigationMenu 
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                currentUser={currentUser}
                isAuthenticated={isAuthenticated}
                highlightedCount={highlightedCount}
                onLogout={onLogout}
                onLogin={onLogin}
            />

            {/* Information Modal */}
            <ApplicationInfoModal
                isOpen={showInfoModal}
                onClose={() => setShowInfoModal(false)}
            />
        </>
    );
};

export default Header;