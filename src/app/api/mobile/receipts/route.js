import { ObjectId } from "mongodb";
import { buildScopedQuery, requireAccessContext } from "../../../../lib/accessControl";
import { logUserActivity } from "../../../../lib/activityLogs";
import { connectDB } from "../../../../lib/mongodb";
import { approveReceiptUpload, rejectReceiptUpload } from "../../../../lib/receiptUploads";

export async function GET(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db, {
      permission: "payments.validateReceipts",
    });
    const receipts = await db
      .collection("receiptUploads")
      .find(
        buildScopedQuery(context, {
          baseQuery: { status: "pending" },
        })
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();

    return Response.json(
      receipts.map((receipt) => ({
        ...receipt,
        _id: String(receipt._id),
      }))
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load receipts" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db, {
      permission: "payments.validateReceipts",
    });
    const body = await req.json();
    const receiptId = String(body.receiptId || "");
    const action = String(body.action || "");

    if (!ObjectId.isValid(receiptId)) {
      return Response.json({ error: "Invalid receipt id." }, { status: 400 });
    }

    const receipt = await db.collection("receiptUploads").findOne({
      _id: new ObjectId(receiptId),
      ownerId: context.ownerId,
    });

    if (!receipt) {
      return Response.json({ error: "Receipt not found." }, { status: 404 });
    }

    if (action === "approve") {
      const invoice = await approveReceiptUpload(db, receipt, {
        userId: context.user._id,
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
      });

      await logUserActivity(db, {
        ownerId: context.ownerId,
        actorUserId: context.user._id,
        actorName: context.user.fullName || context.user.email,
        actorAccountType: context.user.accountType,
        businessId: receipt.businessId || "",
        businessName: context.primaryBusiness?.name || "",
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
        device: req.headers.get("user-agent") || "",
        action: "Receipt Approved",
        description: `${context.user.fullName || "Staff"} approved a receipt upload.`,
      });

      return Response.json({ success: true, invoice });
    }

    if (action === "reject") {
      await rejectReceiptUpload(db, receipt, {
        userId: context.user._id,
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
        reason: String(body.reason || "Receipt rejected"),
      });

      await logUserActivity(db, {
        ownerId: context.ownerId,
        actorUserId: context.user._id,
        actorName: context.user.fullName || context.user.email,
        actorAccountType: context.user.accountType,
        businessId: receipt.businessId || "",
        businessName: context.primaryBusiness?.name || "",
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
        device: req.headers.get("user-agent") || "",
        action: "Receipt Rejected",
        description: `${context.user.fullName || "Staff"} rejected a receipt upload.`,
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to update receipt" },
      { status: error.status || 500 }
    );
  }
}
