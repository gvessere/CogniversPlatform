import React, { useState, useEffect } from 'react';
import { Box, Typography, Alert, CircularProgress } from '@mui/material';
import { useRouter } from 'next/router';
import { withNavigationLayout } from '../../../../utils/layout';
import { callFrontendApi } from '../../../../lib/api';
import ProcessorForm from '../../../../components/ProcessorForm/ProcessorForm';
import { Processor } from '../../../../lib/types';

function EditProcessor() {
  const router = useRouter();
  const { id } = router.query;
  const [processor, setProcessor] = useState<Processor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProcessor();
    }
  }, [id]);

  const fetchProcessor = async () => {
    setLoading(true);
    try {
      const data = await callFrontendApi<Processor>(`/api/processors/${id}`, 'GET');
      setProcessor(data);
    } catch (err) {
      console.error('Error fetching processor:', err);
      setError('Failed to load processor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ my: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Edit Processor
      </Typography>

      {error && <Alert severity="error">{error}</Alert>}
      {success && <Alert severity="success">{success}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : processor ? (
        <ProcessorForm
          initialData={processor}
          isEdit
        />
      ) : null}
    </Box>
  );
}

EditProcessor.getLayout = withNavigationLayout;

export default EditProcessor; 