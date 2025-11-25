// hooks/useLoadingAnimation.js - Custom hook for managing loading state
import { useState } from 'react';

export const useLoadingAnimation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState("Executive Orders");

  const startLoading = (type = "Executive Orders") => {
    setLoadingType(type);
    setIsLoading(true);
  };

  const stopLoading = () => {
    setIsLoading(false);
  };

  return {
    isLoading,
    loadingType,
    startLoading,
    stopLoading
  };
};