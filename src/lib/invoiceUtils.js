export function generateInvoiceToken(seed = "inv") {
  return `${seed}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function toWhatsAppNumber(rawPhone) {
  if (!rawPhone) return "";

  const digits = rawPhone.replace(/\D/g, "");

  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;

  return `234${digits}`;
}

export function buildInvoiceMessage({
  customerName,
  category,
  amount,
  paymentLink,
  date = new Date(),
}) {
  const formattedDate =
    date.toLocaleDateString() +
    " " +
    date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return `Hello ${customerName},

Please make payment for ${category || "this invoice"}

Amount: ₦${Number(amount).toLocaleString()}
Date: ${formattedDate}

Payment Link:
${paymentLink}`;
}
