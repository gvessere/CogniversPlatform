import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Container, 
  Typography, 
  Box, 
  Card, 
  CardContent, 
  Button, 
  Grid, 
  TextField, 
  FormControlLabel, 
  Switch, 
  Alert, 
  CircularProgress,
  Snackbar,
  Chip,
  Divider,
  IconButton,
  Tooltip,
  Paper,
  Collapse
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import InfoIcon from '@mui/icons-material/Info';
import { format } from 'date-fns';
import { 
  getSession, 
  updateSession, 
  generateSessionCode,
  getQuestionnaireInstances
} from '../../../lib/api';
import { Session, QuestionnaireInstance } from '../../../lib/types';
import withAuth from '../../../components/withAuth';
import SessionForm from '../../../components/SessionForm';

// Add base URL configuration
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

function SessionDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [session, setSession] = useState<Session | null>(null);
  const [instances, setInstances] = useState<QuestionnaireInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showSessionTypeHelp, setShowSessionTypeHelp] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!id || typeof id !== 'string') return;
      
      setLoading(true);
      try {
        const sessionId = parseInt(id);
        const [sessionData, instancesData] = await Promise.all([
          getSession(sessionId),
          getQuestionnaireInstances(sessionId)
        ]);
        
        setSession(sessionData);
        setInstances(instancesData);
        setIsPublic(sessionData.is_public);
      } catch (err) {
        console.error('Error fetching session data:', err);
        setError('Failed to load session data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handlePublicToggle = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!session) return;
    
    const newIsPublic = event.target.checked;
    setIsPublic(newIsPublic);
    
    setUpdating(true);
    try {
      const updatedSession = await updateSession(session.id, {
        is_public: newIsPublic
      });
      
      setSession(updatedSession);
      setSuccess(newIsPublic 
        ? 'Session is now public' 
        : 'Session is now private with a session code');
    } catch (err) {
      console.error('Error updating session visibility:', err);
      setError('Failed to update session visibility');
      // Revert the toggle if there was an error
      setIsPublic(!newIsPublic);
    } finally {
      setUpdating(false);
    }
  };

  const handleGenerateNewCode = async () => {
    if (!session) return;
    
    setUpdating(true);
    try {
      const updatedSession = await generateSessionCode(session.id);
      setSession(updatedSession);
      setSuccess('New session code generated successfully');
    } catch (err) {
      console.error('Error generating new session code:', err);
      setError('Failed to generate new session code');
    } finally {
      setUpdating(false);
    }
  };

  const handleCopyCode = () => {
    if (!session?.session_code) return;
    
    navigator.clipboard.writeText(session.session_code)
      .then(() => {
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2000);
      })
      .catch(err => {
        console.error('Error copying code to clipboard:', err);
        setError('Failed to copy code to clipboard');
      });
  };

  const handleCopyLink = () => {
    if (!session || !session.session_code) return;
    
    // Always use session code for enrollment links
    const enrollmentLink = `${BASE_URL}/sessions/enroll?code=${session.session_code}`;
    
    navigator.clipboard.writeText(enrollmentLink)
      .then(() => {
        setSuccess('Enrollment link copied to clipboard');
      })
      .catch(err => {
        console.error('Error copying link to clipboard:', err);
        setError('Failed to copy link to clipboard');
      });
  };

  const handleCloseSnackbar = () => {
    setSuccess('');
  };

  const toggleSessionTypeHelp = () => {
    setShowSessionTypeHelp(!showSessionTypeHelp);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!session) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4 }}>
        <Alert severity="error">Session not found</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Session Details
        </Typography>
        <Button 
          variant="outlined" 
          onClick={() => router.push('/admin/sessions')}
        >
          Back to Sessions
        </Button>
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

      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h5" component="div" gutterBottom>
            {session.title}
          </Typography>
          
          <Typography variant="body1" color="text.secondary" paragraph>
            {session.description}
          </Typography>
          
          <Grid container spacing={3} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
              <Typography variant="body2">
                <strong>Start Date:</strong> {format(new Date(session.start_date), 'PPP')}
              </Typography>
              <Typography variant="body2">
                <strong>End Date:</strong> {format(new Date(session.end_date), 'PPP')}
              </Typography>
              <Typography variant="body2">
                <strong>Trainer:</strong> {session.trainer_name || 'Not assigned'}
              </Typography>
              <Typography variant="body2">
                <strong>Session Code:</strong> {session.session_code || 'Not available'}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="body2">
                <strong>Created:</strong> {format(new Date(session.created_at), 'PPP')}
              </Typography>
              <Typography variant="body2">
                <strong>Last Updated:</strong> {format(new Date(session.updated_at), 'PPP')}
              </Typography>
              <Typography variant="body2">
                <strong>Visibility:</strong> {session.is_public ? 'Public' : 'Private'}
              </Typography>
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="h6" gutterBottom>
                Session Access
              </Typography>
              <Tooltip title="Click for more information about sessions">
                <IconButton onClick={toggleSessionTypeHelp} size="small" sx={{ ml: 1 }}>
                  <HelpOutlineIcon />
                </IconButton>
              </Tooltip>
            </Box>
            
            <Collapse in={showSessionTypeHelp}>
              <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: 'background.paper' }}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 1 }}>
                  <InfoIcon color="info" sx={{ mr: 1, mt: 0.3 }} />
                  <Typography variant="subtitle1" fontWeight="bold">
                    Session Enrollment
                  </Typography>
                </Box>
                
                <Typography variant="body2" paragraph>
                  All sessions use a unique session code for enrollment. Clients can enroll in sessions
                  by entering this code in the Enroll tab of their Sessions page.
                </Typography>
                
                <Box sx={{ mt: 2, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="body2">
                    <strong>Client Experience:</strong> Clients will need to use the session code you provide or click
                    the direct enrollment link to join the session.
                  </Typography>
                </Box>
              </Paper>
            </Collapse>
            
            {/* Session Code Section */}
            <Box sx={{ mt: 2, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle1">
                  Session Code:
                </Typography>
                <Box>
                  <Tooltip title="Generate New Code">
                    <IconButton 
                      onClick={handleGenerateNewCode} 
                      disabled={updating}
                      size="small"
                    >
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Chip 
                  label={session.session_code || 'No code generated'} 
                  sx={{ fontSize: '1.2rem', py: 2, px: 1 }}
                />
                <Tooltip title={codeCopied ? "Copied!" : "Copy Code"}>
                  <IconButton 
                    onClick={handleCopyCode} 
                    disabled={!session.session_code}
                    size="small"
                    sx={{ ml: 1 }}
                  >
                    <ContentCopyIcon />
                  </IconButton>
                </Tooltip>
              </Box>
              
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'flex-start' }}>
                <InfoIcon fontSize="small" color="info" sx={{ mr: 1, mt: 0.3 }} />
                <Typography variant="body2" color="text.secondary">
                  Share this code with clients to allow them to enroll in this session. They will enter this code in the Enroll tab of their Sessions page.
                </Typography>
              </Box>
            </Box>
            
            {/* Enrollment Link Section */}
            <Box sx={{ mt: 3, p: 2, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
              <Typography variant="subtitle1" gutterBottom>
                Direct Enrollment Link
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                {session.session_code ? (
                  <TextField
                    fullWidth
                    variant="outlined"
                    size="small"
                    value={`${BASE_URL}/sessions/enroll?code=${session.session_code}`}
                    InputProps={{
                      readOnly: true,
                    }}
                  />
                ) : (
                  <Alert severity="warning" sx={{ flex: 1 }}>
                    No session code available. Generate a session code first.
                  </Alert>
                )}
                <Tooltip title={session.session_code ? "Copy Enrollment Link" : "No link available"}>
                  <span>
                    <IconButton 
                      onClick={handleCopyLink} 
                      size="small"
                      sx={{ ml: 1 }}
                      disabled={!session.session_code}
                    >
                      <ContentCopyIcon />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
              
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'flex-start' }}>
                <InfoIcon fontSize="small" color="info" sx={{ mr: 1, mt: 0.3 }} />
                <Typography variant="body2" color="text.secondary">
                  Share this link with clients for direct enrollment. When they click this link, they will be automatically enrolled in the session (if logged in) or prompted to login/signup first.
                </Typography>
              </Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Typography variant="h5" sx={{ mt: 4, mb: 2 }}>
        Questionnaires
      </Typography>
      
      {instances.length === 0 ? (
        <Alert severity="info">
          No questionnaires have been added to this session yet.
        </Alert>
      ) : (
        <Grid container spacing={3}>
          {instances.map((instance) => (
            <Grid item xs={12} md={6} key={instance.id}>
              <Card>
                <CardContent>
                  <Typography variant="h6" component="div">
                    {instance.title}
                  </Typography>
                  <Typography color="text.secondary" gutterBottom>
                    Questionnaire: {instance.questionnaire_title}
                  </Typography>
                  <Typography variant="body2">
                    Status: {instance.is_active ? 'Active' : 'Inactive'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      <Box sx={{ mt: 3 }}>
        <Button 
          variant="contained" 
          onClick={() => router.push(`/admin/sessions/${id}/questionnaires/add`)}
        >
          Add Questionnaire
        </Button>
      </Box>
    </Container>
  );
}

export default withAuth(SessionDetailPage); 