// app/api/payment/initiate/route.ts
import { NextRequest, NextResponse } from 'next/server';

import axios from 'axios';
import { prisma } from '@/lib/prisma';



// Configuration PawaPay
const PAWAPAY_API_BASE_URL = process.env.PAWAPAY_API_BASE_URL || 'https://api.pawapay.io';
const PAWAPAY_API_TOKEN = process.env.PAWAPAY_API_TOKEN;

// Mapping des codes pays ISO
const COUNTRY_CODES: Record<string, string> = {
  'Benin': 'BJ',
  'Cameroon': 'CM',
  'Cote d\'Ivoire': 'CI',
  'Democratic Republic of the Congo': 'CD',
  'Gabon': 'GA',
  'Kenya': 'KE',
  'Republic of the Congo': 'CG',
  'Rwanda': 'RW',
  'Senegal': 'SN',
  'Sierra Leone': 'SL',
  'Uganda': 'UG',
  'Zambia': 'ZM',
};

// Mapping des opérateurs par pays
const OPERATOR_MAPPING: Record<string, Record<string, string>> = {
  'Cameroon': {
    'MTN': 'MTN_MOMO_CM',
    'ORANGE': 'ORANGE_MONEY_CM',
  },
  'Benin': {
    'MTN': 'MTN_MOMO_BJ',
    'MOOV': 'MOOV_BJ',
  },
  'Cote d\'Ivoire': {
    'MTN': 'MTN_MOMO_CI',
    'ORANGE': 'ORANGE_MONEY_CI',
    'MOOV': 'MOOV_CI',
  },
  'Democratic Republic of the Congo': {
    'ORANGE': 'ORANGE_MONEY_CD',
    'AIRTEL': 'AIRTEL_MONEY_CD',
    'VODACOM': 'MPESA_CD',
  },
  'Gabon': {
    'AIRTEL': 'AIRTEL_MONEY_GA',
    'MOOV': 'MOOV_GA',
  },
  'Kenya': {
    'MPESA': 'MPESA_KE',
  },
  'Republic of the Congo': {
    'MTN': 'MTN_MOMO_CG',
    'AIRTEL': 'AIRTEL_MONEY_CG',
  },
  'Rwanda': {
    'MTN': 'MTN_MOMO_RW',
    'AIRTEL': 'AIRTEL_MONEY_RW',
  },
  'Senegal': {
    'ORANGE': 'ORANGE_MONEY_SN',
    'FREE': 'FREE_MONEY_SN',
    'EXPRESSO': 'EXPRESSO_MONEY_SN',
  },
  'Sierra Leone': {
    'ORANGE': 'ORANGE_MONEY_SL',
    'AFRICELL': 'AFRICELL_MONEY_SL',
  },
  'Uganda': {
    'MTN': 'MTN_MOMO_UG',
    'AIRTEL': 'AIRTEL_MONEY_UG',
  },
  'Zambia': {
    'MTN': 'MTN_MOMO_ZM',
    'AIRTEL': 'AIRTEL_MONEY_ZM',
    'ZAMTEL': 'ZAMTEL_MONEY_ZM',
  },
};

function formatPhoneNumber(phone: string, country: string): string {
  // Enlever tous les caractères non numériques
  let cleaned = phone.replace(/\D/g, '');
  
  // Ajouter le préfixe pays si nécessaire
  const countryPrefixes: Record<string, string> = {
    'Cameroon': '237',
    'Benin': '229',
    'Cote d\'Ivoire': '225',
    'Democratic Republic of the Congo': '243',
    'Gabon': '241',
    'Kenya': '254',
    'Republic of the Congo': '242',
    'Rwanda': '250',
    'Senegal': '221',
    'Sierra Leone': '232',
    'Uganda': '256',
    'Zambia': '260',
  };

  const prefix = countryPrefixes[country];
  
  // Si le numéro commence déjà par le préfixe pays
  if (cleaned.startsWith(prefix)) {
    return cleaned;
  }
  
  // Si le numéro commence par 0, enlever le 0 et ajouter le préfixe
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Ajouter le préfixe pays
  return prefix + cleaned;
}

