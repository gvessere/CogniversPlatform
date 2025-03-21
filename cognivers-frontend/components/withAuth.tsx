import React from 'react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';

// Higher-order component to protect routes that require authentication
export default function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function WithAuth(props: P) {
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      // If not loading and no user, redirect to login
      if (!loading && !user) {
        router.replace('/login');
      }
    }, [user, loading, router]);

    // Show loading state while checking authentication
    if (loading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <CircularProgress />
        </Box>
      );
    }

    // If authenticated, render the protected component
    if (user) {
      return <Component {...props} />;
    }

    // Return null while redirecting
    return null;
  };
} 