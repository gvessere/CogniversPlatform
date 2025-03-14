import { useState } from 'react';
import { useRouter } from 'next/router';
import { 
  Container, 
  Typography, 
  Box, 
  Alert, 
  Paper,
  Button
} from '@mui/material';
import { createSession } from '../../../lib/api';
import { SessionCreateData, SessionUpdateData } from '../../../lib/types';
import withAuth from '../../../components/withAuth';
import SessionForm from '../../../components/SessionForm';

function CreateSessionPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  const handleSubmit = async (sessionData: SessionCreateData | SessionUpdateData) => {
    try {
      // Since we're creating a session, we can safely cast the data
      await createSession(sessionData as SessionCreateData);
      router.push('/admin/sessions');
    } catch (err: any) {
      console.error('Error creating session:', err);
      setError(err.message || 'Failed to create session. Please try again.');
      throw err; // Re-throw to let the form component handle the error state
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Create New Session
        </Typography>
        <Button 
          variant="outlined" 
          onClick={() => router.push('/admin/sessions')}
        >
          Cancel
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <SessionForm 
          onSubmit={handleSubmit}
          onCancel={() => router.push('/admin/sessions')}
          submitLabel="Create Session"
        />
      </Paper>
    </Container>
  );
}

export default withAuth(CreateSessionPage); 