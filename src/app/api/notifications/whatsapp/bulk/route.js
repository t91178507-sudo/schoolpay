import { requireAuth } from "../../../../../lib/auth";
import { connectDB } from "../../../../../lib/mongodb";
import {
  findUserById,
  resolveWhatsAppWebConfigForUser,
} from "../../../../../lib/paymentGatewaySettings";
import {
  isWhatsAppWebConfigured,
  sendWhatsAppWebMessage,
} from "../../../../../lib/whatsappWebBridge";

function getCustomerPhone(customer = {}) {
  return customer.phone || customer.customerPhone || customer.parentPhone || "";
}

export async function POST(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const body = await req.json();
    const category = String(body.category || "").trim();
    const text = String(body.message || "").trim();

    if (!category) {
      return Response.json({ error: "Category is required" }, { status: 400 });
    }

    if (!text) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    const user = await findUserById(db, userId);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const whatsAppWebConfig = await resolveWhatsAppWebConfigForUser(db, user);
    if (!isWhatsAppWebConfigured(whatsAppWebConfig)) {
      return Response.json(
        { error: "WhatsApp Web bridge is not configured" },
        { status: 400 }
      );
    }

    const customers = await db
      .collection("customers")
      .find({ ownerId: userId, category })
      .toArray();

    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const results = [];

    for (const customer of customers) {
      const phone = getCustomerPhone(customer);

      if (!phone) {
        skippedCount += 1;
        results.push({
          customerId: String(customer._id),
          name: customer.name || "",
          status: "skipped",
          reason: "No phone number",
        });
        continue;
      }

      try {
        const result = await sendWhatsAppWebMessage(whatsAppWebConfig, {
          phone,
          text,
        });
        sentCount += 1;
        results.push({
          customerId: String(customer._id),
          name: customer.name || "",
          phone,
          status: "sent",
          messageId: result?.id || result?.result?.id || "",
        });
      } catch (sendError) {
        failedCount += 1;
        results.push({
          customerId: String(customer._id),
          name: customer.name || "",
          phone,
          status: "failed",
          reason: sendError.message || "Unable to send message",
        });
      }
    }

    return Response.json({
      success: true,
      category,
      totalCount: customers.length,
      sentCount,
      failedCount,
      skippedCount,
      results,
    });
  } catch (error) {
    console.error("WHATSAPP BULK MESSAGE ERROR:", error);
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to send bulk WhatsApp message" },
      { status }
    );
  }
}
