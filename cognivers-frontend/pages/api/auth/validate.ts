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
        // Validate using the backend /auth/validate endpoint
        try {
            // Use the auth/validate endpoint which is specifically designed for token validation
            await callBackendApi('/auth/validate', 'GET', null, token);
            
            // If we get here, the token is valid
            return res.json({ valid: true });
        } catch (validateError: any) {
            // Check if error is specifically about authentication
            if (validateError.response && (validateError.response.status === 401 || validateError.response.status === 403)) {
                return res.status(401).json({ valid: false });
            }
            
            // For other types of errors (like server errors, network issues), return invalid
            // This is a more secure approach than falling back to client-side validation
            console.error('Error validating token:', validateError);
            return res.status(401).json({ valid: false });
        }
    } catch (error) {
        // Any unexpected errors should be treated as invalid token
        console.error('Unexpected error in validate endpoint:', error);
        return res.status(401).json({ valid: false });
    }
}
