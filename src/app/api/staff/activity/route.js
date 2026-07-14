import { requireAccessContext } from "../../../../lib/accessControl";
import { fetchOwnerActivityLogs } from "../../../../lib/activityLogs";
import { connectDB } from "../../../../lib/mongodb";

export async function GET(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db, {
      permission: "settings.view",
    });
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 80);
    const actorUserId = searchParams.get("actorUserId") || "";
    const businessId = searchParams.get("businessId") || "";
    const logs = await fetchOwnerActivityLogs(db, context.ownerId, {
      limit,
      actorUserId,
      businessId,
    });

    return Response.json(
      logs.map((entry) => ({
        ...entry,
        _id: String(entry._id),
      }))
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load activity logs" },
      { status: error.status || 500 }
    );
  }
}
