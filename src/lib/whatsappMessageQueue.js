import { ObjectId } from "mongodb";
import {
  consumeUnitsForWhatsAppMessage,
  ensureCanSendWhatsAppMessage,
} from "./billingService";
import { markInvoiceNotificationPrepared } from "./paymentLifecycle";
import {
  isWhatsAppWebConfigured,
  sendWhatsAppWebDocument,
  sendWhatsAppWebMessage,
} from "./whatsappWebBridge";

const COLLECTION = "whatsappMessageQueue";
const MAX_FLUSH_BATCH = 25;

function normalizeOwnerId(owner = {}) {
  return String(owner._id || owner.id || owner.ownerId || "").trim();
}

function normalizeRelatedId(relatedId) {
  return relatedId ? String(relatedId) : "";
}

function isReadyStatus(status = {}) {
  return String(status.status || "").toLowerCase() === "ready";
}

function buildBaseRecord({ owner, type, relatedId, phone, text, attachment }) {
  const now = new Date();
  const ownerId = normalizeOwnerId(owner);

  return {
    ownerId,
    businessName: owner?.businessName || "",
    type: String(type || "general"),
    provider: "whatsappWeb",
    relatedId: normalizeRelatedId(relatedId),
    phone: String(phone || "").trim(),
    text: String(text || ""),
    attachment: attachment?.base64
      ? {
          filename: attachment.filename || "invoicehub-document.pdf",
          mimetype: attachment.mimetype || "application/pdf",
          base64: attachment.base64,
        }
      : null,
    status: "pending",
    attempts: 0,
    lastFailureReason: "",
    messageId: "",
    createdAt: now,
    updatedAt: now,
    sentAt: null,
  };
}

export async function createPendingWhatsAppMessage(db, payload = {}) {
  const record = buildBaseRecord(payload);

  if (!record.ownerId || !record.phone || !record.text) {
    return null;
  }

  const result = await db.collection(COLLECTION).insertOne(record);
  return { ...record, _id: result.insertedId };
}

export async function markWhatsAppMessageSent(db, messageId, delivery = {}) {
  if (!messageId) return;

  const existing = await db.collection(COLLECTION).findOne(
    { _id: messageId },
    { projection: { ownerId: 1, businessName: 1, relatedId: 1, type: 1 } }
  );

  await db.collection(COLLECTION).updateOne(
    { _id: messageId },
    {
      $set: {
        status: "sent",
        sentAt: new Date(),
        updatedAt: new Date(),
        lastFailureReason: "",
        messageId: delivery?.messageId || delivery?.id || delivery?.key?.id || "",
      },
    }
  );

  const messageType = String(existing?.type || "");
  const shouldSyncInvoice =
    messageType.startsWith("invoice") ||
    messageType === "payment_confirmation";

  if (existing?.relatedId && shouldSyncInvoice && ObjectId.isValid(String(existing.relatedId))) {
    await markInvoiceNotificationPrepared(
      db,
      new ObjectId(String(existing.relatedId)),
      "sent"
    );
  }

  if (existing?.ownerId) {
    await consumeUnitsForWhatsAppMessage(db, {
      ownerId: existing.ownerId,
      businessName: existing.businessName || "",
      messageId,
      createdBy: "WhatsApp delivery",
    });
  }
}

export async function markWhatsAppMessagePending(db, messageId, reason) {
  if (!messageId) return;

  await db.collection(COLLECTION).updateOne(
    { _id: messageId },
    {
      $set: {
        status: "pending",
        lastFailureReason: String(reason || "WhatsApp bridge is not ready"),
        updatedAt: new Date(),
      },
      $inc: { attempts: 1 },
    }
  );
}

async function sendQueuedWhatsAppMessage(config = {}, message = {}) {
  if (message.attachment?.base64) {
    return sendWhatsAppWebDocument(config, {
      phone: message.phone,
      caption: message.text,
      attachment: message.attachment,
    });
  }

  return sendWhatsAppWebMessage(config, {
    phone: message.phone,
    text: message.text,
  });
}

