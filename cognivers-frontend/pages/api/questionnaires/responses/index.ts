import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../../lib/api';
import { withAuth } from '../../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Apply auth middleware
    return withAuth(req, res, async (req, res) => {
      const token = req.cookies.token;
      const { page = '1', limit = '10', ...filters } = req.query;

      // Convert query parameters to the format expected by the backend
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.session_id && { session_id: filters.session_id.toString() }),
        ...(filters.start_date && { start_date: filters.start_date.toString() }),
        ...(filters.end_date && { end_date: filters.end_date.toString() }),
        ...(filters.user_name && { user_name: filters.user_name.toString() }),
        ...(filters.user_email && { user_email: filters.user_email.toString() }),
        ...(filters.questionnaire_id && { questionnaire_id: filters.questionnaire_id.toString() })
      });

      const response = await callBackendApi(
        `/questionnaires/responses?${params.toString()}`,
        'GET',
        undefined,
        token
      );

      return res.status(200).json(response);
    });
  } catch (error: any) {
    console.error('Error fetching questionnaire responses:', error);
    return res.status(error.status || 500).json({
      message: error.message || 'Failed to fetch questionnaire responses'
    });
  }
} 