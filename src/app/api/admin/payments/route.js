import { connectDB } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/adminAuth";

// ✅ There's no separate "payments" collection yet — every paid
// invoice IS a payment record. This treats Paid invoices as the
// platform's payments ledger.
export async function GET(req) {
  try {
    requireAdmin(req);

    const db = await connectDB();

    const [paidInvoices, users] = await Promise.all([
      db.collection("invoices").find({ status: "Paid" }).sort({ date: -1 }).toArray(),
      db.collection("users").find({}, { projection: { password: 0 } }).toArray(),
    ]);

    const usersById = {};
    users.forEach((u) => {
      usersById[u._id.toString()] = u;
    });

    const enriched = paidInvoices.map((inv) => ({
      ...inv,
      ownerBusinessName: inv.ownerId
        ? usersById[inv.ownerId]?.businessName || inv.businessName || "—"
        : inv.businessName || "—",
    }));

    const totalCollected = enriched.reduce(
      (sum, inv) => sum + Number(inv.amount || 0),
      0
    );

    return Response.json({
      payments: enriched,
      totalCollected,
      count: enriched.length,
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