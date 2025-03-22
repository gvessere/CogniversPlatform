import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Alert,
  CircularProgress,
  Tooltip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { withNavigationLayout } from '../../../utils/layout';
import { callFrontendApi } from '../../../lib/api';
import { formatErrorMessage } from '../../../utils/errorUtils';
import { QuestionnaireResponse, User, Session, Questionnaire } from '../../../lib/types';
import { format } from 'date-fns';

interface QuestionResponse {
  id: number;
  question_id: number;
  questionnaire_response_id: number;
  response_text: string;
  question_text: string;
  question_type: string;
  question_configuration: any;
}

interface QuestionnaireResponseWithDetails extends QuestionnaireResponse {
  id: number;
  questionnaire_id: number;
  session_id: number;
  user_id: number;
  status: string;
  created_at: string;
  updated_at: string;
  user: User;
  session: Session;
  questionnaire: Questionnaire;
  answers: QuestionResponse[];
}

interface Processor {
  id: number;
  name: string;
  description: string;
  status: string;
}

export default function QuestionnaireResponses() {
  const [responses, setResponses] = useState<QuestionnaireResponseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedResponse, setSelectedResponse] = useState<QuestionnaireResponseWithDetails | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [processors, setProcessors] = useState<Processor[]>([]);
  const [selectedProcessorId, setSelectedProcessorId] = useState<number | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    sessionId: '',
    startDate: null as Date | null,
    endDate: null as Date | null,
    userName: '',
    userEmail: '',
    questionnaireId: ''
  });

  const fetchResponses = async () => {
    try {
      setLoading(true);
      setError(null);
      const queryParams = new URLSearchParams({
        page: (page + 1).toString(), // Convert to 1-based pagination for backend
        limit: rowsPerPage.toString(),
        ...(filters.sessionId && { session_id: filters.sessionId }),
        ...(filters.startDate && { start_date: filters.startDate.toISOString() }),
        ...(filters.endDate && { end_date: filters.endDate.toISOString() }),
        ...(filters.userName && { user_name: filters.userName }),
        ...(filters.userEmail && { user_email: filters.userEmail }),
        ...(filters.questionnaireId && { questionnaire_id: filters.questionnaireId })
      });

      const response = await callFrontendApi(`/api/questionnaires/responses?${queryParams}`, 'GET');
      setResponses(response.items || []);
      setTotalCount(response.total || 0);
    } catch (err) {
      console.error('Error fetching responses:', err);
      setError(formatErrorMessage(err));
      setResponses([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchProcessors = async () => {
    try {
      const response = await callFrontendApi('/api/processors', 'GET');
      setProcessors(response);
      if (response.length > 0) {
        setSelectedProcessorId(response[0].id);
      }
    } catch (err) {
      console.error('Error fetching processors:', err);
      setError(formatErrorMessage(err));
    }
  };

  useEffect(() => {
    fetchResponses();
    fetchProcessors();
  }, [page, rowsPerPage, filters]);

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleFilterChange = (field: string, value: any) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(0);
  };

  const handleProcessResponse = async () => {
    if (!selectedResponse || !selectedProcessorId) return;

    try {
      setProcessing(true);
      await callFrontendApi(`/api/processors/requeue/${selectedResponse.id}`, 'POST', {
        processor_id: selectedProcessorId
      });
      setSuccessMessage('Successfully queued response for processing');
      setProcessDialogOpen(false);
      fetchResponses(); // Refresh to get updated status
    } catch (err) {
      console.error('Error processing response:', err);
      setError(formatErrorMessage(err));
    } finally {
      setProcessing(false);
    }
  };

  const renderFilters = () => (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid item xs={12} md={3}>
        <TextField
          fullWidth
          label="User Name"
          value={filters.userName}
          onChange={(e) => handleFilterChange('userName', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={3}>
        <TextField
          fullWidth
          label="User Email"
          value={filters.userEmail}
          onChange={(e) => handleFilterChange('userEmail', e.target.value)}
        />
      </Grid>
      <Grid item xs={12} md={3}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="Start Date"
            value={filters.startDate}
            onChange={(date) => handleFilterChange('startDate', date)}
            slotProps={{ textField: { fullWidth: true } }}
          />
        </LocalizationProvider>
      </Grid>
      <Grid item xs={12} md={3}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DatePicker
            label="End Date"
            value={filters.endDate}
            onChange={(date) => handleFilterChange('endDate', date)}
            slotProps={{ textField: { fullWidth: true } }}
          />
        </LocalizationProvider>
      </Grid>
    </Grid>
  );

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Questionnaire Responses
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {renderFilters()}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>User</TableCell>
              <TableCell>Questionnaire</TableCell>
              <TableCell>Session</TableCell>
              <TableCell>Submitted At</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : !responses || responses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No responses found
                </TableCell>
              </TableRow>
            ) : (
              responses.map((response) => (
                <TableRow key={response.id}>
                  <TableCell>{response.user.first_name} {response.user.last_name}</TableCell>
                  <TableCell>{response.questionnaire?.title || 'N/A'}</TableCell>
                  <TableCell>{response.session?.title || 'N/A'}</TableCell>
                  <TableCell>{format(new Date(response.created_at), 'PPpp')}</TableCell>
                  <TableCell>
                    <Tooltip title="View Response">
                      <IconButton onClick={() => {
                        setSelectedResponse(response);
                        setViewDialogOpen(true);
                      }}>
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Process Response">
                      <IconButton onClick={() => {
                        setSelectedResponse(response);
                        setProcessDialogOpen(true);
                      }}>
                        <PlayArrowIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <TablePagination
        component="div"
        count={totalCount}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25]}
      />

      {/* View Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Response Details</DialogTitle>
        <DialogContent>
          {selectedResponse && (
            <Box>
              <Typography variant="h6" gutterBottom>
                User Information
              </Typography>
              <Typography>
                Name: {selectedResponse.user.first_name} {selectedResponse.user.last_name}
              </Typography>
              <Typography>
                Email: {selectedResponse.user.email}
              </Typography>

              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Questionnaire Information
              </Typography>
              {selectedResponse.questionnaire ? (
                <>
                  <Typography>
                    Title: {selectedResponse.questionnaire.title}
                  </Typography>
                  <Typography>
                    Type: {selectedResponse.questionnaire.type}
                  </Typography>
                </>
              ) : (
                <Typography>No questionnaire information available</Typography>
              )}

              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Session Information
              </Typography>
              {selectedResponse.session ? (
                <>
                  <Typography>
                    Title: {selectedResponse.session.title}
                  </Typography>
                  <Typography>
                    Start Date: {format(new Date(selectedResponse.session.start_date), 'PP')}
                  </Typography>
                  <Typography>
                    End Date: {format(new Date(selectedResponse.session.end_date), 'PP')}
                  </Typography>
                </>
              ) : (
                <Typography>No session information available</Typography>
              )}

              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Answers
              </Typography>
              {selectedResponse.answers.map((answer, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1">
                    Question: {answer.question_text}
                  </Typography>
                  <Typography>
                    Answer: {answer.response_text}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Process Dialog */}
      <Dialog
        open={processDialogOpen}
        onClose={() => setProcessDialogOpen(false)}
      >
        <DialogTitle>Process Response</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Are you sure you want to process this response again?
          </Typography>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Processor</InputLabel>
            <Select
              value={selectedProcessorId || ''}
              onChange={(e) => setSelectedProcessorId(e.target.value as number)}
              label="Processor"
            >
              {processors.map((processor) => (
                <MenuItem key={processor.id} value={processor.id}>
                  {processor.name} ({processor.status})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProcessDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleProcessResponse}
            variant="contained"
            color="primary"
            disabled={processing || !selectedProcessorId}
          >
            {processing ? 'Processing...' : 'Process'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Apply the navigation layout
QuestionnaireResponses.getLayout = withNavigationLayout; 