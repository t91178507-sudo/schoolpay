import { connectDB } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/adminAuth";

// ✅ Platform-wide stats — deliberately NOT filtered by ownerId,
// since this is the whole point of the admin dashboard.
export async function GET(req) {
  try {
    requireAdmin(req);

    const db = await connectDB();

    const [totalBusinesses, totalCustomers, totalInvoices, allInvoices] =
      await Promise.all([
        db.collection("users").countDocuments(),
        db.collection("customers").countDocuments(),
        db.collection("invoices").countDocuments(),
        db.collection("invoices").find({}).toArray(),
      ]);

    const totalRevenue = allInvoices.reduce(
      (sum, inv) => sum + Number(inv.amount || 0),
      0
    );

    const paidInvoices = allInvoices.filter((inv) => inv.status === "Paid");
    const paidRevenue = paidInvoices.reduce(
      (sum, inv) => sum + Number(inv.amount || 0),
      0
    );

    return Response.json({
      totalBusinesses,
      totalCustomers,
      totalInvoices,
      totalRevenue,
      paidRevenue,
      paidCount: paidInvoices.length,
      unpaidCount: allInvoices.length - paidInvoices.length,
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