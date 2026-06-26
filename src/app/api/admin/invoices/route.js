import { connectDB } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/adminAuth";

export async function GET(req) {
  try {
    requireAdmin(req);

    const db = await connectDB();

    const [invoices, users] = await Promise.all([
      db.collection("invoices").find({}).sort({ date: -1 }).toArray(),
      db.collection("users").find({}, { projection: { password: 0 } }).toArray(),
    ]);

    // Attach the owning business's name to each invoice for display
    const usersById = {};
    users.forEach((u) => {
      usersById[u._id.toString()] = u;
    });

    const enriched = invoices.map((inv) => ({
      ...inv,
      ownerBusinessName: inv.ownerId
        ? usersById[inv.ownerId]?.businessName || inv.businessName || "—"
        : inv.businessName || "—",
    }));

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