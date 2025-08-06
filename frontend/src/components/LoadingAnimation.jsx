// components/LoadingAnimation.jsx - Loading animation with progress bar
import React, { useState, useEffect } from 'react';
import { LOADING_STAGES } from '../utils/constants';

const LoadingAnimation = ({ type = "Executive Orders", onComplete }) => {
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(0);

  const stages = LOADING_STAGES[type] || LOADING_STAGES['Executive Orders'];

  // Pulsing Favicon Effect
  useEffect(() => {
    const favicon = document.querySelector('link[rel="icon"]') || document.querySelector('link[rel="shortcut icon"]');
    if (!favicon) return;

    const originalHref = favicon.href;
    
    // Create pulsing effect by alternating favicon opacity
    const createPulseEffect = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 32;
      canvas.height = 32;

      const img = new Image();
      img.onload = () => {
        let opacity = 1;
        let increasing = false;

        const pulse = () => {
          // Clear canvas
          ctx.clearRect(0, 0, 32, 32);
          
          // Draw favicon with current opacity
          ctx.globalAlpha = opacity;
          ctx.drawImage(img, 0, 0, 32, 32);
          
          // Draw pulsing rings
          for (let i = 0; i < 3; i++) {
            ctx.globalAlpha = (1 - opacity) * (1 - i * 0.3);
            ctx.strokeStyle = '#3B82F6';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(16, 16, 12 + i * 6, 0, 2 * Math.PI);
            ctx.stroke();
          }
          
          // Update favicon
          favicon.href = canvas.toDataURL();
          
          // Update opacity for pulsing effect
          if (increasing) {
            opacity += 0.1;
            if (opacity >= 1) increasing = false;
          } else {
            opacity -= 0.1;
            if (opacity <= 0.3) increasing = true;
          }
        };

        // Start pulsing animation
        const pulseInterval = setInterval(pulse, 150);
        
        // Store cleanup function
        favicon._pulseCleanup = () => {
          clearInterval(pulseInterval);
          favicon.href = originalHref;
        };
      };
      
      img.src = originalHref;
    };

    createPulseEffect();

    // Cleanup on unmount
    return () => {
      if (favicon._pulseCleanup) {
        favicon._pulseCleanup();
      }
    };
  }, []);

  // Progress simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + Math.random() * 3 + 1; // Random increment 1-4%
        
        // Update stage based on progress
        if (newProgress >= 0 && newProgress < 21) setCurrentStage(0);
        else if (newProgress >= 21 && newProgress < 41) setCurrentStage(1);
        else if (newProgress >= 41 && newProgress < 61) setCurrentStage(2);
        else if (newProgress >= 61 && newProgress < 81) setCurrentStage(3);
        else if (newProgress >= 81) setCurrentStage(4);

        if (newProgress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 500);
          return 100;
        }
        
        return newProgress;
      });
    }, 200); // Update every 200ms

    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 bg-white bg-opacity-95 z-50 flex flex-col">
      {/* Main Loading Content */}
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          {/* Animated Logo/Icon */}
          <div className="mb-8 relative">
            <div className="w-20 h-20 mx-auto bg-gradient-to-r from-violet-600 to-blue-600 rounded-lg flex items-center justify-center animate-pulse">
              <img
                src="/favicon.png"
                alt="Loading"
                className="w-12 h-12 object-contain rounded-md drop-shadow-lg"
                style={{ background: 'white' }}
              />
            </div>

            {/* Pulsing Rings Around Logo */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 border-4 border-blue-400 rounded-full animate-ping opacity-30"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-32 h-32 border-4 border-violet-400 rounded-full animate-ping opacity-20" style={{ animationDelay: '0.5s' }}></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-44 h-44 border-4 border-blue-300 rounded-full animate-ping opacity-10" style={{ animationDelay: '1s' }}></div>
            </div>
          </div>

          {/* Loading Text */}
          <h3 className="text-2xl font-bold text-gray-800 mb-4 bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent">
            Processing Your Request
          </h3>
          
          {/* Dynamic Stage Text */}
          <div className="mb-8">
            <p className="text-lg text-gray-700 font-medium transition-all duration-300">
              {stages[currentStage]}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Please wait while we gather and analyze the data...
            </p>
          </div>

          {/* Progress Percentage */}
          <div className="text-3xl font-bold text-blue-600 mb-4">
            {Math.round(progress)}%
          </div>
        </div>
      </div>

      {/* Bottom Progress Bar */}
      <div className="w-full bg-gray-200 h-2">
        <div 
          className="h-2 bg-gradient-to-r from-violet-500 to-blue-500 transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      
      {/* Bottom Text */}
      <div className="p-4 text-center bg-gray-50">
        <p className="text-sm text-gray-600">
          <span className="font-medium">{stages[currentStage]}</span>
        </p>
      </div>
    </div>
  );
};

export default LoadingAnimation;