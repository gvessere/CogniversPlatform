import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  FormControlLabel, 
  Switch, 
  Divider, 
  Paper,
  IconButton,
  Grid,
  Card,
  CardContent,
  FormHelperText,
  Tooltip,
  Alert,
  Snackbar,
  SelectChangeEvent,
  Checkbox,
  ListItemText,
  OutlinedInput,
  CircularProgress
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { useRouter } from 'next/router';
import { formatErrorMessage } from '../../utils/errorUtils';
import { getSessions } from '../../lib/api';

// Types should match backend models
export interface QuestionFormData {
  text: string;
  type: string;
  order: number;
  is_required: boolean;
  time_limit_seconds: number | null;
  configuration: {
    answer_box_size: string;
    choices: string[];
    min_choices?: number | null;
    max_choices?: number | null;
  };
  page_number: number;
}

export interface QuestionnaireFormData {
  id?: number;
  title: string;
  description: string;
  type: string;
  is_paginated: boolean;
  requires_completion: boolean;
  number_of_attempts: number;
  questions: QuestionFormData[];
  sessions?: number[];
}

interface QuestionnaireFormProps {
  initialData?: QuestionnaireFormData;
  onSubmit: (data: QuestionnaireFormData) => Promise<void>;
  submitButtonText: string;
  isLoading?: boolean;
}

export const initialQuestionState: QuestionFormData = {
  text: '',
  type: 'text',
  order: 1,
  is_required: true,
  time_limit_seconds: null,
  configuration: {
    answer_box_size: 'medium',
    choices: [],
    min_choices: null,
    max_choices: null,
  },
  page_number: 1
};

export const initialFormState: QuestionnaireFormData = {
  title: '',
  description: '',
  type: 'signup',
  is_paginated: false,
  requires_completion: true,
  number_of_attempts: 1,
  questions: [{ ...initialQuestionState }],
  sessions: []
};

