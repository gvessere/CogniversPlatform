import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../lib/api';
import { withAuth } from '../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Apply auth middleware
    return withAuth(req, res, async (req, res) => {
      const token = req.cookies.token;
      
      try {
        // Create interaction batch
        const data = await callBackendApi('/interactions/batch', 'POST', req.body, token);
        
        // Return the response from the backend
        return res.status(201).json(data);
      } catch (error: any) {
        console.error('Error creating interaction batch:', error);
        
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
    console.error('Unexpected error in interactions batch API:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 