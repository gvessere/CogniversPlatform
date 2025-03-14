import { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { callBackendApi } from '../../../lib/api';
import { UserRole } from '../../../lib/types';

/**
 * API handler for getting trainers (users with TRAINER or ADMINISTRATOR role)
 * This endpoint is accessible to all authenticated users
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
      // Make request to backend API using callBackendApi with role filter
      // Use the UserRole enum values to ensure consistency
      const trainers = await callBackendApi(`/users?role=${UserRole.TRAINER}`, 'GET', null, token);
      const admins = await callBackendApi(`/users?role=${UserRole.ADMINISTRATOR}`, 'GET', null, token);
      
      // Combine trainers and admins
      const allTrainers = [...trainers, ...admins];
      
      // Return successful response
      return res.status(200).json(allTrainers);
    } catch (error: any) {
      console.error('Error fetching trainers:', error);
      
      // Handle specific error status codes
      if (error.response) {
        const { status, data } = error.response;
        return res.status(status).json({ 
          message: data.detail || 'Failed to fetch trainers' 
        });
      }
      
      return res.status(500).json({ message: 'Failed to fetch trainers' });
    }
  });
} 