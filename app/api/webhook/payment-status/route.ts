import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';




export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Verify webhook signature if PawaPay provides one
    const signature = request.headers.get('x-pawapay-signature');
    // Add signature verification here if PawaPay provides it
    
    const { depositId, status, failureReason, amount, currency } = body;

    if (!depositId || !status) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Update payment status in database
    const paymentUpdate = await prisma.payment.updateMany({
      where: { transactionId: depositId },
      data: {
        status: status.toLowerCase(),
        failureReason: failureReason || null,
        metadata: {
          webhookReceived: new Date().toISOString(),
          rawWebhookData: body
        }
      },
    });

    if (paymentUpdate.count === 0) {
      console.warn(`No payment found for transaction ID: ${depositId}`);
      // Still return 200 to acknowledge receipt
      return NextResponse.json({ 
        success: true, 
        message: 'Webhook received but no matching payment found' 
      });
    }

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

    // Log successful webhook processing
    console.log(`Payment webhook processed successfully: ${depositId} - ${status}`);

    return NextResponse.json({ 
      success: true, 
      message: 'Webhook processed successfully' 
    });

  } catch (error) {
    console.error('Payment webhook error:', error);
    
    // Always return 200 to acknowledge receipt, even on error
    // This prevents PawaPay from retrying excessively
    return NextResponse.json(
      { success: false, error: 'Internal processing error' },
      { status: 200 } // Note: 200 status even on error
    );
  }
}