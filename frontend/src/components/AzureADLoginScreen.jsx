import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Lock, User, AlertCircle, Building, GraduationCap, Heart, Wrench } from 'lucide-react';

const AzureADLoginScreen = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAzureLoading, setIsAzureLoading] = useState(false);
  const [msalInstance, setMsalInstance] = useState(null);
  const [showDemoForm, setShowDemoForm] = useState(false);

  // MSAL Configuration
  const msalConfig = {
    auth: {
      clientId: "your-azure-client-id", // Replace with your actual client ID
      authority: "https://login.microsoftonline.com/your-tenant-id", // Replace with your tenant
      redirectUri: window.location.origin + "/auth/callback",
      postLogoutRedirectUri: window.location.origin,
    },
    cache: {
      cacheLocation: "localStorage",
      storeAuthStateInCookie: false,
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;
          console.log(`MSAL [${level}]: ${message}`);
        },
        piiLoggingEnabled: false,
      },
    },
  };

  // Login request scopes
  const loginRequest = {
    scopes: ["User.Read", "email", "profile", "openid"],
  };

  // Animation for floating icons
  const [animatedIcons] = useState([
    { icon: Building, delay: 0, x: 20, y: 30, id: 'icon1' },
    { icon: GraduationCap, delay: 1000, x: 80, y: 20, id: 'icon2' },
    { icon: Heart, delay: 2000, x: 10, y: 70, id: 'icon3' },
    { icon: Wrench, delay: 3000, x: 85, y: 80, id: 'icon4' }
  ]);

  // Demo credentials for testing
  const demoCredentials = {
    username: 'demo@legislationvue.com',
    password: 'demo123'
  };

  // Initialize MSAL (simulated for demo)
  useEffect(() => {
    const initializeMsal = async () => {
      try {
        // In a real implementation, you would import and initialize MSAL here:
        // const { PublicClientApplication } = await import('@azure/msal-browser');
        // const instance = new PublicClientApplication(msalConfig);
        // await instance.initialize();
        // setMsalInstance(instance);
        
        // For demo purposes, we'll simulate MSAL being available
        console.log('✅ MSAL would be initialized here with config:', msalConfig);
        setMsalInstance({ initialized: true }); // Mock instance
      } catch (error) {
        console.error('❌ MSAL initialization failed:', error);
        setErrors({
          azure: 'Azure AD configuration error. Please contact your administrator.'
        });
      }
    };

    initializeMsal();
  }, []);

  // Handle Azure AD Sign In
  const handleAzureSignIn = async () => {
    if (!msalInstance) {
      setErrors({
        azure: 'Azure AD not initialized. Please refresh and try again.'
      });
      return;
    }

    setIsAzureLoading(true);
    setErrors({});

    try {
      console.log('🔄 Starting Azure AD sign-in...');
      
      // In a real implementation, you would call:
      // const response = await msalInstance.loginPopup(loginRequest);
      
      // For demo purposes, simulate a successful Azure login
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Simulate successful Azure AD response
      const mockAzureResponse = {
        account: {
          username: 'john.doe@yourcompany.com',
          name: 'John Doe',
          homeAccountId: 'mock-azure-id',
          tenantId: 'mock-tenant-id'
        },
        accessToken: 'mock-azure-access-token'
      };
      
      if (mockAzureResponse && mockAzureResponse.account) {
        console.log('✅ Azure AD sign-in successful:', mockAzureResponse.account);
        
        // Extract user information
        const userInfo = {
          username: mockAzureResponse.account.username,
          name: mockAzureResponse.account.name || mockAzureResponse.account.username,
          role: 'user',
          token: mockAzureResponse.accessToken,
          azureId: mockAzureResponse.account.homeAccountId,
          tenantId: mockAzureResponse.account.tenantId,
          authMethod: 'azure-ad'
        };

        // Call the parent login handler
        if (onLogin) {
          onLogin(userInfo);
        }
      }
    } catch (error) {
      console.error('❌ Azure AD sign-in failed:', error);
      
      // Handle specific MSAL errors
      setErrors({
        azure: 'Azure AD sign-in is not configured yet. This is a demo - use the demo login below.'
      });
    } finally {
      setIsAzureLoading(false);
    }
  };

  // Regular form handlers (for demo login)
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username or email is required';
    } else if (!formData.username.includes('@')) {
      newErrors.username = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDemoSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (formData.username === demoCredentials.username && 
          formData.password === demoCredentials.password) {
        
        const authToken = 'demo-jwt-token-' + Date.now();
        
        // Call the parent login handler
        if (onLogin) {
          onLogin({
            username: formData.username,
            name: 'Demo User',
            role: 'analyst',
            token: authToken,
            authMethod: 'demo'
          });
        }
      } else {
        setErrors({
          general: 'Invalid username or password. Try the demo credentials below.'
        });
      }
    } catch (error) {
      setErrors({
        general: 'Login failed. Please try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = () => {
    setFormData(demoCredentials);
    setErrors({});
  };

  const FloatingIcon = ({ icon: Icon, delay, x, y, id }) => {
    const [isVisible, setIsVisible] = useState(false);
    
    useEffect(() => {
      const timer = setTimeout(() => setIsVisible(true), delay);
      return () => clearTimeout(timer);
    }, [delay]);
    
    return (
      <div 
        className={`absolute transition-all duration-1000 ${isVisible ? 'opacity-30' : 'opacity-0'}`}
        style={{ 
          left: `${x}%`, 
          top: `${y}%`,
          animationDelay: `${delay}ms`,
          animation: isVisible ? 'float 3s ease-in-out infinite' : 'none'
        }}
      >
        <Icon size={24} className="text-blue-300" />
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-violet-50 flex flex-col lg:flex-row relative overflow-hidden">
      
      {/* CSS Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-10px) rotate(2deg); }
          66% { transform: translateY(-5px) rotate(-2deg); }
        }
      `}</style>
      
      {/* Floating Background Icons */}
      {animatedIcons.map((iconData) => (
        <FloatingIcon key={iconData.id} {...iconData} />
      ))}
      
      {/* Left Panel - Branding */}
      <div className="lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-12 relative">
        <div className="max-w-md w-full text-center lg:text-left">
          
          {/* Logo and Title */}
          <div className="mb-8">
            <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-violet-600 to-blue-600 bg-clip-text text-transparent mb-4">
              LegislationVUE
            </h1>
            <div className="flex justify-center lg:justify-start mb-6">
              <div className="h-6 w-24 bg-gray-200 rounded flex items-center justify-center text-xs text-gray-600">
                byMOREgroup
              </div>
            </div>
            <p className="text-xl text-gray-700 mb-4">
              Your AI-Powered Legislative Intelligence Platform
            </p>
            <p className="text-gray-600">
              Track executive orders, analyze state legislation, and stay informed with comprehensive AI analysis.
            </p>
          </div>

          {/* Features List */}
          <div className="space-y-4 text-left">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"></div>
              <span className="text-gray-700">Real-time Executive Order tracking</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"></div>
              <span className="text-gray-700">AI-powered legislative analysis</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"></div>
              <span className="text-gray-700">Multi-state legislation monitoring</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"></div>
              <span className="text-gray-700">Business impact assessments</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-12">
        <div className="w-full max-w-md">
          
          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-r from-violet-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome Back</h2>
              <p className="text-gray-600">Sign in with your company account</p>
            </div>

            {/* Azure AD Error Messages */}
            {errors.azure && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <span className="text-red-700 text-sm">{errors.azure}</span>
              </div>
            )}

            {/* Azure AD Sign In Button */}
            <div className="mb-6">
              <button
                onClick={handleAzureSignIn}
                disabled={isAzureLoading || !msalInstance}
                className={`w-full py-4 px-6 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-3 ${
                  isAzureLoading || !msalInstance
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg transform hover:scale-105'
                }`}
              >
                {isAzureLoading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                    Signing in with Microsoft...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 23 23" fill="currentColor">
                      <path d="M1 1h10v10H1z"/>
                      <path d="M12 1h10v10H12z"/>
                      <path d="M1 12h10v10H1z"/>
                      <path d="M12 12h10v10H12z"/>
                    </svg>
                    Sign in with Microsoft
                  </>
                )}
              </button>
              
              <p className="text-xs text-gray-500 text-center mt-2">
                Use your company Microsoft account to sign in
              </p>
            </div>

            {/* Configuration Notice */}
            <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700">
                <strong>Setup Required:</strong> To enable Azure AD, configure your Client ID and Tenant ID in the environment variables. 
                See the implementation guide for details.
              </p>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">or for testing</span>
              </div>
            </div>

            {/* Demo Form Toggle */}
            <button
              type="button"
              onClick={() => setShowDemoForm(!showDemoForm)}
              className="w-full py-2 px-4 text-sm text-gray-600 hover:text-gray-800 transition-colors mb-4"
            >
              {showDemoForm ? 'Hide' : 'Show'} Demo Login
            </button>

            {/* Demo Login Section */}
            {showDemoForm && (
              <div className="space-y-4">
                
                {/* Demo Error Messages */}
                {errors.general && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <span className="text-red-700 text-sm">{errors.general}</span>
                  </div>
                )}
                
                {/* Username/Email Field */}
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

                {/* Password Field */}
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

                {/* Demo Login Button */}
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

                {/* Demo Credentials */}
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

            {/* Footer Links */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Need help? 
                <button type="button" className="ml-1 text-blue-600 hover:text-blue-700 font-medium">
                  Contact IT Support
                </button>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-xs text-gray-500">
            <p>© 2025 LegislationVue by MORE Group. All rights reserved.</p>
            <div className="mt-1">
              <button type="button" className="hover:text-gray-700">Privacy Policy</button> • 
              <button type="button" className="hover:text-gray-700 ml-1">Terms of Service</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AzureADLoginScreen;
