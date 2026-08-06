import { connectDB } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/adminAuth";
import {
  normalizeBillingSettings,
  saveBillingSettings,
} from "../../../../lib/billingService";
import {
  decryptSettingsSecret,
  encryptSettingsSecret,
  resolveManagedTwilioPlatformConfig,
} from "../../../../lib/paymentGatewaySettings";
import { verifyTwilioAccount } from "../../../../lib/twilioWhatsApp";

const PLATFORM_SETTINGS_ID = "platform";

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeBridgeBaseUrl(value) {
  return normalizeText(value).replace(/\/+$/, "");
}

function normalizeBridgePort(value) {
  const normalized = normalizeText(value);
  return /^\d{1,5}$/.test(normalized) ? normalized : "";
}

function applyBridgePort(bridgeBaseUrl, bridgePort) {
  if (!bridgeBaseUrl || !bridgePort) return bridgeBaseUrl;

  try {
    const url = new URL(bridgeBaseUrl);
    const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);

    if (!url.port && isLocalHost) {
      url.port = bridgePort;
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return bridgeBaseUrl;
  }
}

function buildSessionName(user) {
  const userId = user?._id?.toString?.() || "";
  const savedSessionName = normalizeText(user?.whatsappProviders?.whatsappWeb?.sessionName);

  if (savedSessionName && savedSessionName !== "invoicehub-scan") {
    return savedSessionName;
  }

  return userId ? `invoicehub-${userId}` : "invoicehub-scan";
}

function buildQrConnectUrl(bridgeBaseUrl, sessionName) {
  if (!bridgeBaseUrl || !sessionName) return "";
  return `${bridgeBaseUrl}/qr?sessionName=${encodeURIComponent(sessionName)}`;
}

