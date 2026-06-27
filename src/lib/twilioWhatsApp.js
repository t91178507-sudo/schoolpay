import { toWhatsAppNumber } from "./invoiceUtils";

function normalizeTwilioWhatsAppNumber(phone) {
  const normalized = toWhatsAppNumber(phone);
  return normalized ? `whatsapp:+${normalized}` : "";
}

export function isTwilioSandboxConfigured(config = {}) {
  return Boolean(
    config.enabled &&
      config.accountSid &&
      config.authToken &&
      config.fromNumber
  );
}

export async function sendTwilioWhatsAppMessage(
  config = {},
  { phone, text, contentSid, contentVariables }
) {
  if (!isTwilioSandboxConfigured(config)) {
    throw new Error("Twilio Sandbox is not configured");
  }

  const to = normalizeTwilioWhatsAppNumber(phone);

  if (!to) {
    throw new Error("A valid phone number is required");
  }

  const body = new URLSearchParams();
  body.set("From", config.fromNumber.startsWith("whatsapp:")
    ? config.fromNumber
    : `whatsapp:${config.fromNumber}`);
  body.set("To", to);

  if (contentSid || config.contentSid) {
    body.set("ContentSid", contentSid || config.contentSid);

    if (contentVariables) {
      body.set("ContentVariables", JSON.stringify(contentVariables));
    }
  } else {
    body.set("Body", text);
  }

  if (config.statusCallbackUrl) {
    body.set("StatusCallback", config.statusCallbackUrl);
  }

  const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
      config.accountSid
    )}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    }
  );

  const raw = await response.text();
  let data = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw || null;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        data?.error_message ||
        `Twilio request failed with status ${response.status}`
    );
    error.code = data?.code || data?.error_code || null;
    error.status = response.status;
    throw error;
  }

  return data;
}
