import { requireAuth } from "../../../../../../lib/auth";
import { connectDB } from "../../../../../../lib/mongodb";
import {
  findUserById,
  resolveWhatsAppWebConfig,
} from "../../../../../../lib/paymentGatewaySettings";
import {
  hasWhatsAppWebBridgeConfig,
  requestWhatsAppWebPairingCode,
} from "../../../../../../lib/whatsappWebBridge";

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
