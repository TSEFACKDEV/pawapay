// lib/pawapay.ts
import axios from 'axios';

const PAWAPAY_API_BASE_URL = process.env.PAWAPAY_API_BASE_URL;
const PAWAPAY_API_TOKEN = process.env.PAWAPAY_API_TOKEN;

interface PawaPayConfig {
  country: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  reference: string;
  correspondent?: string;
  statementDescription?: string;
}

interface PawaPayResponse {
  transactionId: string;
  status: string;
  operator?: string;
  correspondentId?: string;
  failureReason?: string;
}

// Country to currency mapping
export const COUNTRY_CONFIG = {
  Benin: { currency: 'XOF', code: 'BJ' },
  Cameroon: { currency: 'XAF', code: 'CM' },
  'Cote d\'Ivoire': { currency: 'XOF', code: 'CI' },
  'Democratic Republic of the Congo': { currency: 'CDF', code: 'CD' },
  Gabon: { currency: 'XAF', code: 'GA' },
  Kenya: { currency: 'KES', code: 'KE' },
  'Republic of the Congo': { currency: 'XAF', code: 'CG' },
  Rwanda: { currency: 'RWF', code: 'RW' },
  Senegal: { currency: 'XOF', code: 'SN' },
  'Sierra Leone': { currency: 'SLE', code: 'SL' },
  Uganda: { currency: 'UGX', code: 'UG' },
  Zambia: { currency: 'ZMW', code: 'ZM' },
};

// Mobile money operators by country
export const MOBILE_OPERATORS: Record<string, string[]> = {
  Benin: ['MTN', 'MOOV'],
  Cameroon: ['MTN', 'ORANGE'],
  'Cote d\'Ivoire': ['MTN', 'ORANGE', 'MOOV'],
  'Democratic Republic of the Congo': ['ORANGE', 'AIRTEL', 'VODACOM'],
  Gabon: ['AIRTEL', 'MOOV'],
  Kenya: ['MPESA'],
  'Republic of the Congo': ['MTN', 'AIRTEL'],
  Rwanda: ['MTN', 'AIRTEL'],
  Senegal: ['ORANGE', 'FREE', 'EXPRESSO'],
  'Sierra Leone': ['ORANGE', 'AFRICELL'],
  Uganda: ['MTN', 'AIRTEL'],
  Zambia: ['MTN', 'AIRTEL', 'ZAMTEL'],
};

// PawaPay API endpoints
const PAWAPAY_ENDPOINTS = {
  deposit: '/v1/deposits',
  refund: '/v1/refunds',
  payout: '/v1/payouts',
};

export async function initializeMobileMoneyPayment(
  config: PawaPayConfig
): Promise<PawaPayResponse> {
  try {
    const countryCode = COUNTRY_CONFIG[config.country as keyof typeof COUNTRY_CONFIG]?.code;
    
    const payload = {
      depositId: config.reference || `DEP-${Date.now()}`,
      amount: config.amount.toString(),
      currency: config.currency,
      country: countryCode,
      correspondent: config.correspondent || getDefaultOperator(config.country),
      payer: {
        type: 'MSISDN',
        address: {
          value: config.phoneNumber,
        },
      },
      statementDescription: config.statementDescription || 'Payment for services',
      metadata: {
        platform: 'web-payment',
        timestamp: new Date().toISOString(),
      },
    };

    const response = await axios.post(
      `${PAWAPAY_API_BASE_URL}${PAWAPAY_ENDPOINTS.deposit}`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${PAWAPAY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    return {
      transactionId: response.data.depositId || response.data.transactionId,
      status: mapPawaPayStatus(response.data.status || response.data.state),
      operator: config.correspondent,
      correspondentId: response.data.correspondentId,
      failureReason: response.data.failureReason,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `PawaPay API Error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`
      );
    }
    throw error;
  }
}

export async function checkPaymentStatus(transactionId: string): Promise<any> {
  try {
    const response = await axios.get(
      `${PAWAPAY_API_BASE_URL}/v2/deposits/${transactionId}`,
      {
        headers: {
          'Authorization': `Bearer ${PAWAPAY_API_TOKEN}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `PawaPay Status Check Error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`
      );
    }
    throw error;
  }
}

function getDefaultOperator(country: string): string {
  const operators = MOBILE_OPERATORS[country];
  return operators ? operators[0] : 'MTN';
}

function mapPawaPayStatus(pawaPayStatus: string): string {
  const statusMap: Record<string, string> = {
    'ACCEPTED': 'processing',
    'PENDING': 'processing',
    'SUCCESS': 'completed',
    'COMPLETED': 'completed',
    'FAILED': 'failed',
    'REJECTED': 'failed',
    'EXPIRED': 'expired',
  };
  return statusMap[pawaPayStatus] || 'pending';
}

export async function generateInvoice(paymentData: any): Promise<any> {
  try {
    const response = await axios.post(
      `${PAWAPAY_API_BASE_URL}/v1/invoices`,
      {
        invoiceId: paymentData.invoiceNumber,
        amount: paymentData.amount.toString(),
        currency: paymentData.currency,
        description: 'Payment for services',
        customer: {
          name: paymentData.customerName,
          email: paymentData.customerEmail,
          phone: paymentData.phoneNumber,
        },
        items: paymentData.items || [],
        metadata: paymentData.metadata || {},
      },
      {
        headers: {
          'Authorization': `Bearer ${PAWAPAY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Invoice generation failed:', error);
    return null;
  }
}