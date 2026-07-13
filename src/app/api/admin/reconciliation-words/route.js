import { connectDB } from "../../../../lib/mongodb";
import { requireAdmin } from "../../../../lib/adminAuth";
import {
  processPendingCreditsForPhrase,
} from "../../../../lib/reconciliation";

function normalizePhrase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export async function GET(req) {
  try {
    requireAdmin(req);
    const db = await connectDB();

    const [pendingCredits, reviewedPhrases] = await Promise.all([
      db
        .collection("reconciliationPendingCredits")
        .find({ status: "pending" })
        .sort({ createdAt: -1 })
        .limit(500)
        .toArray(),
      db
        .collection("reconciliationCreditPhrases")
        .find({})
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(100)
        .toArray(),
    ]);

    const phraseMap = new Map();

    for (const credit of pendingCredits) {
      const phrase = credit.phrase || credit.phraseNormalized || "Unknown";
      const key = credit.phraseNormalized || normalizePhrase(phrase);
      const current = phraseMap.get(key) || {
        phrase,
        phraseNormalized: key,
        pendingCount: 0,
        totalAmount: 0,
        samples: [],
      };

      current.pendingCount += 1;
      current.totalAmount += Number(credit.transaction?.amount || 0);

      if (current.samples.length < 3) {
        current.samples.push({
          _id: String(credit._id),
          ownerId: credit.ownerId,
          bankName: credit.bankName || credit.transaction?.bankName || "",
          fileName: credit.fileName || "",
          date: credit.transaction?.transactionDate || "",
          amount: credit.transaction?.amount || 0,
          remarks: credit.transaction?.remarks || credit.transaction?.narration || "",
          reference: credit.transaction?.reference || "",
        });
      }

      phraseMap.set(key, current);
    }

    return Response.json({
      pending: [...phraseMap.values()],
      reviewed: reviewedPhrases,
    });
  } catch (error) {
    console.error("ADMIN RECONCILIATION WORDS GET ERROR:", error);

    return Response.json(
      { error: error.message || "Unable to load reconciliation words" },
      { status: error.status || 500 }
    );
  }
}

export async function PATCH(req) {
  try {
    const admin = requireAdmin(req);
    const db = await connectDB();
    const body = await req.json();
    const phrase = String(body.phrase || "").trim();
    const action = String(body.action || "").trim();
    const phraseNormalized = normalizePhrase(phrase);
    const now = new Date();

    if (!phraseNormalized) {
      return Response.json({ error: "Phrase is required." }, { status: 400 });
    }

    if (!["approve", "reject"].includes(action)) {
      return Response.json({ error: "Unsupported action." }, { status: 400 });
    }

    if (action === "approve") {
      await db.collection("reconciliationCreditPhrases").updateOne(
        { phraseNormalized },
        {
          $set: {
            phrase,
            phraseNormalized,
            status: "approved",
            reviewedAt: now,
            reviewedBy: admin?.role || "admin",
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true }
      );

      const processed = await processPendingCreditsForPhrase(db, phrase, {
        adminId: admin?.role || "admin",
      });

      return Response.json({
        success: true,
        phrase,
        status: "approved",
        processed,
      });
    }

    await db.collection("reconciliationCreditPhrases").updateOne(
      { phraseNormalized },
      {
        $set: {
          phrase,
          phraseNormalized,
          status: "rejected",
          reviewedAt: now,
          reviewedBy: admin?.role || "admin",
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      },
      { upsert: true }
    );

    const update = await db.collection("reconciliationPendingCredits").updateMany(
      {
        phraseNormalized,
        status: "pending",
      },
      {
        $set: {
          status: "rejected",
          rejectedAt: now,
          reviewedBy: admin?.role || "admin",
          updatedAt: now,
        },
      }
    );

    return Response.json({
      success: true,
      phrase,
      status: "rejected",
      rejectedCount: update.modifiedCount || 0,
    });
  } catch (error) {
    console.error("ADMIN RECONCILIATION WORDS PATCH ERROR:", error);

    return Response.json(
      { error: error.message || "Unable to update reconciliation word" },
      { status: error.status || 500 }
    );
  }
}
