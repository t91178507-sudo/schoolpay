import { requireAccessContext } from "../../../../lib/accessControl";
import { connectDB } from "../../../../lib/mongodb";

export async function GET(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db);

    return Response.json({
      staffName: context.user.fullName || "",
      role: context.user.roleName || context.user.role || "",
      permissions: context.user.permissions || {},
      assignedBusinesses: context.businesses
        .filter(
          (business) =>
            context.user.accountType !== "staff" ||
            context.assignedAllBusinesses ||
            context.assignedBusinessIds.includes(business._id)
        )
        .map((business) => ({
          _id: business._id,
          name: business.name || "",
          type: business.type || "",
        })),
      accountType: context.user.accountType || "owner",
      email: context.user.email || "",
      phoneNumber: context.user.phoneNumber || "",
      username: context.user.username || "",
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load profile" },
      { status: error.status || 500 }
    );
  }
}
