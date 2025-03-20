import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Paper,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Snackbar,
  SelectChangeEvent,
  Grid,
  InputAdornment,
  FormHelperText
} from '@mui/material';
import { useRouter } from 'next/router';
import { withNavigationLayout } from '../../../utils/layout';
import { callFrontendApi } from '../../../lib/api';

interface ProcessorFormData {
  name: string;
  description: string;
  prompt_template: string;
  post_processing_code: string;
  interpreter: string;
  status: string;
  llm_model?: string;
  llm_temperature?: number;
  llm_max_tokens?: number;
  llm_stop_sequences?: string[];
  llm_system_prompt?: string;
}

function CreateProcessor() {
  const router = useRouter();
  const [formData, setFormData] = useState<ProcessorFormData>({
    name: '',
    description: '',
    prompt_template: '',
    post_processing_code: '',
    interpreter: 'none',
    status: 'testing',
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

  const handleTextFieldChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSelectChange = (e: SelectChangeEvent) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value ? Number(value) : undefined
    }));
  };

  return (
    <Box sx={{ my: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Create New Processor
      </Typography>

      <Paper sx={{ p: 3, mt: 3 }}>
        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                name="name"
                value={formData.name}
                onChange={handleTextFieldChange}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                name="description"
                value={formData.description}
                onChange={handleTextFieldChange}
                multiline
                rows={2}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="System Prompt"
                name="llm_system_prompt"
                value={formData.llm_system_prompt || ''}
                onChange={handleTextFieldChange}
                multiline
                rows={3}
                helperText="Instructions that define the LLM's role and behavior. This sets the context for how the LLM should interpret and respond to the prompt template."
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Prompt Template"
                name="prompt_template"
                value={formData.prompt_template}
                onChange={handleTextFieldChange}
                multiline
                rows={4}
                required
                helperText="Main template for generating prompts. Available variables:
                • {{question_text}} - The text of the question
                • {{answer}} - The user's answer to the question
                • {{question_type}} - The type of question (text, multiple_choice_single, multiple_choice_multiple)
                • {{question_configuration}} - The question's configuration (choices, etc.)
                • {{started_at}} - When the response was started
                • {{completed_at}} - When the response was completed
                • {{attempt_number}} - The attempt number for this response"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Post Processing Code"
                name="post_processing_code"
                value={formData.post_processing_code}
                onChange={handleTextFieldChange}
                multiline
                rows={6}
                helperText="Optional code to process the LLM output"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Interpreter</InputLabel>
                <Select
                  name="interpreter"
                  value={formData.interpreter}
                  onChange={handleSelectChange}
                  label="Interpreter"
                >
                  <MenuItem value="none">None</MenuItem>
                  <MenuItem value="python">Python</MenuItem>
                  <MenuItem value="javascript">JavaScript</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  name="status"
                  value={formData.status}
                  onChange={handleSelectChange}
                  label="Status"
                >
                  <MenuItem value="testing">Testing</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="inactive">Inactive</MenuItem>
                </Select>
                <FormHelperText>
                  • Testing: Use while developing and testing the processor. Won't be used in production.
                  • Active: Processor is ready for use in production.
                  • Inactive: Processor is temporarily disabled but can be reactivated later.
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                LLM Configuration
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="LLM Model"
                name="llm_model"
                value={formData.llm_model || ''}
                onChange={handleTextFieldChange}
                helperText="e.g., gpt-4, claude-3-opus"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Temperature"
                name="llm_temperature"
                type="number"
                value={formData.llm_temperature}
                onChange={handleNumberChange}
                InputProps={{
                  inputProps: { min: 0, max: 1, step: 0.1 }
                }}
                helperText="Controls randomness in the LLM's output (0-1):
                • 0.0: Most deterministic, always chooses the most likely next token
                • 0.7: Balanced creativity (default), good for most tasks
                • 1.0: Maximum creativity, more diverse but potentially less focused responses
                Lower values (0.1-0.3) are best for:
                • Factual responses
                • Code generation
                • Data extraction
                Higher values (0.7-0.9) are better for:
                • Creative writing
                • Brainstorming
                • Generating diverse ideas"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Max Tokens"
                name="llm_max_tokens"
                type="number"
                value={formData.llm_max_tokens}
                onChange={handleNumberChange}
                InputProps={{
                  inputProps: { min: 1, max: 4000 }
                }}
                helperText="Maximum length of the response in tokens (roughly 4 characters per token). For example:
                • 100 tokens ≈ 400 characters
                • 500 tokens ≈ 2000 characters
                • 2000 tokens ≈ 8000 characters
                Higher values allow for longer, more detailed responses but may increase processing time and costs."
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Stop Sequences"
                name="llm_stop_sequences"
                value={formData.llm_stop_sequences?.join(', ') || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData(prev => ({
                    ...prev,
                    llm_stop_sequences: value ? value.split(',').map(s => s.trim()) : undefined
                  }));
                }}
                helperText="Comma-separated list of sequences that tell the LLM when to stop generating text. Examples:
                • '.' - Stop after a complete sentence
                • '\\n\\n' - Stop after a paragraph
                • 'END' - Stop at a specific marker
                • '\\n\\n, END, STOP' - Multiple stop conditions"
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2 }}>
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
            </Grid>
          </Grid>
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