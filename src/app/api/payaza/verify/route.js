import { connectDB } from "../../../../lib/mongodb";
import {
  parseAmount,
  verifyPayazaDynamicTransaction,
} from "../../../../lib/payaza";
import {
  findUserById,
  resolvePayazaConfig,
} from "../../../../lib/paymentGatewaySettings";
import { markInvoicePaid } from "../../../../lib/paymentLifecycle";
import { deliverPaymentConfirmation } from "../../../../lib/whatsappNotifications";
import { findAccessibleInvoice } from "../../../../lib/publicInvoiceAccess";

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
    console.error("PAYAZA VERIFY CONFIRMATION SEND ERROR:", notificationError);
  }
}

export async function POST(req) {
  try {
    const db = await connectDB();
    const body = await req.json();
    const token = body.token;
    const invoiceId = body.invoiceId;
    const paymentReference = body.paymentReference;

    if (!token || !invoiceId || !paymentReference) {
      return Response.json(
        { error: "token, invoiceId and paymentReference are required" },
        { status: 400 }
      );
    }

    const invoice = await findAccessibleInvoice(db, { token, invoiceId });

    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (
      invoice.pendingPaymentReference &&
      invoice.pendingPaymentReference !== paymentReference
    ) {
      return Response.json(
        { error: "Payment reference does not match this invoice" },
        { status: 409 }
      );
    }

    const owner = invoice.ownerId ? await findUserById(db, invoice.ownerId) : null;
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
    });

    if (verification.transaction_status !== "Completed") {
      return Response.json(
        {
          error: `Payment is not complete yet. Status: ${verification.transaction_status || "Initialized"}`,
        },
        { status: 409 }
      );
    }

    const amountPaid = parseAmount(verification.amount_received);
    const expectedAmount = parseAmount(invoice.pendingPaymentAmount ?? invoice.amount);

    if (amountPaid !== expectedAmount) {
      return Response.json(
        { error: `Amount mismatch. Paid: ${amountPaid}. Expected: ${expectedAmount}.` },
        { status: 409 }
      );
    }

    const paidInvoice = await markInvoicePaid(db, invoice, {
      paidAt: verification.current_status_date
        ? new Date(verification.current_status_date)
        : new Date(),
      paidAmount: amountPaid,
      paymentReference,
      paymentProvider: "PayAza",
      verificationMethod: "payaza-query",
    });

    await sendPaidConfirmation(db, paidInvoice, owner, amountPaid);

    return Response.json({
      success: true,
      paymentStatus: verification.transaction_status,
      paymentReference,
    });
  } catch (error) {
    console.error("PAYAZA VERIFY ERROR:", error);
    return Response.json(
      { error: error.message || "Unable to verify PayAza payment" },
      { status: 500 }
    );
  }
}
