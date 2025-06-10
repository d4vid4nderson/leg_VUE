// src/components/AuthRedirect.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthRedirect = () => {
  const navigate = useNavigate();
  const { loginWithAzureAD, msalInstance } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleRedirect = async () => {
      if (!msalInstance) {
        setError('Microsoft authentication is not configured');
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      try {
        // Handle the redirect response
        const response = await msalInstance.handleRedirectPromise();
        
        if (response) {
          // Get access token for API calls
          const tokenResponse = await msalInstance.acquireTokenSilent({
            scopes: ["User.Read", "email", "profile", "openid"],
            account: response.account
          });
          
          // Extract user information
          const userInfo = {
            username: response.account.username,
            name: response.account.name || response.account.username,
            role: 'user',
            token: tokenResponse.accessToken,
            azureId: response.account.homeAccountId,
            tenantId: response.account.tenantId,
            authMethod: 'azure-ad'
          };

          // Login with Azure AD data
          loginWithAzureAD(userInfo);
          
          // Redirect to home page
          navigate('/');
        } else {
          // No response from redirect, might not be a redirect
          navigate('/');
        }
      } catch (error) {
        console.error('Failed to handle Azure AD redirect:', error);
        setError('Authentication failed. Please try again.');
        // Redirect to home after delay
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    };

    handleRedirect();
  }, [navigate, loginWithAzureAD, msalInstance]);

  return (
    <div className="fixed inset-0 bg-white flex items-center justify-center">
      <div className="text-center">
        {error ? (
          <div className="text-red-600">
            <h2 className="text-xl font-bold mb-2">Authentication Failed</h2>
            <p>{error}</p>
            <p className="mt-4">Redirecting to home page...</p>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-bold mb-2">Completing Authentication</h2>
            <p className="text-gray-600">Please wait while we finish signing you in...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthRedirect;
