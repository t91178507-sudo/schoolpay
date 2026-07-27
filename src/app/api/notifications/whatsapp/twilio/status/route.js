import { ObjectId } from "mongodb";
import { connectDB } from "../../../../../../lib/mongodb";
import {
  findUserById,
  resolveTwilioWhatsAppConfig,
} from "../../../../../../lib/paymentGatewaySettings";
import { validateTwilioSignature } from "../../../../../../lib/twilioWhatsApp";

function formToObject(formData) {
  return Object.fromEntries(
    [...formData.entries()].map(([key, value]) => [key, String(value)])
  );
}

function getValidationUrl(req) {
  const configuredBase =
    process.env.TWILIO_STATUS_CALLBACK_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    "";
  if (!configuredBase) return req.url;
  return `${String(configuredBase).replace(/\/+$/, "")}/api/notifications/whatsapp/twilio/status`;
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const payload = formToObject(formData);
    const messageSid = payload.MessageSid || payload.SmsSid || "";
    if (!messageSid) {
      return Response.json({ error: "Message SID is required." }, { status: 400 });
    }

    const db = await connectDB();
    const message = await db
      .collection("twilioMessages")
      .findOne({ messageSid });
    if (!message || !ObjectId.isValid(String(message.ownerId))) {
      return Response.json({ error: "Message not found." }, { status: 404 });
    }

    const user = await findUserById(db, message.ownerId);
    const config = resolveTwilioWhatsAppConfig(user || {});
    const validSignature = validateTwilioSignature({
      authToken: config.authToken,
      signature: req.headers.get("x-twilio-signature") || "",
      url: getValidationUrl(req),
      params: payload,
    });
    if (!validSignature) {
      return Response.json({ error: "Invalid Twilio signature." }, { status: 403 });
    }

    const status = String(payload.MessageStatus || payload.SmsStatus || "unknown");
    await db.collection("twilioMessages").updateOne(
      { messageSid },
      {
        $set: {
          status,
          errorCode: payload.ErrorCode || "",
          errorMessage: payload.ErrorMessage || "",
          price: payload.Price || "",
          priceUnit: payload.PriceUnit || "",
          updatedAt: new Date(),
          ...(status === "delivered" ? { deliveredAt: new Date() } : {}),
          ...(status === "read" ? { readAt: new Date() } : {}),
          ...(["failed", "undelivered"].includes(status)
            ? { failedAt: new Date() }
            : {}),
        },
      }
    );

    if (message.relatedId && ObjectId.isValid(message.relatedId)) {
      await db.collection("invoices").updateOne(
        { _id: new ObjectId(message.relatedId) },
        {
          $set: {
            notificationStatus:
              status === "read" || status === "delivered" ? "sent" : status,
            notificationProvider: "twilio",
            notificationUpdatedAt: new Date(),
          },
        }
      );
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("TWILIO STATUS CALLBACK ERROR:", error);
    return Response.json(
      { error: error.message || "Unable to process Twilio status." },
      { status: error.status || 500 }
    );
  }
}
