import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  Typography,
  Box
} from '@mui/material';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { format } from 'date-fns';
import { ClientSessionEnrollment, ClientSessionInfo } from '../../lib/types';
import { deleteData } from '../../lib/api';

interface ClientSessionsProps {
  sessions: (ClientSessionEnrollment | ClientSessionInfo)[];
  onUnenroll: (sessionId: number) => Promise<void>;
}

const isClientSessionEnrollment = (session: ClientSessionEnrollment | ClientSessionInfo): session is ClientSessionEnrollment => {
  return 'session_title' in session;
};

export default function ClientSessions({ sessions, onUnenroll }: ClientSessionsProps) {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'success';
      case 'completed':
        return 'info';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const getSessionTitle = (session: ClientSessionEnrollment | ClientSessionInfo) => {
    if (isClientSessionEnrollment(session)) {
      return session.session_title;
    }
    return session.session_name;
  };

  return (
    <TableContainer component={Paper} sx={{ mt: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Session</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Enrolled</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sessions.map((session) => (
            <TableRow key={isClientSessionEnrollment(session) ? session.id : session.session_id}>
              <TableCell>
                <Typography variant="body2">{getSessionTitle(session)}</Typography>
              </TableCell>
              <TableCell>
                <Chip
                  label={session.status}
                  color={getStatusColor(session.status)}
                  size="small"
                />
              </TableCell>
              <TableCell>
                {format(new Date(session.enrolled_at), 'MMM d, yyyy')}
              </TableCell>
              <TableCell align="right">
                <Tooltip title="Unenroll from session">
                  <IconButton
                    size="small"
                    onClick={() => onUnenroll(isClientSessionEnrollment(session) ? session.session_id : session.session_id)}
                    color="error"
                  >
                    <ExitToAppIcon />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </TableRow>
          ))}
          {sessions.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} align="center">
                <Typography variant="body2" color="text.secondary">
                  No sessions enrolled
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
} 