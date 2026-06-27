import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { ObjectId } from "mongodb";

export const DEFAULT_PAYMENT_GATEWAYS = Object.freeze({
  monnify: {
    enabled: true,
    environment: "sandbox",
    apiKey: "",
    secretKey: "",
    contractCode: "",
    webhookUrl: "",
    callbackUrl: "",
  },
  payaza: {
    enabled: false,
    environment: "test",
    publicKey: "",
    secretKey: "",
    webhookUrl: "",
    callbackUrl: "",
  },
  touchpay: {
    enabled: false,
    environment: "test",
    publicKey: "",
    secretKey: "",
    merchantId: "",
    webhookUrl: "",
    callbackUrl: "",
  },
});

export const DEFAULT_WHATSAPP_PROVIDERS = Object.freeze({
  twilioSandbox: {
    enabled: false,
    accountSid: "",
    authToken: "",
    fromNumber: "+14155238886",
    contentSid: "",
    statusCallbackUrl: "",
  },
});

const SECRET_FIELDS = Object.freeze({
  monnify: ["apiKey", "secretKey", "contractCode"],
  payaza: ["publicKey", "secretKey"],
  touchpay: ["publicKey", "secretKey", "merchantId"],
});

const WHATSAPP_SECRET_FIELDS = Object.freeze({
  twilioSandbox: ["accountSid", "authToken"],
});

const ENCRYPTED_PREFIX = "enc::";

function mergeGateway(defaultGateway, savedGateway = {}) {
  return {
    ...defaultGateway,
    ...savedGateway,
  };
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeGatewayBoolean(value) {
  return value === true;
}

function getEncryptionSecret() {
  return (
    process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY ||
    process.env.APP_SECRET ||
    process.env.JWT_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "invoicehub-local-dev-secret-change-me"
  );
}

function getEncryptionKey() {
  return createHash("sha256").update(getEncryptionSecret()).digest();
}

function encryptValue(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "";
  }

  if (normalized.startsWith(ENCRYPTED_PREFIX)) {
    return normalized;
  }

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function decryptValue(value) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return "";
  }

  if (!normalized.startsWith(ENCRYPTED_PREFIX)) {
    return normalized;
  }

  try {
    const payload = normalized.slice(ENCRYPTED_PREFIX.length);
    const [ivPart, tagPart, encryptedPart] = payload.split(":");

    if (!ivPart || !tagPart || !encryptedPart) {
      return "";
    }

    const decipher = createDecipheriv(
      "aes-256-gcm",
      getEncryptionKey(),
      Buffer.from(ivPart, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagPart, "base64"));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart, "base64")),
      decipher.final(),
    ]);

    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

function isSecretField(gatewayKey, fieldKey) {
  return SECRET_FIELDS[gatewayKey]?.includes(fieldKey) || false;
}

function buildGatewayPayload(gatewayKey, savedGateway = {}) {
  const merged = mergeGateway(DEFAULT_PAYMENT_GATEWAYS[gatewayKey], savedGateway);
  const nextGateway = { ...merged };

  for (const fieldKey of SECRET_FIELDS[gatewayKey] || []) {
    nextGateway[fieldKey] = "";
    nextGateway[`${fieldKey}Configured`] = Boolean(normalizeText(savedGateway[fieldKey]));
  }

  return nextGateway;
}

function isWhatsAppSecretField(providerKey, fieldKey) {
  return WHATSAPP_SECRET_FIELDS[providerKey]?.includes(fieldKey) || false;
}

function buildWhatsAppPayload(providerKey, savedProvider = {}) {
  const merged = {
    ...DEFAULT_WHATSAPP_PROVIDERS[providerKey],
    ...savedProvider,
  };
  const nextProvider = { ...merged };

  for (const fieldKey of WHATSAPP_SECRET_FIELDS[providerKey] || []) {
    nextProvider[fieldKey] = "";
    nextProvider[`${fieldKey}Configured`] = Boolean(normalizeText(savedProvider[fieldKey]));
  }

  return nextProvider;
}

function decryptGatewayValue(savedGateway = {}, fieldKey, fallback = "") {
  const savedValue = savedGateway?.[fieldKey];
  const decrypted = decryptValue(savedValue);
  return decrypted || fallback;
}

export function buildSettingsPayload(user = {}) {
  const paymentGateways = user.paymentGateways || {};
  const whatsappProviders = user.whatsappProviders || {};

  return {
    businessName: user.businessName || "",
    businessType: user.businessType || "",
    businessLogo: user.businessLogo || "",
    businessEmail: user.businessEmail || user.email || "",
    businessPhone: user.businessPhone || "",
    businessAddress: user.businessAddress || "",
    website: user.website || "",
    taxId: user.taxId || "",
    defaultPaymentGateway: user.defaultPaymentGateway || "monnify",
    defaultWhatsAppProvider: user.defaultWhatsAppProvider || "browser",
    paymentGateways: {
      monnify: buildGatewayPayload("monnify", paymentGateways.monnify),
      payaza: buildGatewayPayload("payaza", paymentGateways.payaza),
      touchpay: buildGatewayPayload("touchpay", paymentGateways.touchpay),
    },
    whatsappProviders: {
      twilioSandbox: buildWhatsAppPayload(
        "twilioSandbox",
        whatsappProviders.twilioSandbox
      ),
    },
  };
}

