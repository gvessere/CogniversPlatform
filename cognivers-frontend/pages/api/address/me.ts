import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../lib/api';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET, POST, PATCH, and DELETE methods
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method || '')) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get token from cookies
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const method = req.method as 'GET' | 'POST' | 'PATCH' | 'DELETE';

    // For DELETE, we don't need to return data
    if (method === 'DELETE') {
      await callBackendApi('/address/me', method, null, token);
      return res.status(204).end();
    }

    // For other methods
    const data = await callBackendApi('/address/me', method, 
      method === 'GET' ? null : req.body, token);

    // Check if this is our special 404 result
    if (data && data.__isExpected404Error === true) {
      // Return a 404 with the detail message
      return res.status(404).json({ detail: data.detail });
    }

    // Return the response from the backend
    return res.status(200).json(data);
  } catch (error: unknown) {
    // Enhanced error logging with detailed information
    //console.error('Error in address API:', error);
    
    // Type assertion for error object
    const err = error as {
      message?: string;
      name?: string;
      stack?: string;
      status?: number;
      data?: unknown;
      response?: {
        status: number;
        data: unknown;
        headers: unknown;
      };
      request?: unknown;
      config?: unknown;
    };
    
    // Log the complete error object for debugging
    console.log("FULL ERROR OBJECT:", JSON.stringify({
      message: err.message,
      name: err.name,
      stack: err.stack,
      status: err.status,
      data: err.data,
      response: err.response ? {
        status: err.response.status,
        data: err.response.data,
        headers: err.response.headers
      } : null,
      request: err.request ? 'Request object exists' : null,
      config: err.config
    }, null, 2));
    
    // Check if this is an error from the backend API
    if (err.response) {
      const { status, data } = err.response;
      console.log(`Passing through status ${status} with data:`, data);
      return res.status(status).json(data);
    }
    
    // If we have a status on the error itself, use that
    if (err.status) {
      console.log(`Using error.status ${err.status} with data:`, err.data);
      return res.status(err.status).json(err.data || { error: err.message });
    }
    
    // Handle other errors
    console.log("Falling back to 500 error");
    return res.status(500).json({
      error: 'An error occurred while processing your request',
      message: err.message
    });
  }
} 