const QuestionnaireForm: React.FC<QuestionnaireFormProps> = ({
  initialData,
  onSubmit,
  submitButtonText,
  isLoading = false
}) => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [formState, setFormState] = useState<QuestionnaireFormData>(
    initialData || initialFormState
  );
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [sessions, setSessions] = useState<{ id: number; title: string }[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);

  // Fetch available sessions when component mounts
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setSessionsLoading(true);
        const sessionsData = await getSessions();
        setSessions(sessionsData);
      } catch (error) {
        console.error('Error fetching sessions:', error);
        setError('Failed to load available sessions');
      } finally {
        setSessionsLoading(false);
      }
    };

    fetchSessions();
  }, []);

  // Handle form field changes for text inputs, switches, etc.
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked, type } = e.target;
    setFormState({
      ...formState,
      [name]: type === 'checkbox' ? checked : 
              type === 'number' ? Number(value) : 
              value
    });
  };

  // Handle select changes
  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    setFormState({
      ...formState,
      [name]: value
    });
  };

  // Handle question changes
  const handleQuestionChange = (
    index: number, 
    field: string, 
    value: string | number | boolean | string[] | null
  ) => {
    const updatedQuestions = [...formState.questions];
    
    // Handle nested configuration object
    if (field.startsWith('configuration.')) {
      const configField = field.split('.')[1];
      updatedQuestions[index] = {
        ...updatedQuestions[index],
        configuration: {
          ...updatedQuestions[index].configuration,
          [configField]: value
        }
      };
    } else {
      updatedQuestions[index] = {
        ...updatedQuestions[index],
        [field]: value
      };
    }
    
    setFormState({
      ...formState,
      questions: updatedQuestions
    });
  };

  // Add a new question
  const addQuestion = () => {
    const newQuestion = {
      ...initialQuestionState,
      order: formState.questions.length + 1,
      page_number: formState.is_paginated ? Math.max(...formState.questions.map(q => q.page_number), 1) : 1
    };
    
    setFormState({
      ...formState,
      questions: [...formState.questions, newQuestion]
    });
  };

  // Remove a question
  const removeQuestion = (index: number) => {
    const updatedQuestions = [...formState.questions];
    updatedQuestions.splice(index, 1);
    
    // Reorder remaining questions
    updatedQuestions.forEach((q, i) => {
      q.order = i + 1;
    });
    
    setFormState({
      ...formState,
      questions: updatedQuestions
    });
  };

  // Move question up in order
  const moveQuestionUp = (index: number) => {
    if (index === 0) return;
    
    const updatedQuestions = [...formState.questions];
    const temp = updatedQuestions[index];
    updatedQuestions[index] = updatedQuestions[index - 1];
    updatedQuestions[index - 1] = temp;
    
    // Update order properties
    updatedQuestions.forEach((q, i) => {
      q.order = i + 1;
    });
    
    setFormState({
      ...formState,
      questions: updatedQuestions
    });
  };

  // Move question down in order
  const moveQuestionDown = (index: number) => {
    if (index === formState.questions.length - 1) return;
    
    const updatedQuestions = [...formState.questions];
    const temp = updatedQuestions[index];
    updatedQuestions[index] = updatedQuestions[index + 1];
    updatedQuestions[index + 1] = temp;
    
    // Update order properties
    updatedQuestions.forEach((q, i) => {
      q.order = i + 1;
    });
    
    setFormState({
      ...formState,
      questions: updatedQuestions
    });
  };

  // Add a new choice to a multiple choice question
  const addChoice = (questionIndex: number) => {
    const updatedQuestions = [...formState.questions];
    updatedQuestions[questionIndex].configuration.choices.push('');
    
    setFormState({
      ...formState,
      questions: updatedQuestions
    });
  };

  // Update a choice in a multiple choice question
  const updateChoice = (questionIndex: number, choiceIndex: number, value: string) => {
    const updatedQuestions = [...formState.questions];
    updatedQuestions[questionIndex].configuration.choices[choiceIndex] = value;
    
    setFormState({
      ...formState,
      questions: updatedQuestions
    });
  };

  // Remove a choice from a multiple choice question
  const removeChoice = (questionIndex: number, choiceIndex: number) => {
    const updatedQuestions = [...formState.questions];
    updatedQuestions[questionIndex].configuration.choices.splice(choiceIndex, 1);
    
    setFormState({
      ...formState,
      questions: updatedQuestions
    });
  };

  // Add handler for session selection
  const handleSessionChange = (event: SelectChangeEvent<number[]>) => {
    const { value } = event.target;
    setFormState({
      ...formState,
      sessions: typeof value === 'string' ? [parseInt(value)] : value as number[]
    });
  };

  // Validate the form before submission
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Validate questionnaire fields
    if (!formState.title.trim()) {
      errors.title = 'Title is required';
    }
    
    if (!formState.description.trim()) {
      errors.description = 'Description is required';
    }
    
    if (!formState.type) {
      errors.type = 'Type is required';
    }
    
    // Validate questions
    if (formState.questions.length === 0) {
      errors.questions = 'At least one question is required';
    }
    
    formState.questions.forEach((question, index) => {
      if (!question.text.trim()) {
        errors[`question_${index}_text`] = 'Question text is required';
      }
      
      if (question.type === 'multiple_choice_single' || question.type === 'multiple_choice_multiple') {
        if (question.configuration.choices.length < 2) {
          errors[`question_${index}_choices`] = 'At least two choices are required';
        }
        
        question.configuration.choices.forEach((choice, choiceIndex) => {
          if (!choice.trim()) {
            errors[`question_${index}_choice_${choiceIndex}`] = 'Choice text is required';
          }
        });
      }
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit the form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setError(null);
    setSuccessMessage(null);
    
    try {
      await onSubmit(formState);
    } catch (error) {
      setError(formatErrorMessage(error, 'An error occurred while saving the questionnaire'));
      console.error('Error saving questionnaire:', error);
    }
  };

  // Render form for a question based on its type
  const renderQuestionForm = (question: QuestionFormData, index: number) => {
    return (
      <Card key={index} sx={{ mb: 3, position: 'relative' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Question {index + 1}</Typography>
            <Box>
              <Tooltip title="Move Up">
                <IconButton 
                  size="small" 
                  disabled={index === 0}
                  onClick={() => moveQuestionUp(index)}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Move Down">
                <IconButton 
                  size="small"
                  disabled={index === formState.questions.length - 1}
                  onClick={() => moveQuestionDown(index)}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete Question">
                <IconButton 
                  size="small" 
                  color="error"
                  onClick={() => removeQuestion(index)}
                  disabled={formState.questions.length === 1}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Question Text"
                value={question.text}
                onChange={(e) => handleQuestionChange(index, 'text', e.target.value)}
                error={!!validationErrors[`question_${index}_text`]}
                helperText={validationErrors[`question_${index}_text`]}
              />
            </Grid>
            
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Question Type</InputLabel>
                <Select
                  value={question.type}
                  label="Question Type"
                  onChange={(e) => handleQuestionChange(index, 'type', e.target.value)}
                >
                  <MenuItem value="text">Text Input</MenuItem>
                  <MenuItem value="multiple_choice_single">Multiple Choice (Single Answer)</MenuItem>
                  <MenuItem value="multiple_choice_multiple">Multiple Choice (Multiple Answers)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            
            <Grid item xs={6}>
              <TextField
                fullWidth
                type="number"
                label="Time Limit (seconds)"
                placeholder="Leave blank for no limit"
                value={question.time_limit_seconds || ''}
                onChange={(e) => handleQuestionChange(index, 'time_limit_seconds', e.target.value ? parseInt(e.target.value) : null)}
              />
            </Grid>
            
            {formState.is_paginated && (
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Page Number"
                  value={question.page_number}
                  onChange={(e) => handleQuestionChange(index, 'page_number', parseInt(e.target.value))}
                  InputProps={{ inputProps: { min: 1 } }}
                />
              </Grid>
            )}
            
            <Grid item xs={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={question.is_required}
                    onChange={(e) => handleQuestionChange(index, 'is_required', e.target.checked)}
                  />
                }
                label="Required"
              />
            </Grid>
            
            {question.type === 'text' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Answer Box Size</InputLabel>
                  <Select
                    value={question.configuration.answer_box_size}
                    label="Answer Box Size"
                    onChange={(e) => handleQuestionChange(index, 'configuration.answer_box_size', e.target.value)}
                  >
                    <MenuItem value="small">Small (Single line)</MenuItem>
                    <MenuItem value="medium">Medium (3 lines)</MenuItem>
                    <MenuItem value="large">Large (5+ lines)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}
            
            {(question.type === 'multiple_choice_single' || question.type === 'multiple_choice_multiple') && (
              <Grid item xs={12}>
                <Typography variant="subtitle2" gutterBottom>
                  Choices
                </Typography>
                
                {validationErrors[`question_${index}_choices`] && (
                  <FormHelperText error>
                    {validationErrors[`question_${index}_choices`]}
                  </FormHelperText>
                )}
                
                {question.configuration.choices.map((choice, choiceIndex) => (
                  <Box key={choiceIndex} sx={{ display: 'flex', mb: 1 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label={`Choice ${choiceIndex + 1}`}
                      value={choice}
                      onChange={(e) => updateChoice(index, choiceIndex, e.target.value)}
                      error={!!validationErrors[`question_${index}_choice_${choiceIndex}`]}
                      helperText={validationErrors[`question_${index}_choice_${choiceIndex}`]}
                    />
                    <IconButton 
                      color="error" 
                      onClick={() => removeChoice(index, choiceIndex)}
                      disabled={question.configuration.choices.length <= 2}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                ))}
                
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => addChoice(index)}
                  sx={{ mt: 1 }}
                >
                  Add Choice
                </Button>
              </Grid>
            )}
            
            {question.type === 'multiple_choice_multiple' && (
              <Grid container item xs={12} spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Min Selections"
                    placeholder="Optional"
                    value={question.configuration.min_choices || ''}
                    onChange={(e) => handleQuestionChange(
                      index, 
                      'configuration.min_choices', 
                      e.target.value ? parseInt(e.target.value) : null
                    )}
                    InputProps={{ inputProps: { min: 1 } }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Max Selections"
                    placeholder="Optional"
                    value={question.configuration.max_choices || ''}
                    onChange={(e) => handleQuestionChange(
                      index, 
                      'configuration.max_choices', 
                      e.target.value ? parseInt(e.target.value) : null
                    )}
                    InputProps={{ inputProps: { min: 1 } }}
                  />
                </Grid>
              </Grid>
            )}
          </Grid>
        </CardContent>
      </Card>
    );
  };

  return (
    <Box sx={{ my: 4, maxWidth: 1000, mx: 'auto' }}>
      <Paper sx={{ p: 3, mt: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Questionnaire Title"
                name="title"
                value={formState.title}
                onChange={handleInputChange}
                error={!!validationErrors.title}
                helperText={validationErrors.title}
                required
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                value={formState.description}
                onChange={handleInputChange}
                multiline
                rows={3}
                error={!!validationErrors.description}
                helperText={validationErrors.description}
                required
              />
            </Grid>
            
            <Grid item xs={12} md={6}>
              <FormControl fullWidth required error={!!validationErrors.type}>
                <InputLabel>Questionnaire Type</InputLabel>
                <Select
                  name="type"
                  value={formState.type}
                  label="Questionnaire Type"
                  onChange={handleSelectChange}
                >
                  <MenuItem value="signup">Sign Up</MenuItem>
                  <MenuItem value="pre_test">Pre-Test</MenuItem>
                  <MenuItem value="post_test">Post-Test</MenuItem>
                  <MenuItem value="trainer_evaluation">Trainer Evaluation</MenuItem>
                </Select>
                {validationErrors.type && (
                  <FormHelperText>{validationErrors.type}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                <FormControlLabel
                  control={
                    <Switch
                      name="is_paginated"
                      checked={formState.is_paginated}
                      onChange={handleInputChange}
                    />
                  }
                  label="Enable pagination"
                />
                <FormControlLabel
                  control={
                    <Switch
                      name="requires_completion"
                      checked={formState.requires_completion}
                      onChange={handleInputChange}
                    />
                  }
                  label="Require completion of all required questions"
                />
                <TextField
                  fullWidth
                  label="Number of Attempts"
                  name="number_of_attempts"
                  type="number"
                  value={formState.number_of_attempts}
                  onChange={handleInputChange}
                  inputProps={{ min: 1 }}
                  error={!!validationErrors.number_of_attempts}
                  helperText={validationErrors.number_of_attempts}
                />
              </Box>
            </Grid>

            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel id="sessions-label">Associate with Sessions</InputLabel>
                <Select
                  labelId="sessions-label"
                  multiple
                  value={formState.sessions || []}
                  onChange={handleSessionChange}
                  input={<OutlinedInput label="Associate with Sessions" />}
                  renderValue={(selected) => {
                    const selectedTitles = sessions
                      .filter(session => selected.includes(session.id))
                      .map(session => session.title);
                    return selectedTitles.join(', ');
                  }}
                  startAdornment={
                    sessionsLoading ? (
                      <CircularProgress size={20} sx={{ mr: 1 }} />
                    ) : null
                  }
                >
                  {sessions.map((session) => (
                    <MenuItem key={session.id} value={session.id}>
                      <Checkbox checked={(formState.sessions || []).includes(session.id)} />
                      <ListItemText primary={session.title} />
                    </MenuItem>
                  ))}
                </Select>
                <FormHelperText>
                  Select sessions to associate this questionnaire with
                </FormHelperText>
              </FormControl>
            </Grid>
          </Grid>
          
          <Divider sx={{ my: 4 }} />
          
          <Typography variant="h5" gutterBottom>
            Questions
          </Typography>
          
          {validationErrors.questions && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {validationErrors.questions}
            </Alert>
          )}
          
          <Box sx={{ mt: 2 }}>
            {formState.questions.map((question, index) => renderQuestionForm(question, index))}
            
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={addQuestion}
              sx={{ mt: 2 }}
            >
              Add Question
            </Button>
          </Box>
          
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
            <Button
              variant="outlined"
              onClick={() => router.push('/trainer/questionnaires')}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : submitButtonText}
            </Button>
          </Box>
        </form>
      </Paper>
      
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
    </Box>
  );
};

export default QuestionnaireForm; 