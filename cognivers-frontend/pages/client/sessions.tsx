import { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  CardActions, 
  Button, 
  Grid, 
  TextField, 
  Divider, 
  Tabs, 
  Tab, 
  Alert, 
  CircularProgress,
  Snackbar,
  Paper,
  IconButton,
  Tooltip,
  Collapse
} from '@mui/material';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import InfoIcon from '@mui/icons-material/Info';
import { useAuth } from '../../hooks/useAuth';
import { 
  enroll,
  getClientEnrollments 
} from '../../lib/api';
import { ClientSessionEnrollment } from '../../lib/types';
import { withNavigationLayout } from '../../utils/layout';

export default function ClientSessionsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [enrolledSessions, setEnrolledSessions] = useState<ClientSessionEnrollment[]>([]);
  const [sessionCode, setSessionCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  // Fetch enrolled sessions
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (user) {
          console.log('Fetching enrollments for user:', user.id);
          const enrolledData = await getClientEnrollments(user.id);
          console.log('Received enrollment data:', enrolledData);
          setEnrolledSessions(enrolledData);
        }
      } catch (err) {
        console.error('Error fetching sessions:', err);
        setError('Failed to load sessions. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEnrollInSession = async (sessionCode: string) => {
    if (!sessionCode.trim()) {
      setError('Please enter a session code');
      return;
    }

    setJoinLoading(true);
    setError('');
    try {
      await enroll(sessionCode);
      setSuccess('Successfully enrolled in session!');
      setSessionCode('');
      
      // Refresh enrolled sessions
      if (user) {
        const enrolledData = await getClientEnrollments(user.id);
        setEnrolledSessions(enrolledData);
      }
    } catch (err: any) {
      console.error('Error enrolling in session:', err);
      
      // Special handling for "already enrolled" error
      if (err.message?.includes('already enrolled')) {
        // Treat as success with a different message
        setSuccess('You are already enrolled in this session!');
        setSessionCode('');
        
        // Still refresh enrollments to ensure they're up to date
        if (user) {
          try {
            const enrolledData = await getClientEnrollments(user.id);
            setEnrolledSessions(enrolledData);
          } catch (refreshErr) {
            console.error('Error refreshing enrollments:', refreshErr);
          }
        }
      } else {
        // Handle other errors as usual
        setError(err.message || 'Invalid session code. Please try again.');
      }
    } finally {
      setJoinLoading(false);
    }
  };

  const handleViewSession = (sessionId: number) => {
    router.push(`/client/session/${sessionId}`);
  };

  const handleCloseSnackbar = () => {
    setSuccess('');
  };

  const toggleHelp = () => {
    setShowHelp(!showHelp);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          My Sessions
        </Typography>
        <Tooltip title="Learn about sessions">
          <IconButton onClick={toggleHelp} color="primary">
            <HelpOutlineIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Collapse in={showHelp}>
        <Paper sx={{ p: 2, mb: 3, bgcolor: '#f8f9fa' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
            <InfoIcon color="info" sx={{ mr: 1, mt: 0.3 }} />
            <Typography variant="subtitle1" fontWeight="bold">
              About Sessions
            </Typography>
          </Box>
          
          <Typography variant="body2" paragraph>
            Sessions are training or assessment periods created by trainers. You can enroll in any available session using a session code provided by your trainer.
          </Typography>
          
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              Once you've enrolled in a session, you'll be able to access all questionnaires associated with that session.
            </Typography>
          </Box>
        </Paper>
      </Collapse>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="session tabs">
          <Tab label="My Enrolled Sessions" />
          <Tab label="Enroll in a Session" />
        </Tabs>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Snackbar
        open={!!success}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        message={success}
      />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Tab 1: Enrolled Sessions */}
          {tabValue === 0 && (
            <>
              {enrolledSessions.length === 0 ? (
                <Alert severity="info">
                  You are not enrolled in any sessions yet. Enroll in a session to get started!
                </Alert>
              ) : (
                <Grid container spacing={3}>
                  {enrolledSessions.map((enrollment) => (
                    <Grid item xs={12} md={6} key={enrollment.id}>
                      <Card>
                        <CardContent>
                          <Typography variant="h6" component="div">
                            {enrollment.session_title}
                          </Typography>
                          <Typography color="text.secondary" gutterBottom>
                            Status: {enrollment.status.charAt(0).toUpperCase() + enrollment.status.slice(1)}
                          </Typography>
                          <Typography variant="body2">
                            Enrolled on: {format(new Date(enrollment.enrolled_at), 'PPP')}
                          </Typography>
                        </CardContent>
                        <CardActions>
                          <Button 
                            size="small" 
                            variant="contained"
                            onClick={() => handleViewSession(enrollment.session_id)}
                          >
                            View Session
                          </Button>
                        </CardActions>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </>
          )}

          {/* Tab 2: Enroll in a Session */}
          {tabValue === 1 && (
            <>
              <Box sx={{ mb: 3 }}>
                <Alert severity="info" icon={<InfoIcon />}>
                  Enter the session code provided by your trainer to enroll in a session.
                </Alert>
              </Box>
              
              <Box component="form" onSubmit={(e) => { e.preventDefault(); handleEnrollInSession(sessionCode); }} sx={{ maxWidth: 400, mx: 'auto' }}>
                <Typography variant="h6" gutterBottom>
                  Enroll in a Session
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Enter the session code provided by your trainer to enroll in a session.
                </Typography>
                
                <TextField
                  fullWidth
                  label="Session Code"
                  variant="outlined"
                  value={sessionCode}
                  onChange={(e) => setSessionCode(e.target.value)}
                  placeholder="Enter 6-digit code"
                  margin="normal"
                  inputProps={{ maxLength: 6 }}
                />
                
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  sx={{ mt: 2 }}
                  disabled={joinLoading || !sessionCode.trim()}
                >
                  {joinLoading ? <CircularProgress size={24} /> : 'Enroll in Session'}
                </Button>
              </Box>
            </>
          )}
        </>
      )}
    </Container>
  );
}

// Apply the withNavigationLayout HOC to enable navigation layout
ClientSessionsPage.getLayout = withNavigationLayout; 