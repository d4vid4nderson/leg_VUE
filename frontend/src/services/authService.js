// src/services/authService.js

import API_URL from "../config/api";

/**
 * Service for handling authentication-related operations
 */
const authService = {
  /**
   * Login with email and password
   * @param {string} email User email
   * @param {string} password User password
   * @returns {Promise} Promise with the authentication result
   */
  async login(email, password) {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Login failed");
      }

      return await response.json();
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  },

  /**
   * Logout the current user
   * @returns {Promise} Promise with the logout result
   */
  async logout() {
    try {
      // We don't need to call the backend for Microsoft logout
      // Just clear local storage
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");

      return { success: true };
    } catch (error) {
      console.error("Logout error:", error);
      // Clear local storage even if there's an error
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user");
      throw error;
    }
  },

  /**
   * Validate the current authentication token
   * ✅ UPDATED: Now checks token expiration
   * @returns {Promise} Promise with the validation result
   */
  async validateToken() {
    try {
      const token = localStorage.getItem("auth_token");
      const userString = localStorage.getItem("user");

      if (!token || !userString) {
        return { valid: false, reason: "no_token" };
      }

      // Parse user data to check expiration
      let userData;
      try {
        userData = JSON.parse(userString);
      } catch (parseError) {
        console.error("Error parsing user data:", parseError);
        return { valid: false, reason: "invalid_user_data" };
      }

      // Check if token is expired
      if (userData.expires_at) {
        const expirationTime = new Date(userData.expires_at).getTime();
        const currentTime = Date.now();
        const bufferTime = 5 * 60 * 1000; // 5 minute buffer

        if (currentTime >= expirationTime - bufferTime) {
          console.log("⏰ Token is expired");
          return { valid: false, reason: "token_expired", userData };
        }
      }

      // Token is valid
      return { valid: true, userData };
    } catch (error) {
      console.error("Token validation error:", error);
      return { valid: false, reason: "validation_error" };
    }
  },

  /**
   * Get the current user from localStorage
   * @returns {Object|null} User object or null if not authenticated
   */
  getCurrentUser() {
    const userJson = localStorage.getItem("user");
    if (userJson) {
      try {
        return JSON.parse(userJson);
      } catch (error) {
        console.error("Error parsing user JSON:", error);
        return null;
      }
    }
    return null;
  },

  /**
   * Check if the user is authenticated
   * @returns {boolean} True if authenticated, false otherwise
   */
  isAuthenticated() {
    return !!localStorage.getItem("auth_token");
  },

  /**
   * Process URL parameters after Microsoft SSO callback
   * @returns {Object|null} Authentication data or null if not present
   */
  processMicrosoftCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    const userParam = urlParams.get("user");

    if (token && userParam) {
      try {
        // Parse user data
        const user = JSON.parse(
          decodeURIComponent(userParam.replace(/'/g, '"')),
        );

        // Store in localStorage
        localStorage.setItem("auth_token", token);
        localStorage.setItem("user", JSON.stringify(user));

        // Clean URL parameters
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );

        return { token, user };
      } catch (error) {
        console.error("Error processing callback params:", error);
        return null;
      }
    }

    return null;
  },
};

export default authService;
