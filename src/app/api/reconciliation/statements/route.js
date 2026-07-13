// app/api/reconciliation/statements/route.js

import { connectDB } from "../../../../lib/mongodb";
import { requireAuth } from "../../../../lib/auth";
import { findUserById } from "../../../../lib/paymentGatewaySettings";
import {
  getApprovedCreditPhrases,
  parseStatementFile,
  reconcileStatementTransactions,
  savePendingCreditCandidates,
} from "../../../../lib/reconciliation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function summarize(records = []) {
  return records.reduce(
    (summary, record) => {
      summary.imported += 1;

      const status = String(record.status || "").toLowerCase();

      if (status === "matched") summary.matched += 1;
      if (status === "suggested_match") summary.suggested += 1;

      if (
        [
          "overpayment",
          "underpayment",
          "pending_review",
          "split_pending",
          "duplicate",
          "duplicate_payment",
          "rejected",
        ].includes(status)
      ) {
        summary.manualReview += 1;
      }

      if (status === "unmatched") summary.unmatched += 1;

      if (status === "duplicate" || status === "duplicate_payment") {
        summary.duplicates += 1;
      }

      if (status === "ignored") {
        summary.ignored += 1;
      }

      return summary;
    },
    {
      imported: 0,
      matched: 0,
      suggested: 0,
      manualReview: 0,
      unmatched: 0,
      duplicates: 0,
      ignored: 0,
    }
  );
}

function getFormText(formData, keys, fallback = "") {
  for (const key of keys) {
    const value = formData.get(key);

    if (value !== null && value !== undefined) {
      const text = String(value).trim();

      if (text) {
        return text;
      }
    }
  }

  return fallback;
}

function getFormFile(formData) {
  const file = formData.get("file") || formData.get("statementFile");

  if (!file || typeof file.arrayBuffer !== "function") {
    return null;
  }

  return file;
}

export async function GET(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();

    const statements = await db
      .collection("reconciliationStatements")
      .find({ ownerId: userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return Response.json(statements);
  } catch (error) {
    console.error("GET RECONCILIATION STATEMENTS ERROR:", error);

    return Response.json(
      { error: error.message || "Unable to load statements" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req) {
  let db;
  let insertedStatementId;

  try {
    const userId = requireAuth(req);
    db = await connectDB();

    const owner = await findUserById(db, userId);
    const formData = await req.formData();

    const file = getFormFile(formData);

    const bankName = getFormText(
      formData,
      ["bankName", "bank"],
      "Uploaded bank"
    );

    const password = getFormText(
      formData,
      ["password", "pdfPassword"],
      ""
    );

    const statementPeriod = {
      startDate: getFormText(formData, ["startDate", "periodStart"], ""),
      endDate: getFormText(formData, ["endDate", "periodEnd"], ""),
    };

    if (!file) {
      return Response.json(
        { error: "Upload a bank statement file." },
        { status: 400 }
      );
    }

    const allowedTypes = [
      "text/csv",
      "application/pdf",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    const fileName = file.name || "statement";
    const fileType = file.type || "";
    const fileSize = file.size || 0;

    const fileExtension = fileName.split(".").pop()?.toLowerCase();

    const allowedExtensions = ["csv", "xls", "xlsx", "pdf"];

    if (
      fileExtension &&
      !allowedExtensions.includes(fileExtension) &&
      fileType &&
      !allowedTypes.includes(fileType)
    ) {
      return Response.json(
        {
          error:
            "Unsupported statement format. Upload a CSV, Excel, or PDF statement.",
        },
        { status: 400 }
      );
    }

    const now = new Date();

    const statement = {
      ownerId: userId,
      bankName,
      fileName,
      fileType,
      fileSize,
      statementPeriod,
      status: "processing",
      summary: null,
      importedCount: 0,
      error: "",
      createdAt: now,
      updatedAt: now,
    };

    const inserted = await db
      .collection("reconciliationStatements")
      .insertOne(statement);

    insertedStatementId = inserted.insertedId;

    const approvedCreditPhrases = await getApprovedCreditPhrases(db);
    const transactions = await parseStatementFile(file, bankName, {
      password,
      statementPeriod,
      allowedCreditPhrases: approvedCreditPhrases,
    });

    if (!Array.isArray(transactions)) {
      throw new Error("Statement parser returned an invalid transaction list.");
    }

    const records = await reconcileStatementTransactions(
      db,
      owner || { _id: userId, id: userId },
      transactions,
      {
        statementId: insertedStatementId,
        bankName,
        fileName,
      }
    );

    const summary = summarize(Array.isArray(records) ? records : []);
    const pendingCreditInsert = await savePendingCreditCandidates(
      db,
      userId,
      transactions.pendingCreditCandidates || [],
      {
        statementId: insertedStatementId,
        fileName,
        bankName,
      }
    );

    await db.collection("reconciliationStatements").updateOne(
      { _id: insertedStatementId },
      {
        $set: {
          status: "completed",
          summary: {
            ...summary,
            pendingCreditWords: pendingCreditInsert.insertedCount || 0,
          },
          importedCount: summary.imported,
          updatedAt: new Date(),
        },
      }
    );

    return Response.json({
      success: true,
      statementId: insertedStatementId,
      summary,
      transactions: records,
    });
  } catch (error) {
    console.error("UPLOAD RECONCILIATION STATEMENT ERROR:", error);

    if (db && insertedStatementId) {
      try {
        await db.collection("reconciliationStatements").updateOne(
          { _id: insertedStatementId },
          {
            $set: {
              status: "failed",
              error: error.message || "Unable to reconcile statement",
              updatedAt: new Date(),
            },
          }
        );
      } catch (updateError) {
        console.error(
          "FAILED TO UPDATE RECONCILIATION STATEMENT STATUS:",
          updateError
        );
      }
    }

    return Response.json(
      { error: error.message || "Unable to reconcile statement" },
      { status: error.status || 500 }
    );
  }
}