export async function sendOrQueueWhatsAppWebMessage({
  db,
  owner,
  config,
  bridgeStatus,
  type,
  relatedId,
  phone,
  text,
  attachment,
}) {
  const queued = await createPendingWhatsAppMessage(db, {
    owner,
    type,
    relatedId,
    phone,
    text,
    attachment,
  });

  if (!queued) {
    return {
      sent: false,
      status: "skipped",
      provider: "whatsappWeb",
      reason: "missing_required_message_fields",
    };
  }

  if (!isWhatsAppWebConfigured(config)) {
    await markWhatsAppMessagePending(
      db,
      queued._id,
      "WhatsApp Web bridge is not configured"
    );
    return {
      sent: false,
      status: "pending",
      provider: "whatsappWeb",
      queuedId: String(queued._id),
      reason: "WhatsApp Web bridge is not configured",
    };
  }

  if (bridgeStatus && !isReadyStatus(bridgeStatus)) {
    const reason = `WhatsApp bridge is ${bridgeStatus.status || "not ready"}`;
    await markWhatsAppMessagePending(db, queued._id, reason);
    return {
      sent: false,
      status: "pending",
      provider: "whatsappWeb",
      queuedId: String(queued._id),
      reason,
    };
  }

  const unitCheck = await ensureCanSendWhatsAppMessage(db, {
    ownerId: queued.ownerId,
  });

  if (!unitCheck.allowed) {
    await markWhatsAppMessagePending(db, queued._id, unitCheck.reason);
    return {
      sent: false,
      status: "pending",
      provider: "whatsappWeb",
      queuedId: String(queued._id),
      reason: unitCheck.reason,
    };
  }

  try {
    const delivery = await sendQueuedWhatsAppMessage(config, queued);
    await markWhatsAppMessageSent(db, queued._id, delivery);

    return {
      sent: true,
      status: "sent",
      provider: "whatsappWeb",
      queuedId: String(queued._id),
      messageId: delivery?.messageId || delivery?.id || delivery?.key?.id || "",
      attachmentSent: Boolean(queued.attachment),
    };
  } catch (error) {
    await markWhatsAppMessagePending(db, queued._id, error.message);
    return {
      sent: false,
      status: "pending",
      provider: "whatsappWeb",
      queuedId: String(queued._id),
      reason: error.message || "Unable to send WhatsApp message",
    };
  }
}

export async function flushPendingWhatsAppMessagesForOwner({
  db,
  owner,
  config,
  bridgeStatus,
  limit = MAX_FLUSH_BATCH,
}) {
  const ownerId = normalizeOwnerId(owner);

  if (!ownerId || !isWhatsAppWebConfigured(config) || !isReadyStatus(bridgeStatus)) {
    return { attempted: 0, sent: 0, pending: 0 };
  }

  const pendingMessages = await db
    .collection(COLLECTION)
    .find({ ownerId, provider: "whatsappWeb", status: "pending" })
    .sort({ createdAt: 1, _id: 1 })
    .limit(limit)
    .toArray();

  let sent = 0;

  for (const message of pendingMessages) {
    try {
      const unitCheck = await ensureCanSendWhatsAppMessage(db, {
        ownerId: message.ownerId,
      });

      if (!unitCheck.allowed) {
        await markWhatsAppMessagePending(db, message._id, unitCheck.reason);
        break;
      }

      const delivery = await sendQueuedWhatsAppMessage(config, message);
      await markWhatsAppMessageSent(db, message._id, delivery);
      sent += 1;
    } catch (error) {
      await markWhatsAppMessagePending(db, message._id, error.message);
      break;
    }
  }

  return {
    attempted: pendingMessages.length,
    sent,
    pending: Math.max(0, pendingMessages.length - sent),
  };
}

export function toObjectId(id) {
  return ObjectId.isValid(String(id || "")) ? new ObjectId(String(id)) : null;
}
