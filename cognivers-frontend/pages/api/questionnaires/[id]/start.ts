import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../../lib/api';
import { withAuth } from '../../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST method
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Extract and validate ID
  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Invalid questionnaire ID' });
  }

  try {
    // Apply auth middleware
    return withAuth(req, res, async (req, res) => {
      const token = req.cookies.token;
      
      try {
        // Start the questionnaire
        const data = await callBackendApi(`/questionnaires/${id}/start`, 'POST', {}, token);
        
        // Return the response from the backend
        return res.status(200).json(data);
      } catch (error: any) {
        console.error(`Error starting questionnaire ${id}:`, error);
        
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
    console.error(`Unexpected error in start questionnaire ${id} API:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 