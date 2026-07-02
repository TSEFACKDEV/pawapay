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

    if (statusResponse.status !== 'FOUND' || !statusResponse.data) {
      return NextResponse.json(
        {
          success: false,
          error: 'Payment not found in PawaPay',
        },
        { status: 404 }
      );
    }

    const deposit = statusResponse.data;
    const mappedStatus = mapStatus(deposit.status);

    const payment = await prisma.payment.update({
      where: { transactionId },
      data: {
        status: mappedStatus,
        failureReason: deposit.failureReason ? JSON.stringify(deposit.failureReason) : null,
        metadata: {
          ...(deposit.metadata || {}),
          statusCheckedAt: new Date().toISOString(),
          lastStatusResponse: deposit,
        },
      },
    });

    if (mappedStatus === 'completed') {
      await prisma.invoice.update({
        where: { paymentId: payment.id },
        data: {
          status: 'PAID',
          paidAt: new Date(),
        },
      });
    } else if (mappedStatus === 'failed' || mappedStatus === 'expired') {
      await prisma.invoice.update({
        where: { paymentId: payment.id },
        data: {
          status: 'FAILED',
        },
      });
    }

    return NextResponse.json({
      success: true,
      payment: {
        transactionId: payment.transactionId,
        status: payment.status,
        invoiceNumber: payment.invoiceNumber,
        failureReason: payment.failureReason,
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