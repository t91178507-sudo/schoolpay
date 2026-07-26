import { ObjectId } from "mongodb";
import { connectDB } from "../../../../lib/mongodb";
import { requireSchoolReceiptAccess } from "../../../../lib/receiptAccess";
import {
  approveReceiptUpload,
  decryptReceiptBuffer,
  logReceiptAudit,
  rejectReceiptUpload,
} from "../../../../lib/receiptUploads";

function getIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    ""
  );
}

function safeReceipt(receipt) {
  const safe = { ...receipt };
  delete safe.encryptedData;
  delete safe.iv;
  delete safe.tag;

  return { ...safe, _id: String(receipt._id) };
}

export async function GET(req, context) {
  try {
    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid receipt id" }, { status: 400 });
    }

    const db = await connectDB();
    const access = await requireSchoolReceiptAccess(req, db, {
      permission: "payments.validateReceipts",
    });
    const userId = access.user._id;
    const ownerId = access.ownerId;
    const receipt = await db.collection("receiptUploads").findOne({
      _id: new ObjectId(id),
      ownerId,
    });

    if (!receipt) {
      return Response.json({ error: "Receipt not found" }, { status: 404 });
    }

    const invoice = ObjectId.isValid(receipt.invoiceId)
      ? await db.collection("invoices").findOne({
          _id: new ObjectId(receipt.invoiceId),
          ownerId,
        })
      : null;

    await logReceiptAudit(db, {
      ownerId,
      receiptId: receipt._id,
      invoiceId: receipt.invoiceId,
      userId,
      ipAddress: getIp(req),
      action: "Receipt Viewed",
    });

    return Response.json({
      receipt: safeReceipt(receipt),
      invoice,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load receipt" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(req, context) {
  try {
    const { id } = await context.params;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid receipt id" }, { status: 400 });
    }

    const db = await connectDB();
    const access = await requireSchoolReceiptAccess(req, db, {
      permission: "payments.validateReceipts",
    });
    const userId = access.user._id;
    const ownerId = access.ownerId;
    const receipt = await db.collection("receiptUploads").findOne({
      _id: new ObjectId(id),
      ownerId,
    });

    if (!receipt) {
      return Response.json({ error: "Receipt not found" }, { status: 404 });
    }

    if (action === "approve") {
      const invoice = await approveReceiptUpload(db, receipt, {
        userId,
        ipAddress: getIp(req),
      });

      return Response.json({ success: true, status: "approved", invoice });
    }

    if (action === "reject") {
      const rejection = await rejectReceiptUpload(db, receipt, {
        userId,
        ipAddress: getIp(req),
        reason: String(body.reason || "Receipt rejected"),
      });

      return Response.json({
        success: true,
        status: "rejected",
        notification: rejection.notification,
      });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to update receipt" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req, context) {
  try {
    const { id } = await context.params;

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid receipt id" }, { status: 400 });
    }

    const db = await connectDB();
    const access = await requireSchoolReceiptAccess(req, db, {
      permission: "payments.validateReceipts",
    });
    const ownerId = access.ownerId;
    const receipt = await db.collection("receiptUploads").findOne({
      _id: new ObjectId(id),
      ownerId,
    });

    if (!receipt) {
      return Response.json({ error: "Receipt not found" }, { status: 404 });
    }

    const buffer = decryptReceiptBuffer(receipt);

    return new Response(buffer, {
      headers: {
        "Content-Type": receipt.fileType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${receipt.fileName || "receipt"}"`,
      },
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to open receipt" },
      { status: error.status || 500 }
    );
  }
}
