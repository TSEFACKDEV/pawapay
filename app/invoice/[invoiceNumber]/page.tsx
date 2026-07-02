// app/invoice/[invoiceNumber]/page.tsx

import { prisma } from '@/lib/prisma';
import React from 'react';



export default async function InvoicePage({ params }: { params: Promise<{ invoiceNumber: string }> }) {
  const { invoiceNumber } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { invoiceNumber },
    include: { payment: true },
  });

  if (!invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Invoice Not Found</h1>
          <p className="text-gray-600 mt-2">The requested invoice could not be found.</p>
        </div>
      </div>
    );
  }

  const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-blue-600 px-6 py-8 text-white">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold">INVOICE</h1>
                <p className="text-blue-100 mt-2">#{invoice.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-100">Issue Date</p>
                <p className="font-semibold">{new Date(invoice.issuedAt).toLocaleDateString()}</p>
                {invoice.paidAt && (
                  <>
                    <p className="text-sm text-blue-100 mt-2">Paid Date</p>
                    <p className="font-semibold">{new Date(invoice.paidAt).toLocaleDateString()}</p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 py-8">
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Bill To</h2>
                <p className="font-medium text-gray-900">{invoice.customerName}</p>
                <p className="text-gray-600">{invoice.customerEmail}</p>
                <p className="text-gray-600">{invoice.phoneNumber}</p>
                <p className="text-gray-600">{invoice.country}</p>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Payment Details</h2>
                <p className="text-gray-600">
                  <span className="font-medium">Method:</span> {invoice.paymentMethod}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Operator:</span> {invoice.operator || 'N/A'}
                </p>
                <p className="text-gray-600">
                  <span className="font-medium">Status:</span>{' '}
                  <span className={`font-semibold ${
                    invoice.status === 'PAID' ? 'text-green-600' :
                    invoice.status === 'PENDING' ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {invoice.status}
                  </span>
                </p>
              </div>
            </div>

            <div className="border-t border-b py-4 mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Payment Summary</h2>
                <p className="text-3xl font-bold text-gray-900">
                  {invoice.amount.toLocaleString()} {invoice.currency}
                </p>
              </div>
              {items.reasons && items.reasons.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Reasons:</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {items.reasons.map((reason: string, index: number) => (
                      <li key={index} className="text-gray-600">{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              {items.reference && (
                <p className="text-sm text-gray-600 mt-2">
                  <span className="font-medium">Reference:</span> {items.reference}
                </p>
              )}
            </div>

            <div className="text-center text-sm text-gray-500">
              <p>Thank you for your payment!</p>
              {invoice.payment?.transactionId && (
                <p className="mt-1">Transaction ID: {invoice.payment.transactionId}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => window.print()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
}