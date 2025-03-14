// cognivers-frontend/pages/api/auth/login.ts
import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../lib/api';

interface LoginRequestBody {
    email: string;
    password: string;
}

interface LoginResponseData {
    access_token: string;
}

export default async function handler(
    req: NextApiRequest, 
    res: NextApiResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('Login request to backend:', `/auth/login`);
        
        // Use the new JSON login endpoint
        const data = await callBackendApi<LoginResponseData>(
            `/auth/login`,
            'POST',
            {
                email: (req.body as LoginRequestBody).email,
                password: (req.body as LoginRequestBody).password
            }
        );
        
        // Set token as HTTP-only cookie
        // Ensure cookie parameters are set for browser compatibility
        res.setHeader('Set-Cookie', `token=${data.access_token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`);
        
        // Log that we set the cookie
        console.log('Set auth cookie for token:', data.access_token.substring(0, 10) + '...');
        
        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Login error:', error.response?.data || error.message);
        res.status(error.response?.status || 401).json({ 
            error: error.response?.data?.detail || 'Invalid credentials' 
        });
    }
}