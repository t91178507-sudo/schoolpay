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

const BULK_MESSAGE_MIN_DELAY_MS = 45 * 1000;
const BULK_MESSAGE_MAX_DELAY_MS = 90 * 1000;
const BULK_MESSAGE_COOLDOWN_AFTER_COUNT = 20;
const BULK_MESSAGE_MIN_COOLDOWN_MS = 10 * 60 * 1000;
const BULK_MESSAGE_MAX_COOLDOWN_MS = 15 * 60 * 1000;

function getCustomerPhone(customer = {}) {
  return customer.phone || customer.customerPhone || customer.parentPhone || "";
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBulkDelayPolicy() {
  return {
    minDelaySeconds: Math.round(BULK_MESSAGE_MIN_DELAY_MS / 1000),
    maxDelaySeconds: Math.round(BULK_MESSAGE_MAX_DELAY_MS / 1000),
    cooldownAfterMessages: BULK_MESSAGE_COOLDOWN_AFTER_COUNT,
    minCooldownMinutes: Math.round(BULK_MESSAGE_MIN_COOLDOWN_MS / 60000),
    maxCooldownMinutes: Math.round(BULK_MESSAGE_MAX_COOLDOWN_MS / 60000),
  };
}

async function waitBeforeNextBulkMessage(sentAttemptCount, hasMoreRecipients) {
  if (!hasMoreRecipients) {
    return 0;
  }

  const shouldCooldown =
    sentAttemptCount > 0 &&
    sentAttemptCount % BULK_MESSAGE_COOLDOWN_AFTER_COUNT === 0;
  const delayMs = shouldCooldown
    ? randomBetween(BULK_MESSAGE_MIN_COOLDOWN_MS, BULK_MESSAGE_MAX_COOLDOWN_MS)
    : randomBetween(BULK_MESSAGE_MIN_DELAY_MS, BULK_MESSAGE_MAX_DELAY_MS);

  await sleep(delayMs);
  return delayMs;
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

    const savedWhatsAppWebConfig = await resolveWhatsAppWebConfigForUser(db, user);
    const whatsAppWebConfig = isWhatsAppWebConfigured(savedWhatsAppWebConfig)
      ? await resolveActiveWhatsAppWebConfig(savedWhatsAppWebConfig).catch(
          () => savedWhatsAppWebConfig
        )
      : savedWhatsAppWebConfig;
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

    const sendableCustomers = [];
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

      sendableCustomers.push({ customer, phone });
    }

    let sentCount = 0;
    let failedCount = 0;
    let totalDelayMs = 0;

    for (let index = 0; index < sendableCustomers.length; index += 1) {
      const { customer, phone } = sendableCustomers[index];

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

      totalDelayMs += await waitBeforeNextBulkMessage(
        index + 1,
        index < sendableCustomers.length - 1
      );
    }

    return Response.json({
      success: true,
      category,
      totalCount: customers.length,
      sendableCount: sendableCustomers.length,
      sentCount,
      failedCount,
      skippedCount,
      delayPolicy: getBulkDelayPolicy(),
      totalDelaySeconds: Math.round(totalDelayMs / 1000),
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
