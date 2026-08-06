import { requireAuth } from "../../../../lib/auth";
import { getBusinessUnitSummary } from "../../../../lib/billingService";
import { connectDB } from "../../../../lib/mongodb";

export async function GET(req) {
  try {
    const ownerId = requireAuth(req);
    const db = await connectDB();

    return Response.json(await getBusinessUnitSummary(db, { ownerId }));
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load unit balance." },
      { status: error.status || 500 }
    );
  }
}
