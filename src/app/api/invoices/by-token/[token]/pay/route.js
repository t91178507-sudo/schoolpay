import { connectDB } from "../../../../../../lib/mongodb";
import { ObjectId } from "mongodb";
import { markInvoicePaid } from "../../../../../../lib/paymentLifecycle";

export async function POST(req, context) {
  try {
    const { token } = await context.params;
    const db = await connectDB();
    const body = await req.json().catch(() => ({}));
    const invoiceId = body.invoiceId || null;
    const paymentReference = body.paymentReference || null;
    const paidAmount = Number(body.paidAmount || 0);

    const invoiceQuery = invoiceId ? { _id: new ObjectId(invoiceId) } : { token };
    const invoice = await db.collection("invoices").findOne(invoiceQuery);

    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (
      paymentReference &&
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

    await markInvoicePaid(db, invoice, {
      paidAt: new Date(),
      paidAmount: paidAmount > 0 ? paidAmount : Number(invoice.amount || 0),
      paymentReference,
      paymentProvider: body.paymentProvider || invoice.pendingPaymentProvider || "Monnify",
      verificationMethod: body.verificationMethod || "redirect",
    });

    return Response.json({ message: "Invoice marked as paid" });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
