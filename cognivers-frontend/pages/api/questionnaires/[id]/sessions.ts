import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../../lib/api';
import { getToken } from '../../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const token = getToken(req);
    
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const response = await callBackendApi(
      `/questionnaires/${id}/sessions`,
      'GET',
      undefined,
      token,
      { resource: 'questionnaires' }
    );
    return res.status(200).json(response);
  } catch (error: any) {
    console.error('Error fetching questionnaire sessions:', error);
    return res.status(error.status || 500).json({
      message: error.message || 'Failed to fetch questionnaire sessions'
    });
  }
} 