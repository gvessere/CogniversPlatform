import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Divider, 
  Chip,
  Grid,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Button
} from '@mui/material';
import { useRouter } from 'next/router';
import { QuestionnaireFormData, QuestionFormData } from './QuestionnaireForm';

interface QuestionnaireViewProps {
  questionnaire: QuestionnaireFormData;
  onEdit?: () => void;
}

const QuestionnaireView: React.FC<QuestionnaireViewProps> = ({ 
  questionnaire,
  onEdit
}) => {
  const router = useRouter();

  const getTypeLabel = (type: string) => {
    const typeMap: Record<string, { label: string, color: 'primary' | 'secondary' | 'success' | 'warning' }> = {
      'signup': { label: 'Sign Up', color: 'primary' },
      'pre_test': { label: 'Pre-Test', color: 'secondary' },
      'post_test': { label: 'Post-Test', color: 'success' },
      'trainer_evaluation': { label: 'Trainer Evaluation', color: 'warning' }
    };

    return typeMap[type] || { label: type, color: 'primary' };
  };

  const renderQuestionView = (question: QuestionFormData, index: number) => {
    return (
      <Card key={index} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Question {index + 1}</Typography>
            {question.is_required ? (
              <Chip label="Required" color="primary" size="small" />
            ) : (
              <Chip label="Optional" color="default" size="small" />
            )}
          </Box>
          
          <Typography variant="body1" gutterBottom>
            {question.text}
          </Typography>
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Type: {question.type === 'text' ? 'Text Input' : 
                      question.type === 'multiple_choice_single' ? 'Multiple Choice (Single)' : 
                      'Multiple Choice (Multiple)'}
              </Typography>
            </Grid>
            
            {question.time_limit_seconds && (
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Time Limit: {question.time_limit_seconds} seconds
                </Typography>
              </Grid>
            )}
            
            {questionnaire.is_paginated && (
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Page: {question.page_number}
                </Typography>
              </Grid>
            )}
          </Grid>
          
          {question.type === 'text' && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Answer Box Size: {
                  question.configuration.answer_box_size === 'small' ? 'Small (Single line)' :
                  question.configuration.answer_box_size === 'medium' ? 'Medium (3 lines)' :
                  'Large (5+ lines)'
                }
              </Typography>
            </Box>
          )}
          
          {(question.type === 'multiple_choice_single' || question.type === 'multiple_choice_multiple') && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Choices:
              </Typography>
              <List dense>
                {question.configuration.choices.map((choice, choiceIndex) => (
                  <ListItem key={choiceIndex}>
                    <ListItemText primary={`${choiceIndex + 1}. ${choice}`} />
                  </ListItem>
                ))}
              </List>
              
              {question.type === 'multiple_choice_multiple' && (
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  {question.configuration.min_choices && (
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Min Selections: {question.configuration.min_choices}
                      </Typography>
                    </Grid>
                  )}
                  
                  {question.configuration.max_choices && (
                    <Grid item xs={6}>
                      <Typography variant="subtitle2" color="text.secondary">
                        Max Selections: {question.configuration.max_choices}
                      </Typography>
                    </Grid>
                  )}
                </Grid>
              )}
            </Box>
          )}
        </CardContent>
      </Card>
    );
  };

  const typeInfo = getTypeLabel(questionnaire.type);

  return (
    <Box sx={{ my: 4, maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {questionnaire.title}
        </Typography>
        {onEdit && (
          <Button 
            variant="contained" 
            onClick={onEdit}
          >
            Edit Questionnaire
          </Button>
        )}
      </Box>
      
      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="body1">
              {questionnaire.description}
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Chip 
                label={typeInfo.label} 
                color={typeInfo.color} 
              />
              
              <Chip 
                label={questionnaire.is_paginated ? 'Paginated' : 'Single Page'} 
                variant="outlined" 
              />
              
              <Chip 
                label={questionnaire.requires_completion ? 'Completion Required' : 'Partial Completion Allowed'} 
                variant="outlined" 
              />
            </Box>
          </Grid>
        </Grid>
        
        <Divider sx={{ my: 4 }} />
        
        <Typography variant="h5" gutterBottom>
          Questions ({questionnaire.questions.length})
        </Typography>
        
        <Box sx={{ mt: 2 }}>
          {questionnaire.questions.map((question, index) => renderQuestionView(question, index))}
        </Box>
        
        <Box sx={{ mt: 4 }}>
          <Button
            variant="outlined"
            onClick={() => router.push('/trainer/questionnaires')}
          >
            Back to Questionnaires
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default QuestionnaireView; 