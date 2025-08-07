// components/Header.jsx - Main navigation header with mobile optimization
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ApplicationInfoModal from './ApplicationInfoModal';
import DarkModeToggle from './DarkModeToggle';
import GlobalSearch from './GlobalSearch';
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
import { useDarkMode } from '../context/DarkModeContext';
import byMOREgroupLogo from './byMOREgroup.PNG';
import byMOREgroupLogoDark from './byMOREgroup_drk.png';

// Mobile Navigation Components
const MobileMenuItem = ({ icon: Icon, label, badge, onClick, active = false, className = "" }) => {
    return (
        <button
            onClick={onClick}
            className={`
                w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-lg transition-all duration-200 relative
                ${active 
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' 
                    : 'text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary'
                }
                ${className}
            `}
        >
            {/* Left border for active state */}
            {active && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r"></div>
            )}
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

const MobileFederalSubmenu = ({ onNavigate, isExpanded, setIsExpanded }) => {
    const location = useLocation();
    const navigate = useNavigate();
    
    return (
        <div>
            {/* Federal Legislation Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-800 dark:text-dark-text font-bold hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
            >
                <ScrollText size={20} className="flex-shrink-0 text-gray-600 dark:text-dark-text-secondary" />
                <span className="flex-1 text-left">Federal Legislation</span>
                <ChevronRight 
                    size={16} 
                    className={
                        "transition-transform duration-200 " + 
                        (isExpanded ? 'rotate-90' : 'rotate-180')
                    }
                />
            </button>
            
            {isExpanded && (
                <div className="ml-8 space-y-1">
                {/* Executive Orders */}
                <button
                    onClick={() => {
                        navigate('/executive-orders');
                        onNavigate();
                    }}
                    className={`
                        w-full text-left px-3 py-2.5 text-sm rounded transition-all duration-200 relative
                        ${location.pathname === '/executive-orders' 
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' 
                            : 'text-gray-600 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary'
                        }
                    `}
                >
                    {location.pathname === '/executive-orders' && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r"></div>
                    )}
                    Executive Orders
                </button>
                
                {/* HR1 Policy Analysis */}
                <button
                    onClick={() => {
                        navigate('/hr1');
                        onNavigate();
                    }}
                    className={`
                        w-full text-left px-3 py-2.5 text-sm rounded transition-all duration-200 relative
                        ${location.pathname === '/hr1' 
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' 
                            : 'text-gray-600 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary'
                        }
                    `}
                >
                    {location.pathname === '/hr1' && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r"></div>
                    )}
                    HR1 Policy Analysis
                </button>
            </div>
            )}
        </div>
    );
};

