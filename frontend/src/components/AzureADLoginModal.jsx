import React, { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  User,
  AlertCircle,
  Building,
  GraduationCap,
  Heart,
  Wrench,
  X as XIcon,
} from "lucide-react";
import { PublicClientApplication } from "@azure/msal-browser";
import { useAuth } from "../context/AuthContext";

import yourLogo from "/favicon.png";

const AzureADLoginModal = ({ isOpen, onClose, onLoginSuccess }) => {
  // ✅ ADDED onLoginSuccess prop
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAzureLoading, setIsAzureLoading] = useState(false);
  const [msalInstance, setMsalInstance] = useState(null);
  // const [showDemoForm, setShowDemoForm] = useState(false);

  // MSAL Configuration - FIXED: Use import.meta.env instead of process.env
  const msalConfig = {
    auth: {
      clientId: import.meta.env.VITE_AZURE_CLIENT_ID || "your-azure-client-id",
      authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID || "your-tenant-id"}`,
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

  // Animation for floating icons
  const [animatedIcons] = useState([
    { icon: Building, delay: 0, x: 20, y: 30, id: "icon1" },
    { icon: GraduationCap, delay: 1000, x: 80, y: 20, id: "icon2" },
    { icon: Heart, delay: 2000, x: 10, y: 70, id: "icon3" },
    { icon: Wrench, delay: 3000, x: 85, y: 80, id: "icon4" },
  ]);

  // Demo credentials for testing
  const demoCredentials = {
    username: "demo@legislationvue.com",
    password: "demo123",
  };

  // Initialize MSAL
  useEffect(() => {
    if (!isOpen) return;

    const initializeMsal = async () => {
      try {
        // Check if Azure credentials are configured
        if (
          !import.meta.env.VITE_AZURE_CLIENT_ID ||
          !import.meta.env.VITE_AZURE_TENANT_ID
        ) {
          // Don't show warning, just silently skip Azure AD setup
          return;
        }

        // Initialize MSAL
        const pca = new PublicClientApplication(msalConfig);
        await pca.initialize();
        setMsalInstance(pca);
        console.log("✅ MSAL initialized successfully");
      } catch (error) {
        console.error("❌ MSAL initialization failed:", error);
        setErrors({
          azure:
            "Azure AD configuration error. Please use demo login or contact administrator.",
        });
      }
    };

    initializeMsal();
  }, [isOpen]);

  // ✅ UPDATED: Handle Azure AD Sign In with expiration data
  const handleAzureSignIn = async () => {
    if (!msalInstance) {
      setErrors({
        azure:
          "Azure AD not initialized. Please use demo login or contact administrator.",
      });
      return;
    }

    setIsAzureLoading(true);
    setErrors({});

    try {
      console.log("🔄 Starting Azure AD sign-in...");

      // Attempt login with popup
      const response = await msalInstance.loginPopup(loginRequest);

      if (response && response.account) {
        console.log("✅ Azure AD sign-in successful:", response.account);

        // Get access token for API calls
        const tokenResponse = await msalInstance.acquireTokenSilent({
          scopes: loginRequest.scopes,
          account: response.account,
        });

        // ✅ NEW: Calculate expiration time (Azure AD tokens typically expire in 1 hour)
        const expiresIn = tokenResponse.expiresOn
          ? new Date(tokenResponse.expiresOn).getTime()
          : Date.now() + 60 * 60 * 1000; // Default 1 hour if not provided

        // Extract user information with token expiration
        const userInfo = {
          username: response.account.username,
          name: response.account.name || response.account.username,
          role: "user",
          access_token: tokenResponse.accessToken,
          refresh_token: tokenResponse.refreshToken || null, // May not always be available
          expires_at: new Date(expiresIn).toISOString(),
          account_id: response.account.homeAccountId, // For MSAL refresh
          tenant_id: response.account.tenantId,
          authMethod: "azure-ad",
        };

        console.log(
          "🔐 Calling login with Azure AD user info (expires at:",
          userInfo.expires_at,
          ")",
        );

        // Call the auth context login handler
        login(userInfo);

        // Call success callback first, then close
        if (onLoginSuccess) {
          console.log("✅ Calling onLoginSuccess callback");
          onLoginSuccess();
        }

        // Close the modal
        console.log("✅ Closing Azure AD login modal");
        onClose();
      }
    } catch (error) {
      console.error("❌ Azure AD sign-in failed:", error);

      // Handle specific MSAL errors with better messages
      let errorMessage = "Azure AD sign-in failed. Please try again.";

      if (error.errorCode === "user_cancelled") {
        errorMessage = "Sign-in was cancelled.";
      } else if (error.errorCode === "consent_required") {
        errorMessage =
          "Consent is required. Please contact your administrator.";
      } else if (error.message && error.message.includes("AADSTS9002326")) {
        errorMessage =
          "Azure AD app is not configured as Single Page Application. Please contact your administrator to fix the app registration.";
      } else if (error.message && error.message.includes("Cross-origin")) {
        errorMessage =
          "Azure AD configuration error: App must be registered as Single Page Application (SPA). Please contact your administrator.";
      } else if (error.message && error.message.includes("invalid_request")) {
        errorMessage =
          "Azure AD configuration error. The app registration needs to be updated. Please use demo login or contact administrator.";
      }

      setErrors({
        azure: errorMessage,
      });
    } finally {
      setIsAzureLoading(false);
    }
  };

  // ✅ UPDATED: Demo login with expiration (24 hours for demo)
  const handleDemoSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (
        formData.username === demoCredentials.username &&
        formData.password === demoCredentials.password
      ) {
        const authToken = "demo-jwt-token-" + Date.now();
        const expiresAt = new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(); // 24 hours

        console.log(
          "🔐 Calling login with demo user info (expires at:",
          expiresAt,
          ")",
        );

        // Call the auth context login
        login({
          username: formData.username,
          name: "Demo User",
          role: "analyst",
          access_token: authToken,
          refresh_token: null, // Demo doesn't have refresh
          expires_at: expiresAt,
          authMethod: "demo",
        });

        // Call success callback first, then close
        if (onLoginSuccess) {
          console.log("✅ Calling onLoginSuccess callback");
          onLoginSuccess();
        }

        // Close the modal
        console.log("✅ Closing demo login modal");
        onClose();
      } else {
        setErrors({
          general:
            "Invalid username or password. Try the demo credentials below.",
        });
      }
    } catch (error) {
      setErrors({
        general: "Login failed. Please try again.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Regular form handlers (for demo login)
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.username.trim()) {
      newErrors.username = "Username or email is required";
    } else if (!formData.username.includes("@")) {
      newErrors.username = "Please enter a valid email address";
    }

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDemoLogin = () => {
    setFormData(demoCredentials);
    setErrors({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center">
      {/* Blurred overlay */}
      <div
        className="absolute inset-0 backdrop-blur-xl bg-gray-900 bg-opacity-70"
        onClick={(e) => {
          if (!isLoading && !isAzureLoading) onClose();
        }}
      ></div>

      {/* Modal Content */}
      <div className="relative z-10 bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isLoading || isAzureLoading}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10"
        >
          <XIcon size={24} />
        </button>

        {/* Login Card */}
        <div className="p-8">
          <div className="text-center mb-8">
            {/* Image Logo */}
            <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
              <img
                src={yourLogo}
                alt="LegislationVUE Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Welcome to LegislationVUE
            </h2>
            <p className="text-gray-600">Sign in with your company account</p>
          </div>

          {/* Azure AD Error Messages */}
          {errors.azure && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-red-700 text-sm">{errors.azure}</span>
            </div>
          )}

          {/* Azure AD Sign In Button - Only show if Azure is configured */}
          {import.meta.env.VITE_AZURE_CLIENT_ID &&
          import.meta.env.VITE_AZURE_TENANT_ID ? (
            <div className="mb-6">
              <button
                onClick={handleAzureSignIn}
                disabled={isAzureLoading || !msalInstance}
                className={`w-full py-4 px-6 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-3 ${
                  isAzureLoading || !msalInstance
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg transform hover:scale-105"
                }`}
              >
                {isAzureLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    Signing in with Microsoft...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 23 23"
                      fill="currentColor"
                    >
                      <path d="M1 1h10v10H1z" />
                      <path d="M12 1h10v10H12z" />
                      <path d="M1 12h10v10H1z" />
                      <path d="M12 12h10v10H12z" />
                    </svg>
                    Sign in with Microsoft
                  </>
                )}
              </button>

              <p className="text-xs text-gray-500 text-center mt-2">
                Use your company Microsoft account to sign in
              </p>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">or</span>
                </div>
              </div>
            </div>
          ) : (
            // Show message if Azure AD not configured
            <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                Azure AD is not configured. Use demo login for testing.
              </p>
            </div>
          )}

          {/* Demo Form Toggle */}
          {/*
<button
  type="button"
  onClick={() => setShowDemoForm(!showDemoForm)}
  className="w-full py-2 px-4 text-sm text-gray-600 hover:text-gray-800 transition-colors mb-4"
>
  {showDemoForm ? 'Hide' : 'Show'} Demo Login
</button>

{showDemoForm && (
  <div className="space-y-4">
    
    {errors.general && (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
        <span className="text-red-700 text-sm">{errors.general}</span>
      </div>
    )}
    
    <div>
      <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
        Demo Email
      </label>
      <div className="relative">
        <User className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
        <input
          type="email"
          id="username"
          name="username"
          value={formData.username}
          onChange={handleInputChange}
          className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 ${
            errors.username ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="Enter demo email"
        />
      </div>
      {errors.username && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {errors.username}
        </p>
      )}
    </div>

    <div>
      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
        Demo Password
      </label>
      <div className="relative">
        <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
        <input
          type={showPassword ? 'text' : 'password'}
          id="password"
          name="password"
          value={formData.password}
          onChange={handleInputChange}
          className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-300 ${
            errors.password ? 'border-red-300' : 'border-gray-300'
          }`}
          placeholder="Enter demo password"
        />
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
      {errors.password && (
        <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {errors.password}
        </p>
      )}
    </div>

    <button
      onClick={handleDemoSubmit}
      disabled={isLoading}
      className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 ${
        isLoading
          ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
          : 'bg-gray-600 text-white hover:bg-gray-700'
      }`}
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2">
          <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
          Signing in...
        </div>
      ) : (
        'Demo Sign In'
      )}
    </button>

    <div className="p-3 bg-gray-50 rounded-lg">
      <p className="text-sm text-gray-600 mb-2">Demo credentials:</p>
      <button
        type="button"
        onClick={handleDemoLogin}
        className="w-full text-left p-2 bg-white border border-gray-200 rounded text-sm hover:bg-gray-50"
      >
        <div><strong>Email:</strong> demo@legislationvue.com</div>
        <div><strong>Password:</strong> demo123</div>
      </button>
    </div>
  </div>
)}
*/}

          {/* Footer Links */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Need help?
              <a
                href="mailto:legal@moregroup-inc.com"
                className="ml-1 text-blue-600 hover:text-blue-700 font-medium"
              >
                Contact IT Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AzureADLoginModal;
