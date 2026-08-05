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
import { sendOrQueueWhatsAppWebMessage } from "./whatsappMessageQueue";
import {
  fetchWhatsAppWebStatus,
  isWhatsAppWebConfigured,
  resolveActiveWhatsAppWebConfig,
} from "./whatsappWebBridge";
import {
  getTwilioTemplate,
  isTwilioWhatsAppConfigured,
  sendTrackedTwilioWhatsAppMessage,
} from "./twilioWhatsApp";

function normalizeWhatsAppProviderKey(owner = {}) {
  const explicitProvider = String(owner.defaultWhatsAppProvider || "").trim();

  if (explicitProvider === "browser") return "browser";
  if (explicitProvider === "whatsappWeb") return "whatsappWeb";
  if (explicitProvider === "twilio") return "twilio";

  const providers = owner.whatsappProviders || {};

  if (providers.browser?.enabled) return "browser";
  if (providers.whatsappWeb?.enabled) return "whatsappWeb";
  if (providers.twilio?.enabled) return "twilio";

  return "browser";
}

function buildFallbackUrl(phone, message) {
  const normalizedPhone = toWhatsAppNumber(phone);

  if (!normalizedPhone) {
    return "";
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
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

  return `${origin}/api/invoices/by-token/${encodeURIComponent(
    invoice.token
  )}/receipt-pdf${query}`;
}

function buildInvoicePdfMediaUrl(invoice = {}, origin = "") {
  const normalizedOrigin = String(origin || "").trim().replace(/\/+$/, "");

  if (!normalizedOrigin || !invoice.token || !/^https:\/\//i.test(normalizedOrigin)) {
    return "";
  }

  return `${normalizedOrigin}/api/invoices/by-token/${encodeURIComponent(
    invoice.token
  )}/pdf`;
}

function formatCurrencyValue(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function buildInvoiceWhatsAppMessage({
  isReminder,
  baseMessage,
  outstandingAmount,
  invoiceAmount,
}) {
  let waMessage = String(baseMessage || "");
  const amountRegex = /amount:/i;
  const balanceRegex = /balance:/i;
  const lines = waMessage.split(/\r?\n/);
  const amountIndex = lines.findIndex((line) => amountRegex.test(line));

  if (amountIndex !== -1) {
    const filtered = lines.filter((line) => !balanceRegex.test(line));
    const newAmountIndex = filtered.findIndex((line) => amountRegex.test(line));
    const insertPos = newAmountIndex >= 0 ? newAmountIndex + 1 : filtered.length;
    filtered.splice(insertPos, 0, `Balance: ${formatCurrencyValue(outstandingAmount)}`);
    waMessage = filtered.join("\n");
  } else if (isReminder) {
    const formattedAmount = formatCurrencyValue(invoiceAmount);
    const formattedOutstanding = formatCurrencyValue(outstandingAmount);
    waMessage = [waMessage, "", `Amount: ${formattedAmount}`, `Balance: ${formattedOutstanding}`].join("\n");
  }

  return waMessage;
}

function buildBrowserResult({ phone, message, provider = "browser", status = "fallback" }) {
  return {
    sent: false,
    status,
    provider,
    fallbackUrl: buildFallbackUrl(phone, message),
    message,
  };
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

  const selectedProvider = normalizeWhatsAppProviderKey(owner || {});

  const customerName =
    invoice.customer || invoice.customerName || invoice.student || "Customer";

  const activeGateway = resolveActivePaymentGateway(owner || {});

  const paymentLinkLabel =
    activeGateway === "accountDetails"
      ? "Click to view account details"
      : activeGateway === "receiptUpload"
        ? "Click to view bank transfer details"
        : "Payment Link";

  const outstandingAmount = getOutstandingAmount(invoice);
  const pendingBalance = outstandingAmount;

  const baseMessage = buildInvoiceMessage({
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

  const waMessage = buildInvoiceWhatsAppMessage({
    isReminder,
    baseMessage,
    outstandingAmount,
    invoiceAmount: invoice.amount,
  });

  if (selectedProvider === "browser") {
    await markInvoiceNotificationPrepared(db, invoice._id, "prepared");

    return buildBrowserResult({
      phone,
      message: waMessage,
      provider: "browser",
      status: "fallback",
    });
  }

  if (selectedProvider === "twilio") {
    const twilioConfig = resolveTwilioWhatsAppConfig(owner || {});

    if (!isTwilioWhatsAppConfigured(twilioConfig)) {
      throw new Error(
        "Twilio WhatsApp is selected but its account or sender is not configured."
      );
    }

    const templateType = isReminder ? "reminder" : "invoice";
    const documentMediaUrl = buildInvoicePdfMediaUrl(invoice, origin);
    const documentContentSid = getTwilioTemplate(
      twilioConfig,
      isReminder ? "reminderPdf" : "invoicePdf"
    );

    const hasDocumentTemplate = Boolean(documentMediaUrl && documentContentSid);
    const businessName = invoice.businessName || owner?.businessName || "InvoiceHub";
    const formattedInvoiceAmount = `N${Number(invoice.amount || 0).toLocaleString()}`;
    const formattedBalance = `N${Number(outstandingAmount || 0).toLocaleString()}`;

    const description =
      invoice.description || invoice.category || invoice.class || "Invoice payment";

    const paymentLink = `${origin}/pay/${invoice.token}`;

    const contentVariables = hasDocumentTemplate
      ? isReminder
        ? {
            1: customerName,
            2: businessName,
            3: invoice.invoiceNumber || "Invoice",
            4: formattedInvoiceAmount,
            5: formattedBalance,
            6: description,
            7: paymentLink,
            8: documentMediaUrl,
          }
        : {
            1: customerName,
            2: businessName,
            3: invoice.invoiceNumber || "Invoice",
            4: formattedInvoiceAmount,
            5: description,
            6: paymentLink,
            7: documentMediaUrl,
          }
      : {
          1: customerName,
          2: businessName,
          3: invoice.invoiceNumber || "Invoice",
          4: formattedBalance,
          5: description,
          6: paymentLink,
        };

    const result = await sendTrackedTwilioWhatsAppMessage({
      db,
      user: owner,
      config: twilioConfig,
      messageType: templateType,
      relatedId: invoice._id,
      message: {
        phone,
        text: baseMessage,
        contentSid: hasDocumentTemplate
          ? documentContentSid
          : documentMediaUrl
            ? ""
            : getTwilioTemplate(twilioConfig, templateType),
        contentVariables,
        mediaUrl: documentMediaUrl && !hasDocumentTemplate ? documentMediaUrl : "",
      },
    });

    await markInvoiceNotificationPrepared(db, invoice._id, result.status || "queued");

    return {
      sent: true,
      status: result.status || "queued",
      provider: "twilio",
      messageId: result.messageId,
    };
  }

  if (selectedProvider === "whatsappWeb") {
    const savedWhatsAppWebConfig = await resolveWhatsAppWebConfigForUser(
      db,
      owner || {}
    );

    let whatsAppWebConfig = savedWhatsAppWebConfig;

    if (isWhatsAppWebConfigured(savedWhatsAppWebConfig)) {
      try {
        whatsAppWebConfig = await resolveActiveWhatsAppWebConfig(
          savedWhatsAppWebConfig
        );
      } catch {
        whatsAppWebConfig = savedWhatsAppWebConfig;
      }
    }

    if (!isWhatsAppWebConfigured(whatsAppWebConfig)) {
      throw new Error(
        "WhatsApp Web is selected but the bridge is not configured or connected."
      );
    }

    const bridgeStatus = await fetchWhatsAppWebStatus(whatsAppWebConfig).catch(
      (error) => ({
        status: "offline",
        lastError: error.message || "WhatsApp bridge is offline",
      })
    );
    const attachment = buildInvoiceAttachment({ invoice, owner, origin });
    const result = await sendOrQueueWhatsAppWebMessage({
      db,
      owner,
      config: whatsAppWebConfig,
      bridgeStatus,
      type: isReminder ? "invoice_reminder" : "invoice",
      relatedId: invoice._id,
      phone,
      text: waMessage,
      attachment,
    });

    await markInvoiceNotificationPrepared(
      db,
      invoice._id,
      result.status === "sent" ? "sent" : "pending-whatsapp"
    );

    return result;
  }

  const browserConfig = resolveBrowserWhatsAppConfig(owner || {});

  if (!browserConfig.enabled) {
    throw new Error("Browser WhatsApp is disabled in settings");
  }

  await markInvoiceNotificationPrepared(db, invoice._id, "prepared");

  return buildBrowserResult({
    phone,
    message: waMessage,
    provider: "browser",
    status: "fallback",
  });
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

  const selectedProvider = normalizeWhatsAppProviderKey(owner || {});

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
    balance: Math.max(0, Number(getOutstandingAmount(invoice) || 0)),
  });

  if (selectedProvider === "browser") {
    await markInvoiceNotificationPrepared(db, invoice._id, "prepared");

    return {
      ...buildBrowserResult({
        phone,
        message,
        provider: "browser",
        status: "fallback",
      }),
      attachmentSent: false,
    };
  }

  if (selectedProvider === "twilio") {
    const twilioConfig = resolveTwilioWhatsAppConfig(owner || {});

    if (!isTwilioWhatsAppConfigured(twilioConfig)) {
      throw new Error(
        "Twilio WhatsApp is selected but its account or sender is not configured."
      );
    }

    const paidAmount = amount ?? invoice.paidAmount ?? invoice.amount ?? 0;
    const receiptMediaUrl = buildPaymentReceiptMediaUrl(invoice, twilioConfig);
    const receiptContentSid = getTwilioTemplate(twilioConfig, "paymentReceipt");
    const hasReceiptTemplate = Boolean(receiptMediaUrl && receiptContentSid);

    const contentSid = hasReceiptTemplate
      ? receiptContentSid
      : receiptMediaUrl
        ? ""
        : getTwilioTemplate(twilioConfig, "payment");

    const businessName = invoice.businessName || owner?.businessName || "InvoiceHub";

    const contentVariables = hasReceiptTemplate
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
        mediaUrl: receiptMediaUrl && !hasReceiptTemplate ? receiptMediaUrl : "",
      },
    });

    await markInvoiceNotificationPrepared(db, invoice._id, result.status || "queued");

    return {
      sent: true,
      status: result.status || "queued",
      provider: "twilio",
      messageId: result.messageId,
      attachmentSent: Boolean(receiptMediaUrl),
      attachmentUrl: receiptMediaUrl,
    };
  }

  if (selectedProvider === "whatsappWeb") {
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
      throw new Error(
        "WhatsApp Web is selected but the bridge is not configured or connected."
      );
    }

    const bridgeStatus = await fetchWhatsAppWebStatus(whatsAppWebConfig).catch(
      (error) => ({
        status: "offline",
        lastError: error.message || "WhatsApp bridge is offline",
      })
    );
    const attachment = buildPaymentReceiptAttachment({
      invoice,
      owner,
      amount: amount ?? invoice.paidAmount ?? invoice.amount ?? 0,
    });
    const result = await sendOrQueueWhatsAppWebMessage({
      db,
      owner,
      config: whatsAppWebConfig,
      bridgeStatus,
      type: "payment_confirmation",
      relatedId: invoice._id,
      phone,
      text: message,
      attachment,
    });

    await markInvoiceNotificationPrepared(
      db,
      invoice._id,
      result.status === "sent" ? "sent" : "pending-whatsapp"
    );

    return result;
  }

  const browserConfig = resolveBrowserWhatsAppConfig(owner || {});

  if (!browserConfig.enabled) {
    throw new Error("Browser WhatsApp is disabled in settings");
  }

  await markInvoiceNotificationPrepared(db, invoice._id, "prepared");

  return {
    ...buildBrowserResult({
      phone,
      message,
      provider: "browser",
      status: "fallback",
    }),
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

  const selectedProvider = normalizeWhatsAppProviderKey(owner || {});

  const customerName =
    invoice?.customer || invoice?.customerName || invoice?.student || "Customer";

  const businessName = invoice?.businessName || owner?.businessName || "the business";
  const invoiceNumber = invoice?.invoiceNumber || "your invoice";
  const rejectionReason = String(reason || "Receipt could not be validated").trim();

  const message = [
    `*${businessName}*`,
    "",
    `Hello ${customerName},`,
    "",
    `We reviewed the payment receipt uploaded for Invoice ${invoiceNumber}, but it could not be validated.`,
    `Reason: ${rejectionReason}`,
    "",
    "The invoice remains unpaid for now. Please upload a clearer or corrected receipt, or contact us for help.",
    "",
    "Thank you.",
  ].join("\n");

  if (selectedProvider === "browser") {
    return {
      ...buildBrowserResult({
        phone: recipientPhone,
        message,
        provider: "browser",
        status: "fallback",
      }),
      reason: "browser_required",
    };
  }

  if (selectedProvider === "twilio") {
    const twilioConfig = resolveTwilioWhatsAppConfig(owner || {});

    if (!isTwilioWhatsAppConfigured(twilioConfig)) {
      throw new Error(
        "Twilio WhatsApp is selected but its account or sender is not configured."
      );
    }

    const result = await sendTrackedTwilioWhatsAppMessage({
      db,
      user: owner,
      config: twilioConfig,
      messageType: "receiptRejection",
      relatedId: invoice?._id,
      message: {
        phone: recipientPhone,
        text: message,
        contentSid: getTwilioTemplate(twilioConfig, "receiptRejection"),
        contentVariables: {
          1: customerName,
          2: invoiceNumber,
          3: rejectionReason,
          4: businessName,
        },
      },
    });

    return {
      sent: true,
      status: result.status || "queued",
      provider: "twilio",
      messageId: result.messageId,
    };
  }

  if (selectedProvider === "whatsappWeb") {
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
      throw new Error(
        "WhatsApp Web is selected but the bridge is not configured or connected."
      );
    }

    const bridgeStatus = await fetchWhatsAppWebStatus(whatsAppWebConfig).catch(
      (error) => ({
        status: "offline",
        lastError: error.message || "WhatsApp bridge is offline",
      })
    );

    return sendOrQueueWhatsAppWebMessage({
      db,
      owner,
      config: whatsAppWebConfig,
      bridgeStatus,
      type: "receipt_rejection",
      relatedId: invoice?._id,
      phone: recipientPhone,
      text: message,
    });
  }

  return {
    ...buildBrowserResult({
      phone: recipientPhone,
      message,
      provider: "browser",
      status: "fallback",
    }),
    reason: "browser_required",
  };
}
