import {
  buildInvoiceMessage,
  buildPaymentConfirmationMessage,
  toWhatsAppNumber,
} from "./invoiceUtils";
import { resolveTwilioSandboxConfig } from "./paymentGatewaySettings";
import { markInvoiceNotificationPrepared } from "./paymentLifecycle";
import {
  isTwilioSandboxConfigured,
  sendTwilioWhatsAppMessage,
} from "./twilioWhatsApp";

function buildFallbackUrl(phone, message) {
  const normalizedPhone = toWhatsAppNumber(phone);

  if (!normalizedPhone) {
    return "";
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

function shouldFallbackToBrowser(error) {
  const normalizedMessage = String(error?.message || "").toLowerCase();
  const normalizedCode = String(error?.code || "").trim();

  return (
    normalizedCode === "63015" ||
    normalizedMessage.includes("63015") ||
    normalizedMessage.includes("sandbox") ||
    normalizedMessage.includes("join") ||
    normalizedMessage.includes("whatsapp")
  );
}

export async function deliverInvoiceMessage({
  db,
  invoice,
  owner,
  origin,
}) {
  const phone = invoice?.phone || "";

  if (!phone) {
    return { sent: false, provider: "none" };
  }

  const customerName =
    invoice.customer || invoice.customerName || invoice.student || "Customer";
  const message = buildInvoiceMessage({
    businessLogo: invoice.businessLogo || owner?.businessLogo || "",
    businessName: invoice.businessName || owner?.businessName || "",
    invoiceNumber: invoice.invoiceNumber || "",
    customerName,
    amount: invoice.amount,
    description:
      invoice.description || invoice.category || invoice.class || "Invoice payment",
    items: invoice.items || [],
    paymentLink: `${origin}/pay/${invoice.token}`,
    date: invoice.date ? new Date(invoice.date) : new Date(),
  });

  const twilioConfig = resolveTwilioSandboxConfig(owner || {});

  if (isTwilioSandboxConfigured(twilioConfig)) {
    try {
      await sendTwilioWhatsAppMessage(twilioConfig, { phone, text: message });
      await markInvoiceNotificationPrepared(db, invoice._id, "prepared");

      return { sent: true, provider: "twilioSandbox" };
    } catch (error) {
      if (!shouldFallbackToBrowser(error)) {
        throw error;
      }
    }
  }

  await markInvoiceNotificationPrepared(db, invoice._id, "prepared");

  return {
    sent: false,
    provider: "browser",
    fallbackUrl: buildFallbackUrl(phone, message),
    message,
  };
}

export async function deliverPaymentConfirmation({
  db,
  invoice,
  owner,
  amount,
}) {
  const phone = invoice?.phone || "";

  if (!phone) {
    return { sent: false, provider: "none" };
  }

  const customerName =
    invoice.customer || invoice.customerName || invoice.student || "Customer";
  const message = buildPaymentConfirmationMessage({
    businessName: invoice.businessName || owner?.businessName || "",
    invoiceNumber: invoice.invoiceNumber || "",
    customerName,
    amount: amount ?? invoice.paidAmount ?? invoice.amount ?? 0,
    description:
      invoice.description || invoice.category || invoice.class || "Invoice payment",
  });

  const twilioConfig = resolveTwilioSandboxConfig(owner || {});

  if (isTwilioSandboxConfigured(twilioConfig)) {
    try {
      await sendTwilioWhatsAppMessage(twilioConfig, { phone, text: message });
      await markInvoiceNotificationPrepared(db, invoice._id, "prepared");

      return { sent: true, provider: "twilioSandbox" };
    } catch (error) {
      if (!shouldFallbackToBrowser(error)) {
        throw error;
      }
    }
  }

  await markInvoiceNotificationPrepared(db, invoice._id, "prepared");

  return {
    sent: false,
    provider: "browser",
    fallbackUrl: buildFallbackUrl(phone, message),
    message,
  };
}
