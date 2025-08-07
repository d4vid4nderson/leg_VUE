import { useState, useEffect } from 'react';
import { X, Smartphone, Share, Plus, ArrowRight, Home, Menu as HamburgerIcon } from 'lucide-react';

const PWAInstallModal = ({ isOpen, onClose }) => {
    const [activeTab, setActiveTab] = useState('ios');

    // Auto-detect device and set appropriate tab
    useEffect(() => {
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const android = /Android/.test(navigator.userAgent);
        
        if (iOS) setActiveTab('ios');
        else if (android) setActiveTab('android');
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[300] flex items-center justify-center p-2 sm:p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-[95vw] sm:max-w-2xl max-h-[95vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-gray-200 dark:border-gray-600 flex-shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <Smartphone size={18} className="text-white sm:w-5 sm:h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate">Add to Home Screen</h2>
                            <p className="text-xs text-gray-600 dark:text-gray-300 hidden sm:block">Access LegislationVUE like a native app</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] flex items-center justify-center"
                        aria-label="Close modal"
                    >
                        <X size={18} className="text-gray-500 dark:text-gray-400 sm:w-5 sm:h-5" />
                    </button>
                </div>

                {/* Tab Selector */}
                <div className="flex border-b border-gray-200 dark:border-gray-600 flex-shrink-0">
                    <button
                        onClick={() => setActiveTab('ios')}
                        className={`flex-1 px-3 sm:px-6 py-2.5 sm:py-3 text-center font-medium transition-colors text-sm sm:text-base min-h-[44px] ${
                            activeTab === 'ios'
                                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        <span className="hidden sm:inline">iOS (iPhone/iPad)</span>
                        <span className="sm:hidden">iOS</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('android')}
                        className={`flex-1 px-3 sm:px-6 py-2.5 sm:py-3 text-center font-medium transition-colors text-sm sm:text-base min-h-[44px] ${
                            activeTab === 'android'
                                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                        }`}
                    >
                        Android
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4">
                    {activeTab === 'ios' && (
                        <div className="space-y-3">
                            {/* iOS Info Banner */}
                            <div className="p-2.5 sm:p-3 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
                                <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                                    📱 For iPhone and iPad users
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-300">
                                    Add LegislationVUE to your home screen for quick access
                                </p>
                            </div>

                            {/* iOS Steps */}
                            <div className="space-y-2.5">
                                <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white">Installation Steps:</h3>
                                
                                {/* Step 1 */}
                                <div className="flex gap-2.5">
                                    <div className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                        <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs">1</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <Share size={14} className="text-blue-600 dark:text-blue-400" />
                                            <span className="font-medium text-sm text-gray-900 dark:text-white">Tap the Share button</span>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                            Bottom of Safari (iPhone) or top (iPad)
                                        </p>
                                    </div>
                                </div>

                                {/* Step 2 */}
                                <div className="flex gap-2.5">
                                    <div className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                        <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs">2</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <Plus size={14} className="text-green-600 dark:text-green-400" />
                                            <span className="font-medium text-sm text-gray-900 dark:text-white">Select "Add to Home Screen"</span>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                            Scroll and tap "Add to Home Screen"
                                        </p>
                                    </div>
                                </div>

                                {/* Step 3 */}
                                <div className="flex gap-2.5">
                                    <div className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                        <span className="text-blue-600 dark:text-blue-400 font-semibold text-xs">3</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <ArrowRight size={14} className="text-purple-600 dark:text-purple-400" />
                                            <span className="font-medium text-sm text-gray-900 dark:text-white">Confirm "Add"</span>
                                        </div>
                                        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                            Review and tap "Add" to install
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* iOS Success Banner */}
                            <div className="p-2.5 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                                <div className="flex items-center gap-1.5">
                                    <Home size={14} className="text-green-600 dark:text-green-400" />
                                    <span className="text-xs font-medium text-gray-900 dark:text-white">You're all set!</span>
                                    <span className="text-xs text-gray-600 dark:text-gray-300">LegislationVUE is now on your home screen</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'android' && (
                        <div className="space-y-3">
                            {/* Android Info Banner */}
                            <div className="p-2.5 sm:p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                                <p className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2 mb-1">
                                    🤖 For Android users
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-300">
                                    Install LegislationVUE for the best mobile experience
                                </p>
                            </div>

                            {/* Android Installation Steps */}
                            <div className="space-y-2.5">
                                <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white">Installation Steps:</h3>
                                
                                <div className="space-y-2.5">
                                    <div className="flex gap-2.5">
                                        <div className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                            <span className="text-green-600 dark:text-green-400 font-semibold text-xs">1</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <Plus size={14} className="text-green-600 dark:text-green-400" />
                                                <span className="font-medium text-sm text-gray-900 dark:text-white">Look for "Add to Home Screen" banner</span>
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                                Chrome may show this at the bottom
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <div className="flex gap-2.5">
                                        <div className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                            <span className="text-green-600 dark:text-green-400 font-semibold text-xs">2</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <HamburgerIcon size={14} className="text-purple-600 dark:text-purple-400" />
                                                <span className="font-medium text-sm text-gray-900 dark:text-white">Or use browser menu (⋮) → "Add to Home Screen"</span>
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                                If no banner appears
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2.5">
                                        <div className="flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                            <span className="text-green-600 dark:text-green-400 font-semibold text-xs">3</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <ArrowRight size={14} className="text-purple-600 dark:text-purple-400" />
                                                <span className="font-medium text-sm text-gray-900 dark:text-white">Tap "Add" to confirm</span>
                                            </div>
                                            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                                                Complete the installation
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Android Success Banner */}
                            <div className="p-2.5 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                                <div className="flex items-center gap-1.5">
                                    <Home size={14} className="text-green-600 dark:text-green-400" />
                                    <span className="text-xs font-medium text-gray-900 dark:text-white">You're all set!</span>
                                    <span className="text-xs text-gray-600 dark:text-gray-300">LegislationVUE is now on your home screen</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 flex-shrink-0">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 order-2 sm:order-1">
                            <Smartphone size={14} />
                            <span>Works on iOS 11.3+ and Android 5.0+</span>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg font-medium transition-colors text-sm min-h-[44px] order-1 sm:order-2"
                        >
                            Got it
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PWAInstallModal;