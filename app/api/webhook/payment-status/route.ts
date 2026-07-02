import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

function mapStatus(status: string): string {
  const statusMap: Record<string, string> = {
    ACCEPTED: 'processing',
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    SUCCESS: 'completed',
    FAILED: 'failed',
    REJECTED: 'failed',
    EXPIRED: 'expired',
  };
  return statusMap[status.toUpperCase()] || 'pending';
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify webhook signature if PawaPay provides one
    const signature = request.headers.get('x-pawapay-signature');
    // Add signature verification here if PawaPay provides it

    const { depositId, status, failureReason } = body;

    if (!depositId || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const normalizedStatus = status.toString().toUpperCase();
    const mappedStatus = mapStatus(normalizedStatus);

    const payment = await prisma.payment.findUnique({
      where: { transactionId: depositId },
    });

    if (!payment) {
      console.warn(`No payment found for transaction ID: ${depositId}`);
      return NextResponse.json({
        success: true,
        message: 'Webhook received but no matching payment found',
      });
    }

    const existingMetadata = typeof payment.metadata === 'object' && payment.metadata ? payment.metadata : {};

    await prisma.payment.update({
      where: { transactionId: depositId },
      data: {
        status: mappedStatus,
        failureReason: failureReason ? JSON.stringify(failureReason) : null,
        metadata: {
          ...existingMetadata,
          webhookReceivedAt: new Date().toISOString(),
          rawWebhookData: body,
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

    console.log(`Payment webhook processed successfully: ${depositId} - ${normalizedStatus}`);

    return NextResponse.json({
      success: true,
      message: 'Webhook processed successfully',
    });
  } catch (error) {
    console.error('Payment webhook error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal processing error' },
      { status: 200 }
    );
  }
}
