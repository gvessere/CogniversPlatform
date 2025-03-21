import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper,
  Alert,
  Snackbar
} from '@mui/material';
import { useRouter } from 'next/router';
import { withNavigationLayout } from '../../../../utils/layout';
import { callFrontendApi } from '../../../../lib/api';
import ProcessorForm from '../../../../components/ProcessorForm';
import { Processor } from '../../../../lib/types';

function EditProcessor() {
  const router = useRouter();
  const { id } = router.query;
  const [formData, setFormData] = useState<Partial<Processor>>({
    name: '',
    description: '',
    prompt_template: '',
    post_processing_code: '',
    interpreter: 'none',
    status: 'testing',
    is_active: true,
    llm_temperature: 0.7,
    llm_max_tokens: 2000,
    llm_system_prompt: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchProcessor();
    }
  }, [id]);

  const fetchProcessor = async () => {
    try {
      setLoading(true);
      const data = await callFrontendApi<Processor>(`/api/processors/${id}`, 'GET');
      setFormData(data);
    } catch (err) {
      console.error('Error fetching processor:', err);
      setError('Failed to load processor');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await callFrontendApi(`/api/processors/${id}`, 'PATCH', formData);
      setSuccess('Processor updated successfully');
      setTimeout(() => {
        router.push('/admin/processors');
      }, 1500);
    } catch (err) {
      console.error('Error updating processor:', err);
      setError('Failed to update processor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ my: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Edit Processor
      </Typography>

      <Paper sx={{ p: 3, mt: 3 }}>
        <form onSubmit={handleSubmit}>
          <ProcessorForm
            formData={formData}
            onChange={setFormData}
            isEdit={true}
          />

          <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
            <Button
              variant="contained"
              type="submit"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Processor'}
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
EditProcessor.getLayout = withNavigationLayout;

export default EditProcessor; 