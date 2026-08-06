import { requireAdmin } from "../../../../../lib/adminAuth";
import {
  ensureBusinessUnitWallet,
  getBusinessUnitSummary,
  recordUnitTransaction,
} from "../../../../../lib/billingService";
import { connectDB } from "../../../../../lib/mongodb";

export async function GET(req) {
  try {
    requireAdmin(req);
    const db = await connectDB();
    const { searchParams } = new URL(req.url);
    const ownerId = String(searchParams.get("ownerId") || "").trim();

    if (!ownerId) {
      return Response.json({ error: "Business owner is required." }, { status: 400 });
    }

    return Response.json(await getBusinessUnitSummary(db, { ownerId }));
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load unit wallet." },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req) {
  try {
    requireAdmin(req);
    const db = await connectDB();
    const body = await req.json();
    const ownerId = String(body.ownerId || "").trim();
    const type = String(body.type || "").trim().toLowerCase();
    const units = Number(body.units || 0);
    const reason = String(body.reason || "").trim();
    const businessName = String(body.businessName || "").trim();
    const businessId = String(body.businessId || "").trim();

    if (!ownerId || !["credit", "debit"].includes(type) || !units || units < 1) {
      return Response.json(
        { error: "Select a business, transaction type, and unit amount." },
        { status: 400 }
      );
    }

    await ensureBusinessUnitWallet(db, { ownerId, businessId, businessName });
    const result = await recordUnitTransaction(db, {
      ownerId,
      businessId,
      businessName,
      type,
      units,
      reason: reason || (type === "credit" ? "Admin credit" : "Admin debit"),
      createdBy: "InvoiceHub Admin",
    });

    const summary = await getBusinessUnitSummary(db, { ownerId, businessId });

    return Response.json({
      success: true,
      wallet: result.wallet,
      transaction: result.transaction,
      summary,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to update unit wallet." },
      { status: error.status || 500 }
    );
  }
}
