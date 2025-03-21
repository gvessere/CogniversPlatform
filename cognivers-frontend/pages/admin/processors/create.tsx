import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper,
  Alert,
  Snackbar
} from '@mui/material';
import { useRouter } from 'next/router';
import { withNavigationLayout } from '../../../utils/layout';
import { callFrontendApi } from '../../../lib/api';
import ProcessorForm from '../../../components/ProcessorForm';
import { Processor } from '../../../lib/types';

function CreateProcessor() {
  const router = useRouter();
  const [formData, setFormData] = useState<Partial<Processor>>({
    name: '',
    description: '',
    prompt_template: '',
    post_processing_code: '',
    interpreter: 'none',
    status: 'testing',
    is_active: true,
    llm_temperature: 0.7,
    llm_max_tokens: 2000
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await callFrontendApi('/api/processors', 'POST', formData);
      setSuccess('Processor created successfully');
      setTimeout(() => {
        router.push('/admin/processors');
      }, 1500);
    } catch (err) {
      console.error('Error creating processor:', err);
      setError('Failed to create processor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ my: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Create New Processor
      </Typography>

      <Paper sx={{ p: 3, mt: 3 }}>
        <form onSubmit={handleSubmit}>
          <ProcessorForm
            formData={formData}
            onChange={setFormData}
          />

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button
                  variant="contained"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Processor'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => router.push('/admin/processors')}
                >
                  Cancel
                </Button>
              </Box>
        </form>
      </Paper>

      <Snackbar
        open={!!error || !!success}
        autoHideDuration={6000}
        onClose={() => {
          setError(null);
          setSuccess(null);
        }}
      >
        <Alert 
          onClose={() => {
            setError(null);
            setSuccess(null);
          }} 
          severity={error ? 'error' : 'success'}
        >
          {error || success}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Apply navigation layout
CreateProcessor.getLayout = withNavigationLayout;

export default CreateProcessor; 