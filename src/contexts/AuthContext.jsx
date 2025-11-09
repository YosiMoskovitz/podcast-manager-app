import { createContext, useContext, useState, useEffect } from 'react';
import { getApiBaseUrl } from '../utils/apiUrl';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is authenticated on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const apiUrl = `${getApiBaseUrl()}/auth/user`;
      console.log('[AUTH] Checking authentication at:', apiUrl);
      
      const response = await fetch(apiUrl, {
        credentials: 'include'
      });

      console.log('[AUTH] Response status:', response.status);
      console.log('[AUTH] Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.ok) {
        const userData = await response.json();
        console.log('[AUTH] User authenticated:', userData.email);
        setUser(userData);
      } else {
        console.log('[AUTH] User not authenticated');
        setUser(null);
      }
    } catch (err) {
      console.error('[AUTH] Auth check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = () => {
    // Redirect to Google OAuth
    const authUrl = `${getApiBaseUrl()}/auth/google`;
    console.log('[AUTH] Redirecting to Google OAuth:', authUrl);
    window.location.href = authUrl;
  };

  const logout = async () => {
    try {
      const response = await fetch(`${getApiBaseUrl()}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        setUser(null);
        window.location.href = '/login';
      } else {
        throw new Error('Logout failed');
      }
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to logout');
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
