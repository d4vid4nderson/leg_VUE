import React from 'react';

const BillProgressBar = ({ status, className = '' }) => {
    // Determine progress stage and info based on status
    const getProgressInfo = (billStatus) => {
        if (!billStatus) return { percentage: 10, stage: 'Introduced', color: 'bg-blue-600', isEnacted: false, isFailed: false };
        
        const statusLower = billStatus.toLowerCase();
        
        // Failed/Dead bills
        if (statusLower === 'failed' || 
            statusLower === 'dead' ||
            statusLower.includes('failed') ||
            statusLower.includes('dead') ||
            statusLower.includes('withdrawn') ||
            statusLower.includes('defeated')) {
            return { percentage: 100, stage: 'Failed', color: 'bg-red-600', isEnacted: false, isFailed: true };
        }
        
        // Vetoed bills
        if (statusLower === 'vetoed' || statusLower.includes('vetoed') || statusLower.includes('veto')) {
            return { percentage: 100, stage: 'Vetoed', color: 'bg-red-600', isEnacted: false, isFailed: true };
        }
        
        // Enacted/Signed into law - exact matches first
        if (statusLower === 'enacted' || statusLower === 'enrolled') {
            return { percentage: 100, stage: 'Enacted', color: 'bg-green-600', isEnacted: true, isFailed: false };
        }
        
        // Enacted/Signed into law (fallback for text-based statuses)
        if (statusLower.includes('enacted') || 
            statusLower.includes('signed') || 
            statusLower.includes('law') ||
            statusLower.includes('approved by governor') ||
            statusLower.includes('chaptered')) {
            return { percentage: 100, stage: 'Enacted', color: 'bg-green-600', isEnacted: true, isFailed: false };
        }
        
        if (statusLower === 'passed') {
            return { percentage: 90, stage: 'Passed', color: 'bg-emerald-600', isEnacted: false, isFailed: false };
        }
        
        if (statusLower === 'engrossed') {
            return { percentage: 50, stage: 'Floor Vote', color: 'bg-yellow-600', isEnacted: false, isFailed: false };
        }
        
        if (statusLower === 'introduced' || statusLower === 'pending') {
            return { percentage: 25, stage: 'Introduced', color: 'bg-blue-600', isEnacted: false, isFailed: false };
        }
        
        // Passed one chamber (fallback)
        if (statusLower.includes('passed') || 
            statusLower.includes('enrolled') ||
            statusLower.includes('concurred') ||
            statusLower.includes('sent to governor')) {
            return { percentage: 90, stage: 'Passed', color: 'bg-emerald-600', isEnacted: false, isFailed: false };
        }
        
        // Floor action/voting (fallback)
        if (statusLower.includes('floor') || 
            statusLower.includes('vote') || 
            statusLower.includes('reading') ||
            statusLower.includes('debate') ||
            statusLower.includes('amended') ||
            statusLower.includes('engrossed') ||
            statusLower.includes('calendar')) {
            return { percentage: 50, stage: 'Floor Vote', color: 'bg-yellow-600', isEnacted: false, isFailed: false };
        }
        
        // Committee review (fallback)
        if (statusLower.includes('committee') || 
            statusLower.includes('referred') ||
            statusLower.includes('hearing') ||
            statusLower.includes('markup') ||
            statusLower.includes('reported')) {
            return { percentage: 35, stage: 'Committee', color: 'bg-purple-600', isEnacted: false, isFailed: false };
        }
        
        // Default to introduced
        return { percentage: 25, stage: 'Introduced', color: 'bg-blue-600', isEnacted: false, isFailed: false };
    };

    const progressInfo = getProgressInfo(status);

    return (
        <div className={`w-full ${className}`}>
            {/* Labels */}
            <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {progressInfo.stage}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-500">
                    {progressInfo.percentage}%
                </span>
            </div>
            
            {/* Progress Bar Container */}
            <div className="relative w-full">
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                        className={`h-2 rounded-full transition-all duration-500 ${progressInfo.color}`}
                        style={{ width: `${progressInfo.percentage}%` }}
                    ></div>
                </div>
                
                {/* Status Indicator Circle */}
                {(progressInfo.isEnacted || progressInfo.isFailed) && (
                    <div 
                        className={`absolute right-0 top-1/2 transform -translate-y-1/2 w-4 h-4 rounded-full flex items-center justify-center ${
                            progressInfo.isEnacted ? 'bg-green-600' : 'bg-red-600'
                        } shadow-sm`}
                    >
                        {progressInfo.isEnacted ? (
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                        ) : (
                            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        )}
                    </div>
                )}
            </div>
            
            {/* Stage markers */}
            <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-400 dark:text-gray-600">Introduced</span>
                <span className="text-xs text-gray-400 dark:text-gray-600">Committee</span>
                <span className="text-xs text-gray-400 dark:text-gray-600">Floor Vote</span>
                <span className="text-xs text-gray-400 dark:text-gray-600">Passed</span>
                <span className="text-xs text-gray-400 dark:text-gray-600">Enacted</span>
            </div>
        </div>
    );
};

export default BillProgressBar;