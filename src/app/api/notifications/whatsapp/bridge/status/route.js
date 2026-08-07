import { requireAuth } from "../../../../../../lib/auth";
import { connectDB } from "../../../../../../lib/mongodb";
import {
  findUserById,
  resolveWhatsAppWebConfigForUser,
} from "../../../../../../lib/paymentGatewaySettings";
import { flushPendingWhatsAppMessagesForOwner } from "../../../../../../lib/whatsappMessageQueue";
import {
  fetchWhatsAppWebBridgeOverview,
  fetchWhatsAppWebLogs,
  fetchWhatsAppWebQr,
  fetchWhatsAppWebStatus,
  hasWhatsAppWebBridgeConfig,
  isLocalWhatsAppBridgeUrl,
  recoverWhatsAppWebSession,
  requestWhatsAppWebPairingCode,
} from "../../../../../../lib/whatsappWebBridge";

const RECOVERABLE_STATUSES = new Set([
  "starting",
  "loading",
  "connecting",
  "retrying",
  "authenticated",
]);
const STUCK_SESSION_MS = 90 * 1000;
const RECOVERY_THROTTLE_MS = 2 * 60 * 1000;

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

async function flushQueueIfReady(db, user, config, snapshot) {
  if (snapshot?.status?.status !== "ready") {
    return { attempted: 0, sent: 0, pending: 0 };
  }

  return flushPendingWhatsAppMessagesForOwner({
    db,
    owner: user,
    config,
    bridgeStatus: snapshot.status,
  });
}

function normalizeStatus(status = "") {
  return String(status || "").trim().toLowerCase();
}

async function trackSessionHealth(db, user, status) {
  const currentStatus = normalizeStatus(status?.status);
  const now = new Date();
  const health = user.whatsappWebHealth || {};
  const previousStatus = normalizeStatus(health.status);
  const previousSession = String(health.sessionName || "");
  const currentSession = String(status?.sessionName || "");
  const isRecoverable = RECOVERABLE_STATUSES.has(currentStatus);
  const set = {
    "whatsappWebHealth.status": currentStatus,
    "whatsappWebHealth.sessionName": currentSession,
    "whatsappWebHealth.lastCheckedAt": now,
    "whatsappWebHealth.lastError": status?.lastError || "",
  };

  if (!isRecoverable) {
    set["whatsappWebHealth.stuckSince"] = null;
    set["whatsappWebHealth.lastRecoveryReason"] = "";
    await db.collection("users").updateOne({ _id: user._id }, { $set: set });
    return { shouldRecover: false, stuckForMs: 0 };
  }

  const shouldResetWindow =
    previousStatus !== currentStatus || previousSession !== currentSession;
  const stuckSince = shouldResetWindow || !health.stuckSince
    ? now
    : new Date(health.stuckSince);
  const stuckForMs = Math.max(now.getTime() - stuckSince.getTime(), 0);
  const lastRecoveryAt = health.lastRecoveryAt
    ? new Date(health.lastRecoveryAt)
    : null;
  const recentlyRecovered =
    lastRecoveryAt &&
    now.getTime() - lastRecoveryAt.getTime() < RECOVERY_THROTTLE_MS;
  const shouldRecover = stuckForMs >= STUCK_SESSION_MS && !recentlyRecovered;

  set["whatsappWebHealth.stuckSince"] = stuckSince;

  if (shouldRecover) {
    set["whatsappWebHealth.lastRecoveryAt"] = now;
    set["whatsappWebHealth.lastRecoveryReason"] =
      `Session stayed ${currentStatus} for ${Math.round(stuckForMs / 1000)} seconds.`;
  }

  await db.collection("users").updateOne({ _id: user._id }, { $set: set });

  return {
    shouldRecover,
    stuckForMs,
    stuckSince: stuckSince.toISOString(),
  };
}

async function recoverIfSessionIsStuck(db, user, config, snapshot) {
  const health = await trackSessionHealth(db, user, snapshot?.status || {});

  if (!health.shouldRecover) {
    return {
      attempted: false,
      stuckForMs: health.stuckForMs,
      stuckSince: health.stuckSince || null,
    };
  }

  const recovery = await recoverWhatsAppWebSession(config);

  await db.collection("users").updateOne(
    { _id: user._id },
    {
      $set: {
        "whatsappWebHealth.lastRecoverySuccess": Boolean(recovery.success),
        "whatsappWebHealth.lastRecoveryError": recovery.error || "",
        "whatsappWebHealth.lastRecoveryEndpoint": recovery.endpoint || "",
      },
    }
  );

  return {
    ...recovery,
    stuckForMs: health.stuckForMs,
    stuckSince: health.stuckSince || null,
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
      let activeConfig = null;

      for (const candidate of candidates) {
        try {
          snapshot = await loadBridgeSnapshot(candidate);
          if (snapshot?.status) {
            activeConfig = candidate;
            break;
          }
        } catch (bridgeError) {
          lastBridgeError = bridgeError;
        }
      }

      if (!snapshot) {
        throw lastBridgeError || new Error("WhatsApp bridge is offline");
      }

      const recovery = await recoverIfSessionIsStuck(
        db,
        user,
        activeConfig || config,
        snapshot
      );

      const queueFlush = await flushQueueIfReady(
        db,
        user,
        activeConfig || config,
        snapshot
      );

      return Response.json({
        success: true,
        provider: "whatsappWeb",
        recovery,
        queueFlush,
        ...snapshot,
      });
    } catch (bridgeError) {
      return Response.json({
        success: false,
        provider: "whatsappWeb",
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