export function sanitizeSettingsInput(body = {}, existingUser = {}) {
  const paymentGateways = body.paymentGateways || {};
  const existingGateways = existingUser.paymentGateways || {};
  const whatsappProviders = body.whatsappProviders || {};
  const existingWhatsAppProviders = existingUser.whatsappProviders || {};

  const normalizeGateway = (gatewayKey, defaultEnvironment) => {
    const currentGateway = paymentGateways[gatewayKey] || {};
    const existingGateway = existingGateways[gatewayKey] || {};
    const merged = mergeGateway(DEFAULT_PAYMENT_GATEWAYS[gatewayKey], existingGateway);
    const nextGateway = {
      ...merged,
      enabled: normalizeGatewayBoolean(currentGateway.enabled),
      environment: currentGateway.environment === "live" ? "live" : defaultEnvironment,
    };

    for (const [fieldKey, fieldValue] of Object.entries(currentGateway)) {
      if (fieldKey.endsWith("Configured")) {
        continue;
      }

      if (fieldKey === "enabled" || fieldKey === "environment") {
        continue;
      }

      if (isSecretField(gatewayKey, fieldKey)) {
        const incoming = normalizeText(fieldValue);
        nextGateway[fieldKey] = incoming
          ? encryptValue(incoming)
          : existingGateway[fieldKey] || "";
      } else {
        nextGateway[fieldKey] = normalizeText(fieldValue);
      }
    }

    for (const secretField of SECRET_FIELDS[gatewayKey] || []) {
      if (!(secretField in currentGateway)) {
        nextGateway[secretField] = existingGateway[secretField] || "";
      }
    }

    return nextGateway;
  };

  const normalizeWhatsAppProvider = (providerKey) => {
    const currentProvider = whatsappProviders[providerKey] || {};
    const existingProvider = existingWhatsAppProviders[providerKey] || {};
    const merged = {
      ...DEFAULT_WHATSAPP_PROVIDERS[providerKey],
      ...existingProvider,
    };
    const nextProvider = {
      ...merged,
      enabled: normalizeGatewayBoolean(currentProvider.enabled),
    };

    for (const [fieldKey, fieldValue] of Object.entries(currentProvider)) {
      if (fieldKey.endsWith("Configured") || fieldKey === "enabled") {
        continue;
      }

      if (isWhatsAppSecretField(providerKey, fieldKey)) {
        const incoming = normalizeText(fieldValue);
        nextProvider[fieldKey] = incoming
          ? encryptValue(incoming)
          : existingProvider[fieldKey] || "";
      } else {
        nextProvider[fieldKey] = normalizeText(fieldValue);
      }
    }

    for (const secretField of WHATSAPP_SECRET_FIELDS[providerKey] || []) {
      if (!(secretField in currentProvider)) {
        nextProvider[secretField] = existingProvider[secretField] || "";
      }
    }

    return nextProvider;
  };

  return {
    businessName: normalizeText(body.businessName),
    businessType: normalizeText(body.businessType),
    businessLogo: typeof body.businessLogo === "string" ? body.businessLogo : "",
    businessEmail: normalizeText(body.businessEmail).toLowerCase(),
    businessPhone: normalizeText(body.businessPhone),
    businessAddress: normalizeText(body.businessAddress),
    website: normalizeText(body.website),
    taxId: normalizeText(body.taxId),
    defaultPaymentGateway: ["monnify", "payaza", "touchpay"].includes(body.defaultPaymentGateway)
      ? body.defaultPaymentGateway
      : "monnify",
    defaultWhatsAppProvider: ["browser", "twilioSandbox"].includes(body.defaultWhatsAppProvider)
      ? body.defaultWhatsAppProvider
      : "browser",
    paymentGateways: {
      monnify: normalizeGateway("monnify", "sandbox"),
      payaza: normalizeGateway("payaza", "test"),
      touchpay: normalizeGateway("touchpay", "test"),
    },
    whatsappProviders: {
      twilioSandbox: normalizeWhatsAppProvider("twilioSandbox"),
    },
  };
}

export async function findUserById(db, userId) {
  return db.collection("users").findOne({
    _id: typeof userId === "string" ? new ObjectId(userId) : userId,
  });
}

export function resolveMonnifyConfig(user = {}) {
  const gateway = user.paymentGateways?.monnify || {};

  return {
    apiKey:
      decryptGatewayValue(gateway, "apiKey") || process.env.MONNIFY_API_KEY || "",
    secretKey:
      decryptGatewayValue(gateway, "secretKey") || process.env.MONNIFY_SECRET_KEY || "",
    contractCode:
      decryptGatewayValue(gateway, "contractCode") ||
      process.env.MONNIFY_CONTRACT_CODE ||
      "",
    webhookUrl: normalizeText(gateway.webhookUrl),
    callbackUrl: normalizeText(gateway.callbackUrl),
    enabled: gateway.enabled === true,
    environment: gateway.environment === "live" ? "live" : "sandbox",
  };
}

export function resolveTwilioSandboxConfig(user = {}) {
  const provider = user.whatsappProviders?.twilioSandbox || {};

  return {
    enabled: provider.enabled === true && user.defaultWhatsAppProvider === "twilioSandbox",
    accountSid: decryptGatewayValue(provider, "accountSid") || "",
    authToken: decryptGatewayValue(provider, "authToken") || "",
    fromNumber: normalizeText(provider.fromNumber) || "whatsapp:+14155238886",
    contentSid: normalizeText(provider.contentSid),
    statusCallbackUrl: normalizeText(provider.statusCallbackUrl),
  };
}
