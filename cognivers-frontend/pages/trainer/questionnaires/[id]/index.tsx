import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Box, CircularProgress, Typography } from '@mui/material';
import { withNavigationLayout } from '../../../../utils/layout';
import { getQuestionnaire } from '../../../../lib/api';
import QuestionnaireView from '../../../../components/Questionnaire/QuestionnaireView';
import { QuestionnaireFormData } from '../../../../components/Questionnaire/QuestionnaireForm';

const ViewQuestionnaire = () => {
  const router = useRouter();
  const { id } = router.query;
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchQuestionnaire = async () => {
      if (!id || Array.isArray(id)) return;
      
      try {
        setLoading(true);
        const data = await getQuestionnaire(parseInt(id));
        setQuestionnaire(data);
      } catch (error) {
        console.error('Error fetching questionnaire:', error);
        setError('Failed to load questionnaire. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchQuestionnaire();
    }
  }, [id]);

  const handleEdit = () => {
    router.push(`/trainer/questionnaires/${id}/edit`);
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
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography color="error" variant="h6">
          {error}
        </Typography>
      </Box>
    );
  }

  if (!questionnaire) {
    return (
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h6">
          Questionnaire not found
        </Typography>
      </Box>
    );
  }

  return <QuestionnaireView questionnaire={questionnaire} onEdit={handleEdit} />;
};

// Apply navigation layout
ViewQuestionnaire.getLayout = withNavigationLayout;

export default ViewQuestionnaire; 