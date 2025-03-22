import React, { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { Formik, Field, Form, FormikHelpers } from 'formik'
import * as Yup from 'yup'
import {
  TextField,
  Button,
  Box,
  Typography
} from '@mui/material'
import { callFrontendApi } from '../../lib/api'

interface ProfileFormValues {
  full_name: string;
  supervisor: string;
  current_password: string;
  new_password: string;
}

interface FieldProps {
  field: any;
  meta: {
    touched: boolean;
    error?: string;
  };
}

const validationSchema = Yup.object().shape({
  full_name: Yup.string()
    .min(2, 'Too short!')
    .max(100, 'Too long!'),
  supervisor: Yup.string()
    .min(2, 'Too short!')
    .max(100, 'Too long!'),
  current_password: Yup.string()
    .when('new_password', {
      is: (value: string) => !!value,
      then: (schema) => schema.required('Current password required'),
    }),
  new_password: Yup.string()
    .min(8, 'Minimum 8 characters')
    .notRequired()
  })

export default function ProfileForm(): React.ReactElement {
  const { user, refreshUserData } = useAuth();
  const [status, setStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleSubmit = async (
    values: ProfileFormValues, 
    { setSubmitting }: FormikHelpers<ProfileFormValues>
  ): Promise<void> => {
    if (values.new_password && !values.current_password) {
      alert('Current password required for password changes')
      setSubmitting(false)
      return
    }

    try {
      setSubmitting(true);
      setStatus({ type: null, message: '' });

      // Update user profile
      await callFrontendApi('/api/users/me', 'PUT', values);
      
      // Show success message
      setStatus({
        type: 'success',
        message: 'Profile updated successfully'
      });
      
      // Refresh user data
      await refreshUserData();
    } catch (err: any) {
      console.error('Error updating profile:', err);
      setStatus({
        type: 'error',
        message: err.response?.data?.detail || 'Failed to update profile'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={{
        full_name: user?.full_name ?? '',
        supervisor: user?.supervisor ?? '',
        current_password: '',
        new_password: ''
      }}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      {({ isSubmitting }) => (
        <Form>
          <Box sx={{ maxWidth: 500, mx: 'auto', p: 3 }}>
            {/* Profile Section */}
            <Field name="full_name">
              {({ field, meta }: FieldProps) => (
                <TextField
                  {...field}
                  fullWidth
                  placeholder="Full Name"
                  margin="normal"
                  error={meta.touched && !!meta.error}
                  helperText={meta.touched && meta.error}
              />)}
            </Field>
          
            {/* Password Section */}
            <Box sx={{ mt: 4, pt: 2, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="h6" gutterBottom>
                Change Password
              </Typography>

              <Field name="current_password">
                {({ field, meta }: FieldProps) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="password"
                    placeholder="Current Password"
                    margin="normal"
                    error={meta.touched && !!meta.error}
                    helperText={meta.touched && meta.error}
                  />
                )}
              </Field>

              <Field name="new_password">
                {({ field, meta }: FieldProps) => (
                  <TextField
                    {...field}
                    fullWidth
                    type="password"
                    placeholder="New Password"
                    margin="normal"
                    error={meta.touched && !!meta.error}
                    helperText={meta.touched && meta.error}
                  />
                )}
              </Field>
            </Box>

            <Button
              type="submit"
              variant="contained"
              size="large"
              fullWidth
              sx={{ mt: 3 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Form>
      )}
    </Formik>
  )
} 