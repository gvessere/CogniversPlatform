import { UserRole } from '../../../lib/types';
import { NextApiRequest, NextApiResponse } from 'next';
import { callBackendApi } from '../../../lib/api';

interface UserData {
    id: number | string;
    email: string;
    first_name?: string;
    last_name?: string;
    dob?: string | null;
    role?: UserRole;
    token_exp?: string | null;
}

/**
 * Helper function to normalize role strings to match UserRole enum
 * This ensures consistent role handling regardless of backend format
 */
function normalizeRole(roleString: string | undefined): UserRole {
    if (!roleString) return UserRole.CLIENT;
    
    // Handle both string and enum values
    const normalizedRole = String(roleString).toUpperCase();
    
    // Map to the enum values with various format possibilities
    if (normalizedRole.includes('ADMIN')) {
        return UserRole.ADMINISTRATOR;
    } else if (normalizedRole.includes('TRAIN')) {
        return UserRole.TRAINER;
    } else if (normalizedRole.includes('CLIENT') || normalizedRole.includes('USER')) {
        return UserRole.CLIENT;
    } else {
        return UserRole.CLIENT;
    }
}

export default async function handler(
    req: NextApiRequest, 
    res: NextApiResponse
) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get token from cookies
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    try {
        // Remove the cache-busting parameter from the request
        
        // Try to get fresh user data from the backend API
        try {
            // Get user data directly from /users/me endpoint
            const response = await callBackendApi(`/users/me`, 'GET', null, token);
            
            if (response && response.id) {
                // Normalize role to match enum
                if (response.role) {
                    response.role = normalizeRole(response.role);
                }
                
                return res.status(200).json(response);
            }
        } catch (getError) {
            console.log('Failed to get user data via GET, trying alternative methods:', getError);
        }
        
        // If GET fails, try PATCH as a fallback
        try {
            // Send an empty PATCH request to see if it returns user data
            const response = await callBackendApi('/users/me', 'PATCH', {}, token);
            
            // If we get here, the request succeeded
            if (response && (response.id || response.email)) {
                const userData: UserData = response;
                
                // Normalize role to match enum
                if (userData && userData.role) {
                    userData.role = normalizeRole(userData.role);
                }
                
                return res.status(200).json(userData);
            }
        } catch (patchError) {
            console.log('Failed to get user data via PATCH:', patchError);
        }
        
        // If both API methods fail, return an authentication error
        return res.status(401).json({ 
            error: 'Unable to retrieve user data from backend API',
            detail: 'Authentication may have expired. Please try logging in again.'
        });
    } catch (error) {
        console.error('Error in /api/auth/me:', error);
        // Return appropriate error
        return res.status(500).json({
            error: 'Failed to process user data'
        });
    }
} 