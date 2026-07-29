import {
  buildInvoiceMessage,
  buildPaymentConfirmationMessage,
  toWhatsAppNumber,
} from "./invoiceUtils";
import {
  resolveBrowserWhatsAppConfig,
  resolveActivePaymentGateway,
  resolveWhatsAppWebConfigForUser,
  resolveTwilioWhatsAppConfig,
} from "./paymentGatewaySettings";
import { buildInvoiceAttachment } from "./invoicePdf";
import { buildPaymentReceiptAttachment } from "./paymentReceiptPdf";
import { markInvoiceNotificationPrepared } from "./paymentLifecycle";
import { getOutstandingAmount } from "./reminderSafety";
import {
  isWhatsAppWebConfigured,
  resolveActiveWhatsAppWebConfig,
  sendWhatsAppWebDocument,
  sendWhatsAppWebMessage,
} from "./whatsappWebBridge";
import {
  getTwilioTemplate,
  isTwilioWhatsAppConfigured,
  sendTrackedTwilioWhatsAppMessage,
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

function buildPaymentReceiptMediaUrl(invoice = {}, twilioConfig = {}) {
  const configuredOrigin =
    process.env.TWILIO_MEDIA_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "";
  let origin = String(configuredOrigin).trim().replace(/\/+$/, "");

  if (!origin && twilioConfig.statusCallbackUrl) {
    try {
      origin = new URL(twilioConfig.statusCallbackUrl).origin;
    } catch {
      origin = "";
    }
  }

  if (!origin || !invoice.token || !/^https:\/\//i.test(origin)) {
    return "";
  }

  const transactions = Array.isArray(invoice.paymentTransactions)
    ? invoice.paymentTransactions
    : [];
  const latestPayment = transactions[transactions.length - 1] || {};
  const reference =
    latestPayment.reference ||
    latestPayment.paymentReference ||
    invoice.paymentReference ||
    "";
  const query = reference ? `?reference=${encodeURIComponent(reference)}` : "";

  return `${origin}/api/invoices/by-token/${encodeURIComponent(invoice.token)}/receipt-pdf${query}`;
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
  const invoiceAmount = Number(invoice.amount || 0);
  const outstandingAmount = getOutstandingAmount(invoice);
  const pendingBalance =
    isReminder && outstandingAmount > 0 && outstandingAmount < invoiceAmount
      ? outstandingAmount
      : null;
  const message = buildInvoiceMessage({
    businessLogo: invoice.businessLogo || owner?.businessLogo || "",
    businessName: invoice.businessName || owner?.businessName || "",
    invoiceNumber: invoice.invoiceNumber || "",
    customerName,
    customerLabel: getCustomerMessageLabel(owner),
    amount: invoice.amount,
    pendingBalance,
    description:
      invoice.description || invoice.category || invoice.class || "Invoice payment",
    paymentLink: `${origin}/pay/${invoice.token}`,
    paymentLinkLabel,
    date: invoice.date ? new Date(invoice.date) : new Date(),
    isReminder,
  });

  const twilioConfig = resolveTwilioWhatsAppConfig(owner || {});
  if (twilioConfig.enabled) {
    if (!isTwilioWhatsAppConfigured(twilioConfig)) {
      throw new Error("Twilio WhatsApp is selected but its account or sender is not configured.");
    }
    const templateType = isReminder ? "reminder" : "invoice";
    const result = await sendTrackedTwilioWhatsAppMessage({
      db,
      user: owner,
      config: twilioConfig,
      messageType: templateType,
      relatedId: invoice._id,
      message: {
        phone,
        text: message,
        contentSid: getTwilioTemplate(twilioConfig, templateType),
        contentVariables: {
          1: customerName,
          2: invoice.businessName || owner?.businessName || "InvoiceHub",
          3: invoice.invoiceNumber || "Invoice",
          4: `N${Number(pendingBalance || outstandingAmount || invoice.amount || 0).toLocaleString()}`,
          5: invoice.description || invoice.category || invoice.class || "Invoice payment",
          6: `${origin}/pay/${invoice.token}`,
        },
      },
    });
    await markInvoiceNotificationPrepared(db, invoice._id, result.status || "queued");
    return { sent: true, status: result.status || "queued", provider: "twilio", messageId: result.messageId };
  }

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
      const attachment = buildInvoiceAttachment({ invoice, owner, origin });
      let attachmentSent = false;

      try {
        await sendWhatsAppWebDocument(whatsAppWebConfig, {
          phone,
          caption: "Invoice PDF attached.",
          attachment,
        });
        attachmentSent = true;
      } catch (attachmentError) {
        console.error("WHATSAPP INVOICE PDF SEND ERROR:", attachmentError);
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

  const twilioConfig = resolveTwilioWhatsAppConfig(owner || {});
  if (twilioConfig.enabled) {
    if (!isTwilioWhatsAppConfigured(twilioConfig)) {
      throw new Error("Twilio WhatsApp is selected but its account or sender is not configured.");
    }
    const paidAmount = amount ?? invoice.paidAmount ?? invoice.amount ?? 0;
    const receiptMediaUrl = buildPaymentReceiptMediaUrl(invoice, twilioConfig);
    const receiptContentSid = getTwilioTemplate(twilioConfig, "paymentReceipt");
    const contentSid =
      receiptMediaUrl && receiptContentSid
        ? receiptContentSid
        : getTwilioTemplate(twilioConfig, "payment");
    const businessName = invoice.businessName || owner?.businessName || "InvoiceHub";
    const contentVariables =
      receiptMediaUrl && receiptContentSid
        ? {
            1: customerName,
            2: businessName,
            3: invoice.invoiceNumber || "Invoice",
            4: `N${Number(paidAmount).toLocaleString()}`,
            5: receiptMediaUrl,
          }
        : {
            1: customerName,
            2: businessName,
            3: invoice.invoiceNumber || "Invoice",
            4: `N${Number(paidAmount).toLocaleString()}`,
          };
    const result = await sendTrackedTwilioWhatsAppMessage({
      db,
      user: owner,
      config: twilioConfig,
      messageType: "payment",
      relatedId: invoice._id,
      message: {
        phone,
        text: message,
        contentSid,
        contentVariables,
      },
    });
    await markInvoiceNotificationPrepared(db, invoice._id, result.status || "queued");
    return {
      sent: true,
      status: result.status || "queued",
      provider: "twilio",
      messageId: result.messageId,
      attachmentSent: Boolean(receiptMediaUrl && receiptContentSid),
      attachmentUrl: receiptMediaUrl && receiptContentSid ? receiptMediaUrl : "",
    };
  }

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
  const twilioConfig = resolveTwilioWhatsAppConfig(owner || {});
  if (twilioConfig.enabled) {
    if (!isTwilioWhatsAppConfigured(twilioConfig)) {
      throw new Error("Twilio WhatsApp is selected but its account or sender is not configured.");
    }
    const result = await sendTrackedTwilioWhatsAppMessage({
      db, user: owner, config: twilioConfig, messageType: "receiptRejection", relatedId: invoice?._id,
      message: {
        phone: recipientPhone, text: message,
        contentSid: getTwilioTemplate(twilioConfig, "receiptRejection"),
        contentVariables: { 1: customerName, 2: invoiceNumber, 3: rejectionReason, 4: businessName },
      },
    });
    return { sent: true, status: result.status || "queued", provider: "twilio", messageId: result.messageId };
  }

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
