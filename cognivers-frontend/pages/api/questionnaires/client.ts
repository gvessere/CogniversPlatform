import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../lib/api';
import { withAuth } from '../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Apply auth middleware
    return withAuth(req, res, async (req, res) => {
      const token = req.cookies.token;
      
      try {
        // Make the request to the backend API
        const data = await callBackendApi(
          '/questionnaires/client',
          'GET',
          null,
          token
        );
        
        // Return the response from the backend
        return res.status(200).json(data);
      } catch (error: any) {
        // If there's an error from the backend, pass it through
        if (error.response) {
          return res.status(error.response.status).json(error.response.data);
        }
        
        // For other errors, return a 500
        return res.status(500).json({
          error: 'An error occurred while processing your request'
        });
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
} 