import React from 'react';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  FormControlLabel,
  Switch,
  FormHelperText,
  Typography
} from '@mui/material';
import { Processor } from '../lib/types';

interface ProcessorFormProps {
  formData: Partial<Processor>;
  onChange: (data: Partial<Processor>) => void;
  isEdit?: boolean;
}

const ProcessorForm: React.FC<ProcessorFormProps> = ({ formData, onChange, isEdit = false }) => {
  return (
    <Box sx={{ pt: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Name"
            value={formData.name}
            onChange={(e) => onChange({ ...formData, name: e.target.value })}
            required
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Description"
            multiline
            rows={2}
            value={formData.description}
            onChange={(e) => onChange({ ...formData, description: e.target.value })}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="System Prompt"
            name="llm_system_prompt"
            value={formData.llm_system_prompt || ''}
            onChange={(e) => onChange({ ...formData, llm_system_prompt: e.target.value })}
            multiline
            rows={6}
            helperText={`Instructions that define the LLM's role and behavior.\nThis sets the context for how the LLM should interpret and respond to the prompt template.`}
            FormHelperTextProps={{ sx: { whiteSpace: 'pre-line' } }}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Prompt Template"
            name="prompt_template"
            value={formData.prompt_template}
            onChange={(e) => onChange({ ...formData, prompt_template: e.target.value })}
            multiline
            rows={8}
            required
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Main template for generating prompts. Uses Jinja2 syntax.
            <br /><br />
            Available variables:
            <br />• questions: List of question objects, each containing:
            <br />&nbsp;&nbsp;&nbsp;&nbsp;- id: Question ID
            <br />&nbsp;&nbsp;&nbsp;&nbsp;- text: Question text
            <br />&nbsp;&nbsp;&nbsp;&nbsp;- type: Question type
            <br />&nbsp;&nbsp;&nbsp;&nbsp;- answer: User's answer
            <br />&nbsp;&nbsp;&nbsp;&nbsp;- index: 1-based index in the batch
            <br />• questionnaire_id: ID of the questionnaire
            <br />• user_id: ID of the user who submitted the response
            <br /><br />
            Example template:
            <br />{'{% for question in questions %}'}
            <br />&nbsp;&nbsp;&nbsp;&nbsp;Question #{'{question.index}'}
            <br />&nbsp;&nbsp;&nbsp;&nbsp;{'{question.text}'}
            <br />&nbsp;&nbsp;&nbsp;&nbsp;Answer: {'{question.answer}'}
            <br />{'{% endfor %}'}
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Post Processing Code"
            name="post_processing_code"
            value={formData.post_processing_code}
            onChange={(e) => onChange({ ...formData, post_processing_code: e.target.value })}
            multiline
            rows={6}
            helperText="Optional code to process the LLM output"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <FormControl fullWidth>
            <InputLabel>Interpreter</InputLabel>
            <Select
              value={formData.interpreter}
              label="Interpreter"
              onChange={(e) => onChange({ ...formData, interpreter: e.target.value as 'python' | 'javascript' | 'none' })}
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
              onChange={(e) => onChange({ ...formData, status: e.target.value as 'active' | 'inactive' | 'testing' })}
              label="Status"
            >
              <MenuItem value="testing">Testing</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              • Testing: Use while developing and testing the processor. Won't be used in production.
              <br />• Active: Processor is ready for use in production.
              <br />• Inactive: Processor is temporarily disabled but can be reactivated later.
            </Typography>
          </FormControl>
        </Grid>
        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={formData.is_active}
                onChange={(e) => onChange({ ...formData, is_active: e.target.checked })}
              />
            }
            label="Active"
          />
          <FormHelperText>
            When active, this processor will be used to process responses. When inactive, it will be skipped.
          </FormHelperText>
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
            value={formData.llm_model || ''}
            onChange={(e) => onChange({ ...formData, llm_model: e.target.value })}
            helperText="e.g., gpt-4, claude-3-opus"
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Temperature"
            type="number"
            value={formData.llm_temperature}
            onChange={(e) => onChange({ ...formData, llm_temperature: parseFloat(e.target.value) })}
            InputProps={{
              inputProps: { min: 0, max: 1, step: 0.1 }
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Controls randomness in the LLM's output (0-1):
            <br /><br />
            • 0.0: Most deterministic, always chooses the most likely next token
            <br />• 0.7: Balanced creativity (default), good for most tasks
            <br />• 1.0: Maximum creativity, more diverse but potentially less focused responses
            <br /><br />
            Lower values (0.1-0.3) are best for:
            <br />&nbsp;&nbsp;&nbsp;&nbsp;• Factual responses
            <br />&nbsp;&nbsp;&nbsp;&nbsp;• Code generation
            <br />&nbsp;&nbsp;&nbsp;&nbsp;• Data extraction
            <br /><br />
            Higher values (0.7-0.9) are better for:
            <br />&nbsp;&nbsp;&nbsp;&nbsp;• Creative writing
            <br />&nbsp;&nbsp;&nbsp;&nbsp;• Brainstorming
            <br />&nbsp;&nbsp;&nbsp;&nbsp;• Generating diverse ideas
          </Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Max Tokens"
            type="number"
            value={formData.llm_max_tokens}
            onChange={(e) => onChange({ ...formData, llm_max_tokens: parseInt(e.target.value) })}
            InputProps={{
              inputProps: { min: 1, max: 4000 }
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Maximum length of the response in tokens (roughly 4 characters per token).
            <br /><br />
            For example:
            <br />&nbsp;&nbsp;&nbsp;&nbsp;• 100 tokens ≈ 400 characters
            <br />&nbsp;&nbsp;&nbsp;&nbsp;• 500 tokens ≈ 2000 characters
            <br />&nbsp;&nbsp;&nbsp;&nbsp;• 2000 tokens ≈ 8000 characters
            <br /><br />
            Higher values allow for longer, more detailed responses but may increase processing time and costs.
          </Typography>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="Stop Sequences"
            value={formData.llm_stop_sequences?.join(', ') || ''}
            onChange={(e) => {
              const value = e.target.value;
              onChange({
                ...formData,
                llm_stop_sequences: value ? value.split(',').map(s => s.trim()) : undefined
              });
            }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Comma-separated list of sequences that tell the LLM when to stop generating text.
            <br /><br />
            Examples:
            <br />&nbsp;&nbsp;&nbsp;&nbsp;• '.' - Stop after a complete sentence
            <br />&nbsp;&nbsp;&nbsp;&nbsp;• '\n\n' - Stop after a paragraph
            <br />&nbsp;&nbsp;&nbsp;&nbsp;• 'END' - Stop at a specific marker
            <br />&nbsp;&nbsp;&nbsp;&nbsp;• '\n\n, END, STOP' - Multiple stop conditions
          </Typography>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProcessorForm; 