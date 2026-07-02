// app/api/payment/status/[transactionId]/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { checkPaymentStatus } from '@/lib/pawapay';
import { prisma } from '@/lib/prisma';



export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params;

    // Check status from PawaPay
    const statusResponse = await checkPaymentStatus(transactionId);

    // Update payment status in database
    const payment = await prisma.payment.update({
      where: { transactionId },
      data: {
        status: mapStatus(statusResponse.status),
        failureReason: statusResponse.failureReason,
      },
    });

    // Update invoice if payment completed
    if (payment.status === 'completed') {
      await prisma.invoice.update({
        where: { paymentId: payment.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });
    }

    return NextResponse.json({
      success: true,
      payment: {
        transactionId: payment.transactionId,
        status: payment.status,
        invoiceNumber: payment.invoiceNumber,
      },
    });
  } catch (error: any) {
    console.error('Status check error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Status check failed',
      },
      { status: 500 }
    );
  }
}

function mapStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'ACCEPTED': 'processing',
    'PENDING': 'processing',
    'SUCCESS': 'completed',
    'COMPLETED': 'completed',
    'FAILED': 'failed',
    'REJECTED': 'failed',
    'EXPIRED': 'expired',
  };
  return statusMap[status] || 'pending';
}