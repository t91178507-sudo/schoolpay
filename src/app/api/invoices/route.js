import { connectDB } from "../../../lib/mongodb";
import { requireAuth } from "../../../lib/auth";
import { generateInvoiceToken } from "../../../lib/invoiceUtils";

// ✅ GET ALL INVOICES — only the ones belonging to the logged-in user
export async function GET(req) {
  try {
    const userId = requireAuth(req);

    const db = await connectDB();

    const invoices = await db
      .collection("invoices")
      .find({ ownerId: userId })
      .toArray();

    return Response.json(invoices);

  } catch (error) {
    console.error("GET INVOICES ERROR:", error);

    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Server error" },
      { status }
    );
  }
}

// ✅ CREATE INVOICE — tagged with the logged-in user's ID
export async function POST(req) {
  try {
    const userId = requireAuth(req);

    const db = await connectDB();
    const body = await req.json();
    const invoiceToken = body.token || generateInvoiceToken("inv");

    const result = await db.collection("invoices").insertOne({
      ...body,
      token: invoiceToken,
      customerToken: body.customerToken || invoiceToken,
      ownerId: userId,
      createdAt: new Date(),
    });

    return Response.json({
      success: true,
      insertedId: result.insertedId,
      token: invoiceToken,
    });

  } catch (error) {
    console.error("CREATE INVOICE ERROR:", error);

    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Server error" },
      { status }
    );
  }
}
