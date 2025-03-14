import { useState, useEffect } from 'react';
import { Formik, Form, Field } from 'formik';
import * as Yup from 'yup';
import {
  TextField,
  Button,
  Grid,
  Typography,
  Alert,
  CircularProgress,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
} from '@mui/material';
import { countries, getDefaultCountry } from '../utils/countries';
import { handleAsyncError, formatErrorMessage } from '../utils/errorUtils';
import { getData, postData, putData, deleteData, patchData } from '../lib/api';

interface Address {
  street_address: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

const validationSchema = Yup.object({
  street_address: Yup.string().required('Required'),
  city: Yup.string().required('Required'),
  state: Yup.string().required('Required'),
  postal_code: Yup.string().required('Required'),
  country: Yup.string().required('Required'),
});

export default function AddressForm() {
  const [address, setAddress] = useState<Address | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [defaultCountry, setDefaultCountry] = useState<string>('United States');

  useEffect(() => {
    fetchAddress();
    // Set default country based on browser locale
    setDefaultCountry(getDefaultCountry());
  }, []);

  const fetchAddress = async () => {
    try {
      const result = await getData<Address | any>('/api/address/me');
      
      // Check if this is our special 404 result
      if (result && result.__isExpected404Error === true) {
        // This is an expected 404 condition (no address found)
        console.log('No address found for user, showing empty form');
        setAddress(null);
      } else {
        // This is a normal successful response
        setAddress(result as Address);
        setError(null);
      }
    } catch (err: any) {
      // This will only be reached for unexpected errors
      console.error('Unexpected error fetching address:', err);
      handleAsyncError(err, setError, 'Failed to fetch address');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values: Address) => {
    try {
      if (address) {
        await patchData('/api/address/me', values);
      } else {
        await postData('/api/address/me', values);
      }
      setSuccessMessage('Address saved successfully');
      setError(null);
      fetchAddress();
    } catch (err) {
      handleAsyncError(err, setError, 'Failed to save address');
      setSuccessMessage(null);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteData('/api/address/me');
      setSuccessMessage('Address deleted successfully');
      setError(null);
      setAddress(null);
    } catch (err) {
      handleAsyncError(err, setError, 'Failed to delete address');
      setSuccessMessage(null);
    }
  };

  if (loading) {
    return <CircularProgress />;
  }

  return (
    <div>
      <Typography variant="h6" gutterBottom>
        {address ? 'Update Address' : 'Add Address'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}

      <Formik
        initialValues={address || {
          street_address: '',
          city: '',
          state: '',
          postal_code: '',
          country: defaultCountry,
        }}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
        enableReinitialize
      >
        {({ errors, touched, setFieldValue, values }) => (
          <Form>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Field name="street_address">
                  {({ field }: any) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="Street Address"
                      error={touched.street_address && !!errors.street_address}
                      helperText={touched.street_address && errors.street_address}
                    />
                  )}
                </Field>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Field name="city">
                  {({ field }: any) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="City"
                      error={touched.city && !!errors.city}
                      helperText={touched.city && errors.city}
                    />
                  )}
                </Field>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Field name="state">
                  {({ field }: any) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="State/Province"
                      error={touched.state && !!errors.state}
                      helperText={touched.state && errors.state}
                    />
                  )}
                </Field>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Field name="postal_code">
                  {({ field }: any) => (
                    <TextField
                      {...field}
                      fullWidth
                      label="ZIP Code/Postal Code"
                      error={touched.postal_code && !!errors.postal_code}
                      helperText={touched.postal_code && errors.postal_code}
                    />
                  )}
                </Field>
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControl 
                  fullWidth 
                  error={touched.country && !!errors.country}
                >
                  <InputLabel id="country-label">Country</InputLabel>
                  <Select
                    labelId="country-label"
                    value={values.country}
                    label="Country"
                    onChange={(e) => setFieldValue('country', e.target.value)}
                  >
                    {countries.map((country) => (
                      <MenuItem key={country.code} value={country.name}>
                        {country.name}
                      </MenuItem>
                    ))}
                  </Select>
                  {touched.country && errors.country && (
                    <FormHelperText>{errors.country}</FormHelperText>
                  )}
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  fullWidth
                >
                  {address ? 'Update Address' : 'Save Address'}
                </Button>
              </Grid>

              {address && (
                <Grid item xs={12}>
                  <Button
                    variant="outlined"
                    color="error"
                    fullWidth
                    onClick={handleDelete}
                  >
                    Delete Address
                  </Button>
                </Grid>
              )}
            </Grid>
          </Form>
        )}
      </Formik>
    </div>
  );
} 