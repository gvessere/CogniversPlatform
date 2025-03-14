import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/router';
import dayjs from 'dayjs';
import { withNavigationLayout } from '../../../utils/layout';
import { 
  getSessions, 
  createSession, 
  updateSession, 
  deleteSession
} from '../../../lib/api';
import { Session, SessionCreateData, SessionUpdateData } from '../../../lib/types';
import SessionForm from '../../../components/SessionForm';

export default function SessionsList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await getSessions();
        setSessions(data);
      } catch (error) {
        console.error('Error fetching sessions:', error);
        setSnackbar({
          open: true,
          message: 'Error fetching sessions',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    // Fetch sessions
    fetchSessions();
  }, []);

  const handleCreateSession = () => {
    setOpenCreateDialog(true);
  };

  const handleEditSession = (session: Session) => {
    setSelectedSession(session);
    setOpenEditDialog(true);
  };

  const handleDeleteSession = (session: Session) => {
    setSelectedSession(session);
    setOpenDeleteDialog(true);
  };

  const handleViewSession = (id: number) => {
    router.push(`/trainer/sessions/${id}`);
  };

  const handleCloseDialogs = () => {
    setOpenCreateDialog(false);
    setOpenEditDialog(false);
    setOpenDeleteDialog(false);
  };

  const handleSubmitCreate = async (sessionData: SessionCreateData | SessionUpdateData) => {
    try {
      await createSession(sessionData as SessionCreateData);
      // Refresh the sessions list
      const updatedSessions = await getSessions();
      setSessions(updatedSessions);
      setSnackbar({
        open: true,
        message: 'Session created successfully',
        severity: 'success'
      });
      handleCloseDialogs();
    } catch (error) {
      console.error('Error creating session:', error);
      setSnackbar({
        open: true,
        message: 'Error creating session',
        severity: 'error'
      });
      throw error; // Re-throw to let the SessionForm handle the error state
    }
  };

  const handleSubmitEdit = async (sessionData: SessionCreateData | SessionUpdateData) => {
    if (!selectedSession) return;

    try {
      await updateSession(selectedSession.id, sessionData as SessionUpdateData);
      // Refresh the sessions list
      const updatedSessions = await getSessions();
      setSessions(updatedSessions);
      setSnackbar({
        open: true,
        message: 'Session updated successfully',
        severity: 'success'
      });
      handleCloseDialogs();
    } catch (error) {
      console.error(`Error updating session ${selectedSession.id}:`, error);
      setSnackbar({
        open: true,
        message: 'Error updating session',
        severity: 'error'
      });
      throw error; // Re-throw to let the SessionForm handle the error state
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedSession) return;

    try {
      await deleteSession(selectedSession.id);
      // Update the sessions list by filtering out the deleted session
      setSessions(prev => prev.filter(session => session.id !== selectedSession.id));
      setSnackbar({
        open: true,
        message: 'Session deleted successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error deleting session:', error);
      setSnackbar({
        open: true,
        message: 'Error deleting session',
        severity: 'error'
      });
    } finally {
      handleCloseDialogs();
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  return (
    <Box sx={{ my: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Training Sessions
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={handleCreateSession}
        >
          Create New Session
        </Button>
      </Box>

      {loading ? (
        <Typography>Loading sessions...</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Start Date</TableCell>
                <TableCell>End Date</TableCell>
                <TableCell>Trainer</TableCell>
                <TableCell>Session Code</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sessions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body1" sx={{ my: 2 }}>
                      No sessions found. Create your first session to get started.
                    </Typography>
                    <Button 
                      variant="outlined" 
                      startIcon={<AddIcon />}
                      onClick={handleCreateSession}
                    >
                      Create Session
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>{session.title}</TableCell>
                    <TableCell>{session.description.length > 50 
                      ? `${session.description.substring(0, 50)}...` 
                      : session.description}
                    </TableCell>
                    <TableCell>{dayjs(session.start_date).format('MMM D, YYYY')}</TableCell>
                    <TableCell>{dayjs(session.end_date).format('MMM D, YYYY')}</TableCell>
                    <TableCell>{session.trainer_name}</TableCell>
                    <TableCell>{session.session_code || 'Not available'}</TableCell>
                    <TableCell>
                      <Tooltip title="View">
                        <IconButton 
                          size="small" 
                          onClick={() => handleViewSession(session.id)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton 
                          size="small" 
                          onClick={() => handleEditSession(session)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleDeleteSession(session)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create Session Dialog */}
      <Dialog open={openCreateDialog} onClose={handleCloseDialogs} maxWidth="md" fullWidth>
        <DialogTitle>Create New Session</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <SessionForm
              initialData={{ trainer_id: user?.id || 0 }}
              onSubmit={handleSubmitCreate}
              onCancel={handleCloseDialogs}
              submitLabel="Create"
            />
          </Box>
        </DialogContent>
      </Dialog>

      {/* Edit Session Dialog */}
      <Dialog open={openEditDialog} onClose={handleCloseDialogs} maxWidth="md" fullWidth>
        <DialogTitle>Edit Session</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {selectedSession && (
              <SessionForm
                initialData={selectedSession}
                onSubmit={handleSubmitEdit}
                onCancel={handleCloseDialogs}
                submitLabel="Update"
                isEdit={true}
              />
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={handleCloseDialogs}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the session &quot;{selectedSession?.title}&quot;? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialogs}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Apply the navigation layout
SessionsList.getLayout = withNavigationLayout; 