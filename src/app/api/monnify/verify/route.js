import { ObjectId } from "mongodb";
import { connectDB } from "../../../../lib/mongodb";
import { parseAmount, verifyMonnifyTransaction } from "../../../../lib/monnify";

const MONNIFY_API_KEY = process.env.MONNIFY_API_KEY || "";
const MONNIFY_SECRET_KEY = process.env.MONNIFY_SECRET_KEY || "";

export async function POST(req) {
  try {
    if (!MONNIFY_API_KEY || !MONNIFY_SECRET_KEY) {
      return Response.json(
        { error: "Monnify verification is not configured" },
        { status: 500 }
      );
    }

    const db = await connectDB();
    const body = await req.json();
    const token = body.token;
    const invoiceId = body.invoiceId;
    const paymentReference = body.paymentReference;

    if (!token || !invoiceId || !paymentReference) {
      return Response.json(
        { error: "token, invoiceId and paymentReference are required" },
        { status: 400 }
      );
    }

    const invoice = await db.collection("invoices").findOne({
      _id: new ObjectId(invoiceId),
    });

    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.token !== token) {
      return Response.json(
        { error: "Invoice token mismatch" },
        { status: 409 }
      );
    }

    const verification = await verifyMonnifyTransaction({
      apiKey: MONNIFY_API_KEY,
      secretKey: MONNIFY_SECRET_KEY,
      paymentReference,
    });

    const amountPaid = parseAmount(verification.amountPaid);
    const expectedAmount = parseAmount(invoice.amount);

    if (verification.paymentStatus !== "PAID") {
      return Response.json(
        { error: `Payment is not complete yet. Status: ${verification.paymentStatus}` },
        { status: 409 }
      );
    }

    if (amountPaid !== expectedAmount) {
      return Response.json(
        {
          error: `Amount mismatch. Paid: ${amountPaid}. Expected: ${expectedAmount}.`,
        },
        { status: 409 }
      );
    }

    await db.collection("invoices").updateOne(
      { _id: invoice._id },
      {
        $set: {
          status: "Paid",
          paidAt: verification.paidOn ? new Date(verification.paidOn) : new Date(),
          paidAmount: amountPaid,
          paymentReference,
          paymentProvider: "Monnify",
          paymentVerificationMethod: "verify-api",
        },
        $unset: {
          pendingPaymentReference: "",
          pendingPaymentAmount: "",
          pendingPaymentProvider: "",
          pendingPaymentCreatedAt: "",
        },
      }
    );

    return Response.json({
      success: true,
      paymentStatus: verification.paymentStatus,
      paymentReference,
    });
  } catch (error) {
    console.error("MONNIFY VERIFY ERROR:", error);
    return Response.json(
      { error: error.message || "Unable to verify payment" },
      { status: 500 }
    );
  }
}
