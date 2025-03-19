import React, { useState, useEffect, useContext, createContext } from 'react';
import { User } from '../lib/types';
import { postData } from '../lib/api';
import { useRouter } from 'next/router';

interface SignupFormValues {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  dob: string | null;
}

interface LoginResponse {
  success: boolean;
  message?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  signup: (userData: SignupFormValues) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchUser = async () => {
    try {
      const userData = await postData<User>('/api/auth/me', null);
      setUser(userData);
    } catch (err: any) {
      console.error('Error fetching user:', err);
      setError(err.message || 'Failed to fetch user data');
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await postData<LoginResponse>('/api/auth/login', { email, password });
      if (response.success) {
        await fetchUser();
      } else {
        setError(response.message || 'Login failed');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    setError(null);
    try {
      await postData('/api/auth/logout', null);
      setUser(null);
      router.push('/login');
    } catch (err: any) {
      console.error('Logout error:', err);
      setError(err.message || 'Logout failed');
    } finally {
      setLoading(false);
    }
  };

  const signup = async (userData: SignupFormValues) => {
    setLoading(true);
    setError(null);
    try {
      await postData('/api/auth/signup', userData);
      router.push('/login?success=signup');
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, signup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
} 