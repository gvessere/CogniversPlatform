import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../../lib/api';
import { withAuth } from '../../../../lib/auth';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const token = req.cookies.token;

  try {
    const data = await callBackendApi(
      `/processors/requeue/${id}`,
      req.method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
      req.body,
      token,
      { resource: 'processors' }
    );
    res.status(200).json(data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.detail || 'Internal Server Error';
    res.status(status).json({ detail: message });
  }
}

export default function processorRequeueHandler(req: NextApiRequest, res: NextApiResponse) {
  return withAuth(req, res, handler);
} 