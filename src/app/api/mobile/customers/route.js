import { buildScopedQuery, getPreferredBusinessId, requireAccessContext } from "../../../../lib/accessControl";
import { logUserActivity } from "../../../../lib/activityLogs";
import { connectDB } from "../../../../lib/mongodb";

export async function GET(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db, {
      permission: "customers.view",
    });
    const customers = await db
      .collection("customers")
      .find(buildScopedQuery(context))
      .sort({ createdAt: -1 })
      .limit(250)
      .toArray();

    const normalizedCustomers = customers.map((customer) => ({
      ...customer,
      _id: String(customer._id),
      outstandingBalance: Number(customer.outstandingBalance || 0),
    }));

    await logUserActivity(db, {
      ownerId: context.ownerId,
      actorUserId: context.user._id,
      actorName: context.user.fullName || context.user.email,
      actorAccountType: context.user.accountType,
      businessId: getPreferredBusinessId(context, customers[0]?.businessId || ""),
      businessName: context.primaryBusiness?.name || "",
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
      device: req.headers.get("user-agent") || "",
      action: "Customers Viewed",
      description: `${context.user.fullName || "Staff"} opened the customer list.`,
    });

    return Response.json(normalizedCustomers);
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load customers" },
      { status: error.status || 500 }
    );
  }
}
