import { requireAuth } from "../../../../../../lib/auth";
import { connectDB } from "../../../../../../lib/mongodb";
import {
  findUserById,
  resolveWhatsAppWebConfig,
} from "../../../../../../lib/paymentGatewaySettings";
import {
  fetchWhatsAppWebLogs,
  fetchWhatsAppWebStatus,
  hasWhatsAppWebBridgeConfig,
  requestWhatsAppWebPairingCode,
} from "../../../../../../lib/whatsappWebBridge";

export async function GET(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const user = await findUserById(db, userId);

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const config = resolveWhatsAppWebConfig(user);

    if (!hasWhatsAppWebBridgeConfig(config)) {
      return Response.json(
        { error: "WhatsApp Web bridge details are not configured" },
        { status: 400 }
      );
    }

    let status;
    let logs = { logs: [] };

    try {
      [status, logs] = await Promise.all([
        fetchWhatsAppWebStatus(config),
        fetchWhatsAppWebLogs(config).catch(() => ({ logs: [] })),
      ]);
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
      });
    }

    return Response.json({
      success: true,
      bridgeReachable: true,
      status,
      logs: Array.isArray(logs.logs) ? logs.logs : [],
    });
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

    const config = resolveWhatsAppWebConfig(user);

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
