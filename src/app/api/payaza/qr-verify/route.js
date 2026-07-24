import { connectDB } from "../../../../lib/mongodb";
import {
  parseAmount,
  verifyPayazaDynamicTransaction,
} from "../../../../lib/payaza";
import {
  findUserById,
  resolvePayazaConfig,
} from "../../../../lib/paymentGatewaySettings";
import { ensureQuickPayPaidInvoice } from "../../../../lib/quickPay";
import { deliverPaymentConfirmation } from "../../../../lib/whatsappNotifications";

function isSuccessfulStatus(value) {
  const status = String(value || "").toLowerCase();
  return ["success", "successful", "paid", "completed", "approved"].some((term) =>
    status.includes(term)
  );
}

function getTransactionStatus(verification = {}) {
  return (
    verification.transaction_status ||
    verification.payment_status ||
    verification.status ||
    ""
  );
}

function getTransactionAmount(verification = {}) {
  return parseAmount(
    verification.amount_received ||
      verification.request_amount ||
      verification.amount ||
      verification.transaction_amount ||
      verification.transaction_amount_payable
  );
}

async function sendPaidConfirmation(db, invoice, owner, amount) {
  if (!invoice.phone) {
    return;
  }

  try {
    await deliverPaymentConfirmation({
      db,
      invoice,
      owner,
      amount,
    });
  } catch (notificationError) {
    console.error("PAYAZA QR PAYMENT CONFIRMATION SEND ERROR:", notificationError);
  }
}

export async function POST(req) {
  try {
    const db = await connectDB();
    const body = await req.json();
    const profileToken = body.profileToken;
    const paymentReference = body.paymentReference;

    if (!profileToken || !paymentReference) {
      return Response.json(
        { error: "profileToken and paymentReference are required" },
        { status: 400 }
      );
    }

    const transaction = await db.collection("quickPayTransactions").findOne({
      profileToken,
      paymentReference,
    });

    if (!transaction) {
      return Response.json({ error: "Quick payment transaction not found" }, { status: 404 });
    }

    const owner = transaction.ownerId ? await findUserById(db, transaction.ownerId) : null;
    const payazaConfig = resolvePayazaConfig(owner || {});

    if (!payazaConfig.enabled || !payazaConfig.publicKey) {
      return Response.json(
        { error: "PayAza verification is not configured for this business" },
        { status: 500 }
      );
    }

    const verification = await verifyPayazaDynamicTransaction({
      publicKey: payazaConfig.publicKey,
      transactionReference: paymentReference,
      environment: payazaConfig.environment,
    });
    const status = getTransactionStatus(verification);

    if (!isSuccessfulStatus(status)) {
      return Response.json(
        { error: `Payment is not complete yet. Status: ${status || "Pending"}` },
        { status: 409 }
      );
    }

    const amountPaid = getTransactionAmount(verification);
    const expectedAmount = parseAmount(transaction.amount);

    if (amountPaid > 0 && expectedAmount > 0 && amountPaid !== expectedAmount) {
      return Response.json(
        { error: `Amount mismatch. Paid: ${amountPaid}. Expected: ${expectedAmount}.` },
        { status: 409 }
      );
    }

    const invoice = await ensureQuickPayPaidInvoice(db, transaction, {
      paymentReference,
      paidAmount: amountPaid || expectedAmount,
      paidAt: new Date(),
    });

    await sendPaidConfirmation(db, invoice, owner, amountPaid || expectedAmount);

    return Response.json({
      success: true,
      paymentReference,
      invoice: {
        invoiceNumber: invoice.invoiceNumber || "",
        invoiceId: String(invoice._id),
        description: invoice.description || "QR payment",
        amount: amountPaid || expectedAmount,
      },
    });
  } catch (error) {
    console.error("PAYAZA QR VERIFY ERROR:", error);
    return Response.json(
      { error: error.message || "Unable to verify quick payment" },
      { status: 500 }
    );
  }
}

