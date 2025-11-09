/**
 * Centralized API URL configuration
 * 
 * Priority order:
 * 1. Runtime config injected by server (window.__CONFIG__.API_URL)
 * 2. Vite environment variable (VITE_API_URL)
 * 3. Relative path '/api' (works with Vite dev proxy or same-origin deployment)
 */

export function getApiUrl() {
  // Check for runtime-injected config first
  if (typeof window !== 'undefined' && window.__CONFIG__ && window.__CONFIG__.API_URL) {
    return window.__CONFIG__.API_URL;
  }
  
  // Check for Vite environment variable
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Default to relative path (works with proxy in dev or same origin in production)
  return '/api';
}

export function getApiBaseUrl() {
  const apiUrl = getApiUrl();
  
  // If it's a relative path, construct the full URL
  if (apiUrl.startsWith('/')) {
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.host}${apiUrl}`;
    }
    return apiUrl;
  }
  
  return apiUrl;
}
