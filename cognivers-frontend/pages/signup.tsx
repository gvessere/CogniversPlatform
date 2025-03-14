import { useState } from 'react';
import { Formik, Form, Field, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import {
  TextField,
  Button,
  Container,
  Typography,
  Link,
  Alert,
  CircularProgress
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useRouter } from 'next/router';
import { formatErrorMessage } from '../utils/errorUtils';
import { 
  passwordValidation, 
  nameValidation, 
  emailValidation, 
  dobValidation 
} from '../utils/validationUtils';
import { postData } from '../lib/api';

const SignupSchema = Yup.object().shape({
  email: emailValidation,
  password: passwordValidation.required('Required'),
  first_name: nameValidation,
  last_name: nameValidation,
  dob: dobValidation
});

interface SignupFormValues {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  dob: Date | null;
}

export default function SignupPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const initialValues: SignupFormValues = {
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    dob: null
  };

  const handleSubmit = async (
    values: SignupFormValues, 
    formikHelpers: FormikHelpers<SignupFormValues>
  ) => {
    const { setSubmitting } = formikHelpers;
    setLoading(true);
    setSubmitError('');
    try {
      const formattedValues = {
        ...values,
        dob: values.dob ? values.dob.toISOString().split('T')[0] : null
      };
      console.log('Sending signup request:', formattedValues);
      await postData('/api/auth/signup', formattedValues);
      
      // After successful signup, redirect to login with the returnUrl preserved
      const redirectUrl = router.query.returnUrl 
        ? `/login?success=signup&returnUrl=${encodeURIComponent(router.query.returnUrl as string)}`
        : '/login?success=signup';
        
      router.push(redirectUrl);
    } catch (error) {
      console.error('Signup error:', error);
      setSubmitError(formatErrorMessage(error, 'Signup failed'));
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Sign Up
      </Typography>
      
      <Formik
        initialValues={initialValues}
        validationSchema={SignupSchema}
        onSubmit={handleSubmit}
      >
        {({ setFieldValue, values, errors, touched }) => (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Form method="post">
              <Field name="email">
                {({ field }: { field: any }) => (
                  <TextField
                    {...field}
                    id="email"
                    type="email"
                    label="Email"
                    fullWidth
                    margin="normal"
                    autoComplete="username email"
                    error={touched.email && !!errors.email}
                    helperText={touched.email && errors.email}
                  />
                )}
              </Field>

              <Field name="password">
                {({ field }: { field: any }) => (
                  <TextField
                    {...field}
                    id="password"
                    type="password"
                    label="Password"
                    fullWidth
                    margin="normal"
                    autoComplete="new-password"
                    error={touched.password && !!errors.password}
                    helperText={touched.password && errors.password}
                  />
                )}
              </Field>

              <Field name="first_name">
                {({ field }: { field: any }) => (
                  <TextField
                    {...field}
                    id="first_name"
                    label="First Name"
                    fullWidth
                    margin="normal"
                    autoComplete="given-name"
                    error={touched.first_name && !!errors.first_name}
                    helperText={touched.first_name && errors.first_name}
                  />
                )}
              </Field>

              <Field name="last_name">
                {({ field }: { field: any }) => (
                  <TextField
                    {...field}
                    id="last_name"
                    label="Last Name"
                    fullWidth
                    margin="normal"
                    autoComplete="family-name"
                    error={touched.last_name && !!errors.last_name}
                    helperText={touched.last_name && errors.last_name}
                  />
                )}
              </Field>

              <DatePicker
                label="Date of Birth"
                value={values.dob}
                onChange={(date) => setFieldValue('dob', date)}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    margin: "normal",
                    error: touched.dob && !!errors.dob,
                    helperText: touched.dob && errors.dob
                  }
                }}
                maxDate={new Date()}
              />

              {submitError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {submitError}
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                size="large"
                fullWidth
                disabled={loading}
                sx={{ mt: 3 }}
              >
                {loading ? <CircularProgress size={24} /> : 'Sign Up'}
              </Button>

              <Typography variant="body2" sx={{ mt: 2, textAlign: 'center' }}>
                Already have an account?{' '}
                <Link 
                  href={router.query.returnUrl ? `/login?returnUrl=${encodeURIComponent(router.query.returnUrl as string)}` : "/login"} 
                  underline="hover"
                >
                  Login here
                </Link>
              </Typography>
            </Form>
          </LocalizationProvider>
        )}
      </Formik>
    </Container>
  );
} 