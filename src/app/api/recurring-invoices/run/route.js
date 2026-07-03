import { requireAuth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/mongodb";
import { processDueRecurringInvoices } from "../../../../lib/recurringInvoices";

function getBearerToken(req) {
  const header = req.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

function readCronSecret(req) {
  return req.headers.get("x-cron-secret") || getBearerToken(req);
}

function resolveOrigin(req) {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return new URL(req.url).origin;
}

async function runRecurringInvoices(req) {
  try {
    const db = await connectDB();
    const cronSecret = process.env.CRON_SECRET || "";
    let ownerId = "";

    if (cronSecret && readCronSecret(req) === cronSecret) {
      ownerId = "";
    } else {
      ownerId = requireAuth(req);
    }

    const results = await processDueRecurringInvoices(db, {
      ownerId,
      now: new Date(),
      origin: resolveOrigin(req),
    });
    const generatedCount = results.filter((result) => !result.skipped).length;
    const skippedCount = results.length - generatedCount;

    return Response.json({
      success: true,
      processedCount: results.length,
      generatedCount,
      skippedCount,
      results,
    });
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to run recurring invoices" },
      { status }
    );
  }
}

export async function GET(req) {
  return runRecurringInvoices(req);
}

export async function POST(req) {
  return runRecurringInvoices(req);
}
