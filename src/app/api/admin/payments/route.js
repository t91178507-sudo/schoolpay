import { connectDB } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/adminAuth";

function parseMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export async function GET(req) {
  try {
    requireAdmin(req);

    const db = await connectDB();

    const [paidInvoices, users] = await Promise.all([
      db
        .collection("invoices")
        .find({ status: { $in: ["Paid", "Partially Paid"] } })
        .sort({ paidAt: -1, paymentConfirmedAt: -1, date: -1 })
        .toArray(),
      db.collection("users").find({}, { projection: { password: 0 } }).toArray(),
    ]);

    const usersById = {};
    users.forEach((user) => {
      usersById[user._id.toString()] = user;
    });

    const enriched = paidInvoices.map((invoice) => {
      const owner = invoice.ownerId ? usersById[invoice.ownerId] : null;
      const status = invoice.status || "Paid";
      const paidAmount = parseMoney(invoice.paidAmount || invoice.amount);

      return {
        ...invoice,
        ownerBusinessName: owner?.businessName || invoice.businessName || "-",
        ownerEmail: owner?.email || "",
        customerDisplayName:
          invoice.customer || invoice.customerName || invoice.student || "Customer",
        description:
          invoice.description || invoice.category || invoice.class || "Invoice payment",
        paidAmount,
        paymentProvider:
          invoice.paymentProvider ||
          invoice.pendingPaymentProvider ||
          (invoice.quickPayProfileId ? "Monnify" : "Manual"),
        paymentReference:
          invoice.paymentReference ||
          invoice.pendingPaymentReference ||
          invoice.invoiceNumber ||
          "-",
        paymentStatus: invoice.paymentStatus || (status === "Paid" ? "paid" : "partial"),
        customerNotificationStatus:
          invoice.customerNotificationStatus === "pending-whatsapp"
            ? "prepared"
            : invoice.customerNotificationStatus || "draft",
        happenedAt:
          invoice.paidAt ||
          invoice.paymentConfirmedAt ||
          invoice.pendingPaymentCreatedAt ||
          invoice.date ||
          invoice.createdAt,
      };
    });

    const totalCollected = enriched.reduce(
      (sum, invoice) => sum + parseMoney(invoice.paidAmount),
      0
    );

    return Response.json({
      payments: enriched,
      totalCollected,
      count: enriched.length,
      partialCount: enriched.filter((invoice) => invoice.status === "Partially Paid").length,
      preparedNotificationCount: enriched.filter(
        (invoice) =>
          String(invoice.customerNotificationStatus || "").toLowerCase() === "prepared"
      ).length,
    });
  } catch (error) {
    console.error("ADMIN PAYMENTS ERROR:", error);
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Server error" },
      { status }
    );
  }
}
