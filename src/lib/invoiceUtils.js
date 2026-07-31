export function generateInvoiceToken(seed = "inv") {
  const bytes =
    typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function"
      ? Array.from(crypto.getRandomValues(new Uint8Array(12)))
          .map((byte) => byte.toString(16).padStart(2, "0"))
          .join("")
      : Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

  return `${seed}_${bytes}`;
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
  customerLabel = "Customer Name",
  amount,
  pendingBalance,
  description,
  paymentLink,
  paymentLinkLabel = "Payment Link",
  date = new Date(),
  isReminder = false,
}) {
  const normalizedPendingBalance = Number(pendingBalance);
  const amountLines = isReminder
    ? `Original amount: ${formatCurrency(amount)}\nOutstanding balance: ${formatCurrency(
        Number.isFinite(normalizedPendingBalance) ? normalizedPendingBalance : amount
      )}`
    : `Amount due: ${formatCurrency(amount)}\nBalance pending: ${formatCurrency(
        Number.isFinite(normalizedPendingBalance) ? normalizedPendingBalance : amount
      )}`;
  const greeting = `Hello ${customerName || "there"},`;
  const title = isReminder
    ? "This is a payment reminder for your invoice."
    : "A new invoice has been prepared for you.";
  const action = isReminder
    ? "Please use the link below to review the invoice and complete payment."
    : "Please use the link below to view the invoice and payment details.";

  return `${formatLogoLine(businessLogo)}*${businessName || "InvoiceHub"}*

${greeting}

${title}

Invoice number: ${invoiceNumber || "Pending"}
${customerLabel}: ${customerName}
Description: ${description || "Invoice payment"}
${amountLines}
Date issued: ${formatMessageDate(date)}

${action}
${paymentLinkLabel}: ${paymentLink}

Thank you.`;
}

export function buildPaymentConfirmationMessage({
  businessName,
  invoiceNumber,
  customerName,
  customerLabel = "Customer Name",
  amount,
  description,
}) {
  return `*${businessName || "InvoiceHub"}*

Hello ${customerName || "there"},

Your payment has been received and recorded successfully.

Invoice number: ${invoiceNumber || "Pending"}
${customerLabel}: ${customerName}
Amount paid: ${formatCurrency(amount)}
Description: ${description || "Invoice payment"}

Thank you for your payment.`;
}
