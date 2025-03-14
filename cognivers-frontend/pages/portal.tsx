// pages/portal.tsx
import { ReactElement } from 'react'
import ProtectedRoute from '../components/ProtectedRoute'
import { useAuth } from '../context/AuthContext'
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress, 
  Paper,
  Button
} from '@mui/material'
import { useEffect } from 'react'
import { withNavigationLayout } from '../utils/layout'
import { User } from '../lib/types'

// Helper function to safely get user display name
function getUserDisplayName(user: User | null): string {
  if (!user) return 'User';
  
  // Return full name if both first and last name are available
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  
  // Fallback to email if names are not available
  return user.email || 'User';
}

export default function Portal(): ReactElement {
  const { user, loading } = useAuth()
  
  // Debug the auth state
  useEffect(() => {
    console.log('Portal page - Auth state:', { 
      user, 
      loading,
      userKeys: user ? Object.keys(user) : []
    })
  }, [user, loading])

  return (
    <ProtectedRoute>
      {loading ? (
        <Container sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={60} />
        </Container>
      ) : user ? (
        <Paper elevation={3} sx={{ p: 3, borderRadius: 2, minHeight: '300px' }}>
          <Typography variant="h4" gutterBottom>
            Hello, {getUserDisplayName(user)}
          </Typography>
          <Typography variant="body1" sx={{ mb: 4 }}>
            Here you can manage your account settings and preferences.
          </Typography>
          <Typography variant="body1">
            Please select an option from the menu on the left to:
          </Typography>
          <Box component="ul" sx={{ mt: 2, pl: 2 }}>
            <li>Update your profile information</li>
            <li>Change your password</li>
            <li>Manage your mailing address</li>
          </Box>
        </Paper>
      ) : (
        <Container sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h5" color="error">
            You must be logged in to view this page
          </Typography>
          <Button 
            variant="contained" 
            color="primary"
            sx={{ mt: 3 }}
            onClick={() => window.location.href = '/login'}
          >
            Go to Login
          </Button>
        </Container>
      )}
    </ProtectedRoute>
  )
}

Portal.getLayout = withNavigationLayout;