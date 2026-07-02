// app/api/webhook/refund-status/route.ts
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log the incoming refund webhook
    console.log('Refund webhook received:', JSON.stringify(body));
    
    const { refundId, status, depositId, failureReason } = body;

    if (!refundId || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // If this refund is associated with a deposit, update the payment
    if (depositId) {
      await prisma.payment.updateMany({
        where: { transactionId: depositId },
        data: {
          status: 'refunded',
          metadata: {
            refundWebhookReceived: new Date().toISOString(),
            refundId: refundId,
            refundStatus: status,
            rawRefundData: body
          }
        },
      });

      // Update associated invoice
      const payment = await prisma.payment.findFirst({
        where: { transactionId: depositId },
      });

      if (payment) {
        await prisma.invoice.update({
          where: { paymentId: payment.id },
          data: {
            status: 'REFUNDED',
          },
        });
      }
    }

    // Store refund record if you have a refunds table
    // You may want to create a Refund model in your Prisma schema
    await prisma.payment.updateMany({
      where: { 
        metadata: { 
          path: ['refundId'], 
          equals: refundId 
        } 
      },
      data: {
        status: status.toLowerCase(),
        failureReason: failureReason || null,
      },
    });

    console.log(`Refund webhook processed successfully: ${refundId} - ${status}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Refund webhook processed successfully' 
    });

  } catch (error) {
    console.error('Refund webhook error:', error);
    
    // Always return 200 to acknowledge receipt
    return NextResponse.json(
      { success: false, error: 'Internal processing error' },
      { status: 200 }
    );
  }
}