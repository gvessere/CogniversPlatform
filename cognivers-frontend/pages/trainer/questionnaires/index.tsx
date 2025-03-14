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
  Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteIcon from '@mui/icons-material/Delete';
import { useRouter } from 'next/router';
import dayjs from 'dayjs';
import { withNavigationLayout } from '../../../utils/layout';
import { callFrontendApi } from '../../../lib/api';

interface Questionnaire {
  id: number;
  title: string;
  description: string;
  type: string;
  is_paginated: boolean;
  created_at: string;
  question_count: number;
}

export default function QuestionnairesList() {
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const fetchQuestionnaires = async () => {
      try {
        const data = await callFrontendApi<Questionnaire[]>(
          '/api/questionnaires',
          'GET'
        );
        setQuestionnaires(data);
      } catch (error) {
        console.error('Error fetching questionnaires:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchQuestionnaires();
  }, []);

  const handleCreateQuestionnaire = () => {
    router.push('/trainer/questionnaires/create');
  };

  const handleEditQuestionnaire = (id: number) => {
    router.push(`/trainer/questionnaires/${id}/edit`);
  };

  const handleViewQuestionnaire = (id: number) => {
    router.push(`/trainer/questionnaires/${id}`);
  };

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, { label: string, color: 'primary' | 'secondary' | 'success' | 'warning' }> = {
      'signup': { label: 'Sign Up', color: 'primary' },
      'pre_test': { label: 'Pre-Test', color: 'secondary' },
      'post_test': { label: 'Post-Test', color: 'success' },
      'trainer_evaluation': { label: 'Trainer Evaluation', color: 'warning' }
    };

    return typeMap[type] || { label: type, color: 'primary' };
  };

  return (
    <Box sx={{ my: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Questionnaires
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />}
          onClick={handleCreateQuestionnaire}
        >
          Create New
        </Button>
      </Box>

      {loading ? (
        <Typography>Loading questionnaires...</Typography>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Questions</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {questionnaires.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body1" sx={{ my: 2 }}>
                      No questionnaires found. Create your first questionnaire to get started.
                    </Typography>
                    <Button 
                      variant="outlined" 
                      startIcon={<AddIcon />}
                      onClick={handleCreateQuestionnaire}
                    >
                      Create Questionnaire
                    </Button>
                  </TableCell>
                </TableRow>
              ) : (
                questionnaires.map((questionnaire) => {
                  const typeInfo = getTypeLabel(questionnaire.type);
                  return (
                    <TableRow key={questionnaire.id}>
                      <TableCell>{questionnaire.title}</TableCell>
                      <TableCell>
                        <Chip 
                          label={typeInfo.label} 
                          color={typeInfo.color} 
                          size="small" 
                        />
                      </TableCell>
                      <TableCell>{questionnaire.question_count}</TableCell>
                      <TableCell>{dayjs(questionnaire.created_at).format('MMM D, YYYY')}</TableCell>
                      <TableCell>
                        <Tooltip title="View">
                          <IconButton 
                            size="small" 
                            onClick={() => handleViewQuestionnaire(questionnaire.id)}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton 
                            size="small" 
                            onClick={() => handleEditQuestionnaire(questionnaire.id)}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

// Replace the custom getLayout function with the utility
QuestionnairesList.getLayout = withNavigationLayout; 