import { ObjectId } from "mongodb";
import { connectDB } from "../../../lib/mongodb";
import { requireSchoolReceiptAccess } from "../../../lib/receiptAccess";

function serialize(receipt) {
  const safeReceipt = { ...receipt };
  delete safeReceipt.encryptedData;
  delete safeReceipt.iv;
  delete safeReceipt.tag;

  return {
    ...safeReceipt,
    _id: String(receipt._id),
  };
}

export async function GET(req) {
  try {
    const db = await connectDB();
    const access = await requireSchoolReceiptAccess(req, db);
    const userId = access.ownerId;
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const staleAnalysisThreshold = new Date(Date.now() - 2 * 60 * 1000);

    await db.collection("receiptUploads").updateMany(
      {
        ownerId: userId,
        analysisStatus: "processing",
        analysisStartedAt: { $lt: staleAnalysisThreshold },
      },
      {
        $set: {
          analysisStatus: "failed",
          analysisCompletedAt: new Date(),
          analysisError:
            "Automated reading took too long. Review the receipt manually.",
          updatedAt: new Date(),
        },
      }
    );

    const query = { ownerId: userId };

    if (status && status !== "all") {
      query.status = status;
    }

    const receipts = await db
      .collection("receiptUploads")
      .find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .toArray();

    const invoiceIds = receipts
      .map((receipt) => receipt.invoiceId)
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const invoices = invoiceIds.length
      ? await db
          .collection("invoices")
          .find({ ownerId: userId, _id: { $in: invoiceIds } })
          .toArray()
      : [];
    const invoiceById = new Map(
      invoices.map((invoice) => [String(invoice._id), invoice])
    );

    return Response.json(
      receipts.map((receipt) => ({
        ...serialize(receipt),
        invoice: invoiceById.get(receipt.invoiceId) || null,
      }))
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load receipts" },
      { status: error.status || 500 }
    );
  }
}
