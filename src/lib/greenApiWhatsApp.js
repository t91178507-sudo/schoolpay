import { toWhatsAppNumber } from "./invoiceUtils";

export function isGreenApiConfigured(config = {}) {
  return Boolean(
    config.enabled &&
      config.apiUrl &&
      config.idInstance &&
      config.apiTokenInstance
  );
}

async function parseGreenApiResponse(response) {
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
        `Green API request failed with status ${response.status}`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

export async function sendGreenApiWhatsAppMessage(config = {}, { phone, text }) {
  if (!isGreenApiConfigured(config)) {
    throw new Error("Green API is not configured");
  }

  const to = toWhatsAppNumber(phone);

  if (!to) {
    throw new Error("A valid phone number is required");
  }

  const response = await fetch(
    `${config.apiUrl}/waInstance${config.idInstance}/sendMessage/${config.apiTokenInstance}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatId: `${to}@c.us`,
        message: text,
      }),
      cache: "no-store",
    }
  );

  return parseGreenApiResponse(response);
}
