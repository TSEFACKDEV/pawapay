// lib/validation.ts
import * as yup from 'yup';

const phoneRegex = /^\+?[1-9]\d{1,14}$/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const paymentSchema = yup.object().shape({
  amount: yup
    .number()
    .required('Amount is required')
    .min(0.01, 'Amount must be greater than 0')
    .max(1000000, 'Amount exceeds maximum limit'),
  currency: yup.string().required('Currency is required'),
  country: yup.string().required('Country is required'),
  customerName: yup
    .string()
    .required('Customer name is required')
    .min(2, 'Name is too short')
    .max(100, 'Name is too long'),
  phoneNumber: yup
    .string()
    .required('Phone number is required')
    .matches(phoneRegex, 'Invalid phone number format'),
  customerEmail: yup
    .string()
    .required('Email is required')
    .matches(emailRegex, 'Invalid email format'),
  reference: yup.string().max(50, 'Reference is too long'),
  reasons: yup.array().of(yup.string().max(100, 'Reason is too long')),
  operator: yup.string().when('country', {
    is: (country: string) => country !== '',
    then: (schema) => schema.required('Operator is required'),
  }),
});