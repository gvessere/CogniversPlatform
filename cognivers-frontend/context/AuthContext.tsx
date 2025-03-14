import React, { useState, useContext, createContext, useEffect, useCallback, useRef, ReactNode } from 'react'
import { useRouter } from 'next/router'
import Cookies from 'js-cookie'
import { User } from '../lib/types'
import { callFrontendApi } from '../lib/api'
import { refreshUserData as refreshUserDataApi } from '../lib/auth'

// Define auth context type
interface AuthContextType {
  user: User | null;
  loading: boolean;
  isValidating?: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User | null) => void;
  refreshUserData: () => Promise<User | null>;
}

// Define props for provider
interface AuthProviderProps {
  children: ReactNode;
}

// Create context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  setUser: () => {},
  refreshUserData: async () => null
});

export function AuthProvider({ children }: AuthProviderProps): React.ReactElement {
    const [user, setUser] = useState<User | null>(null)
    const [loading, setLoading] = useState<boolean>(true)
    const [isValidating, setIsValidating] = useState<boolean>(false)
    const router = useRouter()
    const lastValidatedRef = useRef<number>(0)
    const initialized = useRef(false)
    
    const logout = useCallback(async (): Promise<void> => {
        console.log('Logging out user')
        
        // Clear session indicator in localStorage
        localStorage.removeItem('hasSession');
        
        try {
            // Call logout API to clear the HTTP-only cookie
            await callFrontendApi('/api/auth/logout', 'POST', {});
        } catch (error) {
            console.error('Error during logout:', error)
        }
        
        // Clear local state regardless of API success
        setUser(null)
        
        // Use setTimeout to ensure state update completes before navigation
        setTimeout(() => {
            router.push('/login')
        }, 0)
    }, [router])


    useEffect(() => {
      let isMounted = true // Track component mount state
      async function loadUser(): Promise<void> {
          // Check if we're on a public page where authentication isn't required
          const isPublicPage = ['/login', '/signup', '/'].includes(router.pathname);
          
          // Helper function to detect if there might be a session
          const mightHaveSession = (): boolean => {
              // Check if we have any authentication related cookies
              // This avoids unnecessary API calls on public pages when clearly not logged in
              const cookies = document.cookie;
              const hasAuthCookie = cookies.includes('token=') || 
                                   cookies.includes('session=') || 
                                   cookies.includes('auth=');
              const hasLocalStorageSession = localStorage.getItem('hasSession') === 'true';
              
              // Only return true if we have actual evidence of a session
              return hasAuthCookie || hasLocalStorageSession;
          };
          
          // Force auth state reset when landing on login page
          if (router.pathname === '/login') {
              if (isMounted) {
                  setUser(null);
                  setLoading(false);
              }
              // Only proceed with API call if we have reason to believe there's a valid session
              // This helps avoid unnecessary API calls on the login page
              if (!mightHaveSession()) {
                  return;
              }
          }
          
          console.log('AuthContext - Checking authentication state');
          
          // Skip auth check for public pages if there's no evidence of a session
          if (isPublicPage && !mightHaveSession()) {
              console.log('AuthContext - On public page with no session evidence, skipping auth check');
              setUser(null);
              setLoading(false);
              return;
          }
          
          try {
              console.log('AuthContext - Loading user data');
              const userData = await callFrontendApi<User>('/api/auth/me', 'GET', undefined, { isPublicPage });
              
              // Check if this is a special 401 error response for public pages
              if (userData && (userData as any).__isExpected401Error) {
                  console.log('AuthContext - Expected 401 on public page, setting user to null');
                  if (isMounted) {
                      setUser(null);
                      localStorage.removeItem('hasSession');
                  }
              } else {
                  console.log('AuthContext - User data loaded:', userData)
                  if (isMounted) {
                    setUser(userData)
                    // Mark as validated when we successfully load user data
                    lastValidatedRef.current = Date.now()
                    // Set flag in localStorage to indicate we have a session
                    localStorage.setItem('hasSession', 'true');
                  }
              }
          } catch (error: any) {
              // Don't log as error for 401 unauthorized on public pages
              if (error.response?.status === 401 && isPublicPage) {
                  console.log('AuthContext - Not authenticated on public page');
                  // Silently handle 401 errors on public pages
                  localStorage.removeItem('hasSession');
              } else if (error.response?.status === 401) {
                  console.log('AuthContext - Authentication required');
                  // Clear session indicator
                  localStorage.removeItem('hasSession');
                  
                  // If not on a public page, redirect to login
                  if (!isPublicPage && router.pathname !== '/login') {
                      router.push('/login');
                  }
              } else {
                  console.error('Failed to load user data:', error);
              }
              
              if (isMounted) setUser(null)
          } finally {
              if (isMounted) setLoading(false)
          }
        }
        loadUser()
        return () => { isMounted = false } // Cleanup on unmount
    }, [router.pathname]) // Re-run on route changes to update auth state
  
    useEffect(() => {
      // Only validate session if user is logged in
      if (!user) return;
      
      let isMounted = true
      async function validateSession(): Promise<void> {
        // Skip validation if it's been less than 10 seconds since last validation
        const now = Date.now()
        if (now - lastValidatedRef.current < 10000) {
          console.log('AuthContext - Skipping validation, too soon since last check')
          return
        }
        
        try {
          setIsValidating(true)
          console.log('AuthContext - Validating session')
          const validationData = await callFrontendApi<{ valid: boolean }>('/api/auth/validate', 'GET');
          if (!isMounted) return
          if (validationData.valid) {
            console.log('AuthContext - Session valid, refreshing user data')
            // Update last validated timestamp
            lastValidatedRef.current = now
            // Refresh user data after validation
            const userData = await callFrontendApi<User>('/api/auth/me', 'GET');
            setUser(userData)
          } else {
            console.log('AuthContext - Session invalid, logging out')
            logout() // Proper cleanup
          }
        } catch (error: any) {
          console.error('Session validation failed:', error)
          // Only logout if there's a validation error, not network errors
          if (error.response?.status === 401) {
            logout()
          }
        } finally {
          if (isMounted) setIsValidating(false)
        }
      }
      
      // Delay initial validation to avoid immediate validation after login
      const initialTimer = setTimeout(validateSession, 5000)
      
      // Set up regular validation interval (5 minutes)
      const interval = setInterval(validateSession, 300_000)
      
      return () => {
        clearTimeout(initialTimer)
        clearInterval(interval)
        isMounted = false
      }
    }, [logout, user]) // Add user to dependencies to re-run effect when user changes


    const login = async (): Promise<void> => {
      console.log('AuthContext - Login called')
      try {
        // Fetch user data using the HttpOnly cookie that was set by the login API
        const userData = await callFrontendApi<User>('/api/auth/me', 'GET');
        console.log('AuthContext - Login successful, user data:', userData)
        setUser(userData)
        
        // Set last validated timestamp
        lastValidatedRef.current = Date.now()
        
        // Set flag in localStorage to indicate we have a session
        localStorage.setItem('hasSession', 'true');
        
        // Check for a returnUrl in the router query
        if (router.query.returnUrl) {
          // Redirect to the returnUrl
          router.push(router.query.returnUrl as string);
        } else if (router.pathname !== '/portal') {
          // Default redirect to portal if not already there
          router.push('/portal');
        }
      } catch (error) {
        console.error('Failed to fetch user data after login:', error)
        // Handle failed user data fetch
        localStorage.removeItem('hasSession');
        logout()  
      }
    }
  
    // Debug when user state changes
    useEffect(() => {
      console.log('AuthContext - User state changed:', { 
        isAuthenticated: !!user, 
        loading,
        lastValidated: new Date(lastValidatedRef.current).toISOString()
      })
    }, [user, loading])

    // Implement refreshUserData function
    const refreshUserData = async (): Promise<User | null> => {
      try {
        console.log('AuthContext - Refreshing user data');
        
        // Remove cache-busting parameter
        const userData = await callFrontendApi<User>(`/api/auth/me`, 'GET');
        
        console.log('AuthContext - User data refreshed:', userData);
        
        // Update the user state with the fresh data
        setUser(userData);
        
        // Update last validated timestamp
        lastValidatedRef.current = Date.now();
        
        return userData;
      } catch (error) {
        console.error('Failed to refresh user data:', error);
        return null;
      }
    };

    // Initialize auth state - check if already authenticated
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;
        
        console.log('Initializing auth state')
        const checkAuth = async () => {
            try {
                setLoading(true)
                const userData = await refreshUserDataApi();
                if (userData) {
                    setUser(userData);
                    localStorage.setItem('hasSession', 'true');
                    
                    // Check for pending enrollment after login
                    const pendingEnrollment = sessionStorage.getItem('pendingEnrollment');
                    if (pendingEnrollment && router.pathname !== '/sessions/enroll') {
                        try {
                            const enrollmentData = JSON.parse(pendingEnrollment);
                            let enrollUrl = '/sessions/enroll';
                            
                            if ('code' in enrollmentData && enrollmentData.code) {
                                enrollUrl += `?code=${enrollmentData.code}`;
                                // Redirect to enrollment page
                                router.push(enrollUrl);
                            } else {
                                // Invalid enrollment data, clear it
                                console.error('Invalid enrollment data format:', enrollmentData);
                                sessionStorage.removeItem('pendingEnrollment');
                            }
                        } catch (e) {
                            console.error('Error parsing pending enrollment data:', e);
                            sessionStorage.removeItem('pendingEnrollment');
                        }
                    }
                }
            } catch (error) {
                console.error('Error checking auth status:', error)
                setUser(null)
                localStorage.removeItem('hasSession');
            } finally {
                setLoading(false)
            }
        }
        
        checkAuth()
    }, [router])

    // Define the value object with typed parameters
    const contextValue: AuthContextType = {
      user,
      loading,
      isValidating, 
      login,
      logout,
      setUser,
      refreshUserData
    };

    return (
      <AuthContext.Provider value={contextValue}>
        {children}
      </AuthContext.Provider>
    )
}

export const useAuth = (): AuthContextType => useContext(AuthContext) 