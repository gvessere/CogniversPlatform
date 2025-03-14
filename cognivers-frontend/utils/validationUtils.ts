import * as Yup from 'yup';

/**
 * Shared password validation rules to ensure consistency across the application
 */
export const passwordValidation = Yup.string()
  .min(8, 'Password must be at least 8 characters')
  .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
  .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .matches(/[0-9]/, 'Password must contain at least one number');

/**
 * Validation for password confirmation
 * @param passwordField - The name of the password field to match against
 */
export const passwordConfirmationValidation = (passwordField: string = 'password') => 
  Yup.string()
    .oneOf([Yup.ref(passwordField)], 'Passwords must match')
    .when(passwordField, {
      is: (val: string) => val && val.length > 0,
      then: () => Yup.string().required('Please confirm your password'),
    });

/**
 * Validation for current password when changing to a new password
 */
export const currentPasswordValidation = Yup.string()
  .when('new_password', {
    is: (val: string) => val && val.length > 0,
    then: () => Yup.string().required('Required when setting new password'),
  });

/**
 * Common name validation
 */
export const nameValidation = Yup.string()
  .min(2, 'Too Short!')
  .required('Required');

/**
 * Email validation
 */
export const emailValidation = Yup.string()
  .email('Invalid email')
  .required('Required');

/**
 * Date of birth validation
 */
export const dobValidation = Yup.date()
  .required('Required')
  .max(new Date(), 'Date of birth cannot be in the future');

/**
 * Optional date of birth validation (for updates)
 */
export const optionalDobValidation = Yup.mixed()
  .nullable()
  .test('is-date', 'Invalid date', value => !value || value instanceof Date)
  .test('not-future', 'Date cannot be in the future', value => !value || value <= new Date()); 