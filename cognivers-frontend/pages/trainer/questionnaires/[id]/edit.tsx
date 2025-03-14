import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Box, CircularProgress, Typography, Snackbar, Alert } from '@mui/material';
import { withNavigationLayout } from '../../../../utils/layout';
import { getQuestionnaire, updateQuestionnaire } from '../../../../lib/api';
import QuestionnaireForm, { QuestionnaireFormData } from '../../../../components/Questionnaire/QuestionnaireForm';

const EditQuestionnaire = () => {
  const router = useRouter();
  const { id } = router.query;
  const [questionnaire, setQuestionnaire] = useState<QuestionnaireFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const handleSubmit = async (formData: QuestionnaireFormData) => {
    if (!id || Array.isArray(id)) return;
    
    setSaving(true);
    setError(null);
    
    try {
      await updateQuestionnaire(parseInt(id), formData);
      setSuccessMessage('Questionnaire updated successfully');
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push(`/trainer/questionnaires/${id}`);
      }, 2000);
    } catch (error) {
      console.error('Error updating questionnaire:', error);
      setError('Failed to update questionnaire. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !questionnaire) {
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

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom sx={{ my: 4, maxWidth: 1000, mx: 'auto' }}>
        Edit Questionnaire
      </Typography>
      
      <QuestionnaireForm 
        initialData={questionnaire}
        onSubmit={handleSubmit}
        submitButtonText="Update Questionnaire"
        isLoading={saving}
      />
      
      <Snackbar
        open={!!successMessage}
        autoHideDuration={6000}
        onClose={() => setSuccessMessage(null)}
      >
        <Alert onClose={() => setSuccessMessage(null)} severity="success">
          {successMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

// Apply navigation layout
EditQuestionnaire.getLayout = withNavigationLayout;

export default EditQuestionnaire; 