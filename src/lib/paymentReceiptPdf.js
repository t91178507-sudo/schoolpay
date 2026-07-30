import { jsPDF } from "jspdf";
import { INVOICEHUB_LOGO_PNG } from "./invoiceHubLogo";

/**
 * @typedef {Object} Invoice
 * @property {string} [customer]
 * @property {string} [customerName]
 * @property {string} [student]
 * @property {string} [businessName]
 * @property {string} [invoiceNumber]
 * @property {number} [amount]
 * @property {number} [balanceDue]
 * @property {number} [balance]
 * @property {number} [paidAmount]
 * @property {string} [paidAt]
 * @property {string} [updatedAt]
 * @property {string} [paymentProvider]
 * @property {string} [paymentReference]
 * @property {string} [pendingPaymentReference]
 * @property {string} [transactionReference]
 * @property {string} [description]
 * @property {string} [category]
 * @property {string} [class]
 * @property {string} [_id]
 */

/**
 * @typedef {Object} Owner
 * @property {string} [businessName]
 * @property {string} [currency]
 */

/**
 * @param {number} amount
 * @param {string} [currency="NGN"]
 * @returns {string}
 */
function formatMoney(amount, currency = "NGN") {
  const numericAmount = Number(amount || 0);

  const formattedNumber = numericAmount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const normalizedCurrency = String(currency || "NGN")
    .trim()
    .toUpperCase();

  /*
    Important:
    jsPDF default fonts do not reliably render the Naira symbol.
    So we force plain ASCII "N" instead of "₦" or Intl currency output.
  */
  if (
    normalizedCurrency === "NGN" ||
    normalizedCurrency === "N" ||
    normalizedCurrency === "NAIRA" ||
    normalizedCurrency === "₦"
  ) {
    return `N${formattedNumber}`;
  }

  const safeCurrencyCode =
    normalizedCurrency.replace(/[^A-Z0-9]/g, "") || "NGN";

  return `${safeCurrencyCode} ${formattedNumber}`;
}

/**
 * @param {string|Date} [value]
 * @returns {string}
 */
function formatDate(value = new Date()) {
  if (!value) return new Date().toLocaleString();

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleString();
  }
  return date.toLocaleString();
}

/**
 * @param {string} value
 * @returns {string}
 */
