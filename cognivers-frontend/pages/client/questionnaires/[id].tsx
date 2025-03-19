import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  TextField, 
  RadioGroup, 
  FormControlLabel, 
  Radio, 
  Checkbox, 
  FormGroup, 
  Paper, 
  Divider, 
  Alert, 
  CircularProgress,
  Grid,
  Stepper,
  Step,
  StepLabel,
  LinearProgress,
  Chip,
  Card,
  CardContent,
  Snackbar,
  Container
} from '@mui/material';
import { useAuth } from '../../../context/AuthContext';
import { getToken } from '../../../lib/auth';
import { useRouter } from 'next/router';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TimerIcon from '@mui/icons-material/Timer';
import SideNavigation from '../../../components/SideNavigation';
import { withNavigationLayout } from '../../../utils/layout';
import { formatErrorMessage } from '../../../utils/errorUtils';
import { callFrontendApi } from '../../../lib/api';

// Define types for our data structures
interface QuestionConfiguration {
  answer_box_size: string;
  choices: string[];
  min_choices?: number | null;
  max_choices?: number | null;
}

interface Question {
  id: number;
  text: string;
  type: string;
  order: number;
  is_required: boolean;
  time_limit_seconds: number | null;
  configuration: QuestionConfiguration;
  page_number: number;
}

interface Questionnaire {
  id: number;
  title: string;
  description: string;
  type: string;
  is_paginated: boolean;
  requires_completion: boolean;
  number_of_attempts: number;
  questions: Question[];
}

interface ResponseState {
  [questionId: number]: {
    answer: any;
    saving: boolean;
    saved: boolean;
    error: string | null;
    interactionBatchId?: number;
    question_text?: string;
  };
}

interface QuestionnaireAttempt {
  id: number;
  questionnaire_id: number;
  user_id: number;
  started_at: string;
  completed_at: string | null;
  attempt_number: number;
}

interface AttemptsData {
  attempts: QuestionnaireAttempt[];
  completed_count: number;
  remaining_attempts: number;
}

