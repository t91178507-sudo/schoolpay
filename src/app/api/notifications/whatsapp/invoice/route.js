import { ObjectId } from "mongodb";
import { requireAuth } from "../../../../../lib/auth";
import { connectDB } from "../../../../../lib/mongodb";
import { findUserById } from "../../../../../lib/paymentGatewaySettings";
import { deliverInvoiceMessage } from "../../../../../lib/whatsappNotifications";

export async function POST(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const body = await req.json();
    const invoiceId = body.invoiceId;
    const origin = body.origin;

    if (!invoiceId || !ObjectId.isValid(invoiceId)) {
      return Response.json({ error: "A valid invoiceId is required" }, { status: 400 });
    }

    if (!origin) {
      return Response.json({ error: "origin is required" }, { status: 400 });
    }

    const invoice = await db.collection("invoices").findOne({
      _id: new ObjectId(invoiceId),
      ownerId: userId,
    });

    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    const owner = await findUserById(db, userId);
    const result = await deliverInvoiceMessage({
      db,
      invoice,
      owner,
      origin,
    });

    return Response.json({
      success: true,
      delivery: result,
    });
  } catch (error) {
    console.error("WHATSAPP INVOICE SEND ERROR:", error);
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to send invoice notification" },
      { status }
    );
  }
}
