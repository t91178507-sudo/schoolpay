import { connectDB } from "../../../lib/mongodb";
import { requireAuth } from "../../../lib/auth";
import { generateInvoiceToken } from "../../../lib/invoiceUtils";

export async function GET(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();

    const invoices = await db
      .collection("invoices")
      .find({ ownerId: userId })
      .sort({ createdAt: -1, date: -1 })
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
      paidAmount: Number(body.paidAmount || 0),
      balanceDue: Math.max(
        Number(body.amount || 0) - Number(body.paidAmount || 0),
        0
      ),
      paymentStatus: body.paymentStatus || "unpaid",
      customerNotificationStatus:
        body.customerNotificationStatus || (body.phone ? "draft" : "unavailable"),
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
