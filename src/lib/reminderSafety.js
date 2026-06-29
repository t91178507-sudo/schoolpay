const MIN_SINGLE_REMINDER_INTERVAL_MS = 5 * 60 * 1000;
const MIN_BULK_REMINDER_INTERVAL_MS = 12 * 60 * 60 * 1000;
const BULK_REMINDER_DELAY_MS = 3000;
const MAX_BULK_REMINDERS_PER_RUN = 20;

export function getOutstandingAmount(invoice = {}) {
  const amount = Number(invoice.amount || 0);
  const paidAmount = Number(invoice.paidAmount || 0);
  const balanceDue = Number(invoice.balanceDue || 0);

  if (balanceDue > 0) {
    return balanceDue;
  }

  if (paidAmount > 0) {
    return Math.max(amount - paidAmount, 0);
  }

  return amount;
}

function toTimestamp(value) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function evaluateReminderEligibility(
  invoice = {},
  { mode = "single", force = false } = {}
) {
  if (force) {
    return {
      allowed: true,
      reason: null,
      retryAfterMs: 0,
    };
  }

  const now = Date.now();
  const lastSentAt = toTimestamp(invoice.lastReminderSentAt);
  const minInterval =
    mode === "bulk" ? MIN_BULK_REMINDER_INTERVAL_MS : MIN_SINGLE_REMINDER_INTERVAL_MS;

  if (lastSentAt && now - lastSentAt < minInterval) {
    return {
      allowed: false,
      reason: "cooldown",
      retryAfterMs: minInterval - (now - lastSentAt),
    };
  }

  return {
    allowed: true,
    reason: null,
    retryAfterMs: 0,
  };
}

export async function recordReminderAttempt(
  db,
  invoiceId,
  {
    provider = "unknown",
    outcome = "sent",
  } = {}
) {
  await db.collection("invoices").updateOne(
    { _id: invoiceId },
    {
      $set: {
        lastReminderSentAt: new Date(),
        lastReminderProvider: provider,
        lastReminderOutcome: outcome,
      },
      $inc: {
        reminderSendCount: 1,
      },
    }
  );
}

export function getReminderPolicy() {
  return {
    minSingleReminderIntervalMs: MIN_SINGLE_REMINDER_INTERVAL_MS,
    minBulkReminderIntervalMs: MIN_BULK_REMINDER_INTERVAL_MS,
    bulkReminderDelayMs: BULK_REMINDER_DELAY_MS,
    maxBulkRemindersPerRun: MAX_BULK_REMINDERS_PER_RUN,
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
