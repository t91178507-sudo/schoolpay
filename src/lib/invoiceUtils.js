export function generateInvoiceToken(seed = "inv") {
  return `${seed}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function generateInvoiceNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${year}${month}${day}-${suffix}`;
}

export function toWhatsAppNumber(rawPhone) {
  if (!rawPhone) return "";

  const digits = rawPhone.replace(/\D/g, "");

  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;

  return `234${digits}`;
}

export function sanitizeInvoiceItems(items = []) {
  return items
    .map((item, index) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = Number(item.unitPrice || 0);
      const description = (item.description || "").trim();
      const lineTotal = quantity * unitPrice;

      return {
        id: item.id || `item-${index + 1}`,
        description,
        quantity,
        unitPrice,
        lineTotal,
      };
    })
    .filter(
      (item) =>
        item.description &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0 &&
        Number.isFinite(item.unitPrice) &&
        item.unitPrice >= 0
    );
}

export function calculateInvoiceTotal(items = []) {
  return sanitizeInvoiceItems(items).reduce(
    (sum, item) => sum + Number(item.lineTotal || 0),
    0
  );
}

function formatCurrency(amount) {
  return `N${Number(amount || 0).toLocaleString()}`;
}

function formatMessageDate(date = new Date()) {
  return (
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  );
}

function formatLineItems(items = []) {
  const sanitized = sanitizeInvoiceItems(items);

  if (sanitized.length === 0) {
    return "";
  }

  return sanitized
    .map(
      (item, index) =>
        `${index + 1}. ${item.description} x${item.quantity} - ${formatCurrency(item.lineTotal)}`
    )
    .join("\n");
}

function formatLogoLine(businessLogo = "") {
  if (typeof businessLogo === "string" && /^https?:\/\//i.test(businessLogo)) {
    return `Logo: ${businessLogo}\n`;
  }

  return "";
}

export function buildInvoiceMessage({
  businessLogo,
  businessName,
  invoiceNumber,
  customerName,
  amount,
  description,
  items = [],
  paymentLink,
  date = new Date(),
}) {
  const lines = formatLineItems(items);

  return `${formatLogoLine(businessLogo)}${businessName || "InvoiceHub"}

Invoice Number: ${invoiceNumber || "Pending"}
Customer Name: ${customerName}
Amount: ${formatCurrency(amount)}
Description: ${description || "Invoice payment"}
Date: ${formatMessageDate(date)}
${lines ? `\nItems:\n${lines}\n` : ""}
Payment Link:
${paymentLink}`;
}

export function buildPaymentConfirmationMessage({
  businessName,
  invoiceNumber,
  customerName,
  amount,
  description,
}) {
  return `*${businessName || "InvoiceHub"}*

Payment received successfully.

Invoice Number: ${invoiceNumber || "Pending"}
Customer Name: ${customerName}
Amount Paid: ${formatCurrency(amount)}
Description: ${description || "Invoice payment"}

Thank you for your payment.`;
}
