import React, { createContext, useContext, useEffect, useState } from 'react';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Check health/db status
      try {
        const healthRes = await fetch('/api/health');
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setDbConnected(healthData.dbConnected);
        }
      } catch (err) {
        // Silent health check failure
      }

      const token = localStorage.getItem('vitra_token');
      
      if (token) {
        try {
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (response.ok) {
            const userData = await response.json();
            
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
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        data = await response.json();
      } else {
        const text = await response.text();
        console.error("Non-JSON response received:", text);
        if (text.includes("Please wait while your application starts")) {
          throw new Error('Server is still warming up. Please try again in a few seconds.');
        }
        throw new Error(`Server returned non-JSON response: ${response.status} ${response.statusText}`);
      }
      
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
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: googleToken })
      });

      const data = await response.json();
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
