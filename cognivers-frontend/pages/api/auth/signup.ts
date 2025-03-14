import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../lib/api';

interface SignupRequestBody {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  dob?: string;
}

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Just pass the request body directly to the backend
    // The backend will handle role assignment based on email
    console.log('Signup payload:', req.body);
    console.log('Backend target:', `/auth/signup`);
    
    const { data } = await callBackendApi('/auth/signup', 'POST', req.body, null);
    
    console.log('Signup successful:', data);
    res.status(200).json(data);
  } catch (error: any) {
    console.error('Signup error details:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers,
        data: error.config?.data
      }
    });

    if (error.response?.data?.detail) {
      return res.status(error.response.status).json({ 
        error: error.response.data.detail 
      });
    }

    res.status(error.response?.status || 500).json({
      error: 'Signup failed. Please try again.'
    });
  }
}