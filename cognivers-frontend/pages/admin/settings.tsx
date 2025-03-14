import { 
  Typography, 
  Paper
} from '@mui/material';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { withNavigationLayout } from '../../utils/layout';
import { UserRole } from '../../lib/types';

export default function SystemSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Redirect if user is not an administrator
  useEffect(() => {
    if (user && user.role !== UserRole.ADMINISTRATOR) {
      router.push('/portal');
    }
  }, [user, router]);

  return (
    <ProtectedRoute>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          System Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Configure system-wide settings and preferences.
        </Typography>
      </Paper>
    </ProtectedRoute>
  );
}

SystemSettingsPage.getLayout = withNavigationLayout; 