async function initializeMobileMoneyPayment(data: {
  country: string;
  amount: number;
  currency: string;
  phoneNumber: string;
  customerName: string;
  customerEmail: string;
  reference?: string;
  operator: string;
  reasons?: string[];
}) {
  const countryCode = COUNTRY_CODES[data.country];
  const formattedPhone = formatPhoneNumber(data.phoneNumber, data.country);
  const operatorCode = OPERATOR_MAPPING[data.country]?.[data.operator];

  // Générer un ID de dépôt unique
  const depositId = `DEP-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  // Construction du payload selon la documentation PawaPay
  const payload = {
    depositId: depositId,
    amount: data.amount.toString(),
    currency: data.currency,
    country: countryCode,
    correspondent: operatorCode || data.operator,
    payer: {
      type: 'MSISDN',
      address: {
        value: formattedPhone
      }
    },
    customer: {
      name: data.customerName,
      email: data.customerEmail
    },
    statementDescription: data.reasons?.[0] || 'Payment for services',
    metadata: {
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      reference: data.reference || '',
      reasons: data.reasons || [],
      initiatedFrom: 'web',
      timestamp: new Date().toISOString()
    }
  };

  console.log('PawaPay Request Payload:', JSON.stringify(payload, null, 2));

  try {
    const response = await axios.post(
      `${PAWAPAY_API_BASE_URL}/v1/deposits`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${PAWAPAY_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 30000,
      }
    );

    console.log('PawaPay Response:', JSON.stringify(response.data, null, 2));

    return {
      success: true,
      transactionId: response.data.depositId || depositId,
      status: response.data.status || 'ACCEPTED',
      operator: data.operator,
      correspondent: operatorCode,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('PawaPay API Error Details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        headers: error.response?.headers,
      });
      
      throw new Error(
        `PawaPay API Error: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`
      );
    }
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    console.log('Received payment request:', JSON.stringify(body, null, 2));

    const {
      amount,
      currency,
      country,
      customerName,
      phoneNumber,
      customerEmail,
      reference,
      reasons,
      operator,
    } = body;

    // Validation des champs requis
    if (!amount || !currency || !country || !customerName || !phoneNumber || !customerEmail || !operator) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields. All fields marked with * are required.',
        },
        { status: 400 }
      );
    }

    // Valider le montant
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid amount. Amount must be greater than 0.',
        },
        { status: 400 }
      );
    }

    // Valider le pays
    if (!COUNTRY_CODES[country]) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid country. Please select a valid country from the list.',
        },
        { status: 400 }
      );
    }

    // Valider l'opérateur
    if (!OPERATOR_MAPPING[country]?.[operator]) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid operator ${operator} for country ${country}. Valid operators: ${Object.keys(OPERATOR_MAPPING[country] || {}).join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Générer un numéro de facture
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Initier le paiement avec PawaPay
    const paymentResponse = await initializeMobileMoneyPayment({
      country,
      amount: parsedAmount,
      currency,
      phoneNumber,
      customerName,
      customerEmail,
      reference,
      operator,
      reasons: reasons?.filter((r: string) => r.trim() !== '') || [],
    });

    // Sauvegarder dans la base de données
    const payment = await prisma.payment.create({
      data: {
        transactionId: paymentResponse.transactionId,
        amount: parsedAmount,
        currency,
        country,
        customerName,
        phoneNumber: formatPhoneNumber(phoneNumber, country),
        customerEmail,
        reference: reference || '',
        reasons: reasons?.filter((r: string) => r.trim() !== '') || [],
        status: 'processing',
        paymentMethod: 'MOBILE_MONEY',
        operator: operator,
        correspondentId: paymentResponse.correspondent || '',
        invoiceNumber,
        metadata: {
          requestPayload: body,
          pawaPayResponse: paymentResponse,
          initiatedAt: new Date().toISOString(),
        },
      },
    });

    // Créer la facture
    await prisma.invoice.create({
      data: {
        paymentId: payment.id,
        invoiceNumber,
        amount: parsedAmount,
        currency,
        customerName,
        customerEmail,
        phoneNumber: formatPhoneNumber(phoneNumber, country),
        country,
        paymentMethod: 'MOBILE_MONEY',
        operator,
        status: 'PENDING',
        items: {
          description: 'Mobile money payment',
          reasons: reasons?.filter((r: string) => r.trim() !== '') || ['No specific reason provided'],
          reference: reference || 'N/A',
        },
        issuedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        transactionId: payment.transactionId,
        status: payment.status,
        invoiceNumber: payment.invoiceNumber,
      },
      message: `A payment request of ${parsedAmount} ${currency} has been sent to your ${operator} mobile money account (${phoneNumber}). Please check your phone and enter your PIN to confirm the payment.`,
    });
  } catch (error: any) {
    console.error('Payment initiation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Payment initiation failed',
      },
      { status: 500 }
    );
  }
}