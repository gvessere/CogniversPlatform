import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../../../../lib/api';
import { getToken } from '../../../../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = getToken(req);
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  // Extract the session ID and questionnaire ID from path parameters
  const { sessionId, questionnaireId } = req.query;

  if (!sessionId || Array.isArray(sessionId) || !questionnaireId || Array.isArray(questionnaireId)) {
    return res.status(400).json({ message: 'Invalid session ID or questionnaire ID' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Activate a questionnaire using standard RESTful path
    const data = await callBackendApi(`/sessions/${sessionId}/questionnaires/${questionnaireId}/activate`, 'POST', null, token);
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('API error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json(
      error.response?.data || { message: 'Internal server error' }
    );
  }
} 