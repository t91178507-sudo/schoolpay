import { connectDB } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/adminAuth";
import { flattenPaymentsForInvoices } from "../../../../lib/paymentTransactions";

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

    const paymentRows = flattenPaymentsForInvoices(paidInvoices);

    const enriched = paymentRows.map((payment) => {
      const invoice = payment.invoice || {};
      const owner = invoice.ownerId ? usersById[invoice.ownerId] : null;
      const status = payment.status || invoice.status || "Paid";
      const normalizedStatus = String(status || "").toLowerCase();
      const paidAmount = parseMoney(payment.amount);

      return {
        ...invoice,
        _id: payment.id,
        invoiceId: invoice._id,
        transactionId: payment.transactionId,
        ownerBusinessName: owner?.businessName || invoice.businessName || "-",
        ownerEmail: owner?.email || "",
        customerDisplayName:
          invoice.customer || invoice.customerName || invoice.student || "Customer",
        description:
          invoice.description || invoice.category || invoice.class || "Invoice payment",
        paidAmount,
        paymentProvider:
          payment.paymentProvider ||
          payment.provider ||
          invoice.paymentProvider ||
          invoice.pendingPaymentProvider ||
          "Manual",
        paymentReference: payment.paymentReference || payment.reference || "-",
        paymentStatus:
          payment.paymentStatus ||
          (normalizedStatus === "paid"
            ? "paid"
            : normalizedStatus.includes("partial")
              ? "partial"
              : invoice.paymentStatus || "paid"),
        customerNotificationStatus:
          payment.notificationStatus === "pending-whatsapp" ||
          invoice.customerNotificationStatus === "pending-whatsapp"
            ? "prepared"
            : payment.notificationStatus ||
              invoice.customerNotificationStatus ||
              "draft",
        happenedAt: payment.happenedAt,
      };
    }).sort((a, b) => {
      const aTime = a.happenedAt ? new Date(a.happenedAt).getTime() : 0;
      const bTime = b.happenedAt ? new Date(b.happenedAt).getTime() : 0;

      return bTime - aTime;
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
