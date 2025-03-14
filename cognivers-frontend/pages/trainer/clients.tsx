import { 
  Typography, 
  Paper,
  Alert,
  Snackbar
} from '@mui/material';
import ProtectedRoute from '../../components/ProtectedRoute';
import UserList from '../../components/UserList/UserList';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { withNavigationLayout } from '../../utils/layout';
import { handleAsyncError } from '../../utils/errorUtils';
import { User, UserRole } from '../../lib/types';
import { getData } from '../../lib/api';

export default function MyClientsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [clients, setClients] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snackbarMessage, setSnackbarMessage] = useState<string | null>(null);
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  // Redirect if user is not a trainer or administrator
  useEffect(() => {
    if (user && user.role !== UserRole.TRAINER && user.role !== UserRole.ADMINISTRATOR) {
      router.push('/portal');
    }
  }, [user, router]);

  // Fetch clients
  const fetchClients = async () => {
    try {
      setLoading(true);
      const clients = await getData<User[]>('/api/users/clients');
      setClients(clients);
      setError(null);
    } catch (err) {
      handleAsyncError(err, setError, 'Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  // Fetch clients on component mount
  useEffect(() => {
    fetchClients();
  }, []);

  const handleClientSelect = (selectedClient: User) => {
    // Navigate to client details or training plan
    router.push(`/trainer/clients/${selectedClient.id}`);
  };

  const handleSnackbarClose = () => {
    setSnackbarMessage(null);
    setSnackbarSeverity('success');
  };

  return (
    <ProtectedRoute>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          My Clients
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          View and manage your client list.
        </Typography>

        {/* Error Alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Client List */}
        <UserList
          users={clients}
          isAdmin={false}
          onUserSelect={handleClientSelect}
          loading={loading}
          onRefresh={fetchClients}
          currentUserRole={user?.role || ''}
        />
      </Paper>

      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
      >
        <Alert 
          onClose={handleSnackbarClose} 
          severity={snackbarSeverity} 
          variant="filled" 
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </ProtectedRoute>
  );
}

MyClientsPage.getLayout = withNavigationLayout; 