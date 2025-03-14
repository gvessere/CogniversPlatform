import React, { useEffect, useState, useRef, ReactNode } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '../context/AuthContext'

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps): React.ReactElement {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [mounted, setMounted] = useState<boolean>(false)
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // Debug auth state in ProtectedRoute
  useEffect(() => {
    console.log('ProtectedRoute - Auth state:', { isAuthenticated: !!user, user, loading, mounted })
  }, [user, loading, mounted])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    // Clear any existing redirect timeout
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current)
      redirectTimeoutRef.current = null
    }
    
    // Only redirect after initial load and when we know user isn't authenticated
    if (mounted && !loading) {
      if (!user) {
        console.log('ProtectedRoute - User not authenticated, setting redirect timeout')
        // Add a grace period before redirecting to prevent flashing screens
        // and to allow time for auth state to be correctly updated
        redirectTimeoutRef.current = setTimeout(() => {
          // Check again if user is still not authenticated
          if (!user) {
            console.log('ProtectedRoute - Redirecting to login')
            router.replace('/login')
          }
        }, 2000) // 2 second grace period
      }
    }
    
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current)
      }
    }
  }, [mounted, loading, user, router])

  // Always render children, let them handle their own loading states
  // This prevents double loading indicators and lets page components
  // control their own UI based on auth state
  return <>{children}</>
} 