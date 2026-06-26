import { connectDB } from "../../../../lib/mongodb";
import { parseAmount } from "../../../../lib/monnify";

export async function POST(req) {
  try {
    const body = await req.json();
    const eventType = body?.eventType;
    const eventData = body?.eventData;

    if (eventType !== "SUCCESSFUL_TRANSACTION" || !eventData?.paymentReference) {
      return Response.json({ success: true });
    }

    const db = await connectDB();
    const invoice = await db.collection("invoices").findOne({
      pendingPaymentReference: eventData.paymentReference,
    });

    if (!invoice) {
      return Response.json({ success: true });
    }

    const amountPaid = parseAmount(eventData.amountPaid);
    const expectedAmount = parseAmount(invoice.amount);

    if (eventData.paymentStatus !== "PAID" || amountPaid !== expectedAmount) {
      return Response.json({ success: true });
    }

    await db.collection("invoices").updateOne(
      { _id: invoice._id },
      {
        $set: {
          status: "Paid",
          paidAt: new Date(),
          paidAmount: amountPaid,
          paymentReference: eventData.paymentReference,
          paymentProvider: "Monnify",
          paymentVerificationMethod: "webhook",
        },
        $unset: {
          pendingPaymentReference: "",
          pendingPaymentAmount: "",
          pendingPaymentProvider: "",
          pendingPaymentCreatedAt: "",
        },
      }
    );

    return Response.json({ success: true });
  } catch (error) {
    console.error("MONNIFY WEBHOOK ERROR:", error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
