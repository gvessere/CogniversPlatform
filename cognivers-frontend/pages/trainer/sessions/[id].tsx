import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  SelectChangeEvent,
  Grid,
  Card,
  CardContent,
  CardActions,
  Switch,
  FormControlLabel,
  Divider,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useRouter } from 'next/router';
import dayjs from 'dayjs';
import { withNavigationLayout } from '../../../utils/layout';
import { 
  getSession,
  getQuestionnaireInstances,
  createQuestionnaireInstance,
  updateQuestionnaireInstance,
  deleteQuestionnaireInstance,
  activateQuestionnaireInstance,
  deactivateQuestionnaireInstance
} from '../../../lib/api';
import { Session, QuestionnaireInstance, Questionnaire } from '../../../lib/types';

export default function SessionDetail() {
  const [session, setSession] = useState<Session | null>(null);
  const [instances, setInstances] = useState<QuestionnaireInstance[]>([]);
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState<QuestionnaireInstance | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    questionnaire_id: 0,
    is_active: false
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    const fetchSessionData = async () => {
      if (!id || typeof id !== 'string') return;
      
      try {
        setLoading(true);
        const sessionId = parseInt(id);
        
        // Fetch session details
        const sessionData = await getSession(sessionId);
        if (sessionData) {
          setSession(sessionData);
        }
        
        // Fetch questionnaire instances for this session
        const instancesData = await getQuestionnaireInstances(sessionId);
        if (instancesData) {
          setInstances(instancesData);
        }
        
        // Mock questionnaires data for now - in a real app, you would fetch this from the API
        // TODO: Replace with actual API call to get questionnaires
        setQuestionnaires([
          { 
            id: 1, 
            title: 'Customer Satisfaction Survey', 
            description: 'Feedback survey', 
            type: 'survey',
            is_paginated: false,
            requires_completion: true,
            number_of_attempts: 1,
            created_by_id: 1, 
            created_at: '2023-01-01',
            updated_at: '2023-01-01',
            questions: [] 
          },
          { 
            id: 2, 
            title: 'Training Evaluation', 
            description: 'Evaluate training effectiveness', 
            type: 'evaluation',
            is_paginated: false,
            requires_completion: true,
            number_of_attempts: 1,
            created_by_id: 1, 
            created_at: '2023-01-01',
            updated_at: '2023-01-01',
            questions: [] 
          },
          { 
            id: 3, 
            title: 'Skills Assessment', 
            description: 'Assess participant skills', 
            type: 'assessment',
            is_paginated: false,
            requires_completion: true,
            number_of_attempts: 1,
            created_by_id: 1, 
            created_at: '2023-01-01',
            updated_at: '2023-01-01',
            questions: [] 
          }
        ]);
      } catch (error) {
        console.error('Error fetching session data:', error);
        setSnackbar({
          open: true,
          message: 'Error fetching session data',
          severity: 'error'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSessionData();
  }, [id]);

  const handleBack = () => {
    router.push('/trainer/sessions');
  };

  const handleCreateInstance = () => {
    setFormData({
      title: '',
      questionnaire_id: 0,
      is_active: false
    });
    setOpenCreateDialog(true);
  };

  const handleEditInstance = (instance: QuestionnaireInstance) => {
    setSelectedInstance(instance);
    setFormData({
      title: instance.title,
      questionnaire_id: instance.questionnaire_id,
      is_active: instance.is_active
    });
    setOpenEditDialog(true);
  };

  const handleDeleteInstance = (instance: QuestionnaireInstance) => {
    setSelectedInstance(instance);
    setOpenDeleteDialog(true);
  };

  const handleCloseDialogs = () => {
    setOpenCreateDialog(false);
    setOpenEditDialog(false);
    setOpenDeleteDialog(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleQuestionnaireChange = (e: SelectChangeEvent<number>) => {
    setFormData(prev => ({ ...prev, questionnaire_id: e.target.value as number }));
  };

  const handleActiveChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, is_active: e.target.checked }));
  };

  const handleSubmitCreate = async () => {
    if (!session) return;

    try {
      const instanceData = {
        title: formData.title,
        questionnaire_id: formData.questionnaire_id,
        is_active: formData.is_active
      };

      const newInstance = await createQuestionnaireInstance(session.id, instanceData);
      if (newInstance) {
        setInstances(prev => [...prev, newInstance]);
        setSnackbar({
          open: true,
          message: 'Questionnaire instance created successfully',
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Error creating questionnaire instance:', error);
      setSnackbar({
        open: true,
        message: 'Error creating questionnaire instance',
        severity: 'error'
      });
    } finally {
      handleCloseDialogs();
    }
  };

  const handleSubmitEdit = async () => {
    if (!selectedInstance) return;

    try {
      const instanceData = {
        title: formData.title,
        is_active: formData.is_active
      };

      const updatedInstance = await updateQuestionnaireInstance(selectedInstance.id, instanceData);
      if (updatedInstance) {
        setInstances(prev => 
          prev.map(instance => 
            instance.id === updatedInstance.id ? updatedInstance : instance
          )
        );
        setSnackbar({
          open: true,
          message: 'Questionnaire instance updated successfully',
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Error updating questionnaire instance:', error);
      setSnackbar({
        open: true,
        message: 'Error updating questionnaire instance',
        severity: 'error'
      });
    } finally {
      handleCloseDialogs();
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedInstance) return;

    try {
      await deleteQuestionnaireInstance(selectedInstance.id);
      setInstances(prev => prev.filter(instance => instance.id !== selectedInstance.id));
      setSnackbar({
        open: true,
        message: 'Questionnaire instance deleted successfully',
        severity: 'success'
      });
    } catch (error) {
      console.error('Error deleting questionnaire instance:', error);
      setSnackbar({
        open: true,
        message: 'Error deleting questionnaire instance',
        severity: 'error'
      });
    } finally {
      handleCloseDialogs();
    }
  };

  const handleToggleActive = async (instance: QuestionnaireInstance) => {
    if (!session) {
      throw new Error('Session not found');
    }

    try {
      let updatedInstance;
      
      if (instance.is_active) {
        updatedInstance = await deactivateQuestionnaireInstance(session.id, instance.id);
      } else {
        updatedInstance = await activateQuestionnaireInstance(session.id, instance.id);
      }
      
      if (updatedInstance) {
        setInstances(prev => 
          prev.map(item => 
            item.id === updatedInstance.id ? updatedInstance : item
          )
        );
        setSnackbar({
          open: true,
          message: `Questionnaire ${updatedInstance.is_active ? 'activated' : 'deactivated'} successfully`,
          severity: 'success'
        });
      }
    } catch (error) {
      console.error('Error toggling questionnaire instance status:', error);
      setSnackbar({
        open: true,
        message: 'Error updating questionnaire instance status',
        severity: 'error'
      });
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  if (loading) {
    return <Typography>Loading session details...</Typography>;
  }

  if (!session) {
    return (
      <Box sx={{ my: 4 }}>
        <Typography variant="h5" color="error">Session not found</Typography>
        <Button 
          startIcon={<ArrowBackIcon />} 
          onClick={handleBack}
          sx={{ mt: 2 }}
        >
          Back to Sessions
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ my: 4 }}>
      <Button 
        startIcon={<ArrowBackIcon />} 
        onClick={handleBack}
        sx={{ mb: 3 }}
      >
        Back to Sessions
      </Button>
      
      <Typography variant="h4" component="h1" gutterBottom>
        {session.title}
      </Typography>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" fontWeight="bold">Description</Typography>
            <Typography paragraph>{session.description}</Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle1" fontWeight="bold">Session Details</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography>
                <strong>Start Date:</strong> {dayjs(session.start_date).format('MMM D, YYYY h:mm A')}
              </Typography>
              <Typography>
                <strong>End Date:</strong> {dayjs(session.end_date).format('MMM D, YYYY h:mm A')}
              </Typography>
              <Typography>
                <strong>Trainer:</strong> {session.trainer_name}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">
          Questionnaires
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={handleCreateInstance}
        >
          Add Questionnaire
        </Button>
      </Box>
      
      {instances.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            No questionnaires have been added to this session yet.
          </Typography>
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />}
            onClick={handleCreateInstance}
          >
            Add Questionnaire
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {instances.map((instance) => (
            <Grid item xs={12} sm={6} md={4} key={instance.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Typography variant="h6" component="div">
                      {instance.title}
                    </Typography>
                    <Chip 
                      label={instance.is_active ? 'Active' : 'Inactive'} 
                      color={instance.is_active ? 'success' : 'default'} 
                      size="small" 
                    />
                  </Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Based on: {instance.questionnaire_title}
                  </Typography>
                  <Divider sx={{ my: 1.5 }} />
                  <FormControlLabel
                    control={
                      <Switch 
                        checked={instance.is_active} 
                        onChange={() => handleToggleActive(instance)}
                        color="primary"
                      />
                    }
                    label={instance.is_active ? 'Active' : 'Inactive'}
                  />
                </CardContent>
                <CardActions>
                  <Button 
                    size="small" 
                    startIcon={<EditIcon />}
                    onClick={() => handleEditInstance(instance)}
                  >
                    Edit
                  </Button>
                  <Button 
                    size="small" 
                    color="error" 
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDeleteInstance(instance)}
                  >
                    Remove
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
      
      {/* Create Questionnaire Instance Dialog */}
      <Dialog open={openCreateDialog} onClose={handleCloseDialogs} maxWidth="sm" fullWidth>
        <DialogTitle>Add Questionnaire to Session</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              name="title"
              label="Title"
              fullWidth
              value={formData.title}
              onChange={handleInputChange}
              required
              helperText="E.g., 'Pre-Test', 'Enrollment Questionnaire', 'Post-Test'"
            />
            <FormControl fullWidth required>
              <InputLabel id="questionnaire-select-label">Questionnaire</InputLabel>
              <Select
                labelId="questionnaire-select-label"
                id="questionnaire-select"
                value={formData.questionnaire_id}
                label="Questionnaire"
                onChange={handleQuestionnaireChange}
              >
                <MenuItem value={0} disabled>Select a questionnaire</MenuItem>
                {questionnaires.map((questionnaire) => (
                  <MenuItem key={questionnaire.id} value={questionnaire.id}>
                    {questionnaire.title}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch 
                  checked={formData.is_active} 
                  onChange={handleActiveChange}
                  name="is_active"
                  color="primary"
                />
              }
              label="Make Active Immediately"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialogs}>Cancel</Button>
          <Button 
            onClick={handleSubmitCreate} 
            variant="contained"
            disabled={!formData.title || !formData.questionnaire_id}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Questionnaire Instance Dialog */}
      <Dialog open={openEditDialog} onClose={handleCloseDialogs} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Questionnaire</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <TextField
              name="title"
              label="Title"
              fullWidth
              value={formData.title}
              onChange={handleInputChange}
              required
            />
            <FormControlLabel
              control={
                <Switch 
                  checked={formData.is_active} 
                  onChange={handleActiveChange}
                  name="is_active"
                  color="primary"
                />
              }
              label={formData.is_active ? "Active" : "Inactive"}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialogs}>Cancel</Button>
          <Button 
            onClick={handleSubmitEdit} 
            variant="contained"
            disabled={!formData.title}
          >
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={handleCloseDialogs}>
        <DialogTitle>Confirm Remove</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove &quot;{selectedInstance?.title}&quot; from this session? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialogs}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Remove
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
SessionDetail.getLayout = withNavigationLayout; 