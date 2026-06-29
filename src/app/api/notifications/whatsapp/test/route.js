import { requireAuth } from "../../../../../lib/auth";
import { connectDB } from "../../../../../lib/mongodb";
import {
  findUserById,
  resolveGreenApiConfig,
  resolveWhatsAppWebConfig,
  resolveTwilioSandboxConfig,
} from "../../../../../lib/paymentGatewaySettings";
import {
  isTwilioSandboxConfigured,
  sendTwilioWhatsAppMessage,
} from "../../../../../lib/twilioWhatsApp";
import {
  isWhatsAppWebConfigured,
  sendWhatsAppWebMessage,
} from "../../../../../lib/whatsappWebBridge";
import {
  isGreenApiConfigured,
  sendGreenApiWhatsAppMessage,
} from "../../../../../lib/greenApiWhatsApp";

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

    const greenApiConfig = resolveGreenApiConfig(user);
    if (isGreenApiConfigured(greenApiConfig)) {
      const result = await sendGreenApiWhatsAppMessage(greenApiConfig, {
        phone,
        text: "InvoiceHub test message\n\nYour Green API WhatsApp connection is working.",
      });

      return Response.json({
        success: true,
        provider: "greenApi",
        result,
      });
    }

    const whatsAppWebConfig = resolveWhatsAppWebConfig(user);
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

    const twilioConfig = resolveTwilioSandboxConfig(user);

    if (isTwilioSandboxConfigured(twilioConfig)) {
      const result = await sendTwilioWhatsAppMessage(twilioConfig, {
        phone,
        text: "InvoiceHub test message\n\nYour Twilio Sandbox connection is working.",
      });

      return Response.json({
        success: true,
        provider: "twilioSandbox",
        result,
      });
    }

    return Response.json(
      { error: "No active WhatsApp provider is selected and fully configured in settings" },
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
