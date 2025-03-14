import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../lib/api';
import { getToken } from '../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = getToken(req);
  
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { session_code } = req.body;
    
    if (!session_code) {
      return res.status(400).json({ message: 'Session code is required' });
    }

    // Call the backend API to enroll in the session by code
    const data = await callBackendApi(
      `/sessions/enroll-by-code?session_code=${session_code}`, 
      'POST', 
      null, 
      token
    );
    
    return res.status(200).json(data);
  } catch (error: any) {
    console.error('API error:', error.response?.data || error.message);
    return res.status(error.response?.status || 500).json(
      error.response?.data || { message: 'Internal server error' }
    );
  }
} 