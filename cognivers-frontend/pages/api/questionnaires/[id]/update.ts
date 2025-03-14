import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../../lib/api';
import { withAuth } from '../../../../lib/auth';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow PATCH method
  if (req.method !== 'PATCH') {
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
        // Update questionnaire
        const data = await callBackendApi(`/questionnaires/${id}`, 'PATCH', req.body, token);
        
        // Return the response from the backend
        return res.status(200).json(data);
      } catch (error: any) {
        console.error(`Error updating questionnaire ${id}:`, error);
        
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
    console.error(`Unexpected error in questionnaire ${id} update API:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 