import { jsPDF } from "jspdf";
import { INVOICEHUB_LOGO_PNG } from "./invoiceHubLogo";

/**
 * Professional payment receipt PDF generator for InvoiceHub.
 *
 * Highlights:
 * - Clean header that handles long business names without crowding the document title.
 * - Consistent NGN amount format using plain ASCII "N" to avoid jsPDF Naira-symbol rendering issues.
 * - Deduplicated receipt content: one payment summary, grouped invoice/payment details, one amount breakdown, one receipt note.
 * - Pagination guards for longer names, descriptions, and references.
 */

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatMoney(amount, currency = "NGN") {
  const numericAmount = Number(amount || 0);

  const formattedNumber = numericAmount.toLocaleString("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const normalizedCurrency = String(currency || "NGN").trim().toUpperCase();

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

function formatDate(value = new Date()) {
  if (!value) return new Date().toLocaleString();

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return new Date().toLocaleString();
  }

  return date.toLocaleString("en-NG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function cleanFilePart(value) {
  return String(value || "receipt")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function getCustomerName(invoice = {}) {
  return (
    invoice.customer ||
    invoice.customerName ||
    invoice.student ||
    invoice.studentName ||
    "Customer"
  );
}

function getDescription(invoice = {}) {
  return (
    invoice.description ||
    invoice.category ||
    invoice.class ||
    "Invoice payment"
  );
}

function getPaymentReference(invoice = {}, paymentReference = "") {
  return (
    paymentReference ||
    invoice.paymentReference ||
    invoice.pendingPaymentReference ||
    invoice.transactionReference ||
    "-"
  );
}

function getOutstandingBefore(invoice = {}, paidAmount = 0) {
  const hasBalance =
    typeof invoice.balanceDue !== "undefined" && invoice.balanceDue !== null;

  const hasAmount =
    typeof invoice.amount !== "undefined" && invoice.amount !== null;

  const hasPaidAfter =
    typeof invoice.paidAmount !== "undefined" && invoice.paidAmount !== null;

  if (hasBalance && hasAmount && hasPaidAfter) {
    const balanceDue = Number(invoice.balanceDue) || 0;
    const invoiceAmount = Number(invoice.amount) || 0;
    const paidAfter = Number(invoice.paidAmount) || 0;

    const balancePlusPaid = roundMoney(balanceDue + paidAfter);
    const totalInvoiceAmount = roundMoney(invoiceAmount);

    if (Math.abs(balancePlusPaid - totalInvoiceAmount) < 0.01) {
      return roundMoney(balanceDue + paidAmount);
    }

    return roundMoney(balanceDue);
  }

  return roundMoney(
    Number(
      invoice.balanceDue ??
        invoice.balance ??
        (invoice.amount
          ? Number(invoice.amount) - Number(invoice.paidAmount || 0)
          : 0)
    ) || 0
  );
}

function setText(
  doc,
  {
    font = "helvetica",
    style = "normal",
    size = 10,
    color = [15, 23, 42],
  } = {}
) {
  doc.setFont(font, style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

function addWrappedText(doc, text, x, y, maxWidth, options = {}) {
  const {
    font = "helvetica",
    style = "normal",
    size = 10,
    color = [15, 23, 42],
    lineHeight = 14,
  } = options;

  setText(doc, {
    font,
    style,
    size,
    color,
  });

  const lines = doc.splitTextToSize(String(text || "-"), maxWidth);
  doc.text(lines, x, y);

  return lines.length * lineHeight;
}

function addSectionTitle(doc, title, x, y) {
  setText(doc, {
    font: "helvetica",
    style: "bold",
    size: 9,
    color: [71, 85, 105],
  });

  doc.text(String(title || "").toUpperCase(), x, y);

  return y + 18;
}

function addDetailRow(doc, label, value, x, y, width) {
  const labelWidth = 118;
  const valueX = x + labelWidth;
  const valueWidth = width - labelWidth;

  setText(doc, {
    font: "helvetica",
    style: "bold",
    size: 9,
    color: [100, 116, 139],
  });

  doc.text(label, x, y);

  const height = addWrappedText(doc, value, valueX, y, valueWidth, {
    font: "helvetica",
    style: "normal",
    size: 10.5,
    color: [15, 23, 42],
    lineHeight: 14,
  });

  return y + Math.max(22, height + 6);
}

function addCard(doc, x, y, width, height, options = {}) {
  const {
    fill = [248, 250, 252],
    stroke = [226, 232, 240],
    radius = 12,
  } = options;

  doc.setFillColor(...fill);
  doc.setDrawColor(...stroke);
  doc.setLineWidth(0.8);
  doc.roundedRect(x, y, width, height, radius, radius, "FD");
}

function addStatusPill(doc, status, x, y) {
  const normalizedStatus = String(status || "").toLowerCase();

  let pillWidth = 64;
  let textColor = [71, 85, 105];

  if (normalizedStatus === "paid") {
    doc.setFillColor(220, 252, 231);
    textColor = [22, 101, 52];
    pillWidth = 58;
  } else if (normalizedStatus === "partially paid") {
    doc.setFillColor(254, 243, 199);
    textColor = [146, 64, 14];
    pillWidth = 106;
  } else {
    doc.setFillColor(241, 245, 249);
    textColor = [71, 85, 105];
    pillWidth = 112;
  }

  doc.roundedRect(x, y - 12, pillWidth, 22, 11, 11, "F");

  setText(doc, {
    font: "helvetica",
    style: "bold",
    size: 8,
    color: textColor,
  });

  doc.text(
    String(status || "Status").toUpperCase(),
    x + pillWidth / 2,
    y + 2,
    {
      align: "center",
    }
  );

  return pillWidth;
}

function drawDocumentHeader({
  doc,
  businessName,
  documentTitle = "Payment Receipt",
  margin,
  pageWidth,
  startY = 34,
}) {
  let y = startY;

  doc.addImage(INVOICEHUB_LOGO_PNG, "PNG", margin, y - 8, 24, 28);

  setText(doc, {
    font: "helvetica",
    style: "bold",
    size: 11,
    color: [15, 23, 42],
  });

  doc.text("InvoiceHub", margin + 32, y + 10);

  setText(doc, {
    font: "helvetica",
    style: "normal",
    size: 8.5,
    color: [100, 116, 139],
  });

  doc.text("Generated receipt", pageWidth - margin, y + 10, {
    align: "right",
  });

  y += 58;

  const documentTitleText = String(documentTitle || "Receipt").toUpperCase();
  const badgeWidth = documentTitleText.length > 14 ? 124 : 92;
  const badgeHeight = 28;
  const badgeX = pageWidth - margin - badgeWidth;
  const badgeY = y - 22;

  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.8);
  doc.roundedRect(badgeX, badgeY, badgeWidth, badgeHeight, 14, 14, "FD");

  setText(doc, {
    font: "helvetica",
    style: "bold",
    size: 8,
    color: [71, 85, 105],
  });

  doc.text(documentTitleText, badgeX + badgeWidth / 2, badgeY + 18, {
    align: "center",
  });

  const businessMaxWidth = pageWidth - margin * 2 - badgeWidth - 28;

  setText(doc, {
    font: "helvetica",
    style: "bold",
    size: 18,
    color: [15, 23, 42],
  });

  const businessLines = doc.splitTextToSize(
    String(businessName || "Business").trim(),
    businessMaxWidth
  );

  doc.text(businessLines, margin, y);

  y += businessLines.length * 22;

  setText(doc, {
    font: "helvetica",
    style: "normal",
    size: 9.5,
    color: [71, 85, 105],
  });

  doc.text(
    "Receipt generated after a payment was recorded on InvoiceHub.",
    margin,
    y + 8
  );

  y += 36;

  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.9);
  doc.line(margin, y, pageWidth - margin, y);

  return y + 28;
}

function addFooter(doc, { margin, pageWidth, footerY, receiptId }) {
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, footerY - 18, pageWidth - margin, footerY - 18);

  setText(doc, {
    font: "helvetica",
    style: "normal",
    size: 8.5,
    color: [100, 116, 139],
  });

  doc.text("Generated by InvoiceHub", margin, footerY);

  doc.text(`Receipt ID: ${receiptId}`, pageWidth - margin, footerY, {
    align: "right",
  });
}

export function buildPaymentReceiptPdf({
  invoice = {},
  owner = {},
  amount,
  paymentReference = "",
  provider = "",
  currency = "NGN",
} = {}) {
  if (!invoice || typeof invoice !== "object") {
    throw new TypeError("invoice must be an object");
  }

  const paidAmount = roundMoney(amount ?? invoice.paidAmount ?? 0);
  const invoiceOutstandingBefore = getOutstandingBefore(invoice, paidAmount);
  const remainingBalance = roundMoney(invoiceOutstandingBefore - paidAmount);

  const originalAmount = roundMoney(
    invoice.amount || invoiceOutstandingBefore || paidAmount
  );

  const status =
    paidAmount > 0
      ? remainingBalance > 0
        ? "Partially paid"
        : "Paid"
      : invoiceOutstandingBefore <= 0
        ? "Paid"
        : "Awaiting payment";

  const customerName = getCustomerName(invoice);
  const businessName = owner.businessName || invoice.businessName || "InvoiceHub";
  const invoiceNumber = invoice.invoiceNumber || "Pending";
  const useCurrency = owner.currency || currency || "NGN";
  const selectedProvider = provider || invoice.paymentProvider || "Manual";
  const reference = getPaymentReference(invoice, paymentReference);
  const description = getDescription(invoice);
  const receiptId = cleanFilePart(invoice._id || invoiceNumber || "receipt");

  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const contentWidth = pageWidth - margin * 2;
  const footerY = pageHeight - 42;

  let y = drawDocumentHeader({
    doc,
    businessName,
    documentTitle: "Payment Receipt",
    margin,
    pageWidth,
    startY: 34,
  });

  const summaryHeight = 108;

  addCard(doc, margin, y, contentWidth, summaryHeight, {
    fill: [240, 253, 244],
    stroke: [187, 247, 208],
    radius: 14,
  });

  setText(doc, {
    font: "helvetica",
    style: "bold",
    size: 9,
    color: [22, 101, 52],
  });

  doc.text("PAYMENT CONFIRMED", margin + 20, y + 26);

  setText(doc, {
    font: "helvetica",
    style: "bold",
    size: 26,
    color: [15, 23, 42],
  });

  doc.text(formatMoney(paidAmount, useCurrency), margin + 20, y + 62);

  addStatusPill(doc, status, pageWidth - margin - 120, y + 29);

  setText(doc, {
    font: "helvetica",
    style: "normal",
    size: 9.5,
    color: [71, 85, 105],
  });

  doc.text(`Invoice ${invoiceNumber}`, margin + 20, y + 88);

  doc.text(
    formatDate(invoice.paidAt || invoice.updatedAt || new Date()),
    pageWidth - margin - 20,
    y + 88,
    {
      align: "right",
    }
  );

  y += summaryHeight + 28;

  const gap = 18;
  const cardWidth = (contentWidth - gap) / 2;
  const cardHeight = 184;

  if (y + cardHeight > footerY - 24) {
    addFooter(doc, {
      margin,
      pageWidth,
      footerY,
      receiptId,
    });

    doc.addPage();
    y = margin;
  }

  addCard(doc, margin, y, cardWidth, cardHeight);
  addCard(doc, margin + cardWidth + gap, y, cardWidth, cardHeight);

  let leftY = y + 26;
  let rightY = y + 26;

  leftY = addSectionTitle(doc, "Invoice Details", margin + 18, leftY);

  leftY = addDetailRow(
    doc,
    "Invoice No.",
    invoiceNumber,
    margin + 18,
    leftY,
    cardWidth - 36
  );

  leftY = addDetailRow(
    doc,
    "Customer",
    customerName,
    margin + 18,
    leftY,
    cardWidth - 36
  );

  addDetailRow(
    doc,
    "Description",
    description,
    margin + 18,
    leftY,
    cardWidth - 36
  );

  const rightX = margin + cardWidth + gap + 18;

  rightY = addSectionTitle(doc, "Payment Details", rightX, rightY);

  rightY = addDetailRow(
    doc,
    "Provider",
    selectedProvider,
    rightX,
    rightY,
    cardWidth - 36
  );

  rightY = addDetailRow(
    doc,
    "Reference",
    reference,
    rightX,
    rightY,
    cardWidth - 36
  );

  addDetailRow(
    doc,
    "Date",
    formatDate(invoice.paidAt || invoice.updatedAt || new Date()),
    rightX,
    rightY,
    cardWidth - 36
  );

  y += cardHeight + 28;

  const breakdownHeight = 96;

  if (y + breakdownHeight > footerY - 24) {
    addFooter(doc, {
      margin,
      pageWidth,
      footerY,
      receiptId,
    });

    doc.addPage();
    y = margin;
  }

  addCard(doc, margin, y, contentWidth, breakdownHeight, {
    fill: [255, 255, 255],
    stroke: [226, 232, 240],
    radius: 14,
  });

  let breakdownY = y + 26;
  breakdownY = addSectionTitle(doc, "Amount Breakdown", margin + 18, breakdownY);

  const col1X = margin + 18;
  const col2X = margin + contentWidth / 3 + 8;
  const col3X = margin + (contentWidth / 3) * 2 + 8;

  setText(doc, {
    font: "helvetica",
    style: "normal",
    size: 9,
    color: [100, 116, 139],
  });

  doc.text("Invoice Amount", col1X, breakdownY);
  doc.text("Amount Paid", col2X, breakdownY);
  doc.text(
    remainingBalance < 0 ? "Overpayment" : "Balance Due",
    col3X,
    breakdownY
  );

  setText(doc, {
    font: "helvetica",
    style: "bold",
    size: 13,
    color: [15, 23, 42],
  });

  doc.text(formatMoney(originalAmount, useCurrency), col1X, breakdownY + 22);

  doc.setTextColor(22, 101, 52);
  doc.text(formatMoney(paidAmount, useCurrency), col2X, breakdownY + 22);

  if (remainingBalance > 0) {
    doc.setTextColor(180, 83, 9);
    doc.text(formatMoney(remainingBalance, useCurrency), col3X, breakdownY + 22);
  } else if (remainingBalance < 0) {
    doc.setTextColor(37, 99, 235);
    doc.text(
      formatMoney(Math.abs(remainingBalance), useCurrency),
      col3X,
      breakdownY + 22
    );
  } else {
    doc.setTextColor(22, 101, 52);
    doc.text(formatMoney(0, useCurrency), col3X, breakdownY + 22);
  }

  y += breakdownHeight + 28;

  const noteHeight = 54;

  if (y + noteHeight > footerY - 24) {
    addFooter(doc, {
      margin,
      pageWidth,
      footerY,
      receiptId,
    });

    doc.addPage();
    y = margin;
  }

  addCard(doc, margin, y, contentWidth, noteHeight, {
    fill: [248, 250, 252],
    stroke: [226, 232, 240],
    radius: 12,
  });

  setText(doc, {
    font: "helvetica",
    style: "bold",
    size: 10.5,
    color: [15, 23, 42],
  });

  doc.text("Receipt note", margin + 18, y + 22);

  setText(doc, {
    font: "helvetica",
    style: "normal",
    size: 9.3,
    color: [71, 85, 105],
  });

  doc.text(
    "This receipt confirms the payment recorded for this invoice. Please keep this document for your records.",
    margin + 18,
    y + 40
  );

  addFooter(doc, {
    margin,
    pageWidth,
    footerY,
    receiptId,
  });

  return doc.output("arraybuffer");
}

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
