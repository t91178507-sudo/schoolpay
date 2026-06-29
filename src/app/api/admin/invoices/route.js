import { connectDB } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/adminAuth";

function parseMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function getOutstandingAmount(invoice) {
  const balanceDue = parseMoney(invoice.balanceDue);
  if (balanceDue > 0) return balanceDue;

  const total = parseMoney(invoice.amount);
  const paid = parseMoney(invoice.paidAmount);
  return Math.max(total - paid, 0);
}

export async function GET(req) {
  try {
    requireAdmin(req);

    const db = await connectDB();

    const [invoices, users] = await Promise.all([
      db.collection("invoices").find({}).sort({ date: -1 }).toArray(),
      db.collection("users").find({}, { projection: { password: 0 } }).toArray(),
    ]);

    const usersById = {};
    users.forEach((user) => {
      usersById[user._id.toString()] = user;
    });

    const enriched = invoices.map((invoice) => {
      const owner = invoice.ownerId ? usersById[invoice.ownerId] : null;
      const status = invoice.status || "Unpaid";
      const paidAmount = parseMoney(invoice.paidAmount || (status === "Paid" ? invoice.amount : 0));

      return {
        ...invoice,
        ownerBusinessName: owner?.businessName || invoice.businessName || "-",
        ownerEmail: owner?.email || "",
        customerDisplayName:
          invoice.customer || invoice.customerName || invoice.student || "Customer",
        description:
          invoice.description || invoice.category || invoice.class || "Invoice payment",
        paidAmount,
        balanceDue: getOutstandingAmount(invoice),
        paymentProvider:
          invoice.paymentProvider ||
          invoice.pendingPaymentProvider ||
          (invoice.quickPayProfileId ? "Monnify" : "Manual"),
        customerNotificationStatus:
          invoice.customerNotificationStatus === "pending-whatsapp"
            ? "prepared"
            : invoice.customerNotificationStatus || "draft",
      };
    });

    return Response.json(enriched);
  } catch (error) {
    console.error("ADMIN INVOICES ERROR:", error);
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Server error" },
      { status }
    );
  }
}
