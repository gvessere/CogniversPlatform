import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
  Alert
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import { useRouter } from 'next/router';
import dayjs from 'dayjs';
import { withNavigationLayout } from '../../../utils/layout';
import { callFrontendApi, deleteProcessor } from '../../../lib/api';

interface Processor {
  id: number;
  name: string;
  description: string;
  interpreter: string;
  status: string;
  created_at: string;
  created_by_id: number;
}

function ProcessorsList() {
  const [processors, setProcessors] = useState<Processor[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProcessorId, setSelectedProcessorId] = useState<number | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState<'success' | 'error'>('success');
  const router = useRouter();

  useEffect(() => {
    fetchProcessors();
  }, []);

  const fetchProcessors = async () => {
    try {
      setLoading(true);
      const data = await callFrontendApi<Processor[]>(
        '/api/processors',
        'GET'
      );
      setProcessors(data);
    } catch (error) {
      console.error('Error fetching processors:', error);
      showSnackbar('Failed to load processors', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProcessor = () => {
    router.push('/admin/processors/create');
  };

  const handleEditProcessor = (id: number) => {
    router.push(`/admin/processors/${id}/edit`);
  };

  const handleViewProcessor = (id: number) => {
    router.push(`/admin/processors/${id}`);
  };

  const handleDeleteClick = (id: number) => {
    setSelectedProcessorId(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProcessorId) return;

    try {
      await deleteProcessor(selectedProcessorId);
      showSnackbar('Processor deleted successfully', 'success');
      fetchProcessors();
    } catch (error) {
      console.error('Error deleting processor:', error);
      showSnackbar('Failed to delete processor', 'error');
    } finally {
      setDeleteDialogOpen(false);
      setSelectedProcessorId(null);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, 'success' | 'error' | 'warning'> = {
      'active': 'success',
      'inactive': 'error',
      'draft': 'warning'
    };
    return colorMap[status] || 'default';
  };

  return (
    <Box sx={{ my: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Processors
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={handleCreateProcessor}
        >
          Create New
        </Button>
      </Box>

      {loading ? (
        <Typography>Loading processors...</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Interpreter</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {processors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body1" sx={{ my: 2 }}>
                      No processors found. Create your first processor to get started.
                    </Typography>
                    <Button 
                      variant="outlined" 
                      startIcon={<AddIcon />}
                      onClick={handleCreateProcessor}
                    >
                      Create Processor
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                processors.map((processor) => (
                  <TableRow key={processor.id}>
                    <TableCell>{processor.name}</TableCell>
                    <TableCell>{processor.description}</TableCell>
                    <TableCell>{processor.interpreter}</TableCell>
                    <TableCell>
                      <Chip 
                        label={processor.status} 
                        color={getStatusColor(processor.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{dayjs(processor.created_at).format('MMM D, YYYY')}</TableCell>
                    <TableCell>
                      <Tooltip title="View">
                        <IconButton 
                          size="small" 
                          onClick={() => handleViewProcessor(processor.id)}
                        >
                          <VisibilityIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton 
                          size="small" 
                          onClick={() => handleEditProcessor(processor.id)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleDeleteClick(processor.id)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Processor</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this processor? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
}

// Apply navigation layout
ProcessorsList.getLayout = withNavigationLayout;

export default ProcessorsList; 