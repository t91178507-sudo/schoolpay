export const PAYAZA_DEFAULT_BASE_URL =
  process.env.PAYAZA_BASE_URL || "https://api.payaza.africa/live";

export function normalizePayazaKey(value = "") {
  const normalized = String(value || "").trim();
  const keyLine = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("PZ"));

  return keyLine || normalized;
}

export function buildPayazaAuthHeader(publicKey = "") {
  return `Payaza ${Buffer.from(normalizePayazaKey(publicKey)).toString("base64")}`;
}

export function getPayazaTenant(environment = "test") {
  return environment === "live" ? "live" : "test";
}

export function buildPayazaHeaders(publicKey = "", environment = "test", extraHeaders = {}) {
  return {
    Authorization: buildPayazaAuthHeader(publicKey),
    "X-TenantID": getPayazaTenant(environment),
    ...extraHeaders,
  };
}
export function parseAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitCustomerName(name = "") {
  const parts = String(name || "Customer").trim().split(/\s+/).filter(Boolean);

  return {
    firstName: parts[0] || "Customer",
    lastName: parts.slice(1).join(" ") || "Invoice",
  };
}

export async function createPayazaDynamicVirtualAccount({
  publicKey,
  accountName,
  accountReference,
  customerName,
  customerEmail,
  customerPhone,
  amount,
  description,
  bankCode = "1067",
  expiresInMinutes = 30,
  baseUrl = PAYAZA_DEFAULT_BASE_URL,
  environment = "test",
}) {
  const { firstName, lastName } = splitCustomerName(customerName);
  const response = await fetch(
    `${baseUrl}/merchant-collection/merchant/virtual_account/generate_virtual_account`,
    {
      method: "POST",
      headers: buildPayazaHeaders(publicKey, environment, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        account_name: accountName,
        account_type: "Dynamic",
        bank_code: bankCode,
        bvn: "",
        has_amount_validation: "true",
        account_reference: accountReference,
        customer_first_name: firstName,
        customer_last_name: lastName,
        customer_email: customerEmail || "billing@invoicehub.app",
        customer_phone_number: customerPhone || "",
        transaction_description: description || "Invoice payment",
        transaction_amount: String(amount),
        expires_in_minutes: String(expiresInMinutes),
      }),
      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success !== true) {
    const error = new Error(data?.message || "PayAza virtual account creation failed");
    const providerMessage = data?.message || "PayAza virtual account creation failed";
    error.status =
      response.status === 401 ||
      response.status === 403 ||
      String(providerMessage).toLowerCase().includes("authorization")
        ? 401
        : 502;
    error.code = "PAYAZA_VIRTUAL_ACCOUNT_FAILED";
    error.details = {
      providerMessage,
      responseStatus: response.status,
    };
    throw error;
  }

  return data.data || {};
}

export async function verifyPayazaDynamicTransaction({
  publicKey,
  transactionReference,
  baseUrl = PAYAZA_DEFAULT_BASE_URL,
  environment = "test",
}) {
  const response = await fetch(
    `${baseUrl}/merchant-collection/transfer_notification_controller/transaction-query?transaction_reference=${encodeURIComponent(transactionReference)}`,
    {
      headers: buildPayazaHeaders(publicKey, environment),
      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.success !== true) {
    throw new Error(data?.message || "PayAza transaction query failed");
  }

  return data.data || {};
}

