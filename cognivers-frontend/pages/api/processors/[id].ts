import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi, validateMethod } from '../../../lib/api';
import { withAuth } from '../../../lib/auth';

const ALLOWED_METHODS = ['GET', 'PUT', 'DELETE'] as const;
type AllowedMethod = typeof ALLOWED_METHODS[number];

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const token = req.cookies.token;

  if (!validateMethod(req, res, ALLOWED_METHODS)) {
    return;
  }

  try {
    const data = await callBackendApi(
      `/processors/${id}`,
      req.method as AllowedMethod,
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

export default function processorHandler(req: NextApiRequest, res: NextApiResponse) {
  return withAuth(req, res, handler);
} 