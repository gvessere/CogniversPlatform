import React from 'react';
import {
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box
} from '@mui/material';
import { Processor } from '../lib/types';

interface ProcessorFormProps {
  formData: Partial<Processor>;
  onChange: (data: Partial<Processor>) => void;
}

const ProcessorForm: React.FC<ProcessorFormProps> = ({ formData, onChange }) => {
  return (
    <Box sx={{ pt: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Name"
            value={formData.name}
            onChange={(e) => onChange({ ...formData, name: e.target.value })}
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
            label="Prompt Template"
            multiline
            rows={4}
            value={formData.prompt_template}
            onChange={(e) => onChange({ ...formData, prompt_template: e.target.value })}
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="Post Processing Code"
            multiline
            rows={4}
            value={formData.post_processing_code}
            onChange={(e) => onChange({ ...formData, post_processing_code: e.target.value })}
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
              value={formData.status}
              label="Status"
              onChange={(e) => onChange({ ...formData, status: e.target.value as 'active' | 'inactive' | 'testing' })}
            >
              <MenuItem value="testing">Testing</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} md={6}>
          <TextField
            fullWidth
            label="LLM Model"
            value={formData.llm_model}
            onChange={(e) => onChange({ ...formData, llm_model: e.target.value })}
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
        </Grid>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="System Prompt"
            multiline
            rows={2}
            value={formData.llm_system_prompt}
            onChange={(e) => onChange({ ...formData, llm_system_prompt: e.target.value })}
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProcessorForm; 