import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '@lib/api';
import { getToken } from '@lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = getToken(req);
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { sessionId, clientId } = req.query;

  if (!clientId || Array.isArray(clientId) || !sessionId || Array.isArray(sessionId)) {
    return res.status(400).json({ message: 'Invalid client ID or session ID' });
  }

  try {
    if (req.method === 'GET') {
      // Get specific enrollment
      const data = await callBackendApi(
        `/sessions/${sessionId}/enrollments/${clientId}`, 
        'GET', 
        null, 
        token
      );
      return res.status(200).json(data);
    } else if (req.method === 'DELETE') {
      // Unenroll client from session
      await callBackendApi(
        `/sessions/${sessionId}/enrollments/${clientId}`, 
        'DELETE', 
        null, 
        token
      );
      return res.status(204).end();
    } else {
      return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('API error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json(
      error.response?.data || { message: 'Internal server error' }
    );
  }
} 