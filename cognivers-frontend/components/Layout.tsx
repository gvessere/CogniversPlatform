import { useRouter } from 'next/router';
import { useAuth } from '../context/AuthContext';
import { useEffect } from 'react';
import Link from 'next/link';
import { Box, Container, Typography, AppBar, Toolbar, Button, Link as MuiLink } from '@mui/material';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps): React.ReactElement => {
  const router = useRouter();
  const { user } = useAuth();
  
  // Debug user state
  useEffect(() => {
    console.log('Layout - Auth state:', { isAuthenticated: !!user, user });
  }, [user]);

  // If we're on the portal page which requires auth but user isn't authenticated, 
  // return only the children so ProtectedRoute can handle the redirect
  if (router.pathname === '/portal' && !user) {
    return <>{children}</>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Navigation Bar */}
      <AppBar position="static" color="primary">
        <Toolbar>
          <Container maxWidth="lg" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 'bold' }}>
              Cognivers
            </Typography>
            
            {!user && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  color="inherit"
                  component={Link}
                  href="/login"
                  sx={{ '&:hover': { color: 'primary.light' } }}
                >
                  Login
                </Button>
                <Button
                  color="inherit"
                  component={Link}
                  href="/signup"
                  sx={{ '&:hover': { color: 'primary.light' } }}
                >
                  Sign Up
                </Button>
              </Box>
            )}
          </Container>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1 }}>
        <Container maxWidth="lg" sx={{ pt: 1, pb: 2 }}>
          {children}
        </Container>
      </Box>

      {/* Footer */}
      <Box component="footer" sx={{ bgcolor: 'grey.900', color: 'white', py: 3 }}>
        <Container maxWidth="lg">
          <Typography variant="body2" align="center">
            &copy; {new Date().getFullYear()} Cognivers. All rights reserved.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
};

export default Layout; 