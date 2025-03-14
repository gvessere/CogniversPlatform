import React from 'react';
import { 
  Typography, 
  Paper, 
  Box
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { ProfileUpdateForm, ProfileUpdateValues } from '../components/ProfileUpdateForm';
import { withNavigationLayout } from '../utils/layout';
import ProtectedRoute from '../components/ProtectedRoute';
import { useState, useEffect } from 'react';
import { Alert } from '@mui/material';
import { refreshUserData } from '../lib/auth';
import * as Yup from 'yup';
import { formatErrorMessage } from '../utils/errorUtils';
import { parseISO } from 'date-fns';
import { 
  passwordValidation, 
  passwordConfirmationValidation,
  currentPasswordValidation,
  optionalDobValidation
} from '../utils/validationUtils';
import { patchData } from '../lib/api';

const validationSchema = Yup.object({
  first_name: Yup.string().min(2, 'Too Short!'),
  last_name: Yup.string().min(2, 'Too Short!'),
  dob: optionalDobValidation,
  current_password: currentPasswordValidation,
  new_password: passwordValidation,
  confirm_password: passwordConfirmationValidation('new_password'),
});

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(Date.now()); // Add a key to force re-render

  // Initial values for the form
  const initialValues: ProfileUpdateValues = {
    email: user?.email || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    dob: user?.dob ? parseISO(user.dob) : null,
    current_password: '',
    new_password: '',
    confirm_password: '',
  };

  // Update form values when user data changes
  useEffect(() => {
    if (user) {
      // Force re-render of form with new values
      setFormKey(Date.now());
    }
  }, [user]);

  const handleUpdateProfile = async (values: ProfileUpdateValues) => {
    try {
      // Create a formatted data object for the API
      const apiData: Record<string, string | undefined> = {};
      
      // Only include defined fields
      if (values.first_name !== undefined) {
        apiData.first_name = values.first_name;
      }
      
      if (values.last_name !== undefined) {
        apiData.last_name = values.last_name;
      }
      
      // Format date of birth if provided
      if (values.dob) {
        apiData.dob = new Date(values.dob).toISOString().split('T')[0];
      }
      
      // Include password fields if provided
      if (values.current_password) {
        apiData.current_password = values.current_password;
      }
      
      if (values.new_password) {
        apiData.new_password = values.new_password;
      }
      
      // Use our new update-profile endpoint
      await patchData('/api/users/update-profile', apiData);
      
      // Force a complete refresh of user data from the server
      // This is important to ensure we have the latest data
      try {
        // Clear any cached user data first
        setUser(null);
        
        // Then fetch fresh data from the server
        const updatedUser = await refreshUserData();
        if (updatedUser) {
          console.log('Profile updated with new user data:', updatedUser);
          setUser(updatedUser);
          
          // Force a re-render of the form with new values
          setFormKey(Date.now());
        }
      } catch (refreshError) {
        console.error('Failed to refresh user data after profile update:', refreshError);
      }
      
      // Show success message
      setSubmitSuccess(true);
      
      // Reset password fields
      values.current_password = '';
      values.new_password = '';
      values.confirm_password = '';
      
      // Trigger password save prompt in browser if password was changed
      if (apiData.new_password) {
        // This helps trigger the browser's password save dialog
        setTimeout(() => {
          const event = new Event('passwordsaved', { bubbles: true });
          document.dispatchEvent(event);
        }, 500);
      }
    } catch (error) {
      // Use the error formatting utility
      setSubmitError(formatErrorMessage(error));
    }
  };

  return (
    <ProtectedRoute>
      <Paper elevation={3} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Profile Settings
        </Typography>

        {submitSuccess && (
          <Alert severity="success" sx={{ mb: 3 }}>
            Profile updated successfully!
          </Alert>
        )}

        {submitError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {submitError}
          </Alert>
        )}

        <Box sx={{ maxWidth: 600 }}>
          <ProfileUpdateForm
            key={formKey} // Add key to force re-render when user data changes
            initialValues={initialValues}
            onSubmit={handleUpdateProfile}
            validationSchema={validationSchema}
          />
        </Box>
      </Paper>
    </ProtectedRoute>
  );
}

ProfilePage.getLayout = withNavigationLayout; 