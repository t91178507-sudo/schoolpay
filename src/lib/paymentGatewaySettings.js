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
  receiptUpload: {
    enabled: false,
    environment: "manual",
    bankName: "",
    accountName: "",
    accountNumber: "",
    paymentInstructions: "",
    autoWhatsAppAcknowledgement: true,
  },
});

export const DEFAULT_WHATSAPP_PROVIDERS = Object.freeze({
  browser: {
    enabled: true,
  },
  whatsappWeb: {
    enabled: false,
    senderPhoneNumber: "",
    bridgeBaseUrl: "http://localhost:8787",
    sessionName: "invoicehub-scan",
    apiKey: "invoicehub-bridge-local",
    qrConnectUrl: "http://localhost:8787/qr",
    statusWebhookUrl: "",
  },
});

const SECRET_FIELDS = Object.freeze({
  monnify: ["apiKey", "secretKey", "contractCode"],
  payaza: ["publicKey", "secretKey"],
  touchpay: ["publicKey", "secretKey", "merchantId"],
});

const WHATSAPP_SECRET_FIELDS = Object.freeze({
  whatsappWeb: ["apiKey"],
});

const ENCRYPTED_PREFIX = "enc::";
export const PLATFORM_SETTINGS_ID = "platform";

function mergeGateway(defaultGateway, savedGateway = {}) {
  return {
    ...defaultGateway,
    ...savedGateway,
  };
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBridgeBaseUrl(value) {
  return normalizeText(value).replace(/\/+$/, "");
}

function normalizeGatewayBoolean(value) {
  return value === true;
}

function resolveUserIdString(user = {}) {
  const raw = user?._id;

  if (!raw) {
    return "";
  }

  if (typeof raw === "string") {
    return raw;
  }

  if (typeof raw.toString === "function") {
    return raw.toString();
  }

  return "";
}

function buildDefaultWhatsAppWebProvider(user = {}) {
  const userId = resolveUserIdString(user);
  const sessionName = userId ? `invoicehub-${userId}` : "invoicehub-scan";

  return {
    ...DEFAULT_WHATSAPP_PROVIDERS.whatsappWeb,
    sessionName,
    qrConnectUrl: `http://localhost:8787/qr?sessionName=${encodeURIComponent(sessionName)}`,
  };
}

function buildWhatsAppWebQrConnectUrl(bridgeBaseUrl, sessionName) {
  if (!bridgeBaseUrl || !sessionName) {
    return "";
  }

  return `${bridgeBaseUrl}/qr?sessionName=${encodeURIComponent(sessionName)}`;
}

function normalizePlatformWhatsAppBridge(platformSettings = {}) {
  const bridge = platformSettings.whatsappBridge || platformSettings || {};
  const bridgeBaseUrl = normalizeBridgeBaseUrl(bridge.bridgeBaseUrl);
  const apiKey = normalizeText(bridge.apiKey);

  return {
    enabled: Boolean(bridgeBaseUrl && apiKey),
    bridgeBaseUrl,
    bridgePort: normalizeText(bridge.bridgePort),
    apiKey,
    updatedAt: bridge.updatedAt || null,
  };
}

function shouldUseDefaultWhatsAppWebSession(savedSessionName, defaultProvider) {
  return (
    !savedSessionName ||
    savedSessionName === DEFAULT_WHATSAPP_PROVIDERS.whatsappWeb.sessionName ||
    savedSessionName === defaultProvider.sessionName
  );
}

function shouldUseDefaultWhatsAppWebQrUrl(savedQrUrl, defaultProvider) {
  if (!savedQrUrl) {
    return true;
  }

  if (
    savedQrUrl === DEFAULT_WHATSAPP_PROVIDERS.whatsappWeb.qrConnectUrl ||
    savedQrUrl === defaultProvider.qrConnectUrl
  ) {
    return true;
  }

  return savedQrUrl.includes("sessionName=invoicehub-scan");
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

function buildWhatsAppPayload(providerKey, savedProvider = {}, user = {}, platformSettings = {}) {
  const defaultProvider =
    providerKey === "whatsappWeb"
      ? buildDefaultWhatsAppWebProvider(user)
      : DEFAULT_WHATSAPP_PROVIDERS[providerKey];
  const platformBridge =
    providerKey === "whatsappWeb"
      ? normalizePlatformWhatsAppBridge(platformSettings)
      : null;
  const normalizedSavedProvider =
    providerKey === "whatsappWeb"
      ? {
          ...savedProvider,
          sessionName: shouldUseDefaultWhatsAppWebSession(
            normalizeText(savedProvider.sessionName),
            defaultProvider
          )
            ? defaultProvider.sessionName
            : normalizeText(savedProvider.sessionName),
          qrConnectUrl: shouldUseDefaultWhatsAppWebQrUrl(
            normalizeText(savedProvider.qrConnectUrl),
            defaultProvider
          )
            ? defaultProvider.qrConnectUrl
            : normalizeText(savedProvider.qrConnectUrl),
        }
      : savedProvider;
  const merged = {
    ...defaultProvider,
    ...normalizedSavedProvider,
  };

  if (platformBridge?.enabled) {
    merged.enabled = true;
    merged.bridgeBaseUrl = platformBridge.bridgeBaseUrl;
    merged.bridgePort = platformBridge.bridgePort;
    merged.apiKey = platformBridge.apiKey;
    merged.qrConnectUrl = buildWhatsAppWebQrConnectUrl(
      platformBridge.bridgeBaseUrl,
      merged.sessionName
    );
  }

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

export function buildSettingsPayload(user = {}, platformSettings = {}) {
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
      receiptUpload: buildGatewayPayload(
        "receiptUpload",
        paymentGateways.receiptUpload
      ),
    },
    whatsappProviders: {
      browser: buildWhatsAppPayload(
        "browser",
        whatsappProviders.browser,
        user,
        platformSettings
      ),
      whatsappWeb: buildWhatsAppPayload(
        "whatsappWeb",
        whatsappProviders.whatsappWeb,
        user,
        platformSettings
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
    const defaultProvider =
      providerKey === "whatsappWeb"
        ? buildDefaultWhatsAppWebProvider(existingUser)
        : DEFAULT_WHATSAPP_PROVIDERS[providerKey];
    const merged = {
      ...defaultProvider,
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
    defaultPaymentGateway: ["monnify", "payaza", "touchpay", "receiptUpload"].includes(body.defaultPaymentGateway)
      ? body.defaultPaymentGateway
      : "monnify",
    defaultWhatsAppProvider: ["browser", "whatsappWeb"].includes(body.defaultWhatsAppProvider)
      ? body.defaultWhatsAppProvider
      : "browser",
    paymentGateways: {
      monnify: normalizeGateway("monnify", "sandbox"),
      payaza: normalizeGateway("payaza", "test"),
      touchpay: normalizeGateway("touchpay", "test"),
      receiptUpload: {
        ...mergeGateway(
          DEFAULT_PAYMENT_GATEWAYS.receiptUpload,
          existingGateways.receiptUpload
        ),
        ...paymentGateways.receiptUpload,
        enabled: normalizeGatewayBoolean(paymentGateways.receiptUpload?.enabled),
        environment: "manual",
        bankName: normalizeText(paymentGateways.receiptUpload?.bankName),
        accountName: normalizeText(paymentGateways.receiptUpload?.accountName),
        accountNumber: normalizeText(paymentGateways.receiptUpload?.accountNumber),
        paymentInstructions: normalizeText(
          paymentGateways.receiptUpload?.paymentInstructions
        ),
        autoWhatsAppAcknowledgement:
          paymentGateways.receiptUpload?.autoWhatsAppAcknowledgement !== false,
      },
    },
    whatsappProviders: {
      browser: normalizeWhatsAppProvider("browser"),
      whatsappWeb: normalizeWhatsAppProvider("whatsappWeb"),
    },
  };
}

export async function findUserById(db, userId) {
  return db.collection("users").findOne({
    _id: typeof userId === "string" ? new ObjectId(userId) : userId,
  });
}

export async function getPlatformSettings(db) {
  return db.collection("platformSettings").findOne({
    _id: PLATFORM_SETTINGS_ID,
  });
}

export async function getPlatformWhatsAppBridgeSettings(db) {
  return normalizePlatformWhatsAppBridge((await getPlatformSettings(db)) || {});
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

export function resolvePayazaConfig(user = {}) {
  const gateway = user.paymentGateways?.payaza || {};

  return {
    publicKey: decryptGatewayValue(gateway, "publicKey") || "",
    secretKey: decryptGatewayValue(gateway, "secretKey") || "",
    webhookUrl: normalizeText(gateway.webhookUrl),
    callbackUrl: normalizeText(gateway.callbackUrl),
    enabled: gateway.enabled === true,
    environment: gateway.environment === "live" ? "live" : "test",
  };
}

export function resolveActivePaymentGateway(user = {}) {
  const defaultGateway = normalizeText(user.defaultPaymentGateway) || "monnify";
  const gateways = user.paymentGateways || {};

  if (gateways[defaultGateway]?.enabled === true) {
    return defaultGateway;
  }

  if (gateways.payaza?.enabled === true) {
    return "payaza";
  }

  if (gateways.monnify?.enabled === true) {
    return "monnify";
  }

  if (gateways.touchpay?.enabled === true) {
    return "touchpay";
  }

  return defaultGateway;
}

export function resolveBrowserWhatsAppConfig(user = {}) {
  const provider = user.whatsappProviders?.browser || {};

  return {
    enabled: provider.enabled === true,
  };
}

export function resolveWhatsAppWebConfig(user = {}, platformSettings = {}) {
  const provider = user.whatsappProviders?.whatsappWeb || {};
  const defaultProvider = buildDefaultWhatsAppWebProvider(user);
  const platformBridge = normalizePlatformWhatsAppBridge(platformSettings);
  const savedSessionName = normalizeText(provider.sessionName);
  const sessionName =
    shouldUseDefaultWhatsAppWebSession(savedSessionName, defaultProvider)
      ? defaultProvider.sessionName
      : savedSessionName;
  const savedQrUrl = normalizeText(provider.qrConnectUrl);
  const bridgeBaseUrl =
    platformBridge.bridgeBaseUrl ||
    normalizeBridgeBaseUrl(provider.bridgeBaseUrl) ||
    "http://localhost:8787";

  return {
    enabled: provider.enabled === true || platformBridge.enabled,
    senderPhoneNumber: normalizeText(provider.senderPhoneNumber),
    bridgeBaseUrl,
    bridgePort: platformBridge.bridgePort || normalizeText(provider.bridgePort),
    sessionName,
    apiKey:
      platformBridge.apiKey ||
      decryptGatewayValue(provider, "apiKey") ||
      "invoicehub-bridge-local",
    qrConnectUrl:
      platformBridge.bridgeBaseUrl
        ? buildWhatsAppWebQrConnectUrl(platformBridge.bridgeBaseUrl, sessionName)
        : (shouldUseDefaultWhatsAppWebQrUrl(savedQrUrl, defaultProvider)
            ? defaultProvider.qrConnectUrl
            : savedQrUrl),
    statusWebhookUrl: normalizeText(provider.statusWebhookUrl),
  };
}

export async function resolveWhatsAppWebConfigForUser(db, user = {}) {
  return resolveWhatsAppWebConfig(
    user,
    await getPlatformWhatsAppBridgeSettings(db)
  );
}
