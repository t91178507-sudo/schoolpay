import { connectDB } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/adminAuth";

export async function GET(req) {
  try {
    requireAdmin(req);

    const db = await connectDB();

    const users = await db
      .collection("users")
      .find({}, { projection: { password: 0 } })
      .toArray();

    const [customers, invoices] = await Promise.all([
      db.collection("customers").find({}).toArray(),
      db.collection("invoices").find({}).toArray(),
    ]);

    const businesses = users.map((user) => {
      const userId = user._id.toString();

      const ownedCustomers = customers.filter(
        (c) => c.ownerId === userId
      );
      const ownedInvoices = invoices.filter(
        (inv) => inv.ownerId === userId
      );

      const revenue = ownedInvoices.reduce(
        (sum, inv) => sum + Number(inv.amount || 0),
        0
      );

      return {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        businessName: user.businessName,
        businessType: user.businessType,
        createdAt: user.createdAt,
        customerCount: ownedCustomers.length,
        invoiceCount: ownedInvoices.length,
        revenue,
      };
    });

    return Response.json(businesses);

  } catch (error) {
    console.error("ADMIN BUSINESSES ERROR:", error);
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Server error" },
      { status }
    );
  }
}