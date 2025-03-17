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
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { useRouter } from 'next/router';
import dayjs from 'dayjs';
import { withNavigationLayout } from '../../../utils/layout';
import { callFrontendApi, deleteQuestionnaire, cloneQuestionnaire } from '../../../lib/api';

interface Questionnaire {
  id: number;
  title: string;
  description: string;
  type: string;
  is_paginated: boolean;
  created_at: string;
  question_count: number;
  session_count: number;
}

export default function QuestionnairesList() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<number | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const router = useRouter();

  useEffect(() => {
    fetchQuestionnaires();
  }, []);

  const fetchQuestionnaires = async () => {
    try {
      setLoading(true);
      const data = await callFrontendApi<Questionnaire[]>(
        '/api/questionnaires',
        'GET'
      );
      setQuestionnaires(data);
    } catch (error) {
      console.error('Error fetching questionnaires:', error);
      showSnackbar('Failed to load questionnaires', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuestionnaire = () => {
    router.push('/trainer/questionnaires/create');
  };

  const handleEditQuestionnaire = (id: number) => {
    router.push(`/trainer/questionnaires/${id}/edit`);
  };

  const handleViewQuestionnaire = (id: number) => {
    router.push(`/trainer/questionnaires/${id}`);
  };

  const handleDeleteClick = (id: number) => {
    setSelectedQuestionnaireId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (selectedQuestionnaireId) {
      try {
        await deleteQuestionnaire(selectedQuestionnaireId);
        showSnackbar('Questionnaire deleted successfully', 'success');
        fetchQuestionnaires(); // Refresh the list
      } catch (error: any) {
        console.error('Error deleting questionnaire:', error);
        if (error.status === 400 && error.data?.detail?.includes('associated with sessions')) {
          showSnackbar('Cannot delete questionnaire that is associated with sessions', 'error');
        } else {
          showSnackbar('Failed to delete questionnaire', 'error');
        }
      }
    }
    setDeleteDialogOpen(false);
  };

  const handleCloneQuestionnaire = async (id: number) => {
    try {
      const result = await cloneQuestionnaire(id);
      showSnackbar('Questionnaire cloned successfully', 'success');
      fetchQuestionnaires(); // Refresh the list
      
      // Optionally navigate to edit the cloned questionnaire
      if (result && result.id) {
        router.push(`/trainer/questionnaires/${result.id}/edit`);
      }
    } catch (error) {
      console.error('Error cloning questionnaire:', error);
      showSnackbar('Failed to clone questionnaire', 'error');
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, { label: string, color: 'primary' | 'secondary' | 'success' | 'warning' }> = {
      'signup': { label: 'Sign Up', color: 'primary' },
      'pre_test': { label: 'Pre-Test', color: 'secondary' },
      'post_test': { label: 'Post-Test', color: 'success' },
      'trainer_evaluation': { label: 'Trainer Evaluation', color: 'warning' }
    };

    return typeMap[type] || { label: type, color: 'primary' };
  };

  return (
    <Box sx={{ my: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Questionnaires
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={handleCreateQuestionnaire}
        >
          Create New
        </Button>
      </Box>

      {loading ? (
        <Typography>Loading questionnaires...</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Questions</TableCell>
                <TableCell>Sessions</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {questionnaires.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body1" sx={{ my: 2 }}>
                      No questionnaires found. Create your first questionnaire to get started.
                    </Typography>
                    <Button 
                      variant="outlined" 
                      startIcon={<AddIcon />}
                      onClick={handleCreateQuestionnaire}
                    >
                      Create Questionnaire
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                questionnaires.map((questionnaire) => {
                  const typeInfo = getTypeLabel(questionnaire.type);
                  return (
                    <TableRow key={questionnaire.id}>
                      <TableCell>{questionnaire.title}</TableCell>
                      <TableCell>
                        <Chip 
                          label={typeInfo.label} 
                          color={typeInfo.color} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>{questionnaire.question_count}</TableCell>
                      <TableCell>
                        {questionnaire.session_count > 0 ? (
                          <Chip 
                            label={questionnaire.session_count} 
                            color="info" 
                            size="small" 
                          />
                        ) : (
                          '0'
                        )}
                      </TableCell>
                      <TableCell>{dayjs(questionnaire.created_at).format('MMM D, YYYY')}</TableCell>
                      <TableCell>
                        <Tooltip title="View">
                          <IconButton 
                            size="small" 
                            onClick={() => handleViewQuestionnaire(questionnaire.id)}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton 
                            size="small" 
                            onClick={() => handleEditQuestionnaire(questionnaire.id)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Clone">
                          <IconButton 
                            size="small" 
                            color="primary"
                            onClick={() => handleCloneQuestionnaire(questionnaire.id)}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={questionnaire.session_count > 0 ? "Cannot delete (associated with sessions)" : "Delete"}>
                          <span>
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={() => handleDeleteClick(questionnaire.id)}
                              disabled={questionnaire.session_count > 0}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Questionnaire</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this questionnaire? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbarSeverity} sx={{ width: '100%' }}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Replace the custom getLayout function with the utility
QuestionnairesList.getLayout = withNavigationLayout; 