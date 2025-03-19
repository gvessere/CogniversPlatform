// pages/api/auth/validate.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../lib/api';

export default async function handler(
    req: NextApiRequest, 
    res: NextApiResponse
) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ valid: false });
    }

    try {
        // Use the auth/validate endpoint which is specifically designed for token validation
        await callBackendApi('/auth/validate', 'GET', null, token);
        
        // If we get here, the token is valid
        return res.json({ valid: true });
    } catch (error: any) {
        console.error('Error validating token:', error);
        return res.status(401).json({ valid: false });
    }
}
