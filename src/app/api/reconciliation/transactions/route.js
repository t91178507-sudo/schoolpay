import { ObjectId } from "mongodb";
import { connectDB } from "../../../../lib/mongodb";
import { requireAuth } from "../../../../lib/auth";
import { findUserById } from "../../../../lib/paymentGatewaySettings";
import {
  approveSuggestedTransaction,
  dedupeTransactionRecords,
  validateReviewedTransaction,
} from "../../../../lib/reconciliation";
import { deliverPaymentConfirmation } from "../../../../lib/whatsappNotifications";

export async function GET(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();

    const transactions = await db
      .collection("reconciliationTransactions")
      .find({ ownerId: userId })
      .sort({ createdAt: -1 })
      .limit(300)
      .toArray();

    return Response.json(dedupeTransactionRecords(transactions));
  } catch (error) {
    console.error("GET RECONCILIATION TRANSACTIONS ERROR:", error);

    return Response.json(
      { error: error.message || "Unable to load reconciliation transactions" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const owner = await findUserById(db, userId);

    const body = await req.json();
    const transactionId = String(body.transactionId || "");
    const action = String(body.action || "");

    if (!ObjectId.isValid(transactionId)) {
      return Response.json(
        { error: "Invalid transaction id" },
        { status: 400 }
      );
    }

    const transactionObjectId = new ObjectId(transactionId);

    const transaction = await db
      .collection("reconciliationTransactions")
      .findOne({
        _id: transactionObjectId,
        ownerId: userId,
      });

    if (!transaction) {
      return Response.json(
        { error: "Reconciliation transaction not found" },
        { status: 404 }
      );
    }

    if (action === "approve") {
      const invoice = await approveSuggestedTransaction(
        db,
        userId,
        transactionId
      );

      try {
        await deliverPaymentConfirmation({
          db,
          invoice,
          owner: owner || { _id: userId },
          amount: invoice.paidAmount || invoice.amount,
        });
      } catch (error) {
        console.error("RECONCILIATION APPROVAL WHATSAPP ERROR:", error);
      }

      return Response.json({
        success: true,
        invoice,
        message: "Suggested match approved and invoice updated.",
      });
    }

    if (action === "validate_review" || action === "validate_unmatched") {
      const result = await validateReviewedTransaction(
        db,
        owner || { _id: userId },
        transactionId
      );

      return Response.json({
        success: true,
        result,
        message:
          result.status === "matched"
            ? "Transaction validated and matched to an invoice."
            : "Transaction validated and moved to unmatched.",
      });
    }

    if (action === "reject") {
      await db.collection("reconciliationTransactions").updateOne(
        {
          _id: transactionObjectId,
          ownerId: userId,
        },
        {
          $set: {
            status: "rejected",
            rejectedAt: new Date(),
            updatedAt: new Date(),

            suggestedInvoiceId: null,
            suggestedInvoiceNumber: "",
            suggestedInvoiceToken: "",
            suggestedCustomer: "",
          },
        }
      );

      return Response.json({
        success: true,
        message: "Transaction rejected.",
      });
    }

    if (action === "ignore") {
      await db.collection("reconciliationTransactions").updateOne(
        {
          _id: transactionObjectId,
          ownerId: userId,
        },
        {
          $set: {
            status: "ignored",
            ignoredAt: new Date(),
            updatedAt: new Date(),

            suggestedInvoiceId: null,
            suggestedInvoiceNumber: "",
            suggestedInvoiceToken: "",
            suggestedCustomer: "",
          },
        }
      );

      return Response.json({
        success: true,
        message: "Transaction ignored.",
      });
    }

    return Response.json(
      { error: "Unsupported reconciliation action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("PATCH RECONCILIATION TRANSACTION ERROR:", error);

    return Response.json(
      { error: error.message || "Unable to update reconciliation transaction" },
      { status: error.status || 500 }
    );
  }
}
