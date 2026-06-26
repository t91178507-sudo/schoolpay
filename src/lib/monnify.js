export function getMonnifyBaseUrl(apiKey = "") {
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
}) {
  const authString = buildMonnifyBasicAuth(apiKey, secretKey);

  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authString}`,
      "Content-Type": "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok || !data?.requestSuccessful) {
    throw new Error(
      data?.responseMessage || data?.responseBody?.message || "Monnify auth failed"
    );
  }

  return data.responseBody.accessToken;
}

export async function verifyMonnifyTransaction({
  apiKey,
  secretKey,
  paymentReference,
}) {
  const baseUrl = getMonnifyBaseUrl(apiKey);
  const accessToken = await getMonnifyAccessToken({
    apiKey,
    secretKey,
    baseUrl,
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
