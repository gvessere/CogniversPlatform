import { NextApiRequest, NextApiResponse } from 'next';
import { withAdmin } from '../../../lib/auth';
import { callBackendApi } from '../../../lib/api';

/**
 * API handler for operations on a specific user
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow supported methods
  if (req.method !== 'GET' && req.method !== 'PATCH') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Extract and validate ID
  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ message: 'Invalid user ID' });
  }

  // Apply admin authorization middleware
  return withAdmin(req, res, async (req, res) => {
    const token = req.cookies.token;
    
    try {
      if (req.method === 'GET') {
        // User retrieval
        const data = await callBackendApi(`/users/${id}`, 'GET', null, token);
        return res.status(200).json(data);
      } 
      else if (req.method === 'PATCH') {
        // User update
        const data = await callBackendApi(`/users/${id}`, 'PATCH', req.body, token);
        return res.status(200).json(data);
      }
    } catch (error: any) {
      console.error('Error in user API:', error);
      
      // Handle specific error status codes
      if (error.response) {
        const { status, data } = error.response;
        return res.status(status).json({ 
          message: data.detail || `Failed to ${req.method === 'GET' ? 'fetch' : 'update'} user` 
        });
      }
      
      return res.status(500).json({ 
        message: `An error occurred while ${req.method === 'GET' ? 'fetching' : 'updating'} the user` 
      });
    }
  });
} 