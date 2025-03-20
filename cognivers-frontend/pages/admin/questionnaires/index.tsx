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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Chip,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { useRouter } from 'next/router';
import { withNavigationLayout } from '../../../utils/layout';
import { callFrontendApi } from '../../../lib/api';
import { formatErrorMessage } from '../../../utils/errorUtils';
import { Questionnaire, Processor } from '../../../lib/types';

export default function QuestionnaireManagement() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [processors, setProcessors] = useState<Processor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [openProcessorDialog, setOpenProcessorDialog] = useState(false);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<Questionnaire | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: '',
    is_paginated: false,
    requires_completion: true,
    number_of_attempts: 1
  });

  const router = useRouter();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [questionnairesData, processorsData] = await Promise.all([
        callFrontendApi<Questionnaire[]>('/api/questionnaires', 'GET'),
        callFrontendApi<Processor[]>('/api/processors', 'GET')
      ]);
      setQuestionnaires(questionnairesData);
      setProcessors(processorsData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setFormData({
      title: '',
      description: '',
      type: '',
      is_paginated: false,
      requires_completion: true,
      number_of_attempts: 1
    });
    setOpenDialog(true);
  };

  const handleEdit = (questionnaire: Questionnaire) => {
    setFormData({
      title: questionnaire.title,
      description: questionnaire.description,
      type: questionnaire.type,
      is_paginated: questionnaire.is_paginated,
      requires_completion: questionnaire.requires_completion,
      number_of_attempts: questionnaire.number_of_attempts
    });
    setSelectedQuestionnaire(questionnaire);
    setOpenDialog(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this questionnaire?')) return;

    try {
      await callFrontendApi(`/api/questionnaires/${id}`, 'DELETE');
      setQuestionnaires(questionnaires.filter(q => q.id !== id));
    } catch (err) {
      console.error('Error deleting questionnaire:', err);
      setError('Failed to delete questionnaire. Please try again later.');
    }
  };

  const handleSubmit = async () => {
    try {
      if (selectedQuestionnaire) {
        await callFrontendApi(`/api/questionnaires/${selectedQuestionnaire.id}`, 'PUT', formData);
        setQuestionnaires(questionnaires.map(q => 
          q.id === selectedQuestionnaire.id ? { ...q, ...formData } : q
        ));
      } else {
        const newQuestionnaire = await callFrontendApi<Questionnaire>('/api/questionnaires', 'POST', formData);
        setQuestionnaires([...questionnaires, newQuestionnaire]);
      }
      setOpenDialog(false);
      setSelectedQuestionnaire(null);
    } catch (err) {
      console.error('Error saving questionnaire:', err);
      setError('Failed to save questionnaire. Please try again later.');
    }
  };

  const handleAssignProcessor = (questionnaire: Questionnaire) => {
    setSelectedQuestionnaire(questionnaire);
    setOpenProcessorDialog(true);
  };

  const handleProcessorSubmit = async (processorId: number, questionIds: number[]) => {
    if (!selectedQuestionnaire) return;

    try {
      await callFrontendApi(`/api/processors/${processorId}/assign`, 'POST', {
        questionnaire_id: selectedQuestionnaire.id,
        question_ids: questionIds
      });
      setOpenProcessorDialog(false);
      fetchData(); // Refresh to get updated processor assignments
    } catch (err) {
      console.error('Error assigning processor:', err);
      setError('Failed to assign processor. Please try again later.');
    }
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ my: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Questionnaire Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Create New
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Attempts</TableCell>
              <TableCell>Processors</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {questionnaires.map((questionnaire) => (
              <TableRow key={questionnaire.id}>
                <TableCell>{questionnaire.title}</TableCell>
                <TableCell>
                  <Chip
                    label={getTypeLabel(questionnaire.type).label}
                    color={getTypeLabel(questionnaire.type).color}
                    size="small"
                  />
                </TableCell>
                <TableCell>{questionnaire.number_of_attempts}</TableCell>
                <TableCell>
                  {questionnaire.processors?.map(processor => (
                    <Chip
                      key={processor.id}
                      label={processor.name}
                      size="small"
                      sx={{ mr: 1, mb: 1 }}
                    />
                  ))}
                </TableCell>
                <TableCell>
                  <Tooltip title="Assign Processor">
                    <IconButton
                      size="small"
                      onClick={() => handleAssignProcessor(questionnaire)}
                      sx={{ mr: 1 }}
                    >
                      <AssignmentIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(questionnaire)}
                      sx={{ mr: 1 }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDelete(questionnaire.id)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {selectedQuestionnaire ? 'Edit Questionnaire' : 'Create New Questionnaire'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              fullWidth
              multiline
              rows={3}
            />
            <FormControl fullWidth required>
              <InputLabel>Type</InputLabel>
              <Select
                value={formData.type}
                label="Type"
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              >
                <MenuItem value="signup">Sign Up</MenuItem>
                <MenuItem value="pre_test">Pre-Test</MenuItem>
                <MenuItem value="post_test">Post-Test</MenuItem>
                <MenuItem value="trainer_evaluation">Trainer Evaluation</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Number of Attempts"
              type="number"
              value={formData.number_of_attempts}
              onChange={(e) => setFormData({ ...formData, number_of_attempts: parseInt(e.target.value) })}
              fullWidth
              required
              inputProps={{ min: 1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.is_paginated}
                  onChange={(e) => setFormData({ ...formData, is_paginated: e.target.checked })}
                />
              }
              label="Enable pagination"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formData.requires_completion}
                  onChange={(e) => setFormData({ ...formData, requires_completion: e.target.checked })}
                />
              }
              label="Require completion of all required questions"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {selectedQuestionnaire ? 'Save Changes' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Processor Assignment Dialog */}
      <Dialog open={openProcessorDialog} onClose={() => setOpenProcessorDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Assign Processor to Questions</DialogTitle>
        <DialogContent>
          {selectedQuestionnaire && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Questionnaire: {selectedQuestionnaire.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                Select the questions you want to process with this processor.
              </Typography>
              <FormControl fullWidth sx={{ mt: 2 }}>
                <InputLabel>Processor</InputLabel>
                <Select
                  label="Processor"
                  onChange={(e) => {
                    const processorId = e.target.value as number;
                    handleProcessorSubmit(processorId, selectedQuestionnaire.questions.map(q => q.id));
                  }}
                >
                  {processors.map(processor => (
                    <MenuItem key={processor.id} value={processor.id}>
                      {processor.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenProcessorDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Set up the layout
(QuestionnaireManagement as any).getLayout = withNavigationLayout; 