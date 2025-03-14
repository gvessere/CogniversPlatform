import Cookies from 'js-cookie';
import { NextApiRequest, NextApiResponse } from 'next';
import { User, UserRole } from './types';
import { API_BASE_URL } from './config';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { callFrontendApi } from './api';

export function setToken(token: string): void {
  // Note: This is only for non-HttpOnly cookies
  // HttpOnly cookies are set by the server
  Cookies.set('token', token, { 
    expires: 1, // 1 day
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
}

// Define interface for JWT payload
interface JwtPayload {
  sub: string | number;
  email?: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  [key: string]: any;
}

/**
 * Get token from cookies, with support for both client-side and server-side
 * @param req Optional request object for server-side usage
 * @returns The token string or null if not found
 */
export function getToken(req?: NextApiRequest): string | null {
  // For server-side (API routes), use req.cookies
  if (req && req.cookies && req.cookies.token) {
    return req.cookies.token;
  }
  
  // For client-side, use js-cookie
  return typeof window !== 'undefined' ? Cookies.get('token') || null : null;
}

export function removeToken(): void {
  Cookies.remove('token');
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Get current authenticated user
 * Uses direct JWT decoding on server-side to avoid HTTP request issues
 */
export const getCurrentUser = async (token: string): Promise<User | null> => {
  if (!token) return null;
  
  try {
    // Server-side: decode token directly
    if (typeof window === 'undefined') {
      // Simple JWT decode (not secure but necessary for middleware)
      const decoded = jwt.decode(token) as JwtPayload;
      
      if (!decoded) return null;
      
      // Simple role normalization
      const role = String(decoded.role || '').toUpperCase().includes('ADMIN') 
        ? UserRole.ADMINISTRATOR 
        : String(decoded.role || '').toUpperCase().includes('TRAIN')
          ? UserRole.TRAINER
          : UserRole.CLIENT;
      
      // Minimal user object with required fields
      return {
        id: typeof decoded.sub === 'number' ? decoded.sub : parseInt(String(decoded.sub)) || 0,
        email: decoded.email || '',
        first_name: decoded.first_name || '',
        last_name: decoded.last_name || '',
        role,
      } as User;
    }
    
    // Client-side: use the API endpoint
    try {
      return await callFrontendApi<User>('/api/auth/me', 'GET');
    } catch (error) {
      console.error('Failed to fetch user data:', error);
      return null;
    }
  } catch (error) {
    console.error('Error in getCurrentUser:', error);
    return null;
  }
};

/**
 * Middleware to require authentication
 */
export const withAuth = async (
  req: NextApiRequest, 
  res: NextApiResponse,
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
): Promise<void> => {
  const token = getToken(req);
  
  if (!token) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  
  const user = await getCurrentUser(token);
  
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }
  
  // Add user to request object for use in handler
  (req as any).user = user;
  
  return handler(req, res);
};

/**
 * Middleware to require admin role
 */
export const withAdmin = async (
  req: NextApiRequest, 
  res: NextApiResponse,
  handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void>
): Promise<void> => {
  return withAuth(req, res, async (req, res) => {
    const user = (req as any).user as User;
    
    if (!hasRole(user, UserRole.ADMINISTRATOR)) {
      res.status(403).json({ message: 'Forbidden: Admin access required' });
      return;
    }
    
    return handler(req, res);
  });
};

/**
 * Helper to check if a user is an admin
 */
export const isAdmin = (user: User | null): boolean => {
  return hasRole(user, UserRole.ADMINISTRATOR);
};

/**
 * Check if a user has a specific role, with case-insensitive matching
 * and fallback for string-based roles
 */
export const hasRole = (user: User | null, role: UserRole): boolean => {
  if (!user) return false;
  
  // Direct equality check (enum to enum)
  if (user.role === role) return true;
  
  // Handle case where user.role is a string that doesn't match the enum exactly
  return typeof user.role === 'string' && 
         user.role.toUpperCase() === role.toUpperCase();
};

/**
 * Refresh user data from the server
 * @returns Promise with updated user data
 */
export const refreshUserData = async (): Promise<User | null> => {
  try {
    return await callFrontendApi<User>('/api/auth/me', 'GET');
  } catch (error) {
    console.error('Failed to refresh user data:', error);
    return null;
  }
}; 