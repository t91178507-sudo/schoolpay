import { ObjectId } from "mongodb";
import { connectDB } from "../../../lib/mongodb";
import { getPlatformWhatsAppBridgeSettings } from "../../../lib/paymentGatewaySettings";
import { sendWhatsAppWebMessage } from "../../../lib/whatsappWebBridge";

const DEMO_ALERT_PHONE = "08103902471";
const DEMO_ALERT_SESSION = "invoicehub-6a3edef73dabe1e960b6e27d";

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildDemoRequestMessage(request = {}) {
  return [
    "*New InvoiceHub demo request*",
    "",
    `Name: ${request.fullName}`,
    `Email: ${request.email}`,
    `Phone: ${request.phone}`,
    `Business: ${request.businessName}`,
    `Business type: ${request.businessType}`,
    `Team size: ${request.teamSize}`,
    `Submitted: ${request.createdAt.toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}`,
    "",
    "What they would like to see:",
    request.message || "No additional message provided.",
  ].join("\n");
}

export async function POST(req) {
  try {
    const db = await connectDB();
    const body = await req.json();

    const fullName = String(body.fullName || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const phone = String(body.phone || "").trim();
    const businessName = String(body.businessName || "").trim();
    const businessType = String(body.businessType || "").trim();
    const teamSize = String(body.teamSize || "").trim();
    const message = String(body.message || "").trim();

    if (!fullName || !email || !phone || !businessName || !businessType || !teamSize) {
      return Response.json(
        { error: "Please complete the required fields." },
        { status: 400 }
      );
    }

    if (!isValidEmail(email)) {
      return Response.json(
        { error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    const createdAt = new Date();
    const requestRecord = {
      fullName,
      email,
      phone,
      businessName,
      businessType,
      teamSize,
      message,
      status: "new",
      whatsappDelivery: {
        status: "pending",
        recipient: DEMO_ALERT_PHONE,
        sessionName: DEMO_ALERT_SESSION,
      },
      createdAt,
    };
    const result = await db.collection("demo_requests").insertOne(requestRecord);

    try {
      const platformBridge = await getPlatformWhatsAppBridgeSettings(db);
      const bridgeConfig = {
        ...platformBridge,
        enabled: platformBridge.enabled === true,
        sessionName: DEMO_ALERT_SESSION,
      };
      const delivery = await sendWhatsAppWebMessage(bridgeConfig, {
        phone: DEMO_ALERT_PHONE,
        text: buildDemoRequestMessage(requestRecord),
      });

      await db.collection("demo_requests").updateOne(
        { _id: new ObjectId(result.insertedId) },
        {
          $set: {
            "whatsappDelivery.status": "sent",
            "whatsappDelivery.messageId":
              delivery?.messageId || delivery?.id || delivery?.key?.id || "",
            "whatsappDelivery.sentAt": new Date(),
          },
        }
      );
    } catch (deliveryError) {
      console.error("DEMO REQUEST WHATSAPP ERROR:", deliveryError);
      await db.collection("demo_requests").updateOne(
        { _id: new ObjectId(result.insertedId) },
        {
          $set: {
            "whatsappDelivery.status": "failed",
            "whatsappDelivery.error":
              deliveryError.message || "WhatsApp delivery failed",
            "whatsappDelivery.failedAt": new Date(),
          },
        }
      );

      return Response.json(
        {
          error: "Your request was saved, but the WhatsApp notification could not be sent.",
          saved: true,
        },
        { status: deliveryError.status || 502 }
      );
    }

    return Response.json({
      success: true,
      message: "Demo request submitted successfully.",
    });
  } catch (error) {
    console.error("DEMO REQUEST ERROR:", error);

    return Response.json(
      { error: "Server error" },
      { status: 500 }
    );
  }
}