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

    const [users, totalCustomers, totalInvoices, allInvoices] =
      await Promise.all([
        db.collection("users").find({}, { projection: { password: 0 } }).toArray(),
        db.collection("customers").countDocuments(),
        db.collection("invoices").countDocuments(),
        db.collection("invoices").find({}).toArray(),
      ]);

    const totalRevenue = allInvoices.reduce(
      (sum, invoice) => sum + parseMoney(invoice.amount),
      0
    );
    const paidInvoices = allInvoices.filter((invoice) => invoice.status === "Paid");
    const partialInvoices = allInvoices.filter(
      (invoice) => invoice.status === "Partially Paid"
    );
    const paidRevenue = paidInvoices.reduce(
      (sum, invoice) => sum + parseMoney(invoice.paidAmount || invoice.amount),
      0
    );
    const partialRevenue = partialInvoices.reduce(
      (sum, invoice) => sum + parseMoney(invoice.paidAmount),
      0
    );
    const outstandingRevenue = allInvoices.reduce(
      (sum, invoice) => sum + getOutstandingAmount(invoice),
      0
    );
    const preparedNotificationCount = allInvoices.filter((invoice) => {
      const status = String(invoice.customerNotificationStatus || "").toLowerCase();
      return status === "prepared" || status === "pending-whatsapp";
    }).length;
    const unavailableNotificationCount = allInvoices.filter(
      (invoice) =>
        String(invoice.customerNotificationStatus || "").toLowerCase() === "unavailable"
    ).length;
    const whatsappWebBusinesses = users.filter(
      (user) =>
        user.defaultWhatsAppProvider === "whatsappWeb" &&
        user.whatsappProviders?.whatsappWeb?.enabled === true
    ).length;
    const monnifyConfiguredBusinesses = users.filter((user) => {
      const gateway = user.paymentGateways?.monnify || {};
      return Boolean(gateway.enabled && gateway.apiKey && gateway.secretKey && gateway.contractCode);
    }).length;

    return Response.json({
      totalBusinesses: users.length,
      totalCustomers,
      totalInvoices,
      totalRevenue,
      paidRevenue,
      partialRevenue,
      collectedRevenue: paidRevenue + partialRevenue,
      outstandingRevenue,
      paidCount: paidInvoices.length,
      partialCount: partialInvoices.length,
      unpaidCount: allInvoices.filter(
        (invoice) => invoice.status !== "Paid" && invoice.status !== "Partially Paid"
      ).length,
      preparedNotificationCount,
      unavailableNotificationCount,
      whatsappWebBusinesses,
      monnifyConfiguredBusinesses,
    });
  } catch (error) {
    console.error("ADMIN STATS ERROR:", error);
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Server error" },
      { status }
    );
  }
}
