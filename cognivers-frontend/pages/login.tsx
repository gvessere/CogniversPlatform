import { useState } from 'react';
import { useRouter } from 'next/router';
import { Formik, Form, Field, FormikHelpers } from 'formik';
import * as Yup from 'yup';
import {
  Container,
  TextField,
  Button,
  Typography,
  Link,
  CircularProgress,
  Alert
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { formatErrorMessage } from '../utils/errorUtils';
import { postData } from '../lib/api';

const validationSchema = Yup.object({
  email: Yup.string()
    .email('Invalid email address')
    .required('Required'),
  password: Yup.string()
    .required('Required')
});

interface LoginFormValues {
  email: string;
  password: string;
}

const LoginForm = () => {
  const router = useRouter();
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const handleSubmit = async (
    values: LoginFormValues, 
    { setSubmitting }: FormikHelpers<LoginFormValues>
  ) => {
    setLoading(true);
    setSubmitError('');
    try {
      console.log('Sending login request:', values);
      interface LoginResponse {
        success: boolean;
        token?: string;
        message?: string;
      }
      const response = await postData<LoginResponse>('/api/auth/login', values);
      
      if (response.success) {
        console.log('Login successful, calling login function');
        // Since we can't access the HttpOnly cookie, we'll just
        // tell the auth context to fetch the user data
        await login();
        // No need to redirect as login() will do that
      } else {
        setSubmitError('Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setSubmitError(formatErrorMessage(error, 'Login failed'));
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Login
      </Typography>
      
      {router.query.success === 'signup' && (
        <Alert severity="success" sx={{ mb: 3 }}>
          Signup successful! Please login with your credentials
        </Alert>
      )}

      <Formik
        initialValues={{ email: '', password: '' }}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        {({ errors, touched }) => (
          <Form method="post">
            <Field name="email">
              {({ field }: { field: any }) => (
                <TextField
                  {...field}
                  id="email"
                  type="email"
                  fullWidth
                  margin="normal"
                  label="Email"
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
                  fullWidth
                  margin="normal"
                  label="Password"
                  autoComplete="current-password"
                  error={touched.password && !!errors.password}
                  helperText={touched.password && errors.password}
                />
              )}
            </Field>

            {submitError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {submitError}
              </Alert>
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? (
                <CircularProgress size={24} />
              ) : (
                'Login'
              )}
            </Button>
            
            <Typography align="center">
              Don&apos;t have an account?{' '}
              <Link 
                href={router.query.returnUrl ? `/signup?returnUrl=${encodeURIComponent(router.query.returnUrl as string)}` : "/signup"} 
                underline="hover"
              >
                Sign up
              </Link>
            </Typography>
          </Form>
        )}
      </Formik>
    </Container>
  );
};

export default LoginForm; 