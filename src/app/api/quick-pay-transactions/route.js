import { requireAuth } from "../../../lib/auth";
import { connectDB } from "../../../lib/mongodb";

export async function GET(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();

    const transactions = await db
      .collection("quickPayTransactions")
      .find({ ownerId: userId })
      .sort({ createdAt: -1 })
      .toArray();

    return Response.json(transactions);
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to load quick pay transactions" },
      { status }
    );
  }
}