function cleanFilePart(value) {
  return String(value || "receipt")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Calculate the invoice outstanding balance before this payment.
 * Handles both pre-payment and post-payment balanceDue values.
 *
 * @param {Invoice} invoice
 * @param {number} paidAmount
 * @returns {number}
 */
function getOutstandingBefore(invoice, paidAmount) {
  const hasBalance =
    typeof invoice.balanceDue !== "undefined" && invoice.balanceDue !== null;
  const hasAmount =
    typeof invoice.amount !== "undefined" && invoice.amount !== null;
  const hasPaidAfter =
    typeof invoice.paidAmount !== "undefined" && invoice.paidAmount !== null;

  if (hasBalance && hasAmount && hasPaidAfter) {
    const B = Number(invoice.balanceDue) || 0;
    const A = Number(invoice.amount) || 0;
    const paidAfter = Number(invoice.paidAmount) || 0;

    // Round to 2 decimals before comparison to avoid float drift
    const sum = Math.round((B + paidAfter) * 100) / 100;
    const total = Math.round(A * 100) / 100;

    // If balance + paidAfter === amount, balanceDue is post-payment
    if (Math.abs(sum - total) < 0.01) {
      return Math.round((B + paidAmount) * 100) / 100;
    }
    // Otherwise assume balanceDue is pre-payment outstanding
    return B;
  }

  return (
    Number(
      invoice.balanceDue ??
        invoice.balance ??
        (invoice.amount
          ? Number(invoice.amount) - Number(invoice.paidAmount || 0)
          : 0)
    ) || 0
  );
}

/**
 * @param {Object} params
 * @param {Invoice} [params.invoice]
 * @param {Owner} [params.owner]
 * @param {number} [params.amount]
 * @param {string} [params.paymentReference]
 * @param {string} [params.provider]
 * @param {string} [params.currency]
 * @returns {ArrayBuffer}
 */
export function buildPaymentReceiptPdf({
  invoice = {},
  owner = {},
  amount,
  paymentReference = "",
  provider = "",
  currency = "NGN",
} = {}) {
  // Validate inputs
  if (!invoice || typeof invoice !== "object") {
    throw new TypeError("invoice must be an object");
  }

  const paidAmount = Number(amount ?? invoice.paidAmount ?? 0) || 0;
  const invoiceOutstandingBefore = getOutstandingBefore(invoice, paidAmount);
  const remainingBalance = Math.round((invoiceOutstandingBefore - paidAmount) * 100) / 100;

  const customerName =
    invoice.customer || invoice.customerName || invoice.student || "Customer";
  const businessName = invoice.businessName || owner.businessName || "InvoiceHub";
  const invoiceNumber = invoice.invoiceNumber || "Pending";
  const useCurrency = owner.currency || currency || "NGN";

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = 78;

  // --- Header ---
  doc.addImage(INVOICEHUB_LOGO_PNG, "PNG", margin, 22, 24, 28);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("InvoiceHub", margin + 32, 41);

  doc.setFontSize(20);
  doc.text(businessName, margin, y);
  y += 24;
  doc.setFontSize(14);
  doc.text("Payment Receipt", margin, y);
  y += 30;

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 34;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(
    "Receipt generated by InvoiceHub after successful payment.",
    margin,
    y
  );
  y += 32;

  // --- Data Rows ---
  const rows = [
    ["Invoice Number", invoiceNumber],
    ["Customer", customerName],
    ["Amount Paid", formatMoney(paidAmount, useCurrency)],
  ];

  // Balance / Overpayment
  if (remainingBalance > 0) {
    rows.push(["Balance Due", formatMoney(remainingBalance, useCurrency)]);
  } else if (remainingBalance < 0) {
    rows.push([
      "Overpayment",
      formatMoney(Math.abs(remainingBalance), useCurrency),
    ]);
  }

  // Payment Status
  let status = "Awaiting payment";
  if (paidAmount > 0) {
    status = remainingBalance > 0 ? "Partially paid" : "Paid";
  } else if (invoiceOutstandingBefore <= 0) {
    status = "Paid";
  }
  rows.push(["Status", status]);

  rows.push([
    "Payment Date",
    formatDate(invoice.paidAt || invoice.updatedAt || new Date()),
  ]);

  rows.push([
    "Payment Provider",
    provider || invoice.paymentProvider || "Payment",
  ]);

  rows.push([
    "Payment Reference",
    paymentReference ||
      invoice.paymentReference ||
      invoice.pendingPaymentReference ||
      invoice.transactionReference ||
      "-",
  ]);

  rows.push([
    "Description",
    invoice.description || invoice.category || invoice.class || "Invoice payment",
  ]);

  // --- Render Rows with Pagination Guard ---
  const footerY = pageHeight - 56;
  const rowGap = 24;
  const lineHeight = 15;
  const labelX = margin;
  const valueX = margin + 160;
  const maxValueWidth = pageWidth - margin * 2 - 160;

  rows.forEach(([label, value]) => {
    // Check if we need a new page before rendering this row
    const wrapped = doc.splitTextToSize(
      String(value || "-"),
      maxValueWidth
    );
    const rowHeight = Math.max(rowGap, wrapped.length * lineHeight);

    if (y + rowHeight > footerY - 20) {
      doc.addPage();
      y = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(label, labelX, y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(wrapped, valueX, y);

    y += rowHeight;
  });

  // --- Confirmation Banner ---
  y += 18;
  const bannerHeight = 54;

  // Ensure banner fits on current page
  if (y + bannerHeight > footerY - 20) {
    doc.addPage();
    y = margin;
  }

  doc.setFillColor(236, 253, 245);
  doc.roundedRect(
    margin,
    y,
    pageWidth - margin * 2,
    bannerHeight,
    8,
    8,
    "F"
  );
  doc.setTextColor(6, 95, 70);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Payment confirmed. Thank you.", margin + 18, y + 32);

  // --- Footer ---
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    "This receipt confirms the payment recorded on InvoiceHub.",
    margin,
    footerY
  );

  return doc.output("arraybuffer");
}

/**
 * @param {Object} params
 * @param {Invoice} [params.invoice]
 * @param {Owner} [params.owner]
 * @param {number} [params.amount]
 * @param {string} [params.paymentReference]
 * @param {string} [params.provider]
 * @param {string} [params.currency]
 * @returns {{ filename: string, mimetype: string, base64: string, size: number }}
 */
export function buildPaymentReceiptAttachment({
  invoice = {},
  owner = {},
  amount,
  paymentReference = "",
  provider = "",
  currency = "NGN",
} = {}) {
  const arrayBuffer = buildPaymentReceiptPdf({
    invoice,
    owner,
    amount,
    paymentReference,
    provider,
    currency,
  });

  const buffer = Buffer.from(arrayBuffer);
  const invoiceNumber = cleanFilePart(
    invoice.invoiceNumber || invoice._id || "receipt"
  );

  return {
    filename: `payment-receipt-${invoiceNumber}.pdf`,
    mimetype: "application/pdf",
    base64: buffer.toString("base64"),
    size: buffer.length,
  };
}