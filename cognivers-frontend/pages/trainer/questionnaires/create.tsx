import React, { useState } from 'react';
import { Typography, Snackbar, Alert } from '@mui/material';
import { useRouter } from 'next/router';
import { withNavigationLayout } from '../../../utils/layout';
import { formatErrorMessage } from '../../../utils/errorUtils';
import { callFrontendApi } from '../../../lib/api';
import QuestionnaireForm, { QuestionnaireFormData } from '../../../components/Questionnaire/QuestionnaireForm';

export default function CreateQuestionnaire() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (formData: QuestionnaireFormData) => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    
    try {
      await callFrontendApi('/api/questionnaires', 'POST', formData);
      
      setSuccessMessage('Questionnaire created successfully');
      
      // Redirect after a short delay
      setTimeout(() => {
        router.push('/trainer/questionnaires');
      }, 2000);
    } catch (error) {
      setError(formatErrorMessage(error, 'An error occurred while creating the questionnaire'));
      console.error('Error creating questionnaire:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Typography variant="h4" component="h1" gutterBottom sx={{ my: 4, maxWidth: 1000, mx: 'auto' }}>
        Create New Questionnaire
      </Typography>
      
      <QuestionnaireForm 
        onSubmit={handleSubmit}
        submitButtonText="Create Questionnaire"
        isLoading={saving}
      />
      
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
      >
        <Alert onClose={() => setError(null)} severity="error">
          {error}
        </Alert>
      </Snackbar>
      
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
}

// Replace the custom getLayout function with the utility
CreateQuestionnaire.getLayout = withNavigationLayout; 