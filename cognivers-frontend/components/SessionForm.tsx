import React, { useState, useEffect } from 'react';
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
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  Tooltip,
  IconButton,
  SelectChangeEvent,
  InputAdornment
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format } from 'date-fns';
import { getTrainers } from '../lib/api';
import { User, SessionCreateData, SessionUpdateData, Session } from '../lib/types';
import dayjs from 'dayjs';

// Add base URL configuration
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

export interface SessionFormData {
  title: string;
  description: string;
  start_date: Date | dayjs.Dayjs;
  end_date: Date | dayjs.Dayjs;
  trainer_id: number | '';
  is_public: boolean;
}

export interface SessionFormProps {
  initialData?: Partial<Session> & { trainer_id?: number };
  onSubmit: (data: SessionCreateData | SessionUpdateData) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  isEdit?: boolean;
}

export default function SessionForm({ 
  initialData, 
  onSubmit, 
  onCancel, 
  submitLabel = 'Save',
  isEdit = false
}: SessionFormProps) {
  // Form state
  const [formData, setFormData] = useState<SessionFormData>({
    title: initialData?.title || '',
    description: initialData?.description || '',
    start_date: initialData?.start_date ? dayjs(initialData.start_date) : dayjs(),
    end_date: initialData?.end_date ? dayjs(initialData.end_date) : dayjs().add(1, 'day'),
    trainer_id: initialData?.trainer_id || '',
    is_public: initialData?.is_public !== undefined ? initialData.is_public : true
  });

  // UI state
  const [trainers, setTrainers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSessionTypeHelp, setShowSessionTypeHelp] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  // Load trainers on component mount
  useEffect(() => {
    const fetchTrainers = async () => {
      setLoading(true);
      try {
        const data = await getTrainers();
        setTrainers(data);
      } catch (err) {
        console.error('Error fetching trainers:', err);
        setError('Failed to load trainers. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchTrainers();
  }, []);

  // Input handlers
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (name: string, value: Date | null | dayjs.Dayjs) => {
    if (value) {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleTrainerChange = (e: SelectChangeEvent<number | string>) => {
    setFormData(prev => ({ ...prev, trainer_id: e.target.value as number }));
  };

  const handlePublicToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, is_public: e.target.checked }));
  };

  const toggleSessionTypeHelp = () => {
    setShowSessionTypeHelp(!showSessionTypeHelp);
  };

  // Handler for copying session URL
  const handleCopyUrl = () => {
    if (!initialData?.session_code) return;
    
    const enrollmentUrl = `${BASE_URL}/sessions/enroll?code=${initialData.session_code}`;
    
    navigator.clipboard.writeText(enrollmentUrl)
      .then(() => {
        setUrlCopied(true);
        setTimeout(() => setUrlCopied(false), 2000);
      })
      .catch(err => {
        console.error('Error copying URL to clipboard:', err);
      });
  };

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.title || !formData.description || !formData.start_date || !formData.end_date || !formData.trainer_id) {
      setError('Please fill in all required fields');
      return;
    }
    
    // Ensure start date is before end date
    const startDate = dayjs(formData.start_date);
    const endDate = dayjs(formData.end_date);
    
    if (startDate.isAfter(endDate) || startDate.isSame(endDate)) {
      setError('End date must be after start date');
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    try {
      // Prepare data for submission
      const sessionData: SessionCreateData | SessionUpdateData = {
        title: formData.title,
        description: formData.description,
        start_date: formatDate(formData.start_date),
        end_date: formatDate(formData.end_date),
        trainer_id: Number(formData.trainer_id),
        is_public: formData.is_public
      };
      
      await onSubmit(sessionData);
    } catch (err: any) {
      console.error('Error saving session:', err);
      setError(err.message || `Failed to ${isEdit ? 'update' : 'create'} session. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  // Helper function to format dates consistently
  const formatDate = (date: Date | dayjs.Dayjs): string => {
    if (dayjs.isDayjs(date)) {
      return date.format('YYYY-MM-DD');
    }
    return format(date, 'yyyy-MM-dd');
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {/* Error display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Title field */}
      <TextField
        fullWidth
        name="title"
        label="Session Title"
        value={formData.title}
        onChange={handleInputChange}
        margin="normal"
        required
      />
      
      {/* Description field */}
      <TextField
        fullWidth
        name="description"
        label="Description"
        value={formData.description}
        onChange={handleInputChange}
        margin="normal"
        required
        multiline
        rows={4}
      />
      
      {/* Date range */}
      <LocalizationProvider dateAdapter={AdapterDateFns}>
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <DatePicker
            label="Start Date"
            value={dayjs.isDayjs(formData.start_date) ? formData.start_date.toDate() : formData.start_date}
            onChange={(date) => handleDateChange('start_date', date)}
            slotProps={{
              textField: {
                fullWidth: true,
                margin: "normal",
                required: true
              }
            }}
          />
          
          <DatePicker
            label="End Date"
            value={dayjs.isDayjs(formData.end_date) ? formData.end_date.toDate() : formData.end_date}
            onChange={(date) => handleDateChange('end_date', date)}
            slotProps={{
              textField: {
                fullWidth: true,
                margin: "normal",
                required: true
              }
            }}
          />
        </Box>
      </LocalizationProvider>
      
      {/* Trainer selection */}
      <FormControl fullWidth margin="normal" required>
        <InputLabel id="trainer-label">Trainer</InputLabel>
        <Select
          labelId="trainer-label"
          name="trainer_id"
          value={formData.trainer_id}
          onChange={handleTrainerChange}
          label="Trainer"
        >
          {trainers.map((trainer) => (
            <MenuItem key={trainer.id} value={trainer.id}>
              {trainer.first_name} {trainer.last_name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {/* Session Join URL - only show when editing an existing session */}
      {isEdit && initialData?.session_code && (
        <Box sx={{ mt: 2, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Session Join URL
          </Typography>
          <TextField
            fullWidth
            label="Enrollment Link"
            value={`${BASE_URL}/sessions/enroll?code=${initialData.session_code}`}
            margin="normal"
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <Tooltip title={urlCopied ? "Copied!" : "Copy URL"}>
                    <IconButton
                      edge="end"
                      onClick={handleCopyUrl}
                      aria-label="copy join url"
                    >
                      <ContentCopyIcon />
                    </IconButton>
                  </Tooltip>
                </InputAdornment>
              ),
            }}
            helperText="Share this link with clients for direct enrollment. When they click this link, they will be automatically enrolled in the session (if logged in) or prompted to login first."
          />
        </Box>
      )}
      
      {/* Session visibility section */}
      <Box sx={{ mt: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6" component="h2">
            Session Visibility
          </Typography>
          <Tooltip title="Click for more information about sessions">
            <IconButton onClick={toggleSessionTypeHelp} size="small" sx={{ ml: 1 }}>
              <HelpOutlineIcon />
            </IconButton>
          </Tooltip>
        </Box>
        
        {showSessionTypeHelp && (
          <Card variant="outlined" sx={{ mt: 2, mb: 3, bgcolor: 'background.paper' }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                About Session Visibility
              </Typography>
              
              <Typography variant="body2" paragraph>
                Choose the right visibility option based on how you want clients to discover this session:
              </Typography>
              
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight="bold">
                  Visible Sessions:
                </Typography>
                <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                  <li>Visible in the list of available sessions</li>
                  <li>Clients can join using the session code or direct enrollment link</li>
                  <li>Best for open enrollment programs or general training</li>
                </ul>
              </Box>
              
              <Box>
                <Typography variant="subtitle2" fontWeight="bold">
                  Hidden Sessions:
                </Typography>
                <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                  <li>Not visible in the available sessions list</li>
                  <li>Clients still need the session code or link to join</li>
                  <li>Best for targeted training or exclusive groups</li>
                </ul>
              </Box>
              
              <Divider sx={{ my: 2 }} />
              
              <Typography variant="body2">
                <strong>Note:</strong> All sessions require a session code for enrollment, regardless of visibility setting.
              </Typography>
            </CardContent>
          </Card>
        )}
        
        <FormControlLabel
          control={
            <Switch
              checked={formData.is_public}
              onChange={handlePublicToggle}
            />
          }
          label={
            <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
              {formData.is_public ? "Visible Session" : "Hidden Session"}
            </Box>
          }
        />
        
        <Typography 
          variant="body2" 
          color="text.secondary" 
          sx={{ mt: 1, ml: 4, pl: 1, borderLeft: '2px solid', borderColor: 'divider', py: 0.5 }}
        >
          {formData.is_public 
            ? "Visible sessions appear in the available sessions list for clients to discover." 
            : "Hidden sessions do not appear in the available sessions list. Clients need the session code or direct link to join."}
        </Typography>
      </Box>
      
      {/* Form actions */}
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
        {onCancel && (
          <Button onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          variant="contained"
          disabled={submitting || loading}
          sx={{ minWidth: 120 }}
        >
          {submitting ? <CircularProgress size={24} /> : submitLabel}
        </Button>
      </Box>
    </Box>
  );
} 