const TakeQuestionnaire: React.FC = () => {
  const router = useRouter();
  const { id, attempt: urlAttempt } = router.query;
  const { user } = useAuth();
  
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null);
  const [responseId, setResponseId] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<ResponseState>({});
  const [saveNotification, setSaveNotification] = useState<{show: boolean, questionId: number | null}>({
    show: false,
    questionId: null
  });
  
  // Attempts data
  const [attemptsData, setAttemptsData] = useState<AttemptsData | null>(null);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  
  // Set read-only mode if we're viewing a completed questionnaire
  const [isReadOnly, setIsReadOnly] = useState(false);
  
  // Timer refs for saving after typing pauses
  const saveTimers = useRef<{[key: number]: NodeJS.Timeout}>({});
  // Timer refs for question time limits
  const questionTimers = useRef<{[key: number]: {
    timer: NodeJS.Timeout,
    startTime: number,
    timeLeft: number
  }}>({});
  const [questionTimeLeft, setQuestionTimeLeft] = useState<{[key: number]: number}>({});
  
  // Effect to fetch attempts data
  useEffect(() => {
    if (!id) return;
    
    const fetchAttempts = async () => {
      setLoadingAttempts(true);
      try {
        const data = await callFrontendApi<AttemptsData>(
          `/api/questionnaires/${id}/attempts`,
          'GET'
        );
        setAttemptsData(data);
      } catch (err) {
        console.error('Error fetching attempts:', err);
      } finally {
        setLoadingAttempts(false);
      }
    };
    
    fetchAttempts();
  }, [id]);
  
  // Effect to fetch questionnaire data
  useEffect(() => {
    const fetchQuestionnaire = async () => {
      if (!id) return;
      
      setLoading(true);
      try {
        let responseIdToUse = urlAttempt ? Number(urlAttempt) : null;
        
        // If we have a response ID, check if it's completed
        if (responseIdToUse) {
          try {
            const responseData = await callFrontendApi<{ completed_at: string | null }>(
              `/api/questionnaires/${id}/responses/${responseIdToUse}`,
              'GET'
            );
            setIsReadOnly(responseData.completed_at !== null);
          } catch (err: any) {
            console.error('Error fetching response status:', err);
            setIsReadOnly(false);
          }
        } else {
          setIsReadOnly(false);
        }
        
        // If we're not in read-only mode and don't have a response ID, start a new attempt
        if (!isReadOnly && !responseIdToUse) {
          try {
            // Start the questionnaire response
            const startData = await callFrontendApi<{ response_id: number, is_new_attempt: boolean }>(
              `/api/questionnaires/${id}/start`,
              'POST'
            );
            
            responseIdToUse = startData.response_id;
          } catch (err: any) {
            console.error('Error starting questionnaire:', err);
            setError(err.message || 'Failed to start questionnaire');
            setLoading(false);
            return;
          }
        }
        
        setResponseId(responseIdToUse);
        
        // Get the questionnaire details
        const qData = await callFrontendApi<Questionnaire>(
          `/api/questionnaires/${id}`,
          'GET'
        );
        
        setQuestionnaire(qData);
        
        // Initialize response state
        const initialResponses: ResponseState = {};
        qData.questions.forEach((q: Question) => {
          initialResponses[q.id] = {
            answer: q.type === 'multiple_choice_multiple' ? [] : '',
            saving: false,
            saved: false,
            error: null
          };
        });
        
        // Fetch existing responses if a response ID is available
        if (responseIdToUse) {
          try {
            const existingResponses = await callFrontendApi<{ responses: Record<string, any> }>(
              `/api/questionnaires/${id}/responses/${responseIdToUse}`,
              'GET'
            );
            
            if (existingResponses && existingResponses.responses) {
              // Update responses with existing answers
              Object.entries(existingResponses.responses).forEach(([questionId, data]) => {
                const qId = parseInt(questionId);
                if (initialResponses[qId]) {
                  initialResponses[qId] = {
                    ...initialResponses[qId],
                    answer: data.answer,
                    saved: true,
                    interactionBatchId: data.interactionBatchId,
                    question_text: data.question_text
                  };
                }
              });
            }
          } catch (err: any) {
            console.error('Error fetching existing responses:', err);
            // Continue without existing responses
          }
        }
        
        setResponses(initialResponses);
        setLoading(false);
        setError(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Failed to load questionnaire'));
        setLoading(false);
      }
    };
    
    fetchQuestionnaire();
    
    // Cleanup function for timers
    return () => {
      Object.values(saveTimers.current).forEach(timer => clearTimeout(timer));
      Object.values(questionTimers.current).forEach(timerObj => clearTimeout(timerObj.timer));
    };
  }, [id, urlAttempt]);
  
  // Get current page questions
  const getCurrentPageQuestions = () => {
    if (!questionnaire) return [];
    
    if (questionnaire.is_paginated) {
      return questionnaire.questions
        .filter(q => q.page_number === currentPage)
        .sort((a, b) => a.order - b.order);
    } else {
      return questionnaire.questions.sort((a, b) => a.order - b.order);
    }
  };
  
  // Get max page number
  const getMaxPages = () => {
    if (!questionnaire || !questionnaire.is_paginated) return 1;
    return Math.max(...questionnaire.questions.map(q => q.page_number));
  };
  
  // Handle answer change for a question
  const handleAnswerChange = (question: Question, value: any) => {
    // Don't allow changes in read-only mode
    if (isReadOnly) return;

    let newValue = value;
    
    // Handle multiple choice multiple differently
    if (question.type === 'multiple_choice_multiple' && typeof value === 'string') {
      const currentAnswers = [...(responses[question.id]?.answer || [])];
      const valueIndex = currentAnswers.indexOf(value);
      
      if (valueIndex === -1) {
        newValue = [...currentAnswers, value];
      } else {
        currentAnswers.splice(valueIndex, 1);
        newValue = currentAnswers;
      }
    }
    
    setResponses(prev => ({
      ...prev,
      [question.id]: {
        ...prev[question.id],
        answer: newValue,
        saved: false
      }
    }));
    
    // Clear any existing timer for this question
    if (saveTimers.current[question.id]) {
      clearTimeout(saveTimers.current[question.id]);
    }
    
    // Set a new timer to save after 5 seconds of inactivity
    saveTimers.current[question.id] = setTimeout(() => {
      saveQuestionResponse(question);
    }, 5000);
  };
  
  // Start a timer for a time-limited question
  const startQuestionTimer = (question: Question) => {
    if (!question.time_limit_seconds) return;
    
    // Clear any existing timer
    if (questionTimers.current[question.id]) {
      clearTimeout(questionTimers.current[question.id].timer);
    }
    
    const timeLeftInSeconds = questionTimeLeft[question.id] || question.time_limit_seconds;
    
    // Set initial time left
    setQuestionTimeLeft(prev => ({
      ...prev,
      [question.id]: timeLeftInSeconds
    }));
    
    const startTime = Date.now();
    
    // Create timer to update time left and submit when time is up
    const timer = setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const remaining = timeLeftInSeconds - elapsedSeconds;
      
      setQuestionTimeLeft(prev => ({
        ...prev,
        [question.id]: remaining > 0 ? remaining : 0
      }));
      
      if (remaining <= 0) {
        clearInterval(timer);
        saveQuestionResponse(question);
      }
    }, 1000);
    
    questionTimers.current[question.id] = {
      timer,
      startTime,
      timeLeft: timeLeftInSeconds
    };
  };
  
  // Save a question response to the backend
  const saveQuestionResponse = async (question: Question) => {
    if (!responseId) return;
    
    // Don't save if no answer is provided
    if (
      (typeof responses[question.id]?.answer === 'string' && !responses[question.id]?.answer.trim()) ||
      (Array.isArray(responses[question.id]?.answer) && responses[question.id]?.answer.length === 0)
    ) {
      return;
    }
    
    // Mark as saving
    setResponses(prev => ({
      ...prev,
      [question.id]: {
        ...prev[question.id],
        saving: true,
        error: null
      }
    }));
    
    try {
      // Create interaction batch if needed for user activity recording
      let interactionBatchId = responses[question.id]?.interactionBatchId;
      
      if (!interactionBatchId) {
        const interactionData = await callFrontendApi<{ id: number }>(
          '/api/interactions/batch',
          'POST',
          {
            events: [{
              type: 'question_interaction',
              question_id: question.id,
              timestamp: new Date().toISOString()
            }]
          }
        );
        
        interactionBatchId = interactionData.id;
      }
      
      // Submit the question response
      await callFrontendApi(
        `/api/questionnaires/${questionnaire?.id}/responses/${responseId}/questions/${question.id}`,
        'POST',
        {
          question_id: question.id,
          answer: {
            value: responses[question.id].answer
          },
          interaction_batch_id: interactionBatchId
        }
      );
      
      setResponses(prev => ({
        ...prev,
        [question.id]: {
          ...prev[question.id],
          saving: false,
          saved: true,
          error: null,
          interactionBatchId
        }
      }));
      
      // Show saved notification
      setSaveNotification({
        show: true,
        questionId: question.id
      });
      
      // Hide notification after 3 seconds
      setTimeout(() => {
        setSaveNotification({
          show: false,
          questionId: null
        });
      }, 3000);
    } catch (error: any) {
      console.error('Error saving response:', error);
      
      // Extract error message from the error response
      let errorMessage = 'Failed to save response';
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setResponses(prev => ({
        ...prev,
        [question.id]: {
          ...prev[question.id],
          saving: false,
          error: errorMessage
        }
      }));
    }
  };
  
  // Navigate to the next page
  const handleNext = () => {
    // Save all questions on current page
    if (questionnaire) {
      const currentQuestions = getCurrentPageQuestions();
      currentQuestions.forEach(question => {
        saveQuestionResponse(question);
      });
    }
    
    setCurrentPage(prev => Math.min(prev + 1, getMaxPages()));
  };
  
  // Navigate to the previous page
  const handlePrevious = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };
  
  // Submit the entire questionnaire
  const handleSubmit = async () => {
    if (!questionnaire || !responseId) return;
    
    // Check if all required questions are answered
    if (!isQuestionnaireValid()) {
      setError('Please answer all required questions before submitting.');
      return;
    }
    
    // Save all questions first
    const allQuestions = questionnaire.questions;
    allQuestions.forEach(question => {
      saveQuestionResponse(question);
    });
    
    setSubmitting(true);
    try {
      await callFrontendApi(
        `/api/questionnaires/${questionnaire.id}/responses/${responseId}/complete`,
        'POST'
      );
      
      // Redirect to questionnaires list
      router.push('/client/questionnaires');
    } catch (error) {
      console.error('Error completing questionnaire:', error);
      setError(formatErrorMessage(error, 'Failed to submit questionnaire. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };
  
  // Start timers for questions with time limits
  useEffect(() => {
    if (questionnaire) {
      questionnaire.questions.forEach(question => {
        if (question.time_limit_seconds) {
          startQuestionTimer(question);
        }
      });
    }
  }, [questionnaire]);
  
  const renderQuestion = (question: Question) => {
    const responseState = responses[question.id] || {
      answer: question.type === 'multiple_choice_multiple' ? [] : '',
      saving: false,
      saved: false,
      error: null
    };
    
    // Format the answer for display
    const displayAnswer = () => {
      if (Array.isArray(responseState.answer)) {
        return responseState.answer.join(', ');
      }
      if (typeof responseState.answer === 'object' && responseState.answer !== null) {
        // Handle answers wrapped in a value property
        if ('value' in responseState.answer) {
          return responseState.answer.value;
        }
        return JSON.stringify(responseState.answer);
      }
      return responseState.answer || '';
    };
    
    // Get the historical question text if in read-only mode
    const questionText = isReadOnly && responseState.question_text 
      ? responseState.question_text 
      : question.text;
    
    return (
      <Card key={question.id} sx={{ mb: 4, position: 'relative' }}>
        {responseState.saving && (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0 }} />
        )}
        
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography variant="h6" gutterBottom>
                {questionText}
                {question.is_required && <span style={{ color: 'red' }}> *</span>}
              </Typography>
              
              {question.time_limit_seconds && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <TimerIcon fontSize="small" color="action" sx={{ mr: 0.5 }} />
                  <Typography variant="body2" color="text.secondary">
                    Time remaining: {Math.floor(questionTimeLeft[question.id] / 60)}:{(questionTimeLeft[question.id] % 60).toString().padStart(2, '0')}
                  </Typography>
                </Box>
              )}
            </Box>
            
            {saveNotification.show && saveNotification.questionId === question.id && (
              <Chip
                label="Saved"
                color="success"
                size="small"
                icon={<CheckCircleIcon />}
              />
            )}
          </Box>
          
          {/* Text input */}
          {question.type === 'text' && (
            <TextField
              fullWidth
              multiline={question.configuration.answer_box_size !== 'small'}
              rows={question.configuration.answer_box_size === 'large' ? 6 : 3}
              value={displayAnswer()}
              onChange={(e) => handleAnswerChange(question, e.target.value)}
              placeholder="Enter your answer here"
              disabled={submitting || isReadOnly}
            />
          )}
          
          {/* Multiple choice single answer */}
          {question.type === 'multiple_choice_single' && (
            <RadioGroup
              value={displayAnswer()}
              onChange={(e) => handleAnswerChange(question, e.target.value)}
            >
              {question.configuration.choices.map((choice, index) => (
                <FormControlLabel
                  key={index}
                  value={choice}
                  control={<Radio disabled={submitting || isReadOnly} />}
                  label={choice}
                />
              ))}
            </RadioGroup>
          )}
          
          {/* Multiple choice multiple answers */}
          {question.type === 'multiple_choice_multiple' && (
            <FormGroup>
              {question.configuration.choices.map((choice, index) => (
                <FormControlLabel
                  key={index}
                  control={
                    <Checkbox
                      checked={Array.isArray(responseState.answer) && responseState.answer.includes(choice)}
                      onChange={() => handleAnswerChange(question, choice)}
                      disabled={submitting || isReadOnly}
                    />
                  }
                  label={choice}
                />
              ))}
              
              {(question.configuration.min_choices || question.configuration.max_choices) && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  {question.configuration.min_choices && `Select at least ${question.configuration.min_choices} options. `}
                  {question.configuration.max_choices && `Select at most ${question.configuration.max_choices} options.`}
                </Typography>
              )}
            </FormGroup>
          )}
          
          {responseState.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {responseState.error}
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  };
  
  // Determine if current page is valid (all required questions answered)
  const isCurrentPageValid = () => {
    const currentQuestions = getCurrentPageQuestions();
    for (const question of currentQuestions) {
      if (question.is_required) {
        const response = responses[question.id];
        if (!response || 
            (typeof response.answer === 'string' && !response.answer.trim()) ||
            (Array.isArray(response.answer) && response.answer.length === 0)) {
          return false;
        }
      }
    }
    return true;
  };
  
  // Determine if the entire questionnaire is valid
  const isQuestionnaireValid = () => {
    if (!questionnaire) return false;
    
    for (const question of questionnaire.questions) {
      if (question.is_required) {
        const response = responses[question.id];
        if (!response || 
            (typeof response.answer === 'string' && !response.answer.trim()) ||
            (Array.isArray(response.answer) && response.answer.length === 0)) {
          return false;
        }
      }
    }
    return true;
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (error) {
    return (
      <>
        <Alert severity="error" sx={{ mt: 4 }}>
          {error}
        </Alert>
        <Button 
          variant="contained" 
          sx={{ mt: 2 }}
          onClick={() => router.push('/client/questionnaires')}
        >
          Back to Questionnaires
        </Button>
      </>
    );
  }
  
  if (!questionnaire) {
    return (
      <Typography>Questionnaire not found</Typography>
    );
  }
  
  return (
    <Box sx={{ my: 4, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {questionnaire?.title}
          {isReadOnly && (
            <Chip 
              label="Read Only" 
              color="primary" 
              size="small" 
              sx={{ ml: 2, verticalAlign: 'middle' }} 
            />
          )}
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          {questionnaire?.description}
        </Typography>
        
        {/* Attempts information */}
        {attemptsData && (
          <Box sx={{ mt: 2, mb: 3 }}>
            <Typography variant="h6">
              Attempt {attemptsData.attempts[attemptsData.attempts.length - 1]?.attempt_number || 1} of {questionnaire?.number_of_attempts}
            </Typography>
            
            {/* Show button for new attempt if attempts remaining */}
            {!isReadOnly && attemptsData.remaining_attempts > 0 && attemptsData.attempts.length > 0 && (
              <Button
                variant="contained"
                color="primary"
                sx={{ mt: 2 }}
                onClick={() => router.push(`/client/questionnaires/${id}`)}
              >
                Start New Attempt
              </Button>
            )}
          </Box>
        )}
        
        <Divider sx={{ my: 2 }} />
      </Box>
      
      {questionnaire.is_paginated && (
        <Box sx={{ mb: 4 }}>
          <Stepper activeStep={currentPage - 1} alternativeLabel>
            {Array.from({ length: getMaxPages() }).map((_, index) => (
              <Step key={index}>
                <StepLabel>Page {index + 1}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>
      )}
      
      {getCurrentPageQuestions().map(question => renderQuestion(question))}
      
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
        {questionnaire?.is_paginated && currentPage > 1 && (
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handlePrevious}
            disabled={submitting}
          >
            Previous
          </Button>
        )}
        
        {!isReadOnly ? (
          <>
            {currentPage < getMaxPages() ? (
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={handleNext}
                disabled={questionnaire?.requires_completion && !isCurrentPageValid() || submitting}
                sx={{ ml: 'auto' }}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                disabled={questionnaire?.requires_completion && !isQuestionnaireValid() || submitting}
                sx={{ ml: 'auto' }}
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </Button>
            )}
          </>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={() => router.push('/client/questionnaires')}
            sx={{ ml: 'auto' }}
          >
            Back to Questionnaires
          </Button>
        )}
      </Box>
    </Box>
  );
};

// Set up the layout
(TakeQuestionnaire as any).getLayout = withNavigationLayout;

// Export the component
export default TakeQuestionnaire; 