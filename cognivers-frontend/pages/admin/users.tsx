import { 
  Typography, 
  Paper,
  Alert,
  Snackbar,
  CircularProgress,
  Box
} from '@mui/material';
import ProtectedRoute from '../../components/ProtectedRoute';
import UserList from '../../components/UserList/UserList';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { withNavigationLayout } from '../../utils/layout';
import { User, UserRole } from '../../lib/types';
import { handleAsyncError } from '../../utils/errorUtils';
import { hasRole } from '../../lib/auth';
import { getData, patchData } from '../../lib/api';

/**
 * Admin-only page for user management
 */
export default function UserManagementPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  // Check admin access after auth is loaded
  useEffect(() => {
    // Only check access when auth is no longer loading
    if (!authLoading) {
      if (!user) {
        // If no user, let ProtectedRoute handle redirect to login
        return;
      }
      
      // Use the hasRole utility function to check if user is admin
      if (!hasRole(user, UserRole.ADMINISTRATOR)) {
        // Set access denied state instead of immediate redirect
        setAccessDenied(true);
        
        // Delayed redirect to give time for message to be displayed
        const timer = setTimeout(() => {
          router.push('/portal');
        }, 3000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [user, authLoading, router]);

  // Fetch users data
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const users = await getData<User[]>('/api/users');
      setUsers(users);
    } catch (error: unknown) {
      // Handle 401/403 errors specifically
      const err = error as { response?: { status: number } };
      if (err.response && (err.response.status === 401 || err.response.status === 403)) {
        setError('You do not have permission to view user data. Please ensure you are logged in as an administrator.');
      } else {
        handleAsyncError(error, setError, 'Failed to load users');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Call fetchUsers in useEffect when we know user is an admin
  useEffect(() => {
    // Use the hasRole utility function
    if (user && hasRole(user, UserRole.ADMINISTRATOR) && !accessDenied) {
      fetchUsers();
    }
  }, [user, accessDenied]);

  const handleRoleChange = async (userId: number, newRole: UserRole) => {
    try {
      await patchData(`/api/users/${userId}`, { role: newRole });
      setUsers(users.map(u => 
        u.id === userId ? { ...u, role: newRole } : u
      ));
      setSuccessMessage('User role updated successfully');
    } catch (err) {
      handleAsyncError(err, setError, 'Failed to update user role');
    }
  };

  const handleUserSelect = (selectedUser: User) => {
    // Handle user selection - can be expanded later
    console.log('Selected user:', selectedUser);
  };

  const handleSnackbarClose = () => {
    setSuccessMessage(null);
  };

  // Show specific content based on state
  const renderContent = () => {
    if (authLoading) {
      return (
        <Box display="flex" justifyContent="center" alignItems="center" height="50vh">
          <CircularProgress />
        </Box>
      );
    }
    
    if (accessDenied) {
      return (
        <Alert severity="error" sx={{ mb: 3 }}>
          Access denied. You need administrator privileges to view this page. Redirecting to portal...
        </Alert>
      );
    }
    
    if (!user) {
      return null; // Let ProtectedRoute handle this case
    }
    
    return (
      <>
        <Typography variant="h4" component="h1" gutterBottom>
          User Management
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          View and manage all users in the system.
        </Typography>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* User List */}
        <UserList
          users={users}
          isAdmin={true}
          onRoleChange={handleRoleChange}
          onUserSelect={handleUserSelect}
          loading={loading}
          onRefresh={fetchUsers}
          currentUserRole={user?.role || ''}
        />
      </>
    );
  };

  return (
    <ProtectedRoute>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        {renderContent()}
      </Paper>

      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity="success" 
          variant="filled" 
          sx={{ width: '100%' }}
        >
          {successMessage}
        </Alert>
      </Snackbar>
    </ProtectedRoute>
  );
}

UserManagementPage.getLayout = withNavigationLayout; 