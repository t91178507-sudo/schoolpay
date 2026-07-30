const { jsPDF } = require('jspdf');
const fs = require('fs');

function formatMoney(amount) {
  return `N${Number(amount || 0).toLocaleString()}`;
}

function formatDate(value = new Date()) {
  const date = value ? new Date(value) : new Date();
  return date.toLocaleString();
}

function buildSimpleReceipt({ invoice = {}, amount = 0, filename = 'receipt.pdf' } = {}) {
  const paidAmount = Number(amount || 0);
  const invoiceOutstandingBefore = Number(invoice.balanceDue ?? invoice.balance ?? (invoice.amount ? Number(invoice.amount) - (Number(invoice.paidAmount || 0)) : 0)) || 0;
  const remainingBalance = Math.max(0, invoiceOutstandingBefore - paidAmount);

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = 78;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(invoice.businessName || 'InvoiceHub', margin, y);
  y += 24;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text('Payment Receipt', margin, y);
  doc.text(`Invoice # ${invoice.invoiceNumber || 'Pending'}`, pageWidth - margin, y, { align: 'right' });
  y += 28;

  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.text('Customer:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.customer || invoice.customerName || 'Customer', margin + 80, y);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.text('Amount Paid:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatMoney(paidAmount), margin + 100, y);
  y += 18;

  if (invoiceOutstandingBefore > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Balance (after this payment):', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatMoney(remainingBalance), margin + 180, y);
    y += 18;
  }

  doc.setFontSize(10);
  doc.text(`Payment Date: ${formatDate(invoice.paidAt || new Date())}`, margin, y);

  const buffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync(filename, buffer);
  console.log('Wrote', filename);
}

// Full payment example
buildSimpleReceipt({
  invoice: {
    businessName: 'KevWhite Nursery and Primary School',
    invoiceNumber: 'INV-001',
    customer: 'John Student',
    amount: 100000,
    paidAmount: 100000,
    balanceDue: 0,
    paidAt: new Date(),
  },
  amount: 100000,
  filename: 'sample-receipt-full.pdf',
});

// Partial payment example
buildSimpleReceipt({
  invoice: {
    businessName: 'KevWhite Nursery and Primary School',
    invoiceNumber: 'INV-002',
    customer: 'Jane Learner',
    amount: 50000,
    paidAmount: 30000,
    balanceDue: 20000,
    paidAt: new Date(),
  },
  amount: 2000,
  filename: 'sample-receipt-partial.pdf',
});
