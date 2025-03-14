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
}

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

  const startQuestionnaire = (id: number) => {
    router.push(`/client/questionnaires/${id}`);
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
          {questionnaires.map((questionnaire) => {
            const typeInfo = getTypeLabel(questionnaire.type);
            return (
              <Grid item xs={12} md={6} key={questionnaire.id}>
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
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        {questionnaire.is_completed ? (
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <AssignmentTurnedInIcon color="success" sx={{ mr: 1 }} />
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
                      </Box>
                      
                      <Button
                        variant={questionnaire.is_completed ? "outlined" : "contained"}
                        onClick={() => startQuestionnaire(questionnaire.id)}
                      >
                        {questionnaire.is_completed ? "Review" : questionnaire.has_response ? "Continue" : "Start"}
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}

// Replace the custom getLayout function with the utility
ClientQuestionnaires.getLayout = withNavigationLayout; 