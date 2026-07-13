import {
  buildInvoiceMessage,
  buildPaymentConfirmationMessage,
  toWhatsAppNumber,
} from "./invoiceUtils";
import {
  resolveBrowserWhatsAppConfig,
  resolveWhatsAppWebConfigForUser,
} from "./paymentGatewaySettings";
import { buildPaymentReceiptAttachment } from "./paymentReceiptPdf";
import { markInvoiceNotificationPrepared } from "./paymentLifecycle";
import {
  isWhatsAppWebConfigured,
  sendWhatsAppWebDocument,
  sendWhatsAppWebMessage,
} from "./whatsappWebBridge";

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
    normalizedCode === "ECONNREFUSED" ||
    normalizedCode === "ECONNRESET" ||
    normalizedCode === "ETIMEDOUT" ||
    normalizedCode === "ENOTFOUND" ||
    normalizedMessage.includes("fetch failed") ||
    normalizedMessage.includes("connect econnrefused") ||
    normalizedMessage.includes("connection refused") ||
    normalizedMessage.includes("timed out") ||
    normalizedMessage.includes("whatsapp")
  );
}

function getCustomerMessageLabel(owner = {}) {
  return String(owner.businessType || "").toLowerCase() === "school"
    ? "Student Name"
    : "Customer Name";
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
    customerLabel: getCustomerMessageLabel(owner),
    amount: invoice.amount,
    description:
      invoice.description || invoice.category || invoice.class || "Invoice payment",
    items: invoice.items || [],
    paymentLink: `${origin}/pay/${invoice.token}`,
    date: invoice.date ? new Date(invoice.date) : new Date(),
    isReminder,
  });

  const browserConfig = resolveBrowserWhatsAppConfig(owner || {});
  const whatsAppWebConfig = await resolveWhatsAppWebConfigForUser(db, owner || {});

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
    customerLabel: getCustomerMessageLabel(owner),
    amount: amount ?? invoice.paidAmount ?? invoice.amount ?? 0,
    description:
      invoice.description || invoice.category || invoice.class || "Invoice payment",
  });

  const browserConfig = resolveBrowserWhatsAppConfig(owner || {});
  const whatsAppWebConfig = await resolveWhatsAppWebConfigForUser(db, owner || {});

  if (isWhatsAppWebConfigured(whatsAppWebConfig)) {
    try {
      await sendWhatsAppWebMessage(whatsAppWebConfig, { phone, text: message });
      const attachment = buildPaymentReceiptAttachment({
        invoice,
        owner,
        amount: amount ?? invoice.paidAmount ?? invoice.amount ?? 0,
      });
      let attachmentSent = false;

      try {
        await sendWhatsAppWebDocument(whatsAppWebConfig, {
          phone,
          caption: "Payment receipt attached.",
          attachment,
        });
        attachmentSent = true;
      } catch (attachmentError) {
        console.error("PAYMENT RECEIPT PDF SEND ERROR:", attachmentError);
      }

      await markInvoiceNotificationPrepared(db, invoice._id, "prepared");

      return { sent: true, provider: "whatsappWeb", attachmentSent };
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
    attachmentSent: false,
  };
}
