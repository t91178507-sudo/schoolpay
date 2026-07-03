import {
  calculateInvoiceTotal,
  generateInvoiceNumber,
  generateInvoiceToken,
  sanitizeInvoiceItems,
} from "./invoiceUtils";
import { findUserById } from "./paymentGatewaySettings";
import { deliverInvoiceMessage } from "./whatsappNotifications";

const FREQUENCIES = new Set(["weekly", "monthly", "yearly"]);

function toDate(value, fallback = new Date()) {
  const date = value ? new Date(value) : fallback;
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function startOfDayKey(value) {
  return toDate(value).toISOString().slice(0, 10);
}

function addFrequency(date, frequency, interval = 1) {
  const next = new Date(date);
  const step = Math.max(Number(interval || 1), 1);

  if (frequency === "weekly") {
    next.setDate(next.getDate() + 7 * step);
  } else if (frequency === "yearly") {
    next.setFullYear(next.getFullYear() + step);
  } else {
    next.setMonth(next.getMonth() + step);
  }

  return next;
}

export function normalizeRecurringInvoiceInput(body = {}, user = {}) {
  const amount = Number(body.amount || 0);
  const description = String(body.description || "Recurring invoice").trim();
  const frequency = FREQUENCIES.has(body.frequency) ? body.frequency : "monthly";
  const items = sanitizeInvoiceItems(
    Array.isArray(body.items) && body.items.length > 0
      ? body.items
      : [
          {
            id: "item-1",
            description,
            quantity: 1,
            unitPrice: amount,
          },
        ]
  );
  const total = calculateInvoiceTotal(items);
  const nextRunAt = toDate(body.nextRunAt || body.startDate || new Date());

  return {
    name: String(body.name || description || "Recurring invoice").trim(),
    customer: String(body.customer || body.customerName || "").trim(),
    customerName: String(body.customerName || body.customer || "").trim(),
    category: String(body.category || "").trim(),
    description,
    items,
    subtotal: total,
    amount: total,
    email: String(body.email || "").trim(),
    phone: String(body.phone || "").trim(),
    businessName: body.businessName || user.businessName || "",
    businessLogo: body.businessLogo || user.businessLogo || "",
    frequency,
    interval: Math.max(Number(body.interval || 1), 1),
    nextRunAt,
    endDate: body.endDate ? toDate(body.endDate, null) : null,
    active: body.active !== false,
  };
}

export function buildInvoiceFromRecurringProfile(profile = {}, runDate = new Date()) {
  const token = generateInvoiceToken("inv");
  const items = sanitizeInvoiceItems(profile.items || []);
  const amount = calculateInvoiceTotal(items);
  const runKey = startOfDayKey(runDate);

  return {
    invoiceNumber: generateInvoiceNumber(),
    customer: profile.customer || profile.customerName || "Customer",
    customerName: profile.customerName || profile.customer || "Customer",
    category: profile.category || "Recurring",
    description: profile.description || profile.name || "Recurring invoice",
    items,
    subtotal: amount,
    email: profile.email || "",
    amount,
    status: "Unpaid",
    token,
    customerToken: profile.customerToken || token,
    phone: profile.phone || "",
    businessName: profile.businessName || "",
    businessLogo: profile.businessLogo || "",
    ownerId: profile.ownerId || "",
    date: runDate,
    paidAmount: 0,
    balanceDue: amount,
    paymentStatus: "unpaid",
    customerNotificationStatus: profile.phone ? "draft" : "unavailable",
    recurringInvoiceId: String(profile._id || ""),
    recurringRunKey: runKey,
    createdAt: new Date(),
  };
}

export function getNextRunDate(profile = {}, fromDate = new Date()) {
  const next = addFrequency(fromDate, profile.frequency || "monthly", profile.interval || 1);
  const endDate = profile.endDate ? toDate(profile.endDate, null) : null;

  if (endDate && next > endDate) {
    return null;
  }

  return next;
}

export async function processDueRecurringInvoices(
  db,
  { ownerId = "", now = new Date(), origin = "" } = {}
) {
  const dueQuery = {
    active: { $ne: false },
    nextRunAt: { $lte: now },
  };

  if (ownerId) {
    dueQuery.ownerId = ownerId;
  }

  const profiles = await db.collection("recurringInvoices").find(dueQuery).toArray();
  const results = [];

  for (const profile of profiles) {
    const runDate = toDate(profile.nextRunAt, now);
    const runKey = startOfDayKey(runDate);
    const existing = await db.collection("invoices").findOne({
      recurringInvoiceId: String(profile._id),
      recurringRunKey: runKey,
    });
    const nextRunAt = getNextRunDate(profile, runDate);

    if (existing) {
      await db.collection("recurringInvoices").updateOne(
        { _id: profile._id },
        {
          $set: {
            nextRunAt,
            active: Boolean(nextRunAt),
            lastSkippedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );
      results.push({ profileId: String(profile._id), skipped: true });
      continue;
    }

    const invoice = buildInvoiceFromRecurringProfile(profile, runDate);
    const insertResult = await db.collection("invoices").insertOne(invoice);
    const insertedInvoice = {
      ...invoice,
      _id: insertResult.insertedId,
    };
    let notification = {
      sent: false,
      provider: "none",
      error: "",
    };

    if (origin && insertedInvoice.phone) {
      try {
        const owner = insertedInvoice.ownerId
          ? await findUserById(db, insertedInvoice.ownerId)
          : null;
        notification = await deliverInvoiceMessage({
          db,
          invoice: insertedInvoice,
          owner,
          origin,
        });
      } catch (error) {
        notification = {
          sent: false,
          provider: "failed",
          error: error.message || "Unable to send WhatsApp notification",
        };
      }
    }

    await db.collection("recurringInvoices").updateOne(
      { _id: profile._id },
      {
        $set: {
          nextRunAt,
          active: Boolean(nextRunAt),
          lastRunAt: new Date(),
          lastInvoiceId: String(insertResult.insertedId),
          lastNotification: notification,
          updatedAt: new Date(),
        },
        $inc: { generatedCount: 1 },
      }
    );

    results.push({
      profileId: String(profile._id),
      invoiceId: String(insertResult.insertedId),
      notification,
      skipped: false,
    });
  }

  return results;
}
