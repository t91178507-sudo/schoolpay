import { requireAuth } from "../../../../../lib/auth";
import { connectDB } from "../../../../../lib/mongodb";
import { findUserById } from "../../../../../lib/paymentGatewaySettings";
import {
  evaluateReminderEligibility,
  getOutstandingAmount,
  getReminderPolicy,
  recordReminderAttempt,
  sleep,
} from "../../../../../lib/reminderSafety";
import { deliverInvoiceMessage } from "../../../../../lib/whatsappNotifications";

export async function POST(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const body = await req.json();
    const origin = String(body.origin || "").trim();
    const force = body.force === true;

    if (!origin) {
      return Response.json({ error: "origin is required" }, { status: 400 });
    }

    const owner = await findUserById(db, userId);

    if (!owner) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    const invoices = await db
      .collection("invoices")
      .find({ ownerId: userId })
      .sort({ date: -1 })
      .toArray();

    const actionableInvoices = invoices.filter(
      (invoice) =>
        getOutstandingAmount(invoice) > 0 &&
        invoice.phone &&
        invoice.token
    );
    const policy = getReminderPolicy();
    const eligibleInvoices = actionableInvoices.filter((invoice) =>
      evaluateReminderEligibility(invoice, { mode: "bulk", force }).allowed
    );
    const cappedInvoices = eligibleInvoices.slice(0, policy.maxBulkRemindersPerRun);

    const fallbackDeliveries = [];
    const cooldownSkippedCount = actionableInvoices.length - eligibleInvoices.length;
    const cappedSkippedCount = Math.max(eligibleInvoices.length - cappedInvoices.length, 0);
    let sentCount = 0;
    let skippedCount = invoices.filter((invoice) => getOutstandingAmount(invoice) <= 0).length;

    for (let index = 0; index < cappedInvoices.length; index += 1) {
      const invoice = cappedInvoices[index];
      const delivery = await deliverInvoiceMessage({
        db,
        invoice,
        owner,
        origin,
      });

      if (delivery.sent) {
        sentCount += 1;
      } else if (delivery.fallbackUrl) {
        fallbackDeliveries.push({
          invoiceId: String(invoice._id),
          customer:
            invoice.customer || invoice.customerName || invoice.student || "Customer",
          fallbackUrl: delivery.fallbackUrl,
        });
      } else {
        skippedCount += 1;
      }

      await recordReminderAttempt(db, invoice._id, {
        provider: delivery.provider,
        outcome: delivery.sent ? "sent" : delivery.fallbackUrl ? "fallback" : "prepared",
      });

      if (index < cappedInvoices.length - 1) {
        await sleep(policy.bulkReminderDelayMs);
      }
    }

    skippedCount += invoices.filter(
      (invoice) =>
        getOutstandingAmount(invoice) > 0 &&
        (!invoice.phone || !invoice.token)
    ).length;
    skippedCount += cooldownSkippedCount + cappedSkippedCount;

    return Response.json({
      success: true,
      totalOpenInvoices: invoices.filter((invoice) => getOutstandingAmount(invoice) > 0).length,
      processedCount: cappedInvoices.length,
      sentCount,
      fallbackCount: fallbackDeliveries.length,
      skippedCount,
      cooldownSkippedCount,
      cappedSkippedCount,
      policy,
      fallbackDeliveries,
    });
  } catch (error) {
    console.error("WHATSAPP REMINDERS ERROR:", error);
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to send invoice reminders" },
      { status }
    );
  }
}
