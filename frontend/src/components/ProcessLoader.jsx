// src/components/ProcessLoader.jsx
import { useState, useEffect } from 'react';

const ProcessLoader = ({ loadStartTime }) => {
  // Define the process states with their estimated time percentages
  const processStates = [
    { text: "Fetching Executive Orders", threshold: 0 },   // 0-25% of load time
    { text: "Sending to AI", threshold: 25 },             // 25-50% of load time
    { text: "Processing in AI", threshold: 50 },          // 50-75% of load time
    { text: "Preparing Orders", threshold: 75 }           // 75-100% of load time
  ];
  
  const [currentStateIndex, setCurrentStateIndex] = useState(0);
  const [progressPercentage, setProgressPercentage] = useState(0);
  
  // Effect to update the current state based on elapsed time
  useEffect(() => {
    if (!loadStartTime) return;
    
    const estimatedTotalLoadTime = 50000; // Estimate 8 seconds for total loading
    
    // Set up an interval to update progress
    const interval = setInterval(() => {
      const elapsedTime = Date.now() - loadStartTime;
      const percentComplete = Math.min(100, (elapsedTime / estimatedTotalLoadTime) * 100);
      
      setProgressPercentage(percentComplete);
      
      // Find the appropriate state for the current progress
      const newStateIndex = processStates.findIndex((state, index, array) => {
        const nextThreshold = index < array.length - 1 ? array[index + 1].threshold : 100;
        return percentComplete >= state.threshold && percentComplete < nextThreshold;
      });
      
      if (newStateIndex !== -1 && newStateIndex !== currentStateIndex) {
        setCurrentStateIndex(newStateIndex);
      }
    }, 100); // Update every 100ms for smooth progress
    
    // Clean up interval on unmount
    return () => clearInterval(interval);
  }, [loadStartTime, currentStateIndex]);
  
  return (
    <>
      {/* Progress bar at top */}
      <div className="w-full h-1 bg-gray-200 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-cyan-500 to-teal-500" 
          style={{ 
            width: `${progressPercentage}%`, 
            transition: 'width 0.3s ease-out' 
          }}
        ></div>
      </div>
      
      {/* Skeleton cards */}
      <div className="grid grid-cols-1 gap-6 mt-6">
        {/* Process state indicator */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden py-8 text-center">
          <div className="flex flex-col items-center justify-center">
            <div className="relative mb-4">
              <div className="bg-gradient-to-r from-cyan-600 to-teal-400 text-transparent bg-clip-text">
                <span className="font-extrabold text-4xl">PV</span>
              </div>
              <div className="absolute inset-0 border-2 border-transparent rounded-full animate-ping opacity-75 bg-gradient-to-r from-cyan-500/50 to-teal-500/50"></div>
            </div>
            
            {/* Animated dots */}
            <div className="flex justify-center space-x-1">
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            
            {/* Current process state text */}
            <p className="mt-4 text-gray-700 font-medium text-lg">
              {processStates[currentStateIndex].text}
            </p>
            
            {/* Percentage indicator (optional) */}
            <p className="mt-1 text-xs text-gray-500">
              {Math.round(progressPercentage)}% complete
            </p>
          </div>
        </div>
        
        {/* Skeleton cards */}
        {[1, 2].map(i => (
          <div key={i} className="bg-white border rounded-md shadow-sm overflow-hidden animate-pulse">
            <div className="p-4 flex justify-between items-center">
              {/* Title skeleton */}
              <div className="w-3/4 h-6 bg-gray-200 rounded"></div>
              {/* Button skeleton */}
              <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
            </div>
            <div className="px-4 pb-4">
              {/* Category pill skeleton */}
              <div className="flex items-center gap-2">
                <div className="w-24 h-7 bg-gray-200 rounded-md"></div>
                <div className="w-16 h-5 bg-gray-200 rounded-md"></div>
              </div>
              
              {/* Date skeleton */}
              <div className="mt-2 w-48 h-4 bg-gray-200 rounded"></div>
              
              {/* AI Summary skeleton */}
              <div className="mt-2 bg-gray-100 py-4 px-6 rounded">
                <div className="w-40 h-5 bg-gray-200 rounded mb-2"></div>
                <div className="w-full h-4 bg-gray-200 rounded mb-2"></div>
                <div className="w-full h-4 bg-gray-200 rounded mb-2"></div>
                <div className="w-3/4 h-4 bg-gray-200 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default ProcessLoader;