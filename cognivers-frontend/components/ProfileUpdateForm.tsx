import React from 'react';
import { Formik, Form } from 'formik';
import { TextField, Button, Box, Typography, Divider } from '@mui/material';
import * as Yup from 'yup';
import { PasswordField } from './PasswordField';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { formatErrorMessage } from '../utils/errorUtils';
import { 
  passwordValidation, 
  passwordConfirmationValidation,
  currentPasswordValidation,
  optionalDobValidation
} from '../utils/validationUtils';

// Export this interface so it can be reused in other files
export interface ProfileUpdateValues {
  email?: string;
  first_name?: string;
  last_name?: string;
  dob?: Date | null;
  current_password?: string;
  new_password?: string;
  confirm_password?: string;
}

const validationSchema = Yup.object({
  email: Yup.string().email('Invalid email'),
  first_name: Yup.string().min(2, 'Too Short!'),
  last_name: Yup.string().min(2, 'Too Short!'),
  dob: optionalDobValidation,
  current_password: currentPasswordValidation,
  new_password: passwordValidation,
  confirm_password: passwordConfirmationValidation('new_password'),
});

export interface ProfileUpdateFormProps {
  onSubmit: (values: ProfileUpdateValues) => Promise<void>;
  initialValues: ProfileUpdateValues;
  validationSchema?: any;
}

export const ProfileUpdateForm: React.FC<ProfileUpdateFormProps> = ({
  onSubmit,
  initialValues,
  validationSchema
}) => {
  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={async (values, { setSubmitting, setStatus }) => {
        try {
          await onSubmit(values);
          setStatus(null);
        } catch (error) {
          setStatus({ error: formatErrorMessage(error, 'An error occurred') });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {({ values, errors, touched, handleChange, handleBlur, isSubmitting, status, setFieldValue }) => (
        <Form name="profile-update" method="post" autoComplete="on">
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {status?.error && (
              <Typography color="error" variant="body2">
                {status.error}
              </Typography>
            )}
            
            {/* Hidden username field for password managers */}
            <input 
              type="text" 
              name="username" 
              id="username" 
              autoComplete="username" 
              value={values.email} 
              readOnly 
              style={{ display: 'none' }} 
            />
            
            {/* Profile Information */}
            <Box>
              <Typography variant="h6" gutterBottom>
                Profile Information
              </Typography>
              
              {/* Email Field - Explicitly marked for password managers */}
              <TextField
                fullWidth
                id="email"
                name="email"
                label="Email"
                type="email"
                value={values.email}
                InputProps={{
                  readOnly: true,
                }}
                disabled
                margin="normal"
                autoComplete="username email"
                // Add data attributes to help password managers
                inputProps={{
                  'data-form-type': 'username',
                  'data-lpignore': 'false',
                  'autoCapitalize': 'none',
                  'autoCorrect': 'off'
                }}
              />
              
              <TextField
                fullWidth
                id="first_name"
                name="first_name"
                label="First Name"
                value={values.first_name}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.first_name && Boolean(errors.first_name)}
                helperText={touched.first_name && errors.first_name}
                margin="normal"
                autoComplete="given-name"
                inputProps={{
                  'data-lpignore': 'true' // Tell password managers to ignore this field
                }}
              />
              <TextField
                fullWidth
                id="last_name"
                name="last_name"
                label="Last Name"
                value={values.last_name}
                onChange={handleChange}
                onBlur={handleBlur}
                error={touched.last_name && Boolean(errors.last_name)}
                helperText={touched.last_name && errors.last_name}
                margin="normal"
                autoComplete="family-name"
                inputProps={{
                  'data-lpignore': 'true' // Tell password managers to ignore this field
                }}
              />
              <LocalizationProvider dateAdapter={AdapterDateFns}>
                <DatePicker
                  label="Date of Birth"
                  value={values.dob}
                  onChange={(date) => setFieldValue('dob', date)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      margin: "normal",
                      error: touched.dob && Boolean(errors.dob),
                      helperText: touched.dob && errors.dob,
                      // Explicitly tell password managers to ignore this field
                      inputProps: {
                        'data-lpignore': 'true',
                        'data-form-type': 'other'
                      }
                    }
                  }}
                  maxDate={new Date()}
                />
              </LocalizationProvider>
            </Box>

            {/* Password Change Section */}
            <Box sx={{ mt: 2 }}>
              <Divider sx={{ mb: 3 }} />
              <Typography variant="h6" gutterBottom>
                Change Password (Optional)
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <PasswordField
                  label="Current Password"
                  value={values.current_password || ''}
                  onChange={(value) => handleChange({ target: { name: 'current_password', value } })}
                  error={touched.current_password ? errors.current_password : undefined}
                  autoComplete="current-password"
                  formType="password"
                />

                <PasswordField
                  label="New Password"
                  value={values.new_password || ''}
                  onChange={(value) => handleChange({ target: { name: 'new_password', value } })}
                  error={touched.new_password ? errors.new_password : undefined}
                  autoComplete="new-password"
                  formType="new-password"
                />

                <PasswordField
                  label="Confirm New Password"
                  value={values.confirm_password || ''}
                  onChange={(value) => handleChange({ target: { name: 'confirm_password', value } })}
                  error={touched.confirm_password ? errors.confirm_password : undefined}
                  autoComplete="new-password"
                  formType="new-password"
                />
              </Box>
            </Box>

            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              disabled={isSubmitting}
              sx={{ mt: 2 }}
            >
              Save Changes
            </Button>
          </Box>
        </Form>
      )}
    </Formik>
  );
}; 