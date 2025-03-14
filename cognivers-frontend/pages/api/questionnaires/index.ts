import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../lib/api';
import { withAuth } from '../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET and POST methods
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Apply auth middleware
    return withAuth(req, res, async (req, res) => {
      const token = req.cookies.token;
      
      try {
        if (req.method === 'GET') {
          // Get all questionnaires
          const data = await callBackendApi(
            '/questionnaires',
            'GET',
            null,
            token
          );
          return res.status(200).json(data);
        } else if (req.method === 'POST') {
          // Create a new questionnaire
          const data = await callBackendApi(
            '/questionnaires',
            'POST',
            req.body,
            token
          );
          return res.status(201).json(data);
        }
        
        // This should never be reached due to the method check above
        return res.status(405).json({ error: 'Method not allowed' });
      } catch (error: any) {
        console.error('Error in questionnaires API:', error);
        
        // Handle specific error status codes
        if (error.response) {
          const { status, data } = error.response;
          return res.status(status).json(data);
        }
        
        // Handle other errors
        return res.status(500).json({
          error: 'An error occurred while processing your request'
        });
      }
    });
  } catch (error) {
    console.error('Unexpected error in questionnaires API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 