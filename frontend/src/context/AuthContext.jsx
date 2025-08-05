// src/context/AuthContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import authService from '../services/authService';

// Create the context
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// MSAL Configuration
const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "",
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || ""}`,
    redirectUri: window.location.origin + "/auth/redirect",
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

// Login request scopes
const loginRequest = {
  scopes: ["User.Read", "email", "profile", "openid"],
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [msalInstance, setMsalInstance] = useState(null);

  // Initialize MSAL
  useEffect(() => {
    const initializeMsal = async () => {
      try {
        if (import.meta.env.VITE_AZURE_CLIENT_ID && import.meta.env.VITE_AZURE_TENANT_ID) {
          const pca = new PublicClientApplication(msalConfig);
          await pca.initialize();
          setMsalInstance(pca);
          console.log('✅ MSAL initialized successfully');
        } else {
          console.log('ℹ️ Azure AD not configured - demo mode only');
        }
      } catch (error) {
        console.error('❌ MSAL initialization failed:', error);
      }
    };

    initializeMsal();
  }, []);

// ✅ NEW: Token validation and refresh functions
  const isTokenExpired = (expiresAt) => {
    if (!expiresAt) return true;
    const expirationTime = new Date(expiresAt).getTime();
    const currentTime = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5 minute buffer
    return currentTime >= (expirationTime - bufferTime);
  };

  const refreshAccessToken = async (userData) => {
    if (!msalInstance || userData.authMethod !== 'azure-ad') {
      console.log('🔄 Cannot refresh: No MSAL instance or not Azure AD auth');
      return null;
    }

    try {
      console.log('🔄 Attempting to refresh Azure AD token...');
      
      // Get all accounts
      const accounts = msalInstance.getAllAccounts();
      const account = accounts.find(acc => acc.homeAccountId === userData.account_id);
      
      if (!account) {
        console.log('❌ No matching account found for refresh');
        return null;
      }

      // Try to get a new token silently
      const tokenResponse = await msalInstance.acquireTokenSilent({
        scopes: loginRequest.scopes,
        account: account
      });

      const expiresIn = tokenResponse.expiresOn ? 
        new Date(tokenResponse.expiresOn).getTime() : 
        Date.now() + (60 * 60 * 1000);

      const refreshedUserData = {
        ...userData,
        access_token: tokenResponse.accessToken,
        expires_at: new Date(expiresIn).toISOString()
      };

      console.log('✅ Token refreshed successfully, expires at:', refreshedUserData.expires_at);
      return refreshedUserData;

    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      return null;
    }
  };

  // ✅ UPDATED: Enhanced authentication check with token validation
  useEffect(() => {
    const checkAuthStatus = async () => {
      console.log('🔍 Checking authentication status...');
      
      try {
        // Check for stored authentication
        const storedToken = localStorage.getItem('auth_token');
        const storedUserString = localStorage.getItem('user');
        
        console.log('🔍 Stored token exists:', !!storedToken);
        console.log('🔍 Stored user exists:', !!storedUserString);
        
        if (storedToken && storedUserString) {
          try {
            const storedUser = JSON.parse(storedUserString);
            console.log('✅ Found stored user:', storedUser.username || storedUser.name);
            
            // ✅ NEW: Check if token is expired
            if (storedUser.expires_at && isTokenExpired(storedUser.expires_at)) {
              console.log('⏰ Token is expired, attempting refresh...');
              
              // Try to refresh the token
              const refreshedUser = await refreshAccessToken(storedUser);
              
              if (refreshedUser) {
                // Update storage with new token
                localStorage.setItem('auth_token', refreshedUser.access_token);
                localStorage.setItem('user', JSON.stringify(refreshedUser));
                
                setCurrentUser(refreshedUser);
                setIsAuthenticated(true);
                setLoading(false);
                console.log('✅ Token refreshed and user authenticated');
                return;
              } else {
                // Refresh failed, clear storage and require login
                console.log('❌ Token refresh failed, clearing storage');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
                setIsAuthenticated(false);
                setLoading(false);
                return;
              }
            }
            
            // Token is still valid
            console.log('✅ Token is still valid, user authenticated');
            setCurrentUser(storedUser);
            setIsAuthenticated(true);
            setLoading(false);
            return;
            
          } catch (parseError) {
            console.error('❌ Error parsing stored user:', parseError);
            // Clear invalid data
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
          }
        }
        
        // Check for Microsoft SSO callback parameters
        const microsoftAuthData = authService.processMicrosoftCallback();
        if (microsoftAuthData) {
          console.log('✅ Processing Microsoft callback');
          setCurrentUser(microsoftAuthData.user);
          setIsAuthenticated(true);
          setLoading(false);
          return;
        }
        
        // No valid authentication found
        setIsAuthenticated(false);
        
      } catch (error) {
        console.error('❌ Auth status check failed:', error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
        console.log('✅ Auth status check complete');
      }
    };

    checkAuthStatus();
  }, [msalInstance]); // Add msalInstance as dependency

  // ✅ UPDATED: Generic login function with proper token storage
  const login = (user) => {
    console.log('🔐 Login called with user:', user.username || user.name);
    console.log('🔐 Token expires at:', user.expires_at);
    
    // Store in localStorage - now includes expiration data
    localStorage.setItem('auth_token', user.access_token || 'demo-token-' + Date.now());
    localStorage.setItem('user', JSON.stringify(user));
    
    // Update state
    setCurrentUser(user);
    setIsAuthenticated(true);
    
    console.log('✅ Login state updated - isAuthenticated:', true);
  };

  // Login function with credentials
  const loginWithCredentials = async (email, password) => {
    try {
      const result = await authService.login(email, password);
      
      if (result.access_token && result.user) {
        // Store token and user data
        localStorage.setItem('auth_token', result.access_token);
        localStorage.setItem('user', JSON.stringify(result.user));
        
        // Update state
        setCurrentUser(result.user);
        setIsAuthenticated(true);
        return { success: true, user: result.user };
      }
      
      return { success: false, error: 'Invalid response from server' };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message || 'Login failed' };
    }
  };

  // Login with Microsoft SSO
  const loginWithMicrosoft = async () => {
    if (!msalInstance) {
      console.error("MSAL not initialized");
      return { success: false, error: 'Microsoft authentication not configured' };
    }

    try {
      await msalInstance.loginPopup(loginRequest);
      // The actual login will happen in the redirect handler
      return { success: true };
    } catch (error) {
      console.error("Microsoft login failed:", error);
      return { success: false, error: error.message || 'Microsoft login failed' };
    }
  };

  // Sync user profile with backend
  const syncUserProfile = async (userData) => {
    try {
      console.log('🔄 Syncing user profile with backend...');
      
      const profileData = {
        email: userData.username || userData.email,
        display_name: userData.name || userData.displayName,
        first_name: userData.givenName,
        last_name: userData.surname,
        department: userData.department
      };
      
      const response = await fetch(`/api/user/sync-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userData.token || userData.access_token}`
        },
        body: JSON.stringify(profileData)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ User profile synced:', result.display_name);
      } else {
        console.warn('⚠️ Failed to sync user profile:', response.status);
      }
    } catch (error) {
      console.error('❌ Error syncing user profile:', error);
    }
  };

  // Login with Azure AD data (called from redirect handler)
  const loginWithAzureAD = async (userData) => {
    console.log('🔐 Setting Azure AD user data:', userData.username || userData.name);
    
    // Update state with the user data
    setCurrentUser(userData);
    setIsAuthenticated(true);
    
    // Store in localStorage
    localStorage.setItem('auth_token', userData.token);
    localStorage.setItem('user', JSON.stringify(userData));
    
    // Sync user profile with backend
    await syncUserProfile(userData);
    
    console.log('✅ Azure AD login complete');
    return { success: true, user: userData };
  };


  // Logout function
  const logout = async () => {
    console.log('🚪 Logging out...');
    
    try {
      await authService.logout();

      // If MSAL is initialized, also sign out from there
      if (msalInstance) {
        try {
          await msalInstance.logoutSilent();
        } catch (msalError) {
          console.log('MSAL silent logout failed, continuing with local logout');
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear state
      setCurrentUser(null);
      setIsAuthenticated(false);
      
      // Clear localStorage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      
      console.log('✅ Logout complete');
    }
  };

  const value = {
    currentUser,
    isAuthenticated,
    loading,
    login,
    loginWithCredentials,
    loginWithMicrosoft,
    loginWithAzureAD,
    logout,
    msalInstance
  };

  // Debug logging
  console.log('🔍 AuthContext state:', {
    isAuthenticated,
    loading,
    hasUser: !!currentUser,
    userName: currentUser?.username || currentUser?.name
  });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
