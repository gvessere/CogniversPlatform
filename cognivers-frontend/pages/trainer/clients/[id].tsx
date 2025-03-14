import { 
  Typography, 
  Paper,
  Alert,
  Box,
  Divider,
  List,
  ListItem,
  ListItemText,
  Button,
  CircularProgress
} from '@mui/material';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { withNavigationLayout } from '../../../utils/layout';
import { User, UserRole } from '../../../lib/types';
import { handleAsyncError } from '../../../utils/errorUtils';
import { getData } from '../../../lib/api';

export default function ClientDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const [client, setClient] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect if user is not a trainer or administrator
  useEffect(() => {
    if (user && user.role !== UserRole.TRAINER && user.role !== UserRole.ADMINISTRATOR) {
      router.push('/portal');
    }
  }, [user, router]);

  // Fetch client details
  useEffect(() => {
    const fetchClient = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const client = await getData<User>(`/api/users/${id}`);
        setClient(client);
        setError(null);
      } catch (err) {
        handleAsyncError(err, setError, 'Failed to load client details');
      } finally {
        setLoading(false);
      }
    };

    fetchClient();
  }, [id]);

  const handleBack = () => {
    router.push('/trainer/clients');
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <ProtectedRoute>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={handleBack}
          sx={{ mb: 3 }}
        >
          Back to Clients
        </Button>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {client ? (
          <Box>
            <Typography variant="h4" gutterBottom>
              {client.first_name} {client.last_name}
            </Typography>
            
            <Divider sx={{ my: 3 }} />
            
            <Typography variant="h6" gutterBottom>
              Client Details
            </Typography>
            
            <List>
              <ListItem>
                <ListItemText 
                  primary="Email" 
                  secondary={client.email} 
                />
              </ListItem>
              
              <ListItem>
                <ListItemText 
                  primary="Role" 
                  secondary={client.role} 
                />
              </ListItem>
              
              {client.dob && (
                <ListItem>
                  <ListItemText 
                    primary="Date of Birth" 
                    secondary={format(new Date(client.dob), 'MMMM d, yyyy')} 
                  />
                </ListItem>
              )}
            </List>
            
            <Divider sx={{ my: 3 }} />
            
            <Box>
              <Typography variant="h6" gutterBottom>
                Questionnaires
              </Typography>
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => router.push(`/trainer/questionnaires?client=${client.id}`)}
              >
                View Questionnaires
              </Button>
            </Box>
          </Box>
        ) : (
          <Alert severity="info">Client not found</Alert>
        )}
      </Paper>
    </ProtectedRoute>
  );
}

// Add the getLayout function to the ClientDetailPage component
ClientDetailPage.getLayout = withNavigationLayout; 