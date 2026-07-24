import { requireAuth } from "../../../../../../lib/auth";
import { connectDB } from "../../../../../../lib/mongodb";
import {
  findUserById,
  resolveWhatsAppWebConfigForUser,
} from "../../../../../../lib/paymentGatewaySettings";
import {
  fetchWhatsAppWebBridgeOverview,
  fetchWhatsAppWebLogs,
  fetchWhatsAppWebQr,
  fetchWhatsAppWebStatus,
  hasWhatsAppWebBridgeConfig,
  isLocalWhatsAppBridgeUrl,
  requestWhatsAppWebPairingCode,
} from "../../../../../../lib/whatsappWebBridge";

function buildLocalFallbackConfig(config = {}) {
  return {
    ...config,
    bridgeBaseUrl: "http://localhost:8787",
    apiKey: config.apiKey || "invoicehub-bridge-local",
    qrConnectUrl: config.sessionName
      ? `http://localhost:8787/qr?sessionName=${encodeURIComponent(config.sessionName)}`
      : "http://localhost:8787/qr",
  };
}

async function loadBridgeSnapshot(config = {}) {
  await fetchWhatsAppWebBridgeOverview(config);
  const status = await fetchWhatsAppWebStatus(config);
  const logs = await fetchWhatsAppWebLogs(config).catch(() => ({ logs: [] }));
  const qr =
    status?.qrAvailable || status?.status === "qr"
      ? await fetchWhatsAppWebQr(config).catch(() => null)
      : null;

  return {
    bridgeReachable: true,
    status: {
      ...status,
      qrDataUrl: qr?.qrDataUrl || "",
    },
    logs: Array.isArray(logs.logs) ? logs.logs : [],
    resolvedConfig: {
      bridgeBaseUrl: config.bridgeBaseUrl,
      sessionName: config.sessionName,
      qrConnectUrl: config.qrConnectUrl,
      senderPhoneNumber:
        status?.connectedNumber ||
        config.senderPhoneNumber ||
        "",
      apiKeyConfigured: Boolean(config.apiKey),
    },
  };
}

export async function GET(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const user = await findUserById(db, userId);

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const config = await resolveWhatsAppWebConfigForUser(db, user);

    if (!hasWhatsAppWebBridgeConfig(config)) {
      return Response.json(
        { error: "WhatsApp Web bridge details are not configured" },
        { status: 400 }
      );
    }

    try {
      const candidates = [config];

      if (
        process.env.NODE_ENV !== "production" &&
        !isLocalWhatsAppBridgeUrl(config.bridgeBaseUrl)
      ) {
        candidates.unshift(buildLocalFallbackConfig(config));
      }

      let snapshot = null;
      let lastBridgeError = null;

      for (const candidate of candidates) {
        try {
          snapshot = await loadBridgeSnapshot(candidate);
          if (snapshot?.status) {
            break;
          }
        } catch (bridgeError) {
          lastBridgeError = bridgeError;
        }
      }

      if (!snapshot) {
        throw lastBridgeError || new Error("WhatsApp bridge is offline");
      }

      return Response.json({
        success: true,
        ...snapshot,
      });
    } catch (bridgeError) {
      return Response.json({
        success: false,
        bridgeReachable: false,
        status: {
          status: "offline",
          sessionName: config.sessionName,
          connectedNumber: "",
          qrAvailable: false,
          lastError: bridgeError.message || "WhatsApp bridge is offline",
          lastUpdatedAt: new Date().toISOString(),
          qrConnectUrl: config.qrConnectUrl || "",
        },
        logs: [],
        resolvedConfig: {
          bridgeBaseUrl: config.bridgeBaseUrl,
          sessionName: config.sessionName,
          qrConnectUrl: config.qrConnectUrl || "",
          senderPhoneNumber: config.senderPhoneNumber || "",
          apiKeyConfigured: Boolean(config.apiKey),
        },
      });
    }
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to fetch WhatsApp Web status" },
      { status }
    );
  }
}

export async function POST(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const user = await findUserById(db, userId);
    const body = await req.json();
    const phoneNumber = String(body.phoneNumber || "").trim().replace(/\D/g, "");

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    if (!phoneNumber) {
      return Response.json({ error: "Phone number is required" }, { status: 400 });
    }

    const config = await resolveWhatsAppWebConfigForUser(db, user);

    if (!hasWhatsAppWebBridgeConfig(config)) {
      return Response.json(
        { error: "WhatsApp Web bridge details are not configured" },
        { status: 400 }
      );
    }

    const pairing = await requestWhatsAppWebPairingCode(config, phoneNumber);

    return Response.json(pairing);
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to request WhatsApp pairing code" },
      { status }
    );
  }
}


