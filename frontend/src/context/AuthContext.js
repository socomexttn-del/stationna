import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    // Initialize from localStorage
    return localStorage.getItem('volt_token');
  });
  const [loading, setLoading] = useState(true);

  // Create a stable API instance with useMemo
  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: `${API_URL}/api`,
      timeout: 10000,
    });

    // Request interceptor - add token to every request
    instance.interceptors.request.use(
      (config) => {
        const currentToken = localStorage.getItem('volt_token');
        if (currentToken) {
          config.headers.Authorization = `Bearer ${currentToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle 401 errors only
    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        // Only logout on 401 Unauthorized (token expired/invalid)
        if (error.response?.status === 401) {
          console.warn('Token expired or invalid, logging out');
          localStorage.removeItem('volt_token');
          setToken(null);
          setUser(null);
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, []); // Empty deps - create only once

  // Fetch user data
  const fetchUser = useCallback(async () => {
    const currentToken = localStorage.getItem('volt_token');
    if (!currentToken) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      // Only clear user on 401, not on network errors
      if (error.response?.status === 401) {
        console.warn('Token invalid, clearing session');
        localStorage.removeItem('volt_token');
        setToken(null);
        setUser(null);
      } else {
        console.error('Network error fetching user, keeping session:', error.message);
        // Keep the token and try again later - don't logout on network errors
      }
    } finally {
      setLoading(false);
    }
  }, [api]);

  // Sync with localStorage on mount and token changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'volt_token') {
        setToken(e.newValue);
        if (!e.newValue) {
          setUser(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Fetch user when token changes
  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setUser(null);
      setLoading(false);
    }
  }, [token, fetchUser]);

  const login = useCallback(async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { token: newToken, user: userData } = response.data;
    
    // Save to localStorage first
    localStorage.setItem('volt_token', newToken);
    
    // Then update state
    setToken(newToken);
    setUser(userData);
    
    return userData;
  }, [api]);

  const register = useCallback(async (data, verificationCode = null) => {
    const requestData = { ...data };
    if (verificationCode) {
      requestData.verification_code = verificationCode;
    }
    const response = await api.post('/auth/register', requestData, {
      params: verificationCode ? { verification_code: verificationCode } : {}
    });
    const { token: newToken, user: userData } = response.data;
    
    // Save to localStorage first
    localStorage.setItem('volt_token', newToken);
    
    // Then update state
    setToken(newToken);
    setUser(userData);
    
    return userData;
  }, [api]);

  const sendVerificationCode = useCallback(async (email) => {
    const response = await api.post('/auth/send-verification-code', { email });
    return response.data;
  }, [api]);

  const verifyCode = useCallback(async (email, code) => {
    const response = await api.post('/auth/verify-code', { email, code });
    return response.data;
  }, [api]);

  const logout = useCallback(() => {
    localStorage.removeItem('volt_token');
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((userData) => {
    setUser(userData);
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    token,
    loading,
    login,
    register,
    sendVerificationCode,
    verifyCode,
    logout,
    updateUser,
    api
  }), [user, token, loading, login, register, sendVerificationCode, verifyCode, logout, updateUser, api]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
