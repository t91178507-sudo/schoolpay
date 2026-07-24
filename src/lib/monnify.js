export class MonnifyAuthError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "MonnifyAuthError";
    this.status = 401;
    this.code = "MONNIFY_AUTH_FAILED";
    this.details = details;
  }
}

function getMonnifyEnvironmentLabel(environment = "sandbox") {
  return environment === "live" ? "Live" : "Sandbox";
}
export function getMonnifyBaseUrl(apiKey = "", environment = "sandbox") {
  if (environment === "live") {
    return "https://api.monnify.com";
  }

  if (environment === "sandbox") {
    return "https://sandbox.monnify.com";
  }

  return apiKey.includes("_TEST_")
    ? "https://sandbox.monnify.com"
    : "https://api.monnify.com";
}

export function buildMonnifyBasicAuth(apiKey, secretKey) {
  return Buffer.from(`${apiKey}:${secretKey}`).toString("base64");
}

export async function getMonnifyAccessToken({
  apiKey,
  secretKey,
  baseUrl,
  environment = "sandbox",
}) {
  const authString = buildMonnifyBasicAuth(apiKey, secretKey);

  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authString}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data?.requestSuccessful) {
    const providerMessage =
      data?.responseMessage || data?.responseBody?.message || "Monnify auth failed";
    const environmentLabel = getMonnifyEnvironmentLabel(environment);

    throw new MonnifyAuthError(
      `Monnify rejected the ${environmentLabel} API key or secret key. Re-enter the matching Monnify ${environmentLabel} credentials in Settings > Payment Gateway, then click Verify connection.`,
      {
        providerMessage,
        environment,
        baseUrl,
        responseStatus: response.status,
      }
    );
  }

  return data.responseBody.accessToken;
}

export async function verifyMonnifyTransaction({
  apiKey,
  secretKey,
  paymentReference,
  environment = "sandbox",
}) {
  const baseUrl = getMonnifyBaseUrl(apiKey, environment);
  const accessToken = await getMonnifyAccessToken({
    apiKey,
    secretKey,
    baseUrl,
    environment,
  });

  const response = await fetch(
    `${baseUrl}/api/v2/merchant/transactions/query?paymentReference=${encodeURIComponent(paymentReference)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  const data = await response.json();

  if (!response.ok || !data?.requestSuccessful) {
    throw new Error(
      data?.responseMessage || data?.responseBody?.message || "Monnify verification failed"
    );
  }

  return data.responseBody;
}

export async function initializeMonnifyTransaction({
  apiKey,
  secretKey,
  amount,
  customerName,
  customerEmail,
  paymentReference,
  paymentDescription,
  contractCode,
  redirectUrl,
  environment = "sandbox",
}) {
  const baseUrl = getMonnifyBaseUrl(apiKey, environment);
  const accessToken = await getMonnifyAccessToken({
    apiKey,
    secretKey,
    baseUrl,
    environment,
  });

  const response = await fetch(`${baseUrl}/api/v1/merchant/transactions/init-transaction`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount,
      customerEmail,
      paymentReference,
      paymentDescription,
      currencyCode: "NGN",
      contractCode,
      redirectUrl,
      paymentMethods: ["ACCOUNT_TRANSFER"],
      metadata: {
        customerName,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok || !data?.requestSuccessful) {
    throw new Error(
      data?.responseMessage ||
        data?.responseBody?.message ||
        "Monnify transaction initialization failed"
    );
  }

  return data.responseBody;
}

export function parseAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  if (value && typeof value === "object") {
    const asString = value.toString?.();
    if (asString && asString !== "[object Object]") {
      const normalized = asString.replace(/[^0-9.]/g, "");
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : 0;
    }
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

