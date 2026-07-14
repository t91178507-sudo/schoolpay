import { connectDB } from "../../../../../../lib/mongodb";
import { markInvoicePaid } from "../../../../../../lib/paymentLifecycle";
import { findUserById } from "../../../../../../lib/paymentGatewaySettings";
import { deliverPaymentConfirmation } from "../../../../../../lib/whatsappNotifications";
import { findAccessibleInvoice } from "../../../../../../lib/publicInvoiceAccess";

export async function POST(req, context) {
  try {
    const { token } = await context.params;
    const db = await connectDB();
    const body = await req.json().catch(() => ({}));
    const invoiceId = body.invoiceId || null;
    const paymentReference = body.paymentReference || null;
    const paidAmount = Number(body.paidAmount || 0);
    const invoice = await findAccessibleInvoice(db, { token, invoiceId });

    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (!paymentReference) {
      return Response.json(
        { error: "Payment reference is required to confirm this payment." },
        { status: 400 }
      );
    }

    if (
      invoice.pendingPaymentReference &&
      invoice.pendingPaymentReference !== paymentReference
    ) {
      return Response.json(
        { error: "Payment reference mismatch" },
        { status: 409 }
      );
    }

    if (invoice.status === "Paid") {
      return Response.json({ message: "Invoice already marked as paid" });
    }

    if (!invoice.pendingPaymentReference) {
      return Response.json(
        { error: "This invoice does not have a pending payment to confirm." },
        { status: 409 }
      );
    }

    const paidInvoice = await markInvoicePaid(db, invoice, {
      paidAt: new Date(),
      paidAmount:
        paidAmount > 0 ? paidAmount : Number(invoice.pendingPaymentAmount || invoice.balanceDue || invoice.amount || 0),
      paymentReference,
      paymentProvider: body.paymentProvider || invoice.pendingPaymentProvider || "Monnify",
      verificationMethod: body.verificationMethod || "redirect",
    });

    if (paidInvoice.phone) {
      try {
        const owner = paidInvoice.ownerId ? await findUserById(db, paidInvoice.ownerId) : null;
        await deliverPaymentConfirmation({
          db,
          invoice: paidInvoice,
          owner,
          amount: paidAmount > 0 ? paidAmount : Number(paidInvoice.amount || 0),
        });
      } catch (notificationError) {
        console.error("PAYMENT CONFIRMATION SEND ERROR:", notificationError);
      }
    }

    return Response.json({ message: "Invoice marked as paid" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
