import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { 
  Box, 
  TextField, 
  Button, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  FormControlLabel, 
  Switch,
  Typography,
  Paper,
  Alert,
  SelectChangeEvent,
  CircularProgress,
  FormHelperText
} from '@mui/material';
import { callFrontendApi } from '../../lib/api';
import { Processor } from '../../lib/types';

interface ProcessorFormProps {
  initialData?: Partial<Processor>;
  isEdit?: boolean;
}

const defaultFormData: Partial<Processor> = {
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
};

const ProcessorForm: React.FC<ProcessorFormProps> = ({ initialData, isEdit = false }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Processor>>(defaultFormData);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    console.log('Initial data received:', initialData);
    if (initialData) {
      const newFormData = {
        ...defaultFormData,
        ...initialData,
        llm_system_prompt: initialData.llm_system_prompt ?? defaultFormData.llm_system_prompt
      };
      console.log('Setting form data to:', newFormData);
      setFormData(newFormData);
      setIsInitialized(true);
    } else if (!isEdit) {
      setIsInitialized(true);
    }
  }, [initialData, isEdit]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    // Validate required fields
    if (!formData.name || !formData.description || !formData.prompt_template || !formData.interpreter || !formData.status) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    try {
      if (isEdit && initialData?.id) {
        await callFrontendApi(`/api/processors/${initialData.id}`, 'PUT', formData);
        setSuccess('Processor updated successfully');
      } else {
        await callFrontendApi('/api/processors', 'POST', formData);
        setSuccess('Processor created successfully');
      }
      
      setTimeout(() => {
        router.push('/admin/processors');
      }, 1500);
    } catch (err) {
      console.error('Error saving processor:', err);
      setError('Failed to save processor');
    } finally {
      setLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <form onSubmit={handleSubmit}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Typography variant="h6" gutterBottom>
            {isEdit ? 'Edit Processor' : 'Create New Processor'}
          </Typography>

          {error && <Alert severity="error">{error}</Alert>}
          {success && <Alert severity="success">{success}</Alert>}

          <TextField
            label="Name"
            name="name"
            value={formData.name || ''}
            onChange={handleTextChange}
            required
            fullWidth
            helperText="A unique name for the processor"
          />

          <TextField
            label="Description"
            name="description"
            value={formData.description || ''}
            onChange={handleTextChange}
            multiline
            rows={2}
            fullWidth
            required
            helperText="A brief description of what this processor does"
          />

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              LLM Configuration
            </Typography>
            <TextField
              label="System Message"
              name="llm_system_prompt"
              value={formData.llm_system_prompt || ''}
              onChange={handleTextChange}
              multiline
              rows={8}
              fullWidth
              helperText="System message to guide the LLM's behavior. This message sets the context and rules for how the LLM should process the input."
              FormHelperTextProps={{ sx: { whiteSpace: 'pre-line' } }}
            />
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Template Configuration
            </Typography>
            <TextField
              label="Prompt Template"
              name="prompt_template"
              value={formData.prompt_template || ''}
              onChange={handleTextChange}
              multiline
              rows={4}
              fullWidth
              required
              helperText={`Use Jinja2 syntax. Available variables: questions, questionnaire_id, user_id. This template defines how the input data should be formatted for the LLM.

Examples:
• Basic loop:
  {% for question in questions %}
  Question: {{ question.text }}
  {% endfor %}

• With index:
  {% for question in questions %}
  Question #{{ loop.index }}: {{ question.text }}
  {% endfor %}

• With conditions:
  {% if question.is_required %}Required: {% endif %}{{ question.text }}

• With multiple fields:
  {% for question in questions %}
  Q{{ loop.index }}: {{ question.text }} (Type: {{ question.type }})
  {% endfor %}`}
              FormHelperTextProps={{ sx: { whiteSpace: 'pre-line', fontFamily: 'monospace' } }}
            />
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Processing Configuration
            </Typography>
            <TextField
              label="Post Processing Code"
              name="post_processing_code"
              value={formData.post_processing_code || ''}
              onChange={handleTextChange}
              multiline
              rows={4}
              fullWidth
              helperText={`Optional Python code to process the raw output from the LLM. This code can transform, validate, or enrich the LLM's response.

Example:
def process_output(output):
    # Clean up the output
    cleaned = output.strip()
    
    # Parse the response
    try:
        result = json.loads(cleaned)
        return result
    except:
        return {"error": "Failed to parse output"}`}
              FormHelperTextProps={{ sx: { whiteSpace: 'pre-line', fontFamily: 'monospace' } }}
            />
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              Runtime Configuration
            </Typography>
            <FormControl fullWidth required>
              <InputLabel>Interpreter</InputLabel>
              <Select
                name="interpreter"
                value={formData.interpreter || 'none'}
                onChange={handleSelectChange}
                label="Interpreter"
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="python">Python</MenuItem>
                <MenuItem value="javascript">JavaScript</MenuItem>
              </Select>
              <FormHelperText>The language used to interpret the post-processing code</FormHelperText>
            </FormControl>

            <FormControl fullWidth required sx={{ mt: 2 }}>
              <InputLabel>Status</InputLabel>
              <Select
                name="status"
                value={formData.status || 'testing'}
                onChange={handleSelectChange}
                label="Status"
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
                <MenuItem value="testing">Testing</MenuItem>
              </Select>
              <FormHelperText>Current status of the processor. Only active processors will be used in production.</FormHelperText>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  name="is_active"
                  checked={formData.is_active ?? true}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                />
              }
              label="Active"
              sx={{ mt: 2 }}
            />
            <FormHelperText>Whether this processor is currently active and should be used for processing</FormHelperText>
          </Box>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" gutterBottom>
              LLM Parameters
            </Typography>
            <TextField
              label="LLM Temperature"
              name="llm_temperature"
              type="number"
              value={formData.llm_temperature || 0.7}
              onChange={handleTextChange}
              fullWidth
              inputProps={{ step: 0.1, min: 0, max: 1 }}
              helperText="Controls randomness in the LLM's output. Higher values (e.g., 0.8) make the output more random, while lower values (e.g., 0.2) make it more deterministic."
              FormHelperTextProps={{ sx: { whiteSpace: 'pre-line' } }}
            />

            <TextField
              label="LLM Max Tokens"
              name="llm_max_tokens"
              type="number"
              value={formData.llm_max_tokens || 2000}
              onChange={handleTextChange}
              fullWidth
              inputProps={{ min: 1 }}
              sx={{ mt: 2 }}
              helperText="Maximum number of tokens the LLM can generate in its response. Higher values allow for longer responses but may increase processing time."
              FormHelperTextProps={{ sx: { whiteSpace: 'pre-line' } }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 4 }}>
            <Button
              variant="outlined"
              onClick={() => router.push('/admin/processors')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
            >
              {loading ? 'Saving...' : (isEdit ? 'Update' : 'Create')}
            </Button>
          </Box>
        </Box>
      </form>
    </Paper>
  );
};

export default ProcessorForm; 