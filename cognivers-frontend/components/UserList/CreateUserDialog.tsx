import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormHelperText,
  Box,
  Alert
} from '@mui/material';
import { Formik, Form } from 'formik';
import * as Yup from 'yup';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

interface CreateUserFormData {
  email: string;
  password: string;
  confirm_password: string;
  first_name: string;
  last_name: string;
  role: string;
  dob: Date | null;
}

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: CreateUserFormData) => Promise<void>;
}

const validationSchema = Yup.object({
  email: Yup.string()
    .email('Invalid email address')
    .required('Required'),
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
    .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .matches(/[0-9]/, 'Password must contain at least one number')
    .required('Required'),
  confirm_password: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Required'),
  first_name: Yup.string()
    .required('Required'),
  last_name: Yup.string()
    .required('Required'),
  role: Yup.string()
    .required('Required'),
  dob: Yup.date()
    .nullable()
    .max(new Date(), 'Date cannot be in the future')
});

const initialValues: CreateUserFormData = {
  email: '',
  password: '',
  confirm_password: '',
  first_name: '',
  last_name: '',
  role: 'Client',
  dob: null
};

export default function CreateUserDialog({
  open,
  onClose,
  onSubmit
}: CreateUserDialogProps) {
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>Create New User</DialogTitle>
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={async (values, { setSubmitting, setStatus }) => {
          try {
            await onSubmit(values);
            onClose();
          } catch (error) {
            setStatus({ error: error instanceof Error ? error.message : 'Failed to create user' });
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {({ values, errors, touched, handleChange, handleBlur, isSubmitting, status, setFieldValue }) => (
          <Form>
            <DialogContent>
              {status?.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {status.error}
                </Alert>
              )}
              
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  name="email"
                  label="Email"
                  value={values.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.email && !!errors.email}
                  helperText={touched.email && errors.email}
                />

                <TextField
                  fullWidth
                  name="password"
                  label="Password"
                  type="password"
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.password && !!errors.password}
                  helperText={touched.password && errors.password}
                />

                <TextField
                  fullWidth
                  name="confirm_password"
                  label="Confirm Password"
                  type="password"
                  value={values.confirm_password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.confirm_password && !!errors.confirm_password}
                  helperText={touched.confirm_password && errors.confirm_password}
                />

                <TextField
                  fullWidth
                  name="first_name"
                  label="First Name"
                  value={values.first_name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.first_name && !!errors.first_name}
                  helperText={touched.first_name && errors.first_name}
                />

                <TextField
                  fullWidth
                  name="last_name"
                  label="Last Name"
                  value={values.last_name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  error={touched.last_name && !!errors.last_name}
                  helperText={touched.last_name && errors.last_name}
                />

                <FormControl fullWidth error={touched.role && !!errors.role}>
                  <InputLabel>Role</InputLabel>
                  <Select
                    name="role"
                    value={values.role}
                    label="Role"
                    onChange={handleChange}
                    onBlur={handleBlur}
                  >
                    <MenuItem value="Client">Client</MenuItem>
                    <MenuItem value="Trainer">Trainer</MenuItem>
                    <MenuItem value="Administrator">Administrator</MenuItem>
                  </Select>
                  {touched.role && errors.role && (
                    <FormHelperText>{errors.role}</FormHelperText>
                  )}
                </FormControl>

                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Date of Birth"
                    value={values.dob}
                    onChange={(date) => setFieldValue('dob', date)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        error: touched.dob && !!errors.dob,
                        helperText: touched.dob && errors.dob
                      }
                    }}
                    maxDate={new Date()}
                  />
                </LocalizationProvider>
              </Box>
            </DialogContent>

            <DialogActions>
              <Button onClick={onClose}>Cancel</Button>
              <Button 
                type="submit" 
                variant="contained" 
                disabled={isSubmitting}
              >
                Create User
              </Button>
            </DialogActions>
          </Form>
        )}
      </Formik>
    </Dialog>
  );
} 