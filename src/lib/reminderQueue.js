import { ObjectId } from "mongodb";
import { connectDB } from "./mongodb";
import { findUserById } from "./paymentGatewaySettings";
import {
  evaluateReminderEligibility,
  getOutstandingAmount,
  recordReminderAttempt,
} from "./reminderSafety";
import { deliverInvoiceMessage } from "./whatsappNotifications";

const reminderQueue = globalThis.__invoiceHubReminderQueue || new Map();

if (!globalThis.__invoiceHubReminderQueue) {
  globalThis.__invoiceHubReminderQueue = reminderQueue;
}

function getQueueKey(invoiceId) {
  return String(invoiceId || "");
}

function clearQueuedReminder(queueKey) {
  const queuedReminder = reminderQueue.get(queueKey);

  if (queuedReminder?.timeoutId) {
    clearTimeout(queuedReminder.timeoutId);
  }

  reminderQueue.delete(queueKey);
}

async function processQueuedReminder({
  invoiceId,
  ownerId,
  origin,
}) {
  const queueKey = getQueueKey(invoiceId);
  reminderQueue.delete(queueKey);

  try {
    const db = await connectDB();
    const invoiceObjectId = new ObjectId(invoiceId);
    const invoice = await db.collection("invoices").findOne({
      _id: invoiceObjectId,
      ownerId,
    });

    if (!invoice || getOutstandingAmount(invoice) <= 0) {
      return;
    }

    const eligibility = evaluateReminderEligibility(invoice, { mode: "single" });

    if (!eligibility.allowed) {
      queueInvoiceReminder({
        invoiceId,
        ownerId,
        origin,
        delayMs: eligibility.retryAfterMs,
      });
      return;
    }

    const owner = await findUserById(db, ownerId);
    const result = await deliverInvoiceMessage({
      db,
      invoice,
      owner,
      origin,
      isReminder: true,
    });

    await recordReminderAttempt(db, invoice._id, {
      provider: result.provider,
      outcome: result.sent ? "sent" : result.fallbackUrl ? "fallback" : "prepared",
    });
  } catch (error) {
    console.error("QUEUED REMINDER SEND ERROR:", error);
  }
}

export function queueInvoiceReminder({
  invoiceId,
  ownerId,
  origin,
  delayMs,
}) {
  const queueKey = getQueueKey(invoiceId);

  if (!queueKey || !ownerId || !origin) {
    return {
      queued: false,
      retryAfterMs: 0,
    };
  }

  const safeDelayMs = Math.max(Number(delayMs) || 0, 0);
  const existingReminder = reminderQueue.get(queueKey);

  if (existingReminder) {
    return {
      queued: true,
      retryAfterMs: Math.max(existingReminder.runAt - Date.now(), 0),
    };
  }

  const timeoutId = setTimeout(() => {
    processQueuedReminder({
      invoiceId: queueKey,
      ownerId,
      origin,
    });
  }, safeDelayMs);

  reminderQueue.set(queueKey, {
    invoiceId: queueKey,
    ownerId,
    origin,
    runAt: Date.now() + safeDelayMs,
    timeoutId,
  });

  return {
    queued: true,
    retryAfterMs: safeDelayMs,
  };
}

export function cancelQueuedInvoiceReminder(invoiceId) {
  clearQueuedReminder(getQueueKey(invoiceId));
}
