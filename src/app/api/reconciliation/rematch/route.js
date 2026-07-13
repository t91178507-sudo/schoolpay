import { connectDB } from "../../../../lib/mongodb";
import { requireAuth } from "../../../../lib/auth";
import { findUserById } from "../../../../lib/paymentGatewaySettings";
import { rematchPendingReconciliationTransactions } from "../../../../lib/reconciliation";

export async function POST(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const owner = await findUserById(db, userId);
    const summary = await rematchPendingReconciliationTransactions(
      db,
      owner || { _id: userId }
    );

    return Response.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error("REMATCH RECONCILIATION ERROR:", error);
    return Response.json(
      { error: error.message || "Unable to rerun reconciliation" },
      { status: error.status || 500 }
    );
  }
}
