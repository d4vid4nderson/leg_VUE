// StateOutlineBackground.jsx - Background state outline component
import React, { useState, useEffect } from 'react';
import { generateStateOutline } from '../utils/stateOutlines';

const StateOutlineBackground = ({ stateName, className = '', isIcon = false }) => {
  const [stateOutline, setStateOutline] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Always render a visible debug div to ensure the component is being rendered
  console.log('🗺️ StateOutlineBackground rendered with stateName:', stateName);

  useEffect(() => {
    const loadStateOutline = async () => {
      console.log('🗺️ Loading state outline for:', stateName);
      
      if (!stateName) {
        console.log('🗺️ No state name provided');
        setStateOutline(null);
        setIsLoading(false);
        setError(null);
        return;
      }

      setIsLoading(true);
      setError(null);
      
      try {
        console.log('🗺️ Generating outline for:', stateName);
        const outline = await generateStateOutline(stateName);
        console.log('🗺️ Generated outline:', outline);
        
        if (outline && outline.pathData) {
          console.log('🗺️ ✅ State outline loaded successfully');
          setStateOutline(outline);
        } else {
          console.log('🗺️ ❌ No outline data available');
          setStateOutline(null);
          setError(`No outline data available for ${stateName}`);
        }
      } catch (error) {
        console.error('🗺️ ❌ Error loading state outline:', error);
        setStateOutline(null);
        setError(error.message || 'Failed to load state outline');
      } finally {
        setIsLoading(false);
      }
    };

    loadStateOutline();
  }, [stateName]);

  // Always render something to debug
  console.log('🗺️ Component state - isLoading:', isLoading, 'error:', error, 'stateOutline:', !!stateOutline);
  
  // Show loading state
  if (isLoading) {
    console.log('🗺️ Showing loading state');
    return (
      <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
        <div className="absolute inset-0 bg-blue-100 opacity-20 flex items-center justify-center">
          <div className="text-blue-600 font-bold">Loading {stateName} outline...</div>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (error) {
    console.log('🗺️ Showing error state:', error);
    return (
      <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
        <div className="absolute inset-0 bg-red-100 opacity-20 flex items-center justify-center">
          <div className="text-red-600 font-bold">Error loading outline</div>
        </div>
      </div>
    );
  }
  
  // Show no data state
  if (!stateOutline || !stateOutline.pathData) {
    console.log('🗺️ Showing no data state');
    return (
      <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
        <div className="absolute inset-0 bg-gray-100 opacity-20 flex items-center justify-center">
          <div className="text-gray-600 font-bold">No outline data for {stateName}</div>
        </div>
      </div>
    );
  }
  
  console.log('🗺️ Rendering state outline for:', stateName);

  // Calculate bounds and create a proper viewBox
  const bounds = stateOutline.bounds || {};
  const { x0 = 0, y0 = 0, x1 = 1000, y1 = 600, width = 200, height = 200, centerX = 500, centerY = 300 } = bounds;
  
  // Calculate viewBox to match the height of the title area (approximately 200px equivalent)
  const titleHeight = 200; // Approximate height of both title lines combined
  const stateAspectRatio = width / height;
  const scaledWidth = titleHeight * stateAspectRatio;
  
  // Center the state in the viewBox
  const viewBoxCenterX = (x0 + x1) / 2;
  const viewBoxCenterY = (y0 + y1) / 2;
  
  const viewBoxX = viewBoxCenterX - (scaledWidth / 2);
  const viewBoxY = viewBoxCenterY - (titleHeight / 2);
  const viewBoxWidth = scaledWidth;
  const viewBoxHeight = titleHeight;
  
  console.log('🗺️ ViewBox:', { x0, y0, x1, y1, width, height, centerX, centerY });
  console.log('🗺️ Calculated ViewBox:', { viewBoxX, viewBoxY, viewBoxWidth, viewBoxHeight });

  if (isIcon) {
    // Icon version - normalize size for consistent appearance
    // Use a fixed viewBox size and scale all states to fit within it
    const iconSize = 100; // Fixed size for all state icons
    const iconPadding = 5; // Reduced padding to make states larger
    
    // Calculate scale to fit the state within the icon bounds
    const maxDimension = Math.max(width, height);
    const scale = (iconSize - iconPadding * 2) / maxDimension;
    
    // Center the scaled state within the icon viewBox
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    const offsetX = (iconSize - scaledWidth) / 2;
    const offsetY = (iconSize - scaledHeight) / 2;
    
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <svg 
          viewBox={`0 0 ${iconSize} ${iconSize}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
            <g transform={`translate(${-x0}, ${-y0})`}>
              <path
                d={stateOutline.pathData}
                fill="currentColor"
                stroke="none"
              />
            </g>
          </g>
        </svg>
      </div>
    );
  }

  // Background version - large, with blend mode
  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      <svg 
        viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxWidth} ${viewBoxHeight}`}
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* State outline path - no stroke, fill only with blend mode */}
        <path
          d={stateOutline.pathData}
          fill="rgba(75, 85, 99, 0.3)"
          stroke="none"
          className="drop-shadow-lg"
          style={{ mixBlendMode: 'soft-light' }}
        />
      </svg>
    </div>
  );
};

export default StateOutlineBackground;