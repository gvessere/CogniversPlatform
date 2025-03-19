import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress,
  Grid,
  Alert
} from '@mui/material';
import { useAuth } from '../../../context/AuthContext';
import { useRouter } from 'next/router';
import { withNavigationLayout } from '../../../utils/layout';
import { callFrontendApi } from '../../../lib/api';
import QuestionnaireCard from '../../../components/Questionnaire/QuestionnaireCard';

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

export default function ClientQuestionnaires() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const fetchQuestionnaires = async () => {
      try {
        const data = await callFrontendApi<Questionnaire[]>('/api/questionnaires/client', 'GET');
        setQuestionnaires(data);
      } catch (err) {
        console.error('Error fetching questionnaires:', err);
        setError('Failed to load questionnaires. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestionnaires();
  }, []);

  const startQuestionnaire = (id: number, responseId?: number) => {
    const query = responseId ? `?attempt=${responseId}` : '';
    router.push(`/client/questionnaires/${id}${query}`);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 4 }}>
        {error}
      </Alert>
    );
  }

  if (questionnaires.length === 0) {
    return (
      <Typography variant="body1" sx={{ mt: 4 }}>
        No questionnaires available.
      </Typography>
    );
  }

  return (
    <Box sx={{ my: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Questionnaires
      </Typography>
      
      <Grid container spacing={3}>
        {questionnaires.map((questionnaire) => (
          <Grid item xs={12} md={6} key={questionnaire.id}>
            <QuestionnaireCard 
              questionnaire={questionnaire}
              onStartQuestionnaire={startQuestionnaire}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

// Set up the layout
(ClientQuestionnaires as any).getLayout = withNavigationLayout; 