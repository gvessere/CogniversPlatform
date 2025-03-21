import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
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
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
  Alert,
  CircularProgress,
  Tooltip,
  Chip,
  Stack
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { withNavigationLayout } from '../../../utils/layout';
import { callFrontendApi } from '../../../lib/api';
import { formatErrorMessage } from '../../../utils/errorUtils';
import { Questionnaire, Processor, User, QuestionnaireProcessorMapping } from '../../../lib/types';

export default function QuestionnaireManagement() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [processors, setProcessors] = useState<Processor[]>([]);
  const [users, setUsers] = useState<Record<number, User>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openProcessorDialog, setOpenProcessorDialog] = useState(false);
  const [selectedQuestionnaire, setSelectedQuestionnaire] = useState<Questionnaire | null>(null);
  const [selectedProcessor, setSelectedProcessor] = useState<number | null>(null);
  const [selectedQuestions, setSelectedQuestions] = useState<number[]>([]);
  const [processorMappings, setProcessorMappings] = useState<Record<number, QuestionnaireProcessorMapping[]>>({});

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

      // Fetch user information for all unique creator IDs
      const uniqueCreatorIds = [...new Set(questionnairesData.map(q => q.created_by_id))];
      const userPromises = uniqueCreatorIds.map(id => 
        callFrontendApi<User>(`/api/users/${id}`, 'GET')
      );
      const userResults = await Promise.all(userPromises);
      const userMap = userResults.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<number, User>);
      setUsers(userMap);

      // Fetch processor mappings for each questionnaire
      const mappingPromises = questionnairesData.map(q => 
        callFrontendApi<QuestionnaireProcessorMapping[]>(`/api/questionnaires/${q.id}/processors`, 'GET')
      );
      const mappingResults = await Promise.all(mappingPromises);
      const mappingMap = mappingResults.reduce((acc, mappings, index) => {
        acc[questionnairesData[index].id] = mappings;
        return acc;
      }, {} as Record<number, QuestionnaireProcessorMapping[]>);
      setProcessorMappings(mappingMap);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignProcessor = async (questionnaire: Questionnaire) => {
    try {
      // Fetch full questionnaire details including questions
      const fullQuestionnaire = await callFrontendApi<Questionnaire>(`/api/questionnaires/${questionnaire.id}`, 'GET');
      setSelectedQuestionnaire(fullQuestionnaire);
      setOpenProcessorDialog(true);
    } catch (err) {
      console.error('Error fetching questionnaire details:', err);
      setError('Failed to load questionnaire details. Please try again later.');
    }
  };

  const handleProcessorSubmit = async () => {
    if (!selectedQuestionnaire || !selectedProcessor) return;

    try {
      await callFrontendApi(`/api/processors/${selectedProcessor}/assign`, 'POST', {
        questionnaire_id: selectedQuestionnaire.id,
        question_ids: selectedQuestions
      });
      setOpenProcessorDialog(false);
      setSelectedProcessor(null);
      setSelectedQuestions([]);
      fetchData(); // Refresh to get updated processor assignments
    } catch (err) {
      console.error('Error assigning processor:', err);
      setError('Failed to assign processor. Please try again later.');
    }
  };

  const handleQuestionToggle = (questionId: number) => {
    setSelectedQuestions(prev => 
      prev.includes(questionId) 
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const getCreatorName = (creatorId: number) => {
    const user = users[creatorId];
    return user ? `${user.first_name} ${user.last_name}` : `ID: ${creatorId}`;
  };

  const getProcessorName = (processorId: number) => {
    const processor = processors.find(p => p.id === processorId);
    return processor ? processor.name : `ID: ${processorId}`;
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
      <Typography variant="h4" component="h1" gutterBottom>
        Questionnaire Processor Management
      </Typography>

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
              <TableCell>Created By</TableCell>
              <TableCell>Processors</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {questionnaires.map((questionnaire) => (
              <TableRow key={questionnaire.id}>
                <TableCell>{questionnaire.title}</TableCell>
                <TableCell>{questionnaire.type}</TableCell>
                <TableCell>{getCreatorName(questionnaire.created_by_id)}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {processorMappings[questionnaire.id]?.map((mapping) => (
                      <Chip
                        key={mapping.id}
                        label={getProcessorName(mapping.processor_id)}
                        color={mapping.is_active ? "primary" : "default"}
                        size="small"
                      />
                    ))}
                  </Stack>
                </TableCell>
                <TableCell>
                  <Tooltip title="Assign Processor">
                    <IconButton onClick={() => handleAssignProcessor(questionnaire)}>
                      <AssignmentIcon />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Processor Assignment Dialog */}
      <Dialog 
        open={openProcessorDialog} 
        onClose={() => setOpenProcessorDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Assign Processor to Questions</DialogTitle>
        <DialogContent>
          {selectedQuestionnaire && (
            <>
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Select Processor</InputLabel>
                <Select
                  value={selectedProcessor || ''}
                  onChange={(e) => setSelectedProcessor(Number(e.target.value))}
                  label="Select Processor"
                >
                  {processors.map((processor) => (
                    <MenuItem key={processor.id} value={processor.id}>
                      {processor.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Typography variant="subtitle1" gutterBottom>
                Select Questions to Process
              </Typography>
              {selectedQuestionnaire.questions?.map((question) => (
                <Box key={question.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Checkbox
                    checked={selectedQuestions.includes(question.id)}
                    onChange={() => handleQuestionToggle(question.id)}
                  />
                  <ListItemText primary={question.text} />
                </Box>
              ))}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenProcessorDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleProcessorSubmit} 
            variant="contained"
            disabled={!selectedProcessor || selectedQuestions.length === 0}
          >
            Assign Processor
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Apply the navigation layout
QuestionnaireManagement.getLayout = withNavigationLayout; 