function maskAccountSid(accountSid) {
  const value = normalizeText(accountSid);
  if (!value) return "";
  if (value.length <= 10) return "Saved securely";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function buildSettingsPayload(settings = {}) {
  const managedTwilio = resolveManagedTwilioPlatformConfig(settings);
  const openAiVision = settings.openAiVision || {};

  return {
    openAiVision: {
      enabled: openAiVision.enabled === true,
      configured: Boolean(
        decryptSettingsSecret(openAiVision.apiKey) || process.env.OPENAI_API_KEY
      ),
      apiKeyConfigured: Boolean(
        decryptSettingsSecret(openAiVision.apiKey) || process.env.OPENAI_API_KEY
      ),
      model: normalizeText(openAiVision.model) || "gpt-4o-mini",
      updatedAt: openAiVision.updatedAt || null,
    },
    whatsappBridge: {
      bridgeBaseUrl: settings.whatsappBridge?.bridgeBaseUrl || "",
      bridgePort: settings.whatsappBridge?.bridgePort || "",
      apiKey: settings.whatsappBridge?.apiKey || "",
      updatedAt: settings.whatsappBridge?.updatedAt || null,
    },
    twilioManaged: {
      configured: managedTwilio.configured,
      accountSidConfigured: Boolean(managedTwilio.accountSid),
      authTokenConfigured: Boolean(managedTwilio.authToken),
      apiKeySidConfigured: Boolean(managedTwilio.apiKeySid),
      apiKeySecretConfigured: Boolean(managedTwilio.apiKeySecret),
      credentialType: managedTwilio.credentialType,
      accountSidHint: maskAccountSid(managedTwilio.accountSid),
      apiKeySidHint: maskAccountSid(managedTwilio.apiKeySid),
      verifiedAt: settings.twilioManaged?.verifiedAt || managedTwilio.verifiedAt || null,
      updatedAt: settings.twilioManaged?.updatedAt || managedTwilio.updatedAt || null,
    },
    billing: normalizeBillingSettings(settings.billing || {}),
  };
}

async function saveOpenAiVision(db, body, currentSettings) {
  const input = body.openAiVision || {};
  const current = currentSettings.openAiVision || {};
  const apiKey =
    normalizeText(input.apiKey) ||
    decryptSettingsSecret(current.apiKey) ||
    normalizeText(process.env.OPENAI_API_KEY);

  if (input.enabled === true && !apiKey) {
    return Response.json(
      { error: "Enter an OpenAI API key before enabling receipt analysis." },
      { status: 400 }
    );
  }

  const now = new Date();
  const openAiVision = {
    enabled: input.enabled === true,
    apiKey: normalizeText(input.apiKey)
      ? encryptSettingsSecret(normalizeText(input.apiKey))
      : current.apiKey || "",
    model: normalizeText(input.model) || "gpt-4o-mini",
    updatedAt: now,
  };

  await db.collection("platformSettings").updateOne(
    { _id: PLATFORM_SETTINGS_ID },
    {
      $set: { openAiVision, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  return Response.json({
    success: true,
    message: openAiVision.enabled
      ? "OpenAI Vision is enabled for receipt analysis."
      : "OpenAI Vision is saved but currently disabled.",
    settings: buildSettingsPayload({ ...currentSettings, openAiVision }),
  });
}

async function saveManagedTwilio(db, body, currentSettings) {
  const input = body.twilioManaged || {};
  const current = currentSettings.twilioManaged || {};
  const accountSid =
    normalizeText(input.accountSid) ||
    decryptSettingsSecret(current.accountSid) ||
    normalizeText(process.env.TWILIO_ACCOUNT_SID);
  const requestedCredentialType =
    input.credentialType === "authToken" ? "authToken" : "apiKey";
  const authToken = requestedCredentialType === "authToken"
    ? normalizeText(input.authToken) ||
      decryptSettingsSecret(current.authToken) ||
      normalizeText(process.env.TWILIO_AUTH_TOKEN)
    : "";
  const apiKeySid = requestedCredentialType === "apiKey"
    ? normalizeText(input.apiKeySid) ||
      decryptSettingsSecret(current.apiKeySid) ||
      normalizeText(process.env.TWILIO_API_KEY_SID)
    : "";
  const apiKeySecret = requestedCredentialType === "apiKey"
    ? normalizeText(input.apiKeySecret) ||
      decryptSettingsSecret(current.apiKeySecret) ||
      normalizeText(process.env.TWILIO_API_KEY_SECRET)
    : "";
  const hasApiKey = Boolean(apiKeySid && apiKeySecret);

  if (!accountSid || (!hasApiKey && !authToken)) {
    return Response.json(
      { error: "Enter the Account SID and either a Main API Key pair or Auth Token." },
      { status: 400 }
    );
  }

  if ((apiKeySid && !apiKeySecret) || (!apiKeySid && apiKeySecret)) {
    return Response.json(
      { error: "Both API Key SID and API Key Secret are required." },
      { status: 400 }
    );
  }

  if (apiKeySid && !/^SK[a-fA-F0-9]{32}$/.test(apiKeySid)) {
    return Response.json(
      { error: "Enter a valid Twilio API Key SID beginning with SK." },
      { status: 400 }
    );
  }
  if (!/^AC[a-fA-F0-9]{32}$/.test(accountSid)) {
    return Response.json(
      { error: "Enter a valid Twilio Account SID beginning with AC." },
      { status: 400 }
    );
  }

  const account = await verifyTwilioAccount({
    accountSid,
    authToken: hasApiKey ? "" : authToken,
    apiKeySid: hasApiKey ? apiKeySid : "",
    apiKeySecret: hasApiKey ? apiKeySecret : "",
  });
  const now = new Date();
  const twilioManaged = {
    accountSid: encryptSettingsSecret(accountSid),
    authToken: hasApiKey ? "" : encryptSettingsSecret(authToken),
    apiKeySid: hasApiKey ? encryptSettingsSecret(apiKeySid) : "",
    apiKeySecret: hasApiKey ? encryptSettingsSecret(apiKeySecret) : "",
    credentialType: hasApiKey ? "apiKey" : "authToken",
    accountSidHint: maskAccountSid(accountSid),
    accountFriendlyName: account.friendlyName || "",
    accountStatus: account.status || "",
    verifiedAt: now,
    updatedAt: now,
  };

  await db.collection("platformSettings").updateOne(
    { _id: PLATFORM_SETTINGS_ID },
    {
      $set: { twilioManaged, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  return Response.json({
    success: true,
    message: "Twilio platform account verified. Managed subaccounts are now available to business users.",
    settings: buildSettingsPayload({ ...currentSettings, twilioManaged }),
  });
}

async function saveWhatsAppBridge(db, body) {
  const rawBridgeBaseUrl = normalizeBridgeBaseUrl(body.whatsappBridge?.bridgeBaseUrl);
  const bridgePort = normalizeBridgePort(body.whatsappBridge?.bridgePort);
  const bridgeBaseUrl = applyBridgePort(rawBridgeBaseUrl, bridgePort);
  const apiKey = normalizeText(body.whatsappBridge?.apiKey);

  if (!bridgeBaseUrl) {
    return Response.json({ error: "Bridge base URL is required" }, { status: 400 });
  }

  if (!apiKey) {
    return Response.json({ error: "Bridge API key is required" }, { status: 400 });
  }

  const nextBridgeSettings = {
    bridgeBaseUrl,
    bridgePort,
    apiKey,
    updatedAt: new Date(),
  };

  await db.collection("platformSettings").updateOne(
    { _id: PLATFORM_SETTINGS_ID },
    {
      $set: { whatsappBridge: nextBridgeSettings, updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );

  const users = await db.collection("users").find({}).toArray();
  const updates = users.map((user) => {
    const existingWhatsAppWeb = user.whatsappProviders?.whatsappWeb || {};
    const sessionName = buildSessionName(user);
    const whatsappWeb = {
      ...existingWhatsAppWeb,
      enabled: true,
      bridgeBaseUrl,
      bridgePort,
      apiKey,
      sessionName,
      qrConnectUrl: buildQrConnectUrl(bridgeBaseUrl, sessionName),
    };

    return {
      updateOne: {
        filter: { _id: user._id },
        update: {
          $set: {
            defaultWhatsAppProvider: "whatsappWeb",
            "whatsappProviders.whatsappWeb": whatsappWeb,
            updatedAt: new Date(),
          },
        },
      },
    };
  });

  if (updates.length > 0) {
    await db.collection("users").bulkWrite(updates);
  }

  const saved = await db.collection("platformSettings").findOne({ _id: PLATFORM_SETTINGS_ID });
  return Response.json({
    success: true,
    updatedUsers: updates.length,
    settings: buildSettingsPayload(saved || { whatsappBridge: nextBridgeSettings }),
  });
}

async function saveBilling(db, body, currentSettings) {
  const billing = await saveBillingSettings(db, body.billing || {});

  return Response.json({
    success: true,
    message: "Billing settings saved.",
    settings: buildSettingsPayload({ ...currentSettings, billing }),
  });
}

export async function GET(req) {
  try {
    requireAdmin(req);
    const db = await connectDB();
    const settings = await db.collection("platformSettings").findOne({
      _id: PLATFORM_SETTINGS_ID,
    });

    return Response.json(buildSettingsPayload(settings || {}));
  } catch (error) {
    console.error("ADMIN SETTINGS GET ERROR:", error);
    return Response.json(
      { error: error.message || "Unable to load admin settings" },
      { status: error.status || 500 }
    );
  }
}

export async function PUT(req) {
  try {
    requireAdmin(req);
    const db = await connectDB();
    const body = await req.json();
    const section = normalizeText(body.section) || "whatsappBridge";
    const currentSettings =
      (await db.collection("platformSettings").findOne({ _id: PLATFORM_SETTINGS_ID })) || {};

    if (section === "openAiVision") {
      return await saveOpenAiVision(db, body, currentSettings);
    }

    if (section === "twilioManaged") {
      return await saveManagedTwilio(db, body, currentSettings);
    }

    if (section === "billing") {
      return await saveBilling(db, body, currentSettings);
    }

    return await saveWhatsAppBridge(db, body);
  } catch (error) {
    console.error("ADMIN SETTINGS PUT ERROR:", error);
    return Response.json(
      {
        error: error.message || "Unable to save admin settings",
        code: error.code || "",
        details: error.details || "",
      },
      { status: error.status || 500 }
    );
  }
}
