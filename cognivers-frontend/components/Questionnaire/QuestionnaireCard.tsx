import React from 'react';
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  Chip,
  Divider
} from '@mui/material';
import { useRouter } from 'next/router';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import dayjs from 'dayjs';

interface Questionnaire {
  id: number;
  title: string;
  description: string;
  type: string;
  has_response: boolean;
  is_completed: boolean;
  last_updated: string | null;
  completed_count: number;
  remaining_attempts: number;
  attempts?: QuestionnaireAttempt[];
}

interface QuestionnaireAttempt {
  id: number;
  questionnaire_id: number;
  user_id: number;
  started_at: string;
  completed_at: string | null;
}

enum QuestionnaireButtonState {
  ATTEMPT = 'Attempt',
  IN_PROGRESS = 'In Progress',
  NO_ATTEMPTS = 'No Attempts Left'
}

const getButtonState = (
  hasOngoingAttempt: boolean,
  attempts: any[],
  remaining_attempts: number
): QuestionnaireButtonState => {
  if (hasOngoingAttempt) {
    return QuestionnaireButtonState.IN_PROGRESS;
  }
  if (attempts.length === 0) {
    return QuestionnaireButtonState.ATTEMPT;
  }
  if (remaining_attempts === 0) {
    return QuestionnaireButtonState.NO_ATTEMPTS;
  }
  return QuestionnaireButtonState.ATTEMPT;
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

interface QuestionnaireCardProps {
  questionnaire: Questionnaire;
  onStartQuestionnaire: (id: number, responseId?: number) => void;
}

const QuestionnaireCard: React.FC<QuestionnaireCardProps> = ({ questionnaire, onStartQuestionnaire }) => {
  const typeInfo = getTypeLabel(questionnaire.type);
  
  const hasOngoingAttempt = questionnaire.attempts && questionnaire.attempts.some(attempt => !attempt.completed_at);
  const attempts = questionnaire.attempts || [];
  const remaining_attempts = questionnaire.remaining_attempts;

  return (
    <Card 
      sx={{ 
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...(questionnaire.is_completed && {
          borderLeft: '4px solid #4caf50'
        })
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" component="h2">
            {questionnaire.title}
          </Typography>
          <Chip 
            label={typeInfo.label}
            color={typeInfo.color}
            size="small"
          />
        </Box>
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {questionnaire.description}
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
            <Box>
              {questionnaire.is_completed ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AssignmentTurnedInIcon color="success" />
                  <Typography variant="body2" color="success.main">
                    Completed
                  </Typography>
                </Box>
              ) : questionnaire.has_response ? (
                <Typography variant="body2" color="text.secondary">
                  Last updated: {dayjs(questionnaire.last_updated).format('MMM D, YYYY')}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Not started
                </Typography>
              )}
              {questionnaire.remaining_attempts > 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {questionnaire.completed_count}/{questionnaire.completed_count + questionnaire.remaining_attempts} attempts
                </Typography>
              )}
            </Box>
            
            <Button
              variant="contained"
              color="primary"
              onClick={() => onStartQuestionnaire(questionnaire.id)}
              disabled={hasOngoingAttempt || (attempts.length > 0 && remaining_attempts === 0)}
            >
              {getButtonState(!!hasOngoingAttempt, attempts, remaining_attempts)}
            </Button>
          </Box>

          {questionnaire.attempts && questionnaire.attempts.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Past Attempts:</Typography>
              {questionnaire.attempts.map((attempt) => (
                <Box 
                  key={attempt.id}
                  sx={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    mb: 1,
                    p: 1,
                    bgcolor: 'background.default',
                    borderRadius: 1
                  }}
                >
                  <Typography variant="body2">
                    {dayjs(attempt.started_at).format('MMM D, YYYY HH:mm')}
                    {attempt.completed_at ? ' (Completed)' : ' (In progress)'}
                  </Typography>
                  <Button
                    variant="text"
                    size="small"
                    onClick={() => onStartQuestionnaire(questionnaire.id, attempt.id)}
                  >
                    View
                  </Button>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default QuestionnaireCard; 