import {
  buildInvoiceMessage,
  buildPaymentConfirmationMessage,
  toWhatsAppNumber,
} from "./invoiceUtils";
import {
  resolveBrowserWhatsAppConfig,
  resolveActivePaymentGateway,
  resolveWhatsAppWebConfigForUser,
} from "./paymentGatewaySettings";
import { buildPaymentReceiptAttachment } from "./paymentReceiptPdf";
import { markInvoiceNotificationPrepared } from "./paymentLifecycle";
import {
  isWhatsAppWebConfigured,
  resolveActiveWhatsAppWebConfig,
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
  const activeGateway = resolveActivePaymentGateway(owner || {});
  const paymentLinkLabel =
    activeGateway === "accountDetails"
      ? "Click to view account details"
      : activeGateway === "receiptUpload"
        ? "Click to view bank transfer details"
        : "Payment Link";
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
    paymentLinkLabel,
    date: invoice.date ? new Date(invoice.date) : new Date(),
    isReminder,
  });

  const browserConfig = resolveBrowserWhatsAppConfig(owner || {});
  const savedWhatsAppWebConfig = await resolveWhatsAppWebConfigForUser(db, owner || {});
  let whatsAppWebConfig = savedWhatsAppWebConfig;

  if (isWhatsAppWebConfigured(savedWhatsAppWebConfig)) {
    try {
      whatsAppWebConfig = await resolveActiveWhatsAppWebConfig(savedWhatsAppWebConfig);
    } catch {
      whatsAppWebConfig = savedWhatsAppWebConfig;
    }
  }

  if (isWhatsAppWebConfigured(whatsAppWebConfig)) {
    try {
      await sendWhatsAppWebMessage(whatsAppWebConfig, { phone, text: message });
      await markInvoiceNotificationPrepared(db, invoice._id, "sent");

      return { sent: true, status: "sent", provider: "whatsappWeb" };
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
    status: "fallback",
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
  const savedWhatsAppWebConfig = await resolveWhatsAppWebConfigForUser(db, owner || {});
  let whatsAppWebConfig = savedWhatsAppWebConfig;

  if (isWhatsAppWebConfigured(savedWhatsAppWebConfig)) {
    try {
      whatsAppWebConfig = await resolveActiveWhatsAppWebConfig(savedWhatsAppWebConfig);
    } catch {
      whatsAppWebConfig = savedWhatsAppWebConfig;
    }
  }

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

      await markInvoiceNotificationPrepared(db, invoice._id, "sent");

      return {
        sent: true,
        status: "sent",
        provider: "whatsappWeb",
        attachmentSent,
      };
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
    status: "fallback",
    provider: "browser",
    fallbackUrl: buildFallbackUrl(phone, message),
    message,
    attachmentSent: false,
  };
}

export async function deliverReceiptRejection({
  db,
  invoice,
  owner,
  phone,
  reason,
}) {
  const recipientPhone = String(phone || invoice?.phone || "").trim();

  if (!recipientPhone) {
    return { sent: false, provider: "none", reason: "missing_phone" };
  }

  const customerName =
    invoice?.customer || invoice?.customerName || invoice?.student || "Customer";
  const businessName = invoice?.businessName || owner?.businessName || "the business";
  const invoiceNumber = invoice?.invoiceNumber || "your invoice";
  const rejectionReason = String(reason || "Receipt could not be validated").trim();
  const message = [
    `Hello ${customerName},`,
    "",
    `Your uploaded payment receipt for Invoice ${invoiceNumber} could not be validated.`,
    `Reason: ${rejectionReason}`,
    "",
    `The invoice remains unpaid. Please contact ${businessName} or upload another receipt.`,
  ].join("\n");
  const savedConfig = await resolveWhatsAppWebConfigForUser(db, owner || {});
  let whatsAppWebConfig = savedConfig;

  if (isWhatsAppWebConfigured(savedConfig)) {
    try {
      whatsAppWebConfig = await resolveActiveWhatsAppWebConfig(savedConfig);
    } catch {
      whatsAppWebConfig = savedConfig;
    }
  }

  if (!isWhatsAppWebConfigured(whatsAppWebConfig)) {
    return { sent: false, provider: "none", reason: "bridge_not_configured" };
  }

  const delivery = await sendWhatsAppWebMessage(whatsAppWebConfig, {
    phone: recipientPhone,
    text: message,
  });

  return {
    sent: true,
    status: "sent",
    provider: "whatsappWeb",
    messageId: delivery?.messageId || delivery?.id || delivery?.key?.id || "",
  };
}
