import {
  buildInvoiceMessage,
  buildPaymentConfirmationMessage,
  toWhatsAppNumber,
} from "./invoiceUtils";
import {
  resolveGreenApiConfig,
  resolveBrowserWhatsAppConfig,
  resolveTwilioSandboxConfig,
  resolveWhatsAppWebConfig,
} from "./paymentGatewaySettings";
import { markInvoiceNotificationPrepared } from "./paymentLifecycle";
import {
  isTwilioSandboxConfigured,
  sendTwilioWhatsAppMessage,
} from "./twilioWhatsApp";
import {
  isWhatsAppWebConfigured,
  sendWhatsAppWebMessage,
} from "./whatsappWebBridge";
import {
  isGreenApiConfigured,
  sendGreenApiWhatsAppMessage,
} from "./greenApiWhatsApp";

function buildFallbackUrl(phone, message) {
  const normalizedPhone = toWhatsAppNumber(phone);

  if (!normalizedPhone) {
    return "";
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

function shouldFallbackToBrowser(error) {
  const normalizedMessage = String(error?.message || "").toLowerCase();
  const normalizedCode = String(error?.code || error?.cause?.code || "").trim();

  return (
    normalizedCode === "63015" ||
    normalizedCode === "ECONNREFUSED" ||
    normalizedCode === "ECONNRESET" ||
    normalizedCode === "ETIMEDOUT" ||
    normalizedCode === "ENOTFOUND" ||
    normalizedMessage.includes("63015") ||
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("connect econnrefused") ||
    normalizedMessage.includes("connection refused") ||
    normalizedMessage.includes("timed out") ||
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
  isReminder = false,
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
    isReminder,
  });

  const twilioConfig = resolveTwilioSandboxConfig(owner || {});
  const browserConfig = resolveBrowserWhatsAppConfig(owner || {});
  const whatsAppWebConfig = resolveWhatsAppWebConfig(owner || {});
  const greenApiConfig = resolveGreenApiConfig(owner || {});

  if (isGreenApiConfigured(greenApiConfig)) {
    try {
      await sendGreenApiWhatsAppMessage(greenApiConfig, { phone, text: message });
      await markInvoiceNotificationPrepared(db, invoice._id, "prepared");

      return { sent: true, provider: "greenApi" };
    } catch (error) {
      if (!shouldFallbackToBrowser(error)) {
        throw error;
      }
    }
  }

  if (isWhatsAppWebConfigured(whatsAppWebConfig)) {
    try {
      await sendWhatsAppWebMessage(whatsAppWebConfig, { phone, text: message });
      await markInvoiceNotificationPrepared(db, invoice._id, "prepared");

      return { sent: true, provider: "whatsappWeb" };
    } catch (error) {
      if (!shouldFallbackToBrowser(error)) {
        throw error;
      }
    }
  }

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

  if (!browserConfig.enabled) {
    throw new Error("Browser WhatsApp is disabled in settings");
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
  const browserConfig = resolveBrowserWhatsAppConfig(owner || {});
  const whatsAppWebConfig = resolveWhatsAppWebConfig(owner || {});
  const greenApiConfig = resolveGreenApiConfig(owner || {});

  if (isGreenApiConfigured(greenApiConfig)) {
    try {
      await sendGreenApiWhatsAppMessage(greenApiConfig, { phone, text: message });
      await markInvoiceNotificationPrepared(db, invoice._id, "prepared");

      return { sent: true, provider: "greenApi" };
    } catch (error) {
      if (!shouldFallbackToBrowser(error)) {
        throw error;
      }
    }
  }

  if (isWhatsAppWebConfigured(whatsAppWebConfig)) {
    try {
      await sendWhatsAppWebMessage(whatsAppWebConfig, { phone, text: message });
      await markInvoiceNotificationPrepared(db, invoice._id, "prepared");

      return { sent: true, provider: "whatsappWeb" };
    } catch (error) {
      if (!shouldFallbackToBrowser(error)) {
        throw error;
      }
    }
  }

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

  if (!browserConfig.enabled) {
    throw new Error("Browser WhatsApp is disabled in settings");
  }

  await markInvoiceNotificationPrepared(db, invoice._id, "prepared");

  return {
    sent: false,
    provider: "browser",
    fallbackUrl: buildFallbackUrl(phone, message),
    message,
  };
}
