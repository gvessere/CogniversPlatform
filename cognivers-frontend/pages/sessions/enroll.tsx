import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Container, 
  Typography, 
  Box, 
  Alert, 
  CircularProgress,
  Paper,
  Button
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { enroll, getSession } from '../../lib/api';
import { Session } from '../../lib/types';

export default function SessionEnrollPage() {
  const router = useRouter();
  const { code } = router.query;
  const { user, loading: authLoading } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    // Only process after authentication is determined and we have query params
    if (authLoading || !code) return;

    // If not authenticated, save link in sessionStorage and redirect to login
    if (!user) {
      // Store enrollment info in sessionStorage
      sessionStorage.setItem('pendingEnrollment', JSON.stringify({ code }));
      
      // Redirect to login with returnUrl set to this page
      router.push(`/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    // If we have a returnUrl query param, the user just logged in, so remove that from the URL
    if (router.query.returnUrl) {
      // Update the URL without the returnUrl
      const newUrl = window.location.pathname + 
        window.location.search.replace(/(\?|&)returnUrl=[^&]*(&|$)/, '$1').replace(/\?$/, '');
      router.replace(newUrl, undefined, { shallow: true });
    }

    const enrollInSession = async () => {
      setLoading(true);
      try {
        await handleEnroll();
      } catch (err: any) {
        console.error('Error enrolling in session:', err);
        setError(err.message || 'Failed to enroll in session.');
      } finally {
        setLoading(false);
      }
    };

    enrollInSession();
  }, [code, authLoading, user, router]);

  const handleEnroll = async () => {
    if (!user || enrolling || !code) return;

    setEnrolling(true);
    setError('');
    
    try {
      // Enroll in session by code
      const enrollmentData = await enroll(code as string);
      
      // Get the session details
      if (enrollmentData.session_id) {
        try {
          const sessionData = await getSession(enrollmentData.session_id);
          setSession(sessionData);
        } catch (e) {
          console.error('Error fetching session after enrollment:', e);
          // Continue anyway, we've already enrolled successfully
        }
      }
      
      setSuccess(true);

      // Remove the code from the URL
      router.replace('/sessions/enroll', undefined, { shallow: true });
      
      // Clear any pending enrollment info
      sessionStorage.removeItem('pendingEnrollment');
    } catch (err: any) {
      console.error('Error enrolling in session:', err);
      
      // Handle "already enrolled" case as a success rather than an error
      if (err.message && err.message.includes('already enrolled')) {
        // Treat "already enrolled" as a success case
        setSuccess(true);
        
        // Try to get the session info from the error response if possible
        if (err.sessionId) {
          try {
            const sessionData = await getSession(err.sessionId);
            setSession(sessionData);
          } catch (e) {
            console.error('Error fetching session after finding already enrolled:', e);
          }
        }
        
        // Remove the code from the URL
        router.replace('/sessions/enroll', undefined, { shallow: true });
        
        // Clear any pending enrollment info
        sessionStorage.removeItem('pendingEnrollment');
      } else {
        // For other errors, show the error message
        setError(err.message || 'Failed to enroll in session. Please try again.');
      }
    } finally {
      setEnrolling(false);
    }
  };

  const handleGoToSessions = () => {
    router.push('/client/sessions');
  };

  if (authLoading || loading) {
    return (
      <Container maxWidth="md" sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ mt: 2 }}>
          {authLoading ? 'Checking authentication...' : 'Processing enrollment...'}
        </Typography>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ mt: 6, mb: 8 }}>
      <Paper elevation={3} sx={{ p: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {success ? 'Enrollment Successful' : 'Session Enrollment'}
        </Typography>

        {error && (
          <Alert severity="error" sx={{ my: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Box sx={{ my: 3 }}>
            <Alert severity="success" sx={{ mb: 3 }}>
              You have been successfully enrolled in the session{session ? ` "${session.title}"` : ''}.
            </Alert>
            
            {session && (
              <Box sx={{ my: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {session.title}
                </Typography>
                <Typography variant="body1" paragraph>
                  {session.description}
                </Typography>
                <Typography variant="body2">
                  <strong>Start Date:</strong> {new Date(session.start_date).toLocaleDateString()}
                </Typography>
                <Typography variant="body2">
                  <strong>End Date:</strong> {new Date(session.end_date).toLocaleDateString()}
                </Typography>
                <Typography variant="body2">
                  <strong>Trainer:</strong> {session.trainer_name || 'Not specified'}
                </Typography>
              </Box>
            )}
            
            <Box sx={{ mt: 4 }}>
              <Button
                variant="contained"
                color="primary"
                size="large"
                onClick={handleGoToSessions}
              >
                Go to My Sessions
              </Button>
            </Box>
          </Box>
        )}

        {!success && !error && !code && (
          <Box sx={{ my: 3 }}>
            <Alert severity="warning">
              No session code provided. Please use a valid session enrollment link.
            </Alert>
          </Box>
        )}

        {!success && !error && code && (
          <Box sx={{ my: 3, textAlign: 'center' }}>
            <CircularProgress />
            <Typography variant="body1" sx={{ mt: 2 }}>
              Processing your enrollment request...
            </Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );
} 