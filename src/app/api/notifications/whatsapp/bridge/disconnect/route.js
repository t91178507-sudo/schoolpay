import { requireAuth } from "../../../../../../lib/auth";
import { connectDB } from "../../../../../../lib/mongodb";
import {
  findUserById,
  resolveWhatsAppWebConfig,
} from "../../../../../../lib/paymentGatewaySettings";
import {
  deleteWhatsAppWebSession,
  disconnectWhatsAppWebSession,
  hasWhatsAppWebBridgeConfig,
} from "../../../../../../lib/whatsappWebBridge";

export async function POST(req) {
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

    const result = await disconnectWhatsAppWebSession(config);

    return Response.json({
      success: true,
      result,
    });
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to disconnect WhatsApp Web session" },
      { status }
    );
  }
}

export async function DELETE(req) {
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

    const result = await deleteWhatsAppWebSession(config);

    return Response.json({
      success: true,
      result,
    });
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to delete WhatsApp Web session" },
      { status }
    );
  }
}
