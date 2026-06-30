import { connectDB } from "../../../../lib/mongodb";
import { parseAmount } from "../../../../lib/monnify";
import { markInvoicePaid } from "../../../../lib/paymentLifecycle";
import { ensureQuickPayPaidInvoice } from "../../../../lib/quickPay";
import { findUserById } from "../../../../lib/paymentGatewaySettings";
import { deliverPaymentConfirmation } from "../../../../lib/whatsappNotifications";

function readPath(source, path) {
  return path.split(".").reduce((value, key) => value?.[key], source);
}

function firstValue(source, paths) {
  for (const path of paths) {
    const value = readPath(source, path);
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return "";
}

function normalizeStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function isSuccessfulPayazaStatus(status) {
  const normalized = normalizeStatus(status);
  return ["success", "successful", "paid", "completed", "approved"].some((term) =>
    normalized.includes(term)
  );
}

function extractPayazaEvent(body = {}) {
  const paymentReference = String(
    firstValue(body, [
      "paymentReference",
      "payment_reference",
      "reference",
      "transactionReference",
      "transaction_reference",
      "transaction_reference",
      "merchant_reference",
      "payaza_account_reference",
      "data.paymentReference",
      "data.payment_reference",
      "data.reference",
      "data.transactionReference",
      "data.transaction_reference",
      "data.merchant_reference",
      "data.payaza_account_reference",
      "eventData.paymentReference",
      "eventData.payment_reference",
      "eventData.reference",
      "eventData.transactionReference",
      "eventData.transaction_reference",
      "eventData.merchant_reference",
      "eventData.payaza_account_reference",
    ])
  ).trim();

  const status = firstValue(body, [
    "status",
    "paymentStatus",
    "payment_status",
    "transactionStatus",
    "transaction_status",
    "transaction_status",
    "data.status",
    "data.paymentStatus",
    "data.payment_status",
    "data.transactionStatus",
    "data.transaction_status",
    "data.status",
    "eventData.status",
    "eventData.paymentStatus",
    "eventData.payment_status",
    "eventData.transactionStatus",
    "eventData.transaction_status",
    "eventData.status",
  ]);

  const amount = parseAmount(
    firstValue(body, [
      "amount",
      "amountPaid",
      "amount_paid",
      "paidAmount",
      "paid_amount",
      "amount_received",
      "request_amount",
      "data.amount",
      "data.amountPaid",
      "data.amount_paid",
      "data.paidAmount",
      "data.paid_amount",
      "data.amount_received",
      "data.request_amount",
      "eventData.amount",
      "eventData.amountPaid",
      "eventData.amount_paid",
      "eventData.paidAmount",
      "eventData.paid_amount",
      "eventData.amount_received",
      "eventData.request_amount",
    ])
  );

  return {
    amount,
    paymentReference,
    status: normalizeStatus(status),
    successful: isSuccessfulPayazaStatus(status),
  };
}

async function sendPaidConfirmation(db, invoice, amount) {
  if (!invoice.phone) {
    return;
  }

  try {
    const owner = invoice.ownerId ? await findUserById(db, invoice.ownerId) : null;
    await deliverPaymentConfirmation({
      db,
      invoice,
      owner,
      amount,
    });
  } catch (notificationError) {
    console.error("PAYAZA PAYMENT CONFIRMATION SEND ERROR:", notificationError);
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const db = await connectDB();
    const event = extractPayazaEvent(body);

    await db.collection("payazaWebhookEvents").insertOne({
      provider: "PayAza",
      receivedAt: new Date(),
      paymentReference: event.paymentReference,
      status: event.status,
      amount: event.amount,
      body,
    });

    if (!event.paymentReference || !event.successful) {
      return Response.json({ success: true });
    }

    const invoice = await db.collection("invoices").findOne({
      pendingPaymentReference: event.paymentReference,
    });

    if (invoice) {
      const expectedAmount = parseAmount(invoice.pendingPaymentAmount ?? invoice.amount);

      if (event.amount > 0 && expectedAmount > 0 && event.amount !== expectedAmount) {
        return Response.json({ success: true });
      }

      const paidInvoice = await markInvoicePaid(db, invoice, {
        paidAt: new Date(),
        paidAmount: event.amount || expectedAmount,
        paymentReference: event.paymentReference,
        paymentProvider: "PayAza",
        verificationMethod: "payaza-webhook",
      });

      await sendPaidConfirmation(db, paidInvoice, event.amount || expectedAmount);

      return Response.json({ success: true });
    }

    const quickPayTransaction = await db.collection("quickPayTransactions").findOne({
      paymentReference: event.paymentReference,
    });

    if (!quickPayTransaction) {
      return Response.json({ success: true });
    }

    const expectedAmount = parseAmount(quickPayTransaction.amount);

    if (event.amount > 0 && expectedAmount > 0 && event.amount !== expectedAmount) {
      return Response.json({ success: true });
    }

    const quickPayInvoice = await ensureQuickPayPaidInvoice(db, quickPayTransaction, {
      paymentReference: event.paymentReference,
      paidAmount: event.amount || expectedAmount,
      paidAt: new Date(),
    });

    await sendPaidConfirmation(db, quickPayInvoice, event.amount || expectedAmount);

    return Response.json({ success: true });
  } catch (error) {
    console.error("PAYAZA WEBHOOK ERROR:", error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
