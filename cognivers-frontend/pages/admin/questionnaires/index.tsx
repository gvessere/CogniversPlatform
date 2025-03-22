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
  Stack,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemSecondaryAction,
  Divider
} from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import { withNavigationLayout } from '../../../utils/layout';
import { callFrontendApi } from '../../../lib/api';
import { formatErrorMessage } from '../../../utils/errorUtils';
import { Questionnaire, Processor, User, QuestionnaireProcessorMapping, QuestionProcessorMapping } from '../../../lib/types';

interface TaskDefinition {
  id: number;
  processor_id: number;
  questionnaire_id: number;
  question_ids: number[];
  is_active: boolean;
}

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
  const [taskDefinitions, setTaskDefinitions] = useState<Record<number, TaskDefinition[]>>({});
  const [expandedQuestionnaire, setExpandedQuestionnaire] = useState<number | null>(null);

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
      
      // Fetch full questionnaire details including questions
      const fullQuestionnairePromises = questionnairesData.map(q => 
        callFrontendApi<Questionnaire>(`/api/questionnaires/${q.id}`, 'GET')
      );
      const fullQuestionnaires = await Promise.all(fullQuestionnairePromises);
      setQuestionnaires(fullQuestionnaires);
      setProcessors(processorsData);

      // Fetch user information for all unique creator IDs
      const uniqueCreatorIds = [...new Set(fullQuestionnaires.map(q => q.created_by_id))];
      const userPromises = uniqueCreatorIds.map(id => 
        callFrontendApi<User>(`/api/users/${id}`, 'GET')
      );
      const userResults = await Promise.all(userPromises);
      const userMap = userResults.reduce((acc, user) => {
        acc[user.id] = user;
        return acc;
      }, {} as Record<number, User>);
      setUsers(userMap);

      // Fetch task definitions for each questionnaire
      const taskDefinitionPromises = fullQuestionnaires.map(q => 
        callFrontendApi<TaskDefinition[]>(`/api/questionnaires/${q.id}/task-definitions`, 'GET')
      );
      const taskDefinitionResults = await Promise.all(taskDefinitionPromises);
      const taskDefinitionMap = taskDefinitionResults.reduce((acc, definitions, index) => {
        acc[fullQuestionnaires[index].id] = definitions;
        return acc;
      }, {} as Record<number, TaskDefinition[]>);
      setTaskDefinitions(taskDefinitionMap);
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
      fetchData(); // Refresh to get updated task definitions
    } catch (err) {
      console.error('Error assigning processor:', err);
      setError('Failed to assign processor. Please try again later.');
    }
  };

  const handleRemoveTaskDefinition = async (taskDefinitionId: number) => {
    try {
      await callFrontendApi(`/api/questionnaires/task-definitions/${taskDefinitionId}`, 'DELETE');
      fetchData(); // Refresh to get updated task definitions
    } catch (err) {
      console.error('Error removing task definition:', err);
      setError('Failed to remove task definition. Please try again later.');
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

  const handleAccordionChange = (questionnaireId: number) => {
    setExpandedQuestionnaire(expandedQuestionnaire === questionnaireId ? null : questionnaireId);
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

      {questionnaires.map((questionnaire) => (
        <Accordion
          key={questionnaire.id}
          expanded={expandedQuestionnaire === questionnaire.id}
          onChange={() => handleAccordionChange(questionnaire.id)}
          sx={{ mb: 2 }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="h6">{questionnaire.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  Type: {questionnaire.type} | Created by: {getCreatorName(questionnaire.created_by_id)}
                </Typography>
              </Box>
              <Tooltip title="Create Task Definition">
                <IconButton onClick={(e) => {
                  e.stopPropagation();
                  handleAssignProcessor(questionnaire);
                }}>
                  <AssignmentIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="subtitle1" gutterBottom>
              Task Definitions
            </Typography>
            <List>
              {taskDefinitions[questionnaire.id]?.map((taskDefinition) => {
                const processor = processors.find(p => p.id === taskDefinition.processor_id);
                const questions = questionnaire.questions.filter(q => taskDefinition.question_ids.includes(q.id));
                return (
                  <React.Fragment key={taskDefinition.id}>
                    <ListItem>
                      <ListItemText
                        primary={processor?.name || `Processor ${taskDefinition.processor_id}`}
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Questions: {questions.map(q => q.text).join(', ')}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Status: {taskDefinition.is_active ? 'Active' : 'Inactive'}
                            </Typography>
                          </Box>
                        }
                      />
                      <ListItemSecondaryAction>
                        <Tooltip title="Remove Task Definition">
                          <IconButton 
                            edge="end" 
                            onClick={() => handleRemoveTaskDefinition(taskDefinition.id)}
                            size="small"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                );
              })}
            </List>
          </AccordionDetails>
        </Accordion>
      ))}

      {/* Processor Assignment Dialog */}
      <Dialog 
        open={openProcessorDialog} 
        onClose={() => setOpenProcessorDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create Task Definition</DialogTitle>
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
            Create Task Definition
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Apply the navigation layout
QuestionnaireManagement.getLayout = withNavigationLayout; 