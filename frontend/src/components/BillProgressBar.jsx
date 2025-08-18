import React from 'react';

const BillProgressBar = ({ status, className = '' }) => {
    // Determine progress stage and info based on status
    const getProgressInfo = (billStatus) => {
        if (!billStatus) return { percentage: 10, stage: 'Introduced', color: 'bg-blue-600' };
        
        const statusLower = billStatus.toLowerCase();
        
        // Exact matches for our database status values
        if (statusLower === 'enrolled') {
            return { percentage: 100, stage: 'Enacted', color: 'bg-green-600' };
        }
        
        if (statusLower === 'passed') {
            return { percentage: 75, stage: 'Passed', color: 'bg-emerald-600' };
        }
        
        if (statusLower === 'engrossed') {
            return { percentage: 50, stage: 'Floor Vote', color: 'bg-yellow-600' };
        }
        
        if (statusLower === 'introduced' || statusLower === 'pending') {
            return { percentage: 10, stage: 'Introduced', color: 'bg-blue-600' };
        }
        
        if (statusLower === 'vetoed') {
            return { percentage: 15, stage: 'Vetoed', color: 'bg-red-600' };
        }
        
        // Enacted/Signed into law (fallback for text-based statuses)
        if (statusLower.includes('enacted') || 
            statusLower.includes('signed') || 
            statusLower.includes('law') ||
            statusLower.includes('approved by governor') ||
            statusLower.includes('chaptered')) {
            return { percentage: 100, stage: 'Enacted', color: 'bg-green-600' };
        }
        
        // Passed one chamber (fallback)
        if (statusLower.includes('passed') || 
            statusLower.includes('enrolled') ||
            statusLower.includes('concurred') ||
            statusLower.includes('sent to governor')) {
            return { percentage: 75, stage: 'Passed', color: 'bg-emerald-600' };
        }
        
        // Floor action/voting (fallback)
        if (statusLower.includes('floor') || 
            statusLower.includes('vote') || 
            statusLower.includes('reading') ||
            statusLower.includes('debate') ||
            statusLower.includes('amended') ||
            statusLower.includes('engrossed') ||
            statusLower.includes('calendar')) {
            return { percentage: 50, stage: 'Floor Vote', color: 'bg-yellow-600' };
        }
        
        // Committee review (fallback)
        if (statusLower.includes('committee') || 
            statusLower.includes('referred') ||
            statusLower.includes('hearing') ||
            statusLower.includes('markup') ||
            statusLower.includes('reported')) {
            return { percentage: 25, stage: 'Committee', color: 'bg-purple-600' };
        }
        
        // Vetoed bills (fallback)
        if (statusLower.includes('vetoed') || statusLower.includes('veto')) {
            return { percentage: 15, stage: 'Vetoed', color: 'bg-red-600' };
        }
        
        // Default to introduced
        return { percentage: 10, stage: 'Introduced', color: 'bg-blue-600' };
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
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                    className={`h-2 rounded-full transition-all duration-500 ${progressInfo.color}`}
                    style={{ width: `${progressInfo.percentage}%` }}
                ></div>
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