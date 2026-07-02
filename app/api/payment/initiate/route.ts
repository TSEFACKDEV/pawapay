// app/api/payment/initiate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { initializeMobileMoneyPayment } from '@/lib/pawapay';
import { prisma } from '@/lib/prisma';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Initiate payment with PawaPay
    const paymentResponse = await initializeMobileMoneyPayment({
      country,
      amount: parseFloat(amount),
      currency,
      phoneNumber,
      reference: reference || `PAY-${Date.now()}`,
      correspondent: operator,
      statementDescription: reasons?.[0] || 'Payment for services',
    });

    // Store payment in database
    const payment = await prisma.payment.create({
      data: {
        transactionId: paymentResponse.transactionId,
        amount: parseFloat(amount),
        currency,
        country,
        customerName,
        phoneNumber,
        customerEmail,
        reference,
        reasons: reasons || [],
        status: paymentResponse.status,
        paymentMethod: 'MOBILE_MONEY',
        operator: paymentResponse.operator,
        correspondentId: paymentResponse.correspondentId,
        failureReason: paymentResponse.failureReason,
        invoiceNumber,
        metadata: {
          initiatedAt: new Date().toISOString(),
          userAgent: request.headers.get('user-agent'),
        },
      },
    });

    // Create invoice record
    await prisma.invoice.create({
      data: {
        paymentId: payment.id,
        invoiceNumber,
        amount: parseFloat(amount),
        currency,
        customerName,
        customerEmail,
        phoneNumber,
        country,
        paymentMethod: 'MOBILE_MONEY',
        operator,
        status: 'PENDING',
        items: {
          description: 'Mobile money payment',
          reasons: reasons || ['No specific reason provided'],
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
      message: getPaymentInstructions(operator, phoneNumber, country),
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

function getPaymentInstructions(operator: string, phone: string, country: string): string {
  return `A payment request has been sent to ${phone}. Please check your ${operator} mobile money account and enter your PIN to complete the payment.`;
}