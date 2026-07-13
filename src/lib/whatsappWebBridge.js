import { toWhatsAppNumber } from "./invoiceUtils";

export function isWhatsAppWebConfigured(config = {}) {
  return Boolean(
    config.enabled &&
      config.bridgeBaseUrl &&
      config.sessionName
  );
}

export function hasWhatsAppWebBridgeConfig(config = {}) {
  return Boolean(config.bridgeBaseUrl && config.sessionName);
}

export function isLocalWhatsAppBridgeUrl(rawUrl = "") {
  try {
    const url = new URL(rawUrl);
    return ["localhost", "127.0.0.1", "0.0.0.0", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function assertReachableWhatsAppBridgeConfig(config = {}) {
  if (!config.bridgeBaseUrl) {
    const error = new Error("WhatsApp Web bridge URL is not configured");
    error.status = 400;
    throw error;
  }

  if (
    process.env.VERCEL &&
    isLocalWhatsAppBridgeUrl(config.bridgeBaseUrl)
  ) {
    const error = new Error(
      "WhatsApp Web bridge must use a public URL in production. Localhost cannot be reached from Vercel."
    );
    error.status = 400;
    throw error;
  }
}

export function buildWhatsAppWebSendPayload(config = {}, { phone, text }) {
  return {
    sessionName: config.sessionName,
    from: toWhatsAppNumber(config.senderPhoneNumber),
    to: toWhatsAppNumber(phone),
    text,
    statusWebhookUrl: config.statusWebhookUrl || "",
  };
}

export function buildWhatsAppWebDocumentPayload(
  config = {},
  { phone, caption = "", attachment = {} }
) {
  return {
    sessionName: config.sessionName,
    from: toWhatsAppNumber(config.senderPhoneNumber),
    to: toWhatsAppNumber(phone),
    caption,
    filename: attachment.filename,
    fileName: attachment.filename,
    mimetype: attachment.mimetype || "application/pdf",
    mimeType: attachment.mimetype || "application/pdf",
    data: attachment.base64,
    base64: attachment.base64,
    document: {
      filename: attachment.filename,
      mimetype: attachment.mimetype || "application/pdf",
      data: attachment.base64,
    },
    statusWebhookUrl: config.statusWebhookUrl || "",
  };
}

export async function sendWhatsAppWebMessage(config = {}, { phone, text }) {
  if (!isWhatsAppWebConfigured(config)) {
    throw new Error("WhatsApp Web is not configured");
  }

  const to = toWhatsAppNumber(phone);

  if (!to) {
    throw new Error("A valid phone number is required");
  }

  const response = await fetch(`${config.bridgeBaseUrl}/api/messages/send-text`, {
    method: "POST",
    headers: buildBridgeHeaders(config),
    body: JSON.stringify(buildWhatsAppWebSendPayload(config, { phone, text })),
    cache: "no-store",
  });

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
        data?.error ||
        `WhatsApp Web bridge request failed with status ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function sendWhatsAppWebDocument(
  config = {},
  { phone, caption = "", attachment = {} }
) {
  if (!isWhatsAppWebConfigured(config)) {
    throw new Error("WhatsApp Web is not configured");
  }

  const to = toWhatsAppNumber(phone);

  if (!to) {
    throw new Error("A valid phone number is required");
  }

  if (!attachment.base64 || !attachment.filename) {
    throw new Error("A PDF attachment is required");
  }

  const response = await fetch(`${config.bridgeBaseUrl}/api/messages/send-document`, {
    method: "POST",
    headers: buildBridgeHeaders(config),
    body: JSON.stringify(
      buildWhatsAppWebDocumentPayload(config, { phone, caption, attachment })
    ),
    cache: "no-store",
  });

  return parseBridgeResponse(response);
}

async function parseBridgeResponse(response) {
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
        data?.error ||
        `WhatsApp Web bridge request failed with status ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

async function fetchBridgeJson(url, options = {}, timeoutMs = 1500) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    return await parseBridgeResponse(response);
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error("WhatsApp Web bridge request timed out");
      timeoutError.status = 504;
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildBridgeHeaders(config = {}) {
  return {
    "Content-Type": "application/json",
    "ngrok-skip-browser-warning": "true",
    ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
  };
}

export async function fetchWhatsAppWebStatus(config = {}) {
  assertReachableWhatsAppBridgeConfig(config);

  const url = new URL(`${config.bridgeBaseUrl}/api/session/status`);
  url.searchParams.set("sessionName", config.sessionName);

  return fetchBridgeJson(
    url,
    {
      method: "GET",
      headers: buildBridgeHeaders(config),
      cache: "no-store",
    },
    1500
  );
}

export async function fetchWhatsAppWebQr(config = {}) {
  assertReachableWhatsAppBridgeConfig(config);

  const url = new URL(`${config.bridgeBaseUrl}/api/session/qr`);
  url.searchParams.set("sessionName", config.sessionName);

  return fetchBridgeJson(
    url,
    {
      method: "GET",
      headers: buildBridgeHeaders(config),
      cache: "no-store",
    },
    3000
  );
}

export async function fetchWhatsAppWebLogs(config = {}) {
  assertReachableWhatsAppBridgeConfig(config);

  const url = new URL(`${config.bridgeBaseUrl}/api/messages/logs`);
  url.searchParams.set("sessionName", config.sessionName);

  return fetchBridgeJson(
    url,
    {
      method: "GET",
      headers: buildBridgeHeaders(config),
      cache: "no-store",
    },
    1200
  );
}

export async function requestWhatsAppWebPairingCode(config = {}, phoneNumber) {
  assertReachableWhatsAppBridgeConfig(config);

  const response = await fetch(`${config.bridgeBaseUrl}/api/session/pairing-code`, {
    method: "POST",
    headers: buildBridgeHeaders(config),
    body: JSON.stringify({
      sessionName: config.sessionName,
      phoneNumber,
    }),
    cache: "no-store",
  });

  return parseBridgeResponse(response);
}

export async function disconnectWhatsAppWebSession(config = {}) {
  assertReachableWhatsAppBridgeConfig(config);

  const response = await fetch(`${config.bridgeBaseUrl}/api/session/logout`, {
    method: "POST",
    headers: buildBridgeHeaders(config),
    body: JSON.stringify({
      sessionName: config.sessionName,
    }),
    cache: "no-store",
  });

  return parseBridgeResponse(response);
}

export async function deleteWhatsAppWebSession(config = {}) {
  assertReachableWhatsAppBridgeConfig(config);

  const response = await fetch(`${config.bridgeBaseUrl}/api/session`, {
    method: "DELETE",
    headers: buildBridgeHeaders(config),
    body: JSON.stringify({
      sessionName: config.sessionName,
    }),
    cache: "no-store",
  });

  return parseBridgeResponse(response);
}
