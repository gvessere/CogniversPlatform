import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { callBackendApi } from '../../../lib/api';

/**
 * API handler for user operations
 * This endpoint is accessible to all authenticated users
 * Access control is handled by the backend API
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET method
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  // Use withAuth middleware to ensure user is authenticated
  await withAuth(req, res, async (req, res) => {
    const token = req.cookies.token;
    
    try {
      // Extract query parameters
      const { role } = req.query;
      
      // Build query string
      let queryString = '';
      if (role) {
        queryString = `?role=${role}`;
      }
      
      // Make request to backend API using callBackendApi
      const data = await callBackendApi(`/users${queryString}`, 'GET', null, token);

      // Return successful response
      return res.status(200).json(data);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      
      // Handle specific error status codes
      if (error.response) {
        const { status, data } = error.response;
        return res.status(status).json({ 
          message: data.detail || 'Failed to fetch users' 
        });
      }
      
      return res.status(500).json({ message: 'Failed to fetch users' });
    }
  });
} 