const MobileStateSubmenu = ({ onNavigate, isExpanded, setIsExpanded }) => {
    const location = useLocation();
    const navigate = useNavigate();
    
    return (
        <div>
            {/* State Legislation Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-gray-800 dark:text-dark-text font-bold hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
            >
                <FileText size={20} className="flex-shrink-0 text-gray-600 dark:text-dark-text-secondary" />
                <span className="flex-1 text-left">State Legislation</span>
                <ChevronRight 
                    size={16} 
                    className={
                        "transition-transform duration-200 " + 
                        (isExpanded ? 'rotate-90' : 'rotate-180')
                    }
                />
            </button>
            
            {isExpanded && (
                <div className="ml-8 space-y-1">
                {/* All States Overview */}
                <button
                    onClick={() => {
                        navigate('/state-legislation');
                        onNavigate();
                    }}
                    className={`
                        w-full text-left px-3 py-2.5 text-sm rounded transition-all duration-200 relative
                        ${location.pathname === '/state-legislation'
                            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' 
                            : 'text-gray-600 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary'
                        }
                    `}
                >
                    {location.pathname === '/state-legislation' && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r"></div>
                    )}
                    All States Overview
                </button>
                
                {/* Individual States */}
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
                                w-full text-left px-3 py-2.5 text-sm rounded transition-all duration-200 relative
                                ${isActive 
                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' 
                                    : 'text-gray-600 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-bg-tertiary'
                                }
                            `}
                        >
                            {isActive && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r"></div>
                            )}
                            {state} ({SUPPORTED_STATES[state]})
                        </button>
                    );
                })}
            </div>
            )}
        </div>
    );
};

const MobileNavigationMenu = ({ isOpen, onClose, currentUser, isAuthenticated, highlightedCount, onLogout, onLogin, mobileFederalExpanded, setMobileFederalExpanded, mobileStateExpanded, setMobileStateExpanded }) => {
    const navigate = useNavigate();
    const location = useLocation();
    
    const handleNavigate = (path) => {
        navigate(path);
        onClose();
    };

    // Prevent body scroll when menu is open
    useEffect(() => {
        if (isOpen) {
            const scrollY = window.scrollY;
            document.body.style.position = 'fixed';
            document.body.style.top = `-${scrollY}px`;
            document.body.style.width = '100%';
            document.body.style.overflow = 'hidden';
            
            return () => {
                document.body.style.position = '';
                document.body.style.top = '';
                document.body.style.width = '';
                document.body.style.overflow = '';
                window.scrollTo(0, scrollY);
            };
        }
    }, [isOpen]);
    
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
            <div 
                className={`
                    fixed top-0 right-0 h-full w-80 max-w-[90vw] bg-white dark:bg-dark-bg shadow-xl z-[210] 
                    transform transition-transform duration-300 ease-in-out lg:hidden flex flex-col
                    ${isOpen ? 'translate-x-0' : 'translate-x-full'}
                `}
            >
                {/* Menu Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-dark-text">Menu</h3>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary rounded-lg transition-colors text-gray-600 dark:text-dark-text-secondary"
                    >
                        <XIcon size={20} />
                    </button>
                </div>

                {/* User Profile Section */}
                {isAuthenticated && (
                    <div className="p-4 border-b border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg-secondary">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                <User size={18} className="text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-800 dark:text-dark-text truncate">
                                    {currentUser?.name || currentUser?.username || 'User'}
                                </p>
                                <p className="text-sm text-gray-500 dark:text-dark-text-secondary truncate">
                                    {currentUser?.email || currentUser?.username || ''}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation Items */}
                <div 
                    className="flex-1 overflow-y-scroll p-4 space-y-2" 
                    style={{ 
                        WebkitOverflowScrolling: 'touch',
                        height: '100%',
                        maxHeight: 'calc(100vh - 200px)'
                    }}
                >
                    {/* Home Link */}
                    <MobileMenuItem
                        icon={Home}
                        label="Home"
                        onClick={() => handleNavigate('/')}
                        active={location.pathname === '/'}
                    />

                    {/* Highlights - Hidden on mobile
                    <MobileMenuItem
                        icon={Star}
                        label="Highlighted Items"
                        badge={highlightedCount}
                        onClick={() => handleNavigate('/highlights')}
                        active={location.pathname === '/highlights'}
                    />
                    */}
                    
                    {/* Separator */}
                    <div className="border-t border-gray-200 dark:border-dark-border my-2"></div>
                    
                    <MobileFederalSubmenu 
                        onNavigate={onClose}
                        isExpanded={mobileFederalExpanded}
                        setIsExpanded={setMobileFederalExpanded}
                    />
                    
                    {/* Separator */}
                    <div className="border-t border-gray-200 dark:border-dark-border my-2"></div>

                    <MobileStateSubmenu 
                        onNavigate={onClose}
                        isExpanded={mobileStateExpanded}
                        setIsExpanded={setMobileStateExpanded}
                    />
                    
                    {/* Separator */}
                    <div className="border-t border-gray-200 dark:border-dark-border my-2"></div>


                    <MobileMenuItem
                        icon={Settings}
                        label="Settings"
                        onClick={() => handleNavigate('/settings')}
                        active={location.pathname === '/settings'}
                    />
                </div>

                {/* Bottom Actions */}
                <div className="p-4 border-t border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg-secondary">
                    {isAuthenticated ? (
                        <button
                            onClick={() => { onLogout(); onClose(); }}
                            className="w-full flex items-center gap-3 p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                            <LogOut size={18} />
                            <span>Sign Out</span>
                        </button>
                    ) : (
                        <button
                            onClick={() => { onLogin(); onClose(); }}
                            className="w-full flex items-center gap-3 p-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-400 transition-colors"
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
    isAuthenticated,
    currentUser,
    onLogout,
    onLogin,
    highlightedCount = 0 // Add this prop for highlighted items count
}) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isDarkMode } = useDarkMode();
    
    // State management
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [showGlobalSearch, setShowGlobalSearch] = useState(false);
    const [mobileFederalExpanded, setMobileFederalExpanded] = useState(false);
    const [mobileStateExpanded, setMobileStateExpanded] = useState(false);

    const handleMenuItemClick = (action) => {
        action();
        setShowDropdown(false);
    };

    // Keyboard shortcut for search (Cmd/Ctrl + K)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setShowGlobalSearch(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <>
            <header className="bg-white dark:bg-dark-bg shadow-sm sticky top-0 z-[100]">
                <div className="container mx-auto px-3 sm:px-4 md:px-6 lg:px-8 xl:px-12">
                    <div className="flex items-center justify-between h-16 lg:h-24">
                        
                        {/* Logo Section - Icon on mobile, full text on desktop */}
                        <div 
                            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity duration-300"
                            onClick={() => navigate('/')}
                        >
                            {/* Mobile Logo Icon with Gradient Background */}
                            <div className="sm:hidden w-12 h-12 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                                <img src="/logo.png" alt="LegislativeVUE" className="w-8 h-8" />
                            </div>
                            
                            {/* Desktop Full Logo */}
                            <div className="hidden sm:block">
                                <h1 className="text-lg sm:text-xl lg:text-3xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent leading-none">
                                    LegislativeVUE
                                </h1>
                                <div className="flex justify-end mb-1">
                                    <img 
                                        src={isDarkMode ? byMOREgroupLogoDark : byMOREgroupLogo} 
                                        alt="byMOREgroup Logo" 
                                        className="h-3 sm:h-4 w-auto"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right Side Navigation */}
                        <div className="flex items-center gap-2">
                            
                            {/* Global Search Button */}
                            <button
                                onClick={() => setShowGlobalSearch(true)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-dark-text-secondary hover:text-gray-800 dark:hover:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary transition-all duration-300 border border-gray-200 dark:border-dark-border"
                                title="Search (Ctrl+K)"
                            >
                                <Search size={18} />
                            </button>

                            {/* Dark Mode Toggle */}
                            <DarkModeToggle />

                            {/* Information Button - Mobile friendly */}
                            <button
                                onClick={() => setShowInfoModal(true)}
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-dark-text-secondary hover:text-gray-800 dark:hover:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary transition-all duration-300 border border-gray-200 dark:border-dark-border"
                                title="Application Information"
                            >
                                <Info size={18} />
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
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-dark-text-secondary hover:text-gray-800 dark:hover:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary transition-all duration-300 border border-gray-200 dark:border-dark-border"
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
                                        className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-dark-bg-secondary rounded-md shadow-lg border border-gray-200 dark:border-dark-border py-3 z-[9999] max-h-[80vh] overflow-y-auto"
                                    >
                                        
                                        {/* User Profile Section - Show when authenticated */}
                                        {isAuthenticated && (
                                            <>
                                                <div className="px-6 py-4 border-b border-gray-200">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                            <User size={18} className="text-blue-600 dark:text-blue-400" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium text-gray-800 dark:text-dark-text truncate">
                                                                {currentUser?.name || currentUser?.username || 'User'}
                                                            </p>
                                                            <p className="text-xs text-gray-500 dark:text-dark-text-secondary truncate">
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
                                                "w-full text-left px-6 py-3 text-sm font-semibold transition-all duration-300 flex items-center gap-3 " +
                                                (location.pathname === '/'
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                    : 'text-gray-800 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary')
                                            }
                                        >
                                            <Home size={16} />
                                            <span>Home</span>
                                        </button>

                                        {/* Separator */}
                                        <div className="border-t border-gray-200 dark:border-dark-border my-2"></div>

                                        {/* Federal Legislation Header */}
                                        <div className="px-6 py-2">
                                            <button
                                                onClick={() => setDesktopFederalExpanded(!desktopFederalExpanded)}
                                                className="w-full flex items-center gap-3 text-sm font-semibold text-gray-800 dark:text-dark-text hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
                                            >
                                                <ScrollText size={16} className="text-gray-800 dark:text-dark-text" />
                                                <span className="flex-1 text-left">Federal Legislation</span>
                                                <ChevronRight 
                                                    size={14} 
                                                    className={
                                                        "transition-transform duration-200 " + 
                                                        (desktopFederalExpanded ? 'rotate-90' : 'rotate-180')
                                                    }
                                                />
                                            </button>
                                        </div>

                                        {/* Federal Submenu Items */}
                                        {desktopFederalExpanded && (
                                            <div className="mb-2">
                                            {/* Executive Orders - Sub-item under Federal Legislation */}
                                            <button
                                                onClick={() => handleMenuItemClick(() => navigate('/executive-orders'))}
                                                className={
                                                    "w-full text-left px-10 py-2.5 text-sm transition-all duration-300 " +
                                                    (location.pathname === '/executive-orders'
                                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                                                        : 'text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary')
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
                                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                                                        : 'text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary')
                                                }
                                            >
                                                HR1 Policy Analysis
                                            </button>
                                        </div>
                                        )}

                                        {/* Separator */}
                                        <div className="border-t border-gray-200 dark:border-dark-border my-2"></div>

                                        {/* State Legislation Header */}
                                        <div className="px-6 py-2">
                                            <button
                                                onClick={() => setDesktopStateExpanded(!desktopStateExpanded)}
                                                className="w-full flex items-center gap-3 text-sm font-semibold text-gray-800 dark:text-dark-text hover:text-blue-600 dark:hover:text-blue-400 transition-colors duration-200"
                                            >
                                                <FileText size={16} className="text-gray-800 dark:text-dark-text" />
                                                <span className="flex-1 text-left">State Legislation</span>
                                                <ChevronRight 
                                                    size={14} 
                                                    className={
                                                        "transition-transform duration-200 " + 
                                                        (desktopStateExpanded ? 'rotate-90' : 'rotate-180')
                                                    }
                                                />
                                            </button>
                                        </div>

                                        {/* State Submenu Items */}
                                        {desktopStateExpanded && (
                                            <div className="mb-2">
                                            {/* State Overview Page */}
                                            <button
                                                onClick={() => handleMenuItemClick(() => navigate('/state-legislation'))}
                                                className={
                                                    "w-full text-left px-10 py-2.5 text-sm transition-all duration-300 " +
                                                    (location.pathname === '/state-legislation'
                                                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                                                        : 'text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary')
                                                }
                                            >
                                                All States Overview
                                            </button>
                                            
                                            {/* Individual State Items */}
                                            {Object.keys(SUPPORTED_STATES).map(state => {
                                                const isActive = location.pathname === `/state/${state.toLowerCase().replace(' ', '-')}`;
                                                return (
                                                    <button
                                                        key={state}
                                                        onClick={() => handleMenuItemClick(() => navigate(`/state/${state.toLowerCase().replace(' ', '-')}`))}
                                                        className={
                                                            "w-full text-left px-10 py-2.5 text-sm transition-all duration-300 " +
                                                            (isActive
                                                                ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium'
                                                                : 'text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary')
                                                        }
                                                    >
                                                        {state} ({SUPPORTED_STATES[state]})
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        )}

                                        {/* Separator */}
                                        <div className="border-t border-gray-200 dark:border-dark-border my-2"></div>


                                        {/* Settings */}
                                        <button
                                            onClick={() => handleMenuItemClick(() => navigate('/settings'))}
                                            className={
                                                "w-full text-left px-6 py-3 text-sm font-semibold transition-all duration-300 flex items-center gap-3 " +
                                                (location.pathname === '/settings'
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                    : 'text-gray-800 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-bg-tertiary')
                                            }
                                        >
                                            <Settings size={16} />
                                            <span>Settings</span>
                                        </button>

                                        {/* Authentication Section */}
                                        <div className="border-t border-gray-200 dark:border-dark-border my-2"></div>
                                        
                                        {isAuthenticated ? (
                                            <button
                                                onClick={() => handleMenuItemClick(onLogout)}
                                                className="w-full text-left px-6 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-300 flex items-center gap-3"
                                            >
                                                <LogOut size={16} />
                                                <span>Sign Out</span>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleMenuItemClick(onLogin)}
                                                className="w-full text-left px-6 py-3 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 flex items-center gap-3"
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
                mobileFederalExpanded={mobileFederalExpanded}
                setMobileFederalExpanded={setMobileFederalExpanded}
                mobileStateExpanded={mobileStateExpanded}
                setMobileStateExpanded={setMobileStateExpanded}
            />

            {/* Information Modal */}
            <ApplicationInfoModal
                isOpen={showInfoModal}
                onClose={() => setShowInfoModal(false)}
            />

            {/* Global Search Modal */}
            <GlobalSearch
                isOpen={showGlobalSearch}
                onClose={() => setShowGlobalSearch(false)}
            />
        </>
    );
};

export default Header;