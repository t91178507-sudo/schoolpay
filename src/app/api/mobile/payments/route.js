import { buildScopedQuery, requireAccessContext } from "../../../../lib/accessControl";
import { connectDB } from "../../../../lib/mongodb";

export async function GET(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db, {
      permission: "payments.view",
    });
    const invoices = await db
      .collection("invoices")
      .find(buildScopedQuery(context))
      .sort({ createdAt: -1, paidAt: -1 })
      .limit(250)
      .toArray();

    const rows = invoices.map((invoice) => ({
      _id: String(invoice._id),
      customer: invoice.customer || invoice.customerName || invoice.student || "",
      invoiceNumber: invoice.invoiceNumber || "",
      amount: Number(invoice.amount || 0),
      paidAmount: Number(invoice.paidAmount || invoice.amountPaid || 0),
      balanceDue: Number(invoice.balanceDue || 0),
      status: invoice.status || invoice.paymentStatus || "Unpaid",
      paymentStatus: invoice.paymentStatus || "unpaid",
      createdAt: invoice.createdAt || null,
      paidAt: invoice.paidAt || null,
      paymentReference: invoice.paymentReference || "",
      notificationStatus: invoice.customerNotificationStatus || "",
    }));

    return Response.json(rows);
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load payments" },
      { status: error.status || 500 }
    );
  }
}
