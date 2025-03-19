import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Divider, 
  Chip,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Alert,
  TextField
} from '@mui/material';
import { useRouter } from 'next/router';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { QuestionnaireFormData, QuestionFormData } from './QuestionnaireForm';
import { getQuestionnaireSessions, cloneQuestionnaire } from '../../lib/api';
import dayjs from 'dayjs';

interface Session {
  id: number;
  title: string;
  start_date: string;
  end_date: string;
}

interface SessionsResponse {
  sessions: Session[];
  session_count: number;
}

interface QuestionnaireViewProps {
  questionnaire: QuestionnaireFormData;
  onEdit?: () => void;
}

const QuestionnaireView: React.FC<QuestionnaireViewProps> = ({ 
  questionnaire,
  onEdit
}) => {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionCount, setSessionCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');

  useEffect(() => {
    if (questionnaire && questionnaire.id) {
      fetchSessions(questionnaire.id);
    }
  }, [questionnaire]);

  const fetchSessions = async (questionnaireId: number) => {
    try {
      setLoading(true);
      const response = await getQuestionnaireSessions(questionnaireId);
      setSessions(response.sessions || []);
      setSessionCount(response.session_count || 0);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      showSnackbar('Failed to load associated sessions', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCloneQuestionnaire = async () => {
    if (!questionnaire || !questionnaire.id) return;
    
    try {
      const result = await cloneQuestionnaire(questionnaire.id);
      showSnackbar('Questionnaire cloned successfully', 'success');
      
      // Navigate to edit the cloned questionnaire
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

  const renderQuestionView = (question: QuestionFormData, index: number) => {
    return (
      <Card key={index} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Question {index + 1}</Typography>
            {question.is_required ? (
              <Chip label="Required" color="primary" size="small" />
            ) : (
              <Chip label="Optional" color="default" size="small" />
            )}
          </Box>
          
          <Typography variant="body1" gutterBottom>
            {question.text}
          </Typography>
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Type: {question.type === 'text' ? 'Text Input' : 
                      question.type === 'multiple_choice_single' ? 'Multiple Choice (Single)' : 
                      'Multiple Choice (Multiple)'}
              </Typography>
            </Grid>
            
            {question.time_limit_seconds && (
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Time Limit: {question.time_limit_seconds} seconds
                </Typography>
              </Grid>
            )}
            
            {questionnaire.is_paginated && (
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Page: {question.page_number}
                </Typography>
              </Grid>
            )}
          </Grid>
          
          {question.type === 'text' && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Answer Box Size: {
                  question.configuration.answer_box_size === 'small' ? 'Small (Single line)' :
                  question.configuration.answer_box_size === 'medium' ? 'Medium (3 lines)' :
                  'Large (5+ lines)'
                }
              </Typography>
            </Box>
          )}
          
          {(question.type === 'multiple_choice_single' || question.type === 'multiple_choice_multiple') && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Choices:
              </Typography>
              <List dense>
                {question.configuration.choices.map((choice, i) => (
                  <ListItem key={i}>
                    <ListItemText primary={choice} />
                  </ListItem>
                ))}
              </List>
              
              {question.type === 'multiple_choice_multiple' && (
                <Box sx={{ mt: 1 }}>
                  {question.configuration.min_choices && (
                    <Typography variant="body2" color="text.secondary">
                      Minimum selections: {question.configuration.min_choices}
                    </Typography>
                  )}
                  {question.configuration.max_choices && (
                    <Typography variant="body2" color="text.secondary">
                      Maximum selections: {question.configuration.max_choices}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">
            {questionnaire.title}
          </Typography>
          <Box>
            <Tooltip title="Clone Questionnaire">
              <IconButton 
                color="primary" 
                onClick={handleCloneQuestionnaire}
                sx={{ mr: 1 }}
              >
                <ContentCopyIcon />
              </IconButton>
            </Tooltip>
            {onEdit && (
              <Button 
                variant="contained" 
                onClick={onEdit}
              >
                Edit
              </Button>
            )}
          </Box>
        </Box>
        
        <Typography variant="body1" paragraph>
          {questionnaire.description}
        </Typography>
        
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item>
            <Chip 
              label={getTypeLabel(questionnaire.type).label} 
              color={getTypeLabel(questionnaire.type).color} 
            />
          </Grid>
          {questionnaire.is_paginated && (
            <Grid item>
              <Chip label="Paginated" color="info" />
            </Grid>
          )}
          {questionnaire.requires_completion && (
            <Grid item>
              <Chip label="Requires Completion" color="warning" />
            </Grid>
          )}
          <Grid item>
            <Chip 
              label={`${questionnaire.number_of_attempts} Attempt${questionnaire.number_of_attempts !== 1 ? 's' : ''}`} 
              color="info" 
            />
          </Grid>
        </Grid>

        {/* Associated Sessions Section */}
        <Box sx={{ mt: 4, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Associated Sessions ({sessionCount})
          </Typography>
          {loading ? (
            <Typography>Loading sessions...</Typography>
          ) : sessionCount > 0 ? (
            <Card variant="outlined">
              <List dense>
                {sessions.map((session) => (
                  <ListItem key={session.id} divider>
                    <ListItemText 
                      primary={session.title} 
                      secondary={`${dayjs(session.start_date).format('MMM D, YYYY')} - ${dayjs(session.end_date).format('MMM D, YYYY')}`} 
                    />
                  </ListItem>
                ))}
              </List>
            </Card>
          ) : (
            <Typography color="text.secondary">
              This questionnaire is not associated with any sessions.
            </Typography>
          )}
        </Box>
      </Paper>
      
      <Typography variant="h5" sx={{ mb: 2 }}>
        Questions ({questionnaire.questions.length})
      </Typography>
      
      {questionnaire.questions.map((question, index) => (
        renderQuestionView(question, index)
      ))}

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
};

export default QuestionnaireView; 