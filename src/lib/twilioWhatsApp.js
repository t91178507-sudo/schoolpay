import { createHmac, timingSafeEqual } from "crypto";
import { toWhatsAppNumber } from "./invoiceUtils";

const TWILIO_API_BASE = "https://api.twilio.com/2010-04-01";

function basicAuthorization(accountSid, authToken) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

function buildTwilioError(data = {}, fallback = "Twilio request failed", status = 500) {
  const error = new Error(data.message || fallback);
  error.status = status;
  error.code = data.code ? String(data.code) : "TWILIO_REQUEST_FAILED";
  error.details = data.more_info || "";
  return error;
}

async function twilioRequest({
  accountSid,
  authToken,
  path,
  method = "GET",
  form,
}) {
  if (!accountSid || !authToken) {
    const error = new Error("Twilio Account SID and Auth Token are required.");
    error.status = 422;
    error.code = "TWILIO_NOT_CONFIGURED";
    throw error;
  }

  const response = await fetch(`${TWILIO_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: basicAuthorization(accountSid, authToken),
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw buildTwilioError(
      data,
      `Twilio request failed with status ${response.status}`,
      response.status
    );
  }

  return data;
}

export function isTwilioWhatsAppConfigured(config = {}) {
  return Boolean(
    config.enabled &&
      config.accountSid &&
      config.authToken &&
      config.whatsappNumber
  );
}

export function normalizeTwilioWhatsAppAddress(phone) {
  const normalized = toWhatsAppNumber(phone);
  return normalized ? `whatsapp:+${normalized}` : "";
}

export async function verifyTwilioAccount(config = {}) {
  const account = await twilioRequest({
    accountSid: config.accountSid,
    authToken: config.authToken,
    path: `/Accounts/${encodeURIComponent(config.accountSid)}.json`,
  });

  return {
    accountSid: account.sid || config.accountSid,
    friendlyName: account.friendly_name || "",
    status: account.status || "",
    type: account.type || "",
  };
}

export async function createTwilioSubaccount({
  accountSid,
  authToken,
  friendlyName,
}) {
  return twilioRequest({
    accountSid,
    authToken,
    path: "/Accounts.json",
    method: "POST",
    form: {
      FriendlyName: String(friendlyName || "InvoiceHub Business").slice(0, 64),
    },
  });
}

export async function sendTwilioWhatsAppMessage(
  config = {},
  {
    phone,
    text = "",
    contentSid = "",
    contentVariables = {},
    mediaUrl = "",
    statusCallback = "",
  } = {}
) {
  if (!isTwilioWhatsAppConfigured(config)) {
    const error = new Error("Twilio WhatsApp is not configured.");
    error.status = 422;
    error.code = "TWILIO_WHATSAPP_NOT_CONFIGURED";
    throw error;
  }

  const to = normalizeTwilioWhatsAppAddress(phone);
  const from = normalizeTwilioWhatsAppAddress(config.whatsappNumber);
  if (!to) {
    const error = new Error("Enter a valid WhatsApp phone number.");
    error.status = 400;
    error.code = "INVALID_WHATSAPP_NUMBER";
    throw error;
  }

  const form = {
    To: to,
    From: from,
  };

  if (config.messagingServiceSid) {
    delete form.From;
    form.MessagingServiceSid = config.messagingServiceSid;
  }

  if (contentSid) {
    form.ContentSid = contentSid;
    form.ContentVariables = JSON.stringify(contentVariables || {});
  } else {
    form.Body = String(text || "").slice(0, 4096);
  }

  if (mediaUrl) form.MediaUrl = mediaUrl;
  if (statusCallback || config.statusCallbackUrl) {
    form.StatusCallback = statusCallback || config.statusCallbackUrl;
  }

  const message = await twilioRequest({
    accountSid: config.accountSid,
    authToken: config.authToken,
    path: `/Accounts/${encodeURIComponent(config.accountSid)}/Messages.json`,
    method: "POST",
    form,
  });

  return {
    id: message.sid || "",
    messageId: message.sid || "",
    status: message.status || "queued",
    to: message.to || to,
    from: message.from || from,
    errorCode: message.error_code || "",
    errorMessage: message.error_message || "",
  };
}

export async function sendTrackedTwilioWhatsAppMessage({
  db,
  user = {},
  config = {},
  message = {},
  messageType = "general",
  relatedId = "",
} = {}) {
  const result = await sendTwilioWhatsAppMessage(config, message);
  if (db && result.messageId) {
    await db.collection("twilioMessages").insertOne({
      messageSid: result.messageId,
      accountSid: config.accountSid,
      ownerId: user._id?.toString?.() || String(user._id || user.ownerId || ""),
      businessId: String(user.primaryBusinessId || ""),
      provider: "twilio",
      messageType,
      relatedId: String(relatedId || ""),
      to: result.to,
      from: result.from,
      status: result.status || "queued",
      errorCode: result.errorCode || "",
      errorMessage: result.errorMessage || "",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return result;
}

export function validateTwilioSignature({
  authToken,
  signature,
  url,
  params = {},
}) {
  if (!authToken || !signature || !url) return false;

  const payload =
    url +
    Object.keys(params)
      .sort()
      .map((key) => `${key}${params[key]}`)
      .join("");
  const expected = createHmac("sha1", authToken)
    .update(payload, "utf8")
    .digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signature);

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export function getTwilioTemplate(config = {}, type = "general") {
  const key = {
    invoice: "invoiceContentSid",
    reminder: "reminderContentSid",
    payment: "paymentContentSid",
    paymentReceipt: "paymentReceiptContentSid",
    receiptRejection: "receiptRejectionContentSid",
    general: "generalContentSid",
  }[type];

  return key ? String(config[key] || "").trim() : "";
}
