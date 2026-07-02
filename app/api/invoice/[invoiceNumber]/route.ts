// app/api/invoice/[invoiceNumber]/route.ts
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ invoiceNumber: string }> }
) {
  try {
    const { invoiceNumber } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber },
      include: { payment: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice: {
        ...invoice,
        items: typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items,
        metadata: invoice.payment?.metadata,
      },
    });
  } catch (error: any) {
    console.error('Invoice fetch error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch invoice' },
      { status: 500 }
    );
  }
}