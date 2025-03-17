import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../../../lib/api';
import { getToken } from '../../../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = getToken(req);
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const { clientId } = req.query;

  if (!clientId || Array.isArray(clientId)) {
    return res.status(400).json({ message: 'Invalid client ID' });
  }

  try {
    if (req.method === 'GET') {
      // Get enrollments for a client
      const data = await callBackendApi(`/sessions/client/${clientId}/enrollments`, 'GET', null, token);
      return res.status(200).json(data);
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