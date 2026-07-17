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
  customerLabel = "Customer Name",
  amount,
  description,
  items = [],
  paymentLink,
  paymentLinkLabel = "Payment Link",
  date = new Date(),
  isReminder = false,
}) {
  const lines = formatLineItems(items);
  const reminderLine = isReminder ? "\nPayment Reminder\n" : "";

  return `${formatLogoLine(businessLogo)}${businessName || "InvoiceHub"}${reminderLine}

Invoice Number: ${invoiceNumber || "Pending"}
${customerLabel}: ${customerName}
Amount: ${formatCurrency(amount)}
Description: ${description || "Invoice payment"}
Date: ${formatMessageDate(date)}
${lines ? `\nItems:\n${lines}\n` : ""}
${paymentLinkLabel}:
${paymentLink}`;
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

Payment received successfully.

Invoice Number: ${invoiceNumber || "Pending"}
${customerLabel}: ${customerName}
Amount Paid: ${formatCurrency(amount)}
Description: ${description || "Invoice payment"}

Thank you for your payment.`;
}
