// app/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Formik, Form, Field, FieldArray } from 'formik';
import { paymentSchema } from '@/lib/validation';
import { COUNTRY_CONFIG, MOBILE_OPERATORS } from '@/lib/pawapay';
import { FaSpinner, FaCheckCircle, FaMobileAlt, FaFileInvoice } from 'react-icons/fa';
import axios from 'axios';

interface PaymentFormValues {
  amount: string;
  currency: string;
  country: string;
  customerName: string;
  phoneNumber: string;
  customerEmail: string;
  reference: string;
  reasons: string[];
  operator: string;
}

export default function PaymentForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentResult, setPaymentResult] = useState<any>(null);
  const [paymentStatus, setPaymentStatus] = useState<string | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  const initialValues: PaymentFormValues = {
    amount: '',
    currency: 'XAF',
    country: '',
    customerName: '',
    phoneNumber: '',
    customerEmail: '',
    reference: '',
    reasons: ['', '', '', '', ''],
    operator: '',
  };

  const handleSubmit = async (values: PaymentFormValues, { setSubmitting }: any) => {
    setIsSubmitting(true);
    setPaymentResult(null);
    setPaymentStatus(null);

    try {
      const response = await axios.post('/api/payment/initiate', {
        ...values,
        amount: parseFloat(values.amount),
        reasons: values.reasons.filter(reason => reason.trim() !== ''),
      });

      if (response.data.success) {
        setPaymentResult(response.data);
        startPollingStatus(response.data.payment.transactionId);
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setPaymentResult({
        success: false,
        error: error.response?.data?.error || 'Payment initiation failed',
      });
    } finally {
      setSubmitting(false);
      setIsSubmitting(false);
    }
  };

  const startPollingStatus = (transactionId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await axios.get(`/api/payment/status/${transactionId}`);
        if (response.data.success) {
          setPaymentStatus(response.data.payment.status);
          
          if (['completed', 'failed', 'expired'].includes(response.data.payment.status)) {
            clearInterval(interval);
            setPollInterval(null);
          }
        }
      } catch (error) {
        console.error('Status polling error:', error);
      }
    }, 5000);

    setPollInterval(interval);
  };

  useEffect(() => {
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [pollInterval]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-8">
            <div className="flex items-center space-x-3">
              <FaMobileAlt className="text-white text-4xl" />
              <div>
                <h2 className="text-2xl font-bold text-white">Mobile Money Payment</h2>
                <p className="text-blue-100 text-sm mt-1">Secure payment via PawaPay</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-8">
            {paymentResult?.success && paymentStatus === 'completed' ? (
              <PaymentSuccess payment={paymentResult.payment} />
            ) : paymentResult?.success && paymentStatus ? (
              <PaymentProcessing 
                status={paymentStatus} 
                message={paymentResult.message}
                transactionId={paymentResult.payment.transactionId}
              />
            ) : paymentResult?.error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <p className="text-red-800">{paymentResult.error}</p>
              </div>
            ) : null}

            <Formik
              initialValues={initialValues}
              validationSchema={paymentSchema}
              onSubmit={handleSubmit}
            >
              {({ values, errors, touched, setFieldValue, isSubmitting }) => (
                <Form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount *
                      </label>
                      <Field
                        type="number"
                        name="amount"
                        step="0.01"
                        placeholder="0.00"
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.amount && touched.amount ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.amount && touched.amount && (
                        <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Currency *
                      </label>
                      <Field
                        as="select"
                        name="currency"
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                          errors.currency && touched.currency ? 'border-red-500' : 'border-gray-300'
                        }`}
                      >
                        <option value="XAF">XAF</option>
                        <option value="XOF">XOF</option>
                        <option value="CDF">CDF</option>
                        <option value="KES">KES</option>
                        <option value="RWF">RWF</option>
                        <option value="SLE">SLE</option>
                        <option value="UGX">UGX</option>
                        <option value="ZMW">ZMW</option>
                      </Field>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country *
                    </label>
                    <Field
                      as="select"
                      name="country"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.country && touched.country ? 'border-red-500' : 'border-gray-300'
                      }`}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setFieldValue('country', e.target.value);
                        const countryConfig = COUNTRY_CONFIG[e.target.value as keyof typeof COUNTRY_CONFIG];
                        if (countryConfig) {
                          setFieldValue('currency', countryConfig.currency);
                          const operators = MOBILE_OPERATORS[e.target.value];
                          if (operators && operators.length > 0) {
                            setFieldValue('operator', operators[0]);
                          }
                        }
                      }}
                    >
                      <option value="">Select country</option>
                      {Object.keys(COUNTRY_CONFIG).map((country) => (
                        <option key={country} value={country}>
                          {country} ({COUNTRY_CONFIG[country as keyof typeof COUNTRY_CONFIG].currency})
                        </option>
                      ))}
                    </Field>
                    {errors.country && touched.country && (
                      <p className="mt-1 text-sm text-red-600">{errors.country}</p>
                    )}
                  </div>

                  {values.country && MOBILE_OPERATORS[values.country] && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mobile Operator *
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {MOBILE_OPERATORS[values.country].map((operator) => (
                          <button
                            key={operator}
                            type="button"
                            onClick={() => setFieldValue('operator', operator)}
                            className={`px-4 py-3 border rounded-lg text-sm font-medium transition-colors ${
                              values.operator === operator
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                            }`}
                          >
                            {operator}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer name *
                    </label>
                    <Field
                      type="text"
                      name="customerName"
                      placeholder="Customer name"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.customerName && touched.customerName ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.customerName && touched.customerName && (
                      <p className="mt-1 text-sm text-red-600">{errors.customerName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone number *
                    </label>
                    <Field
                      type="tel"
                      name="phoneNumber"
                      placeholder="Phone number"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.phoneNumber && touched.phoneNumber ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.phoneNumber && touched.phoneNumber && (
                      <p className="mt-1 text-sm text-red-600">{errors.phoneNumber}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer email *
                    </label>
                    <Field
                      type="email"
                      name="customerEmail"
                      placeholder="Customer email"
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                        errors.customerEmail && touched.customerEmail ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.customerEmail && touched.customerEmail && (
                      <p className="mt-1 text-sm text-red-600">{errors.customerEmail}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reference
                    </label>
                    <Field
                      type="text"
                      name="reference"
                      placeholder="Reference"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reasons (optional)
                    </label>
                    <FieldArray name="reasons">
                      {({ push, remove }) => (
                        <div className="space-y-2">
                          {values.reasons.map((reason, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <Field
                                name={`reasons.${index}`}
                                placeholder={`Reason ${index + 1}`}
                                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                              {values.reasons.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => remove(index)}
                                  className="px-3 py-2 text-red-600 hover:text-red-800"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          ))}
                          {values.reasons.length < 5 && (
                            <button
                              type="button"
                              onClick={() => push('')}
                              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                            >
                              + Add another reason
                            </button>
                          )}
                        </div>
                      )}
                    </FieldArray>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting || isSubmitting}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white font-semibold py-4 px-6 rounded-lg hover:from-blue-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <FaSpinner className="animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <FaMobileAlt />
                        <span>Proceed to payment</span>
                      </>
                    )}
                  </button>
                </Form>
              )}
            </Formik>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentProcessing({ status, message, transactionId }: any) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
      <div className="flex items-center space-x-3 mb-4">
        <FaSpinner className="animate-spin text-blue-600 text-2xl" />
        <div>
          <h3 className="text-lg font-semibold text-blue-900">Payment Processing</h3>
          <p className="text-blue-700 mt-1">{message}</p>
        </div>
      </div>
      <div className="bg-white rounded-lg p-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Transaction ID:</span>
          <span className="text-sm font-mono text-gray-900">{transactionId}</span>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-sm text-gray-600">Status:</span>
          <span className={`text-sm font-semibold ${
            status === 'completed' ? 'text-green-600' :
            status === 'failed' ? 'text-red-600' :
            'text-blue-600'
          }`}>
            {status.toUpperCase()}
          </span>
        </div>
      </div>
      <p className="text-sm text-blue-600 mt-4">
        Please check your phone and enter your PIN to confirm the payment.
      </p>
    </div>
  );
}

function PaymentSuccess({ payment }: any) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
      <div className="flex items-center space-x-3 mb-4">
        <FaCheckCircle className="text-green-600 text-3xl" />
        <div>
          <h3 className="text-lg font-semibold text-green-900">Payment Successful!</h3>
          <p className="text-green-700 mt-1">Your payment has been processed successfully.</p>
        </div>
      </div>
      <div className="bg-white rounded-lg p-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-600">Transaction ID:</span>
          <span className="font-mono text-gray-900">{payment.transactionId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Invoice Number:</span>
          <span className="font-mono text-gray-900">{payment.invoiceNumber}</span>
        </div>
      </div>
      <a
        href={`/invoice/${payment.invoiceNumber}`}
        target="_blank"
        className="mt-4 inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 font-medium"
      >
        <FaFileInvoice />
        <span>View Invoice</span>
      </a>
    </div>
  );
}