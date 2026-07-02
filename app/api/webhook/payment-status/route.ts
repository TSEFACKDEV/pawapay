// app/api/webhook/payment-status/route.ts
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { depositId, status, failureReason } = body;

    // Update payment status in database
    await prisma.payment.updateMany({
      where: { transactionId: depositId },
      data: {
        status: status.toLowerCase(),
        failureReason: failureReason || null,
      },
    });

    // Update invoice if payment completed
    if (status === 'SUCCESS' || status === 'COMPLETED') {
      const payment = await prisma.payment.findFirst({
        where: { transactionId: depositId },
      });

      if (payment) {
        await prisma.invoice.update({
          where: { paymentId: payment.id },
          data: {
            status: 'PAID',
            paidAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}