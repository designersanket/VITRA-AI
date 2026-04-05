import React, { createContext, useContext, useEffect, useState } from 'react';
import { buildApiUrl } from '../constants';

interface User {
  id: string;
  uid: string; // Alias for id
  name: string;
  displayName: string; // Alias for name
  email: string;
  photoURL?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  dbConnected: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signInWithGoogle: (googleToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const parseApiResponse = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return await response.json();
  }

  const text = await response.text();

  if (text.includes('Please wait while your application starts')) {
    throw new Error('Server is still waking up. Please try again in a few seconds.');
  }

  if (text.startsWith('The page') || text.includes('<!DOCTYPE html') || text.includes('<html')) {
    throw new Error('Frontend is reaching the wrong server for API requests. Set VITE_API_URL to your backend URL in production.');
  }

  throw new Error(text || `Server returned ${response.status} ${response.statusText}`);
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Check health/db status
      try {
        const healthRes = await fetch(buildApiUrl('/api/health'));
        if (healthRes.ok) {
          const healthData = await parseApiResponse(healthRes);
          setDbConnected(healthData.dbConnected);
        }
      } catch (err) {
        // Silent health check failure
      }

      const token = localStorage.getItem('vitra_token');
      
      if (token) {
        try {
          const response = await fetch(buildApiUrl('/api/auth/me'), {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const userData = await parseApiResponse(response);
            
            setUser({
              ...userData,
              uid: userData.id,
              displayName: userData.name
            });
          } else {
            localStorage.removeItem('vitra_token');
            setUser(null);
          }
        } catch (error) {
          setUser(null);
        }
      }
      
      setLoading(false);
    };
    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      console.log("Attempting login for:", email);
      const response = await fetch(buildApiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await parseApiResponse(response);
      console.log("Login response:", data);

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      localStorage.setItem('vitra_token', data.token);
      
      setUser({
        ...data.user,
        uid: data.user.id,
        displayName: data.user.name
      });
    } catch (error: any) {
      console.error("Login error details:", error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Backend not running. Please check your server.');
      }
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      console.log("Attempting registration for:", email);
      const response = await fetch(buildApiUrl('/api/auth/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await parseApiResponse(response);
      
      console.log("Registration response:", data);

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      localStorage.setItem('vitra_token', data.token);
      
      setUser({
        ...data.user,
        uid: data.user.id,
        displayName: data.user.name
      });
      console.log("User registered and logged in successfully");
    } catch (error: any) {
      console.error("Registration error details:", error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Backend not reachable. Please ensure the server is running.');
      }
      throw error;
    }
  };

  const signInWithGoogle = async (googleToken: string) => {
    try {
      setLoading(true);
      console.log("Attempting Google login with token...");
      const response = await fetch(buildApiUrl('/api/auth/google'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleToken })
      });

      const data = await parseApiResponse(response);
      console.log("Google login response:", data);

      if (!response.ok) {
        throw new Error(data.message || 'Google login failed');
      }

      localStorage.setItem('vitra_token', data.token);
      
      setUser({
        ...data.user,
        uid: data.user.id,
        displayName: data.user.name
      });
    } catch (error: any) {
      console.error("Google login error details:", error);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Backend not running. Please check your server.');
      }
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('vitra_token');
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, dbConnected, login, register, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
