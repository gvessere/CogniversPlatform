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
        return res.status(401).json({ 
            error: 'Not authenticated',
            detail: 'No authentication token found'
        });
    }

    try {
        // Try to get user data from the backend API
        const response = await callBackendApi(`/users/me`, 'GET', null, token);
        
        if (response && response.id) {
            // Normalize role to match enum
            if (response.role) {
                response.role = normalizeRole(response.role);
            }
            
            return res.status(200).json(response);
        } else {
            throw new Error('Invalid user data received from backend');
        }
    } catch (error: any) {
        console.error('Error in /api/auth/me:', error);
        
        // Return the error message from the API
        return res.status(error.response?.status || 500).json({
            error: error.response?.data?.detail || 'Failed to retrieve user data'
        });
    }
} 