import { connectDB } from "../../../../lib/mongodb";
import { parseAmount } from "../../../../lib/monnify";
import { markInvoicePaid } from "../../../../lib/paymentLifecycle";
import { ensureQuickPayPaidInvoice } from "../../../../lib/quickPay";
import { findUserById } from "../../../../lib/paymentGatewaySettings";
import { deliverPaymentConfirmation } from "../../../../lib/whatsappNotifications";

export async function POST(req) {
  try {
    const body = await req.json();
    const eventType = body?.eventType;
    const eventData = body?.eventData;

    if (eventType !== "SUCCESSFUL_TRANSACTION" || !eventData?.paymentReference) {
      return Response.json({ success: true });
    }

    const db = await connectDB();
    const invoice = await db.collection("invoices").findOne({
      pendingPaymentReference: eventData.paymentReference,
    });

    const amountPaid = parseAmount(eventData.amountPaid);

    if (invoice) {
      const expectedAmount = parseAmount(
        invoice.pendingPaymentAmount ?? invoice.amount
      );

      if (eventData.paymentStatus !== "PAID" || amountPaid !== expectedAmount) {
        return Response.json({ success: true });
      }

      const paidInvoice = await markInvoicePaid(db, invoice, {
        paidAt: new Date(),
        paidAmount: amountPaid,
        paymentReference: eventData.paymentReference,
        paymentProvider: "Monnify",
        verificationMethod: "webhook",
      });

      if (paidInvoice.phone) {
        try {
          const owner = paidInvoice.ownerId ? await findUserById(db, paidInvoice.ownerId) : null;
          await deliverPaymentConfirmation({
            db,
            invoice: paidInvoice,
            owner,
            amount: amountPaid,
          });
        } catch (notificationError) {
          console.error("WEBHOOK PAYMENT CONFIRMATION SEND ERROR:", notificationError);
        }
      }

      return Response.json({ success: true });
    }

    const quickPayTransaction = await db.collection("quickPayTransactions").findOne({
      paymentReference: eventData.paymentReference,
    });

    if (!quickPayTransaction) {
      return Response.json({ success: true });
    }

    const expectedAmount = parseAmount(quickPayTransaction.amount);

    if (eventData.paymentStatus !== "PAID" || amountPaid !== expectedAmount) {
      return Response.json({ success: true });
    }

    const quickPayInvoice = await ensureQuickPayPaidInvoice(db, quickPayTransaction, {
      paymentReference: eventData.paymentReference,
      paidAmount: amountPaid,
      paidAt: new Date(),
    });

    if (quickPayInvoice.phone) {
      try {
        const owner = quickPayInvoice.ownerId ? await findUserById(db, quickPayInvoice.ownerId) : null;
        await deliverPaymentConfirmation({
          db,
          invoice: quickPayInvoice,
          owner,
          amount: amountPaid,
        });
      } catch (notificationError) {
        console.error("QUICK PAY WEBHOOK CONFIRMATION SEND ERROR:", notificationError);
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("MONNIFY WEBHOOK ERROR:", error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
