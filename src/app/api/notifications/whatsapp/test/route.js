import { requireAuth } from "../../../../../lib/auth";
import { connectDB } from "../../../../../lib/mongodb";
import {
  findUserById,
  resolveWhatsAppWebConfigForUser,
} from "../../../../../lib/paymentGatewaySettings";
import {
  isWhatsAppWebConfigured,
  resolveActiveWhatsAppWebConfig,
  sendWhatsAppWebMessage,
} from "../../../../../lib/whatsappWebBridge";

export async function POST(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const body = await req.json();
    const phone = String(body.phone || "").trim();

    if (!phone) {
      return Response.json({ error: "phone is required" }, { status: 400 });
    }

    const user = await findUserById(db, userId);

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const savedWhatsAppWebConfig = await resolveWhatsAppWebConfigForUser(db, user);
    const whatsAppWebConfig = isWhatsAppWebConfigured(savedWhatsAppWebConfig)
      ? await resolveActiveWhatsAppWebConfig(savedWhatsAppWebConfig).catch(
          () => savedWhatsAppWebConfig
        )
      : savedWhatsAppWebConfig;
    if (isWhatsAppWebConfigured(whatsAppWebConfig)) {
      const result = await sendWhatsAppWebMessage(whatsAppWebConfig, {
        phone,
        text: "InvoiceHub test message\n\nYour WhatsApp Web bridge connection is working.",
      });

      return Response.json({
        success: true,
        provider: "whatsappWeb",
        result,
      });
    }

    return Response.json(
      { error: "WhatsApp Web bridge is not configured" },
      { status: 400 }
    );
  } catch (error) {
    console.error("OPENWA TEST ERROR:", error);
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to send test message" },
      { status }
    );
  }
}
