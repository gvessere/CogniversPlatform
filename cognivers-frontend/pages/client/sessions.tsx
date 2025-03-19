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
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { useRouter } from 'next/router';
import { format } from 'date-fns';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import InfoIcon from '@mui/icons-material/Info';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { useAuth } from '../../context/AuthContext';
import { 
  enroll,
  getClientEnrollments,
  unenrollFromSession
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
  const [unenrollDialogOpen, setUnenrollDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<ClientSessionEnrollment | null>(null);

  // Fetch enrolled sessions
  useEffect(() => {
    const fetchData = async () => {
      console.log('Fetching enrolled sessions, user:', user);
      setLoading(true);
      try {
        if (user) {
          console.log('Making API call to get enrollments for user ID:', user.id);
          const enrolledData = await getClientEnrollments(user.id);
          console.log('Received enrolled sessions data:', enrolledData);
          setEnrolledSessions(enrolledData);
        } else {
          console.log('No user data available, skipping API call');
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

  const handleEnrollInSession = async () => {
    if (!sessionCode.trim()) {
      setError('Please enter a session code');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await enroll(sessionCode);
      setSuccess('Successfully enrolled in session!');
      setSessionCode('');
      
      // Refresh enrolled sessions
      if (user) {
        const enrolledData = await getClientEnrollments(user.id);
        setEnrolledSessions(enrolledData);
      }
      
      // Switch to the enrolled sessions tab
      setTabValue(0);
    } catch (err: any) {
      console.error('Error enrolling in session:', err);
      setError(err.message || 'An error occurred while enrolling in the session.');
    } finally {
      setLoading(false);
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

  const handleUnenrollClick = (session: ClientSessionEnrollment) => {
    setSelectedSession(session);
    setUnenrollDialogOpen(true);
  };

  const handleUnenrollConfirm = async () => {
    if (!selectedSession || !user) return;

    try {
      await unenrollFromSession(user.id, selectedSession.session_id);
      setSuccess('Successfully unenrolled from session');
      // Refresh enrolled sessions
      const enrolledData = await getClientEnrollments(user.id);
      setEnrolledSessions(enrolledData);
    } catch (err: any) {
      console.error('Error unenrolling from session:', err);
      setError(err.message || 'Failed to unenroll from session');
    } finally {
      setUnenrollDialogOpen(false);
      setSelectedSession(null);
    }
  };

  const handleUnenrollCancel = () => {
    setUnenrollDialogOpen(false);
    setSelectedSession(null);
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
                            sx={{ mr: 1 }}
                          >
                            View Session
                          </Button>
                          <Tooltip title="Unenroll from session">
                            <IconButton
                              size="small"
                              onClick={() => handleUnenrollClick(enrollment)}
                              color="error"
                            >
                              <ExitToAppIcon />
                            </IconButton>
                          </Tooltip>
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
              
              <Box component="form" onSubmit={(e) => { e.preventDefault(); handleEnrollInSession(); }} sx={{ maxWidth: 400, mx: 'auto' }}>
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
                  inputProps={{ 
                    maxLength: 6,
                    autoComplete: "on"
                  }}
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

      {/* Unenroll Confirmation Dialog */}
      <Dialog
        open={unenrollDialogOpen}
        onClose={handleUnenrollCancel}
      >
        <DialogTitle>Confirm Unenroll</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to unenroll from the session "{selectedSession?.session_title}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleUnenrollCancel}>Cancel</Button>
          <Button onClick={handleUnenrollConfirm} color="error" variant="contained">
            Unenroll
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

// Apply the withNavigationLayout HOC to enable navigation layout
ClientSessionsPage.getLayout = withNavigationLayout; 