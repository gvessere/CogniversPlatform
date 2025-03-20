import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../lib/api';
import { withAuth } from '../../../lib/auth';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = await callBackendApi(
      '/processors',
      req.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      req.body,
      req.cookies.token,
      { resource: 'processors' }
    );
    res.status(200).json(data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.detail || 'Internal Server Error';
    res.status(status).json({ detail: message });
  }
}

export default function processorsHandler(req: NextApiRequest, res: NextApiResponse) {
  return withAuth(req, res, handler);
} 