import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../../lib/api';
import { getToken, withAuth } from '../../../../lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  return withAuth(req, res, async (req: NextApiRequest, res: NextApiResponse) => {
    const token = getToken(req);
    const { id } = req.query;

    if (!id || Array.isArray(id)) {
      return res.status(400).json({ message: 'Invalid task definition ID' });
    }

    try {
      if (req.method === 'DELETE') {
        const data = await callBackendApi(`/questionnaires/task-definitions/${id}`, 'DELETE', null, token);
        return res.status(200).json(data);
      } else {
        return res.status(405).json({ message: 'Method not allowed' });
      }
    } catch (error: any) {
      console.error('API error:', error.response?.data || error.message);
      return res.status(error.response?.status || 500).json(
        error.response?.data || { message: 'Internal server error' }
      );
    }
  });
} 