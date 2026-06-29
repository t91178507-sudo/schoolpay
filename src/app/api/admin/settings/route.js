import { connectDB } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/adminAuth";

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
    if (!url.port) {
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

function buildSettingsPayload(settings = {}) {
  return {
    whatsappBridge: {
      bridgeBaseUrl: settings.whatsappBridge?.bridgeBaseUrl || "",
      bridgePort: settings.whatsappBridge?.bridgePort || "",
      apiKey: settings.whatsappBridge?.apiKey || "",
      updatedAt: settings.whatsappBridge?.updatedAt || null,
    },
  };
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
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to load admin settings" },
      { status }
    );
  }
}

export async function PUT(req) {
  try {
    requireAdmin(req);

    const db = await connectDB();
    const body = await req.json();
    const rawBridgeBaseUrl = normalizeBridgeBaseUrl(body.whatsappBridge?.bridgeBaseUrl);
    const bridgePort = normalizeBridgePort(body.whatsappBridge?.bridgePort);
    const bridgeBaseUrl = applyBridgePort(rawBridgeBaseUrl, bridgePort);
    const apiKey = normalizeText(body.whatsappBridge?.apiKey);

    if (!bridgeBaseUrl) {
      return Response.json(
        { error: "Bridge base URL is required" },
        { status: 400 }
      );
    }

    if (!apiKey) {
      return Response.json(
        { error: "Bridge API key is required" },
        { status: 400 }
      );
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
        $set: {
          whatsappBridge: nextBridgeSettings,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
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

    return Response.json({
      success: true,
      updatedUsers: updates.length,
      settings: buildSettingsPayload({ whatsappBridge: nextBridgeSettings }),
    });
  } catch (error) {
    console.error("ADMIN SETTINGS PUT ERROR:", error);
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to save admin settings" },
      { status }
    );
  }
}
