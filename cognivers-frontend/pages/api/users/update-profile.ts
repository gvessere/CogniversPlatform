import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { callBackendApi } from '../../../lib/api';

// Define a type for the JWT payload
interface JwtPayload {
    sub: string;
    email?: string;
    first_name?: string;
    last_name?: string;
    role?: string;
    [key: string]: any;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Only allow PATCH requests
    if (req.method !== 'PATCH') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get token from cookies
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    try {
        // Process the request data to ensure it's in the correct format
        const requestData = { ...req.body };
        
        // Format DOB field if present
        if (requestData.dob) {
            try {
                // Make sure we're using the proper date format: YYYY-MM-DD
                const dateObj = new Date(requestData.dob);
                const isoString = dateObj.toISOString();
                requestData.dob = isoString.split('T')[0]; // Extract YYYY-MM-DD portion only
            } catch (dateError) {
                return res.status(400).json({ detail: 'Invalid date format for date of birth' });
            }
        }
        
        console.log('Attempting to update profile with data:', {
            ...requestData,
            current_password: requestData.current_password ? '[REDACTED]' : undefined,
            new_password: requestData.new_password ? '[REDACTED]' : undefined
        });
        
        try {
            // Send the update request to the backend
            const data = await callBackendApi('/users/me', 'PATCH', requestData, token);
            
            console.log(`Profile update successful`);
            
            // Return the updated data
            return res.status(200).json(data);
        } catch (apiError: any) {
            // Check if it's a connection error (ECONNRESET, etc.)
            if (apiError.code === 'ECONNRESET' || apiError.code === 'ECONNABORTED' || 
                apiError.message?.includes('socket hang up') || !apiError.response) {
                
                console.error('Connection error when updating profile:', apiError.message);
                
                // Extract user ID from token for the error message
                try {
                    const decoded = jwt.decode(token) as JwtPayload;
                    const userId = decoded?.sub;
                    
                    return res.status(503).json({
                        detail: `Unable to connect to the backend API. Please try again later. User ID: ${userId}`,
                        error_type: 'connection_error'
                    });
                } catch (jwtError) {
                    return res.status(503).json({
                        detail: 'Unable to connect to the backend API. Please try again later.',
                        error_type: 'connection_error'
                    });
                }
            }
            
            // Handle other API errors
            if (apiError.response) {
                const responseData = apiError.response.data;
                
                // 422 means validation error
                if (apiError.response.status === 422 && responseData.detail && Array.isArray(responseData.detail)) {
                    const messages = responseData.detail.map((err: any) => {
                        if (typeof err === 'object' && err.msg) {
                            return `${err.msg} ${err.loc ? `(at ${err.loc.join(' > ')})` : ''}`;
                        }
                        return String(err);
                    }).join('; ');
                    
                    return res.status(apiError.response.status).json({
                        detail: messages
                    });
                }
                
                return res.status(apiError.response.status).json({
                    detail: typeof responseData === 'string' 
                        ? responseData 
                        : responseData.detail || JSON.stringify(responseData)
                });
            }
            
            // Fallback error
            return res.status(500).json({
                detail: `Request failed: ${apiError.message}`
            });
        }
    } catch (error: any) {
        console.error('Unexpected error in update-profile API route:', error);
        return res.status(500).json({
            detail: `An unexpected error occurred: ${error.message}`
        });
    }
} 