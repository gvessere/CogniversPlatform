import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Alert
} from '@mui/material';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/router';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import dayjs from 'dayjs';
import { withNavigationLayout } from '../../../utils/layout';
import { callFrontendApi } from '../../../lib/api';

interface Questionnaire {
  id: number;
  title: string;
  description: string;
  type: string;
  has_response: boolean;
  is_completed: boolean;
  last_updated: string | null;
  completed_count: number;
  remaining_attempts: number;
  attempts?: QuestionnaireAttempt[];
}

interface QuestionnaireAttempt {
  id: number;
  questionnaire_id: number;
  user_id: number;
  started_at: string;
  completed_at: string | null;
}

enum QuestionnaireButtonState {
  ATTEMPT = 'Attempt',
  IN_PROGRESS = 'In Progress',
  NO_ATTEMPTS = 'No Attempts Left'
}

const getButtonState = (
  hasOngoingAttempt: boolean,
  attempts: any[],
  remaining_attempts: number
): QuestionnaireButtonState => {
  if (hasOngoingAttempt) {
    return QuestionnaireButtonState.IN_PROGRESS;
  }
  if (attempts.length === 0) {
    return QuestionnaireButtonState.ATTEMPT;
  }
  if (remaining_attempts === 0) {
    return QuestionnaireButtonState.NO_ATTEMPTS;
  }
  return QuestionnaireButtonState.ATTEMPT;
};

export default function ClientQuestionnaires() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    const fetchQuestionnaires = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await callFrontendApi<Questionnaire[]>(
          '/api/questionnaires/client',
          'GET'
        );
        setQuestionnaires(data);
      } catch (error: unknown) {
        console.error('Error fetching questionnaires:', error);
        
        // Extract error message
        let errorMessage = 'Failed to load questionnaires';
        
        // Type assertion for error object
        const err = error as {
          response?: {
            status?: number;
            data?: {
              detail?: string | Array<{msg: string}>;
              error?: string;
            }
          };
          message?: string;
        };
        
        if (err.response?.status === 422) {
          errorMessage = 'Access denied: This endpoint is restricted to client users only';
        } else if (err.response?.data?.detail) {
          errorMessage = Array.isArray(err.response.data.detail)
            ? err.response.data.detail.map((d) => d.msg).join(', ')
            : err.response.data.detail;
        } else if (err.response?.data?.error) {
          errorMessage = err.response.data.error;
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestionnaires();
  }, [user]);

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, { label: string, color: 'primary' | 'secondary' | 'success' | 'warning' }> = {
      'signup': { label: 'Sign Up', color: 'primary' },
      'pre_test': { label: 'Pre-Test', color: 'secondary' },
      'post_test': { label: 'Post-Test', color: 'success' },
      'trainer_evaluation': { label: 'Trainer Evaluation', color: 'warning' }
    };

    return typeMap[type] || { label: type, color: 'primary' };
  };

  const startQuestionnaire = (id: number, responseId?: number) => {
    const query = responseId ? `?attempt=${responseId}` : '';
    router.push(`/client/questionnaires/${id}${query}`);
  };

  const QuestionnaireCard: React.FC<{ questionnaire: Questionnaire }> = ({ questionnaire }) => {
    const typeInfo = getTypeLabel(questionnaire.type);
    
    // Add debug logging
    console.log('Questionnaire:', {
      id: questionnaire.id,
      attempts: questionnaire.attempts,
      remaining_attempts: questionnaire.remaining_attempts,
      has_response: questionnaire.has_response,
      is_completed: questionnaire.is_completed
    });

    const hasOngoingAttempt = questionnaire.attempts && questionnaire.attempts.some(attempt => !attempt.completed_at);
    const attempts = questionnaire.attempts || [];
    const remaining_attempts = questionnaire.remaining_attempts;

    return (
      <Card 
        sx={{ 
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          ...(questionnaire.is_completed && {
            borderLeft: '4px solid #4caf50'
          })
        }}
      >
        <CardContent sx={{ flexGrow: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" component="h2">
              {questionnaire.title}
            </Typography>
            <Chip 
              label={typeInfo.label}
              color={typeInfo.color}
              size="small"
            />
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {questionnaire.description}
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
              <Box>
                {questionnaire.is_completed ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AssignmentTurnedInIcon color="success" />
                    <Typography variant="body2" color="success.main">
                      Completed
                    </Typography>
                  </Box>
                ) : questionnaire.has_response ? (
                  <Typography variant="body2" color="text.secondary">
                    Last updated: {dayjs(questionnaire.last_updated).format('MMM D, YYYY')}
                  </Typography>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Not started
                  </Typography>
                )}
                {questionnaire.remaining_attempts > 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {questionnaire.completed_count}/{questionnaire.completed_count + questionnaire.remaining_attempts} attempts
                  </Typography>
                )}
              </Box>
              
              <Button
                variant="contained"
                color="primary"
                onClick={() => startQuestionnaire(questionnaire.id)}
                disabled={hasOngoingAttempt || (attempts.length > 0 && remaining_attempts === 0)}
              >
                {getButtonState(!!hasOngoingAttempt, attempts, remaining_attempts)}
              </Button>
            </Box>

            {questionnaire.attempts && questionnaire.attempts.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Past Attempts:</Typography>
                {questionnaire.attempts.map((attempt) => (
                  <Box 
                    key={attempt.id}
                    sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      mb: 1,
                      p: 1,
                      bgcolor: 'background.default',
                      borderRadius: 1
                    }}
                  >
                    <Typography variant="body2">
                      {dayjs(attempt.started_at).format('MMM D, YYYY HH:mm')}
                      {attempt.completed_at ? ' (Completed)' : ' (In progress)'}
                    </Typography>
                    <Button
                      variant="text"
                      size="small"
                      onClick={() => startQuestionnaire(questionnaire.id, attempt.id)}
                    >
                      View
                    </Button>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ my: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        My Questionnaires
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : questionnaires.length === 0 && !error ? (
        <Paper sx={{ p: 4, mt: 3, textAlign: 'center' }}>
          <AssignmentIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
          <Typography variant="h6" gutterBottom>
            No Questionnaires Available
          </Typography>
          <Typography variant="body1" color="textSecondary">
            You don&apos;t have any questionnaires to complete at this time.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3} sx={{ mt: 1 }}>
          {questionnaires.map((questionnaire) => (
            <Grid item xs={12} md={6} key={questionnaire.id}>
              <QuestionnaireCard questionnaire={questionnaire} />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

// Replace the custom getLayout function with the utility
ClientQuestionnaires.getLayout = withNavigationLayout; 