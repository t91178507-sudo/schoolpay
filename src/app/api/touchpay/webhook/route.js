import { connectDB } from "../../../lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("Webhook received:", body);

    if (body.status !== "SUCCESS") {
      return Response.json({ success: true }); // Acknowledge even if not success
    }

    const db = await connectDB();

    // Update invoice using either 'customer' or 'student' field
    const result = await db.collection("invoices").updateOne(
      {
        $or: [
          { customer: body.customer_name },
          { student: body.customer_name },
          { token: body.token } // Better to use token if available
        ]
      },
      {
        $set: {
          status: "Paid",
          paidAt: new Date(),
          paymentReference: body.reference || body.transaction_id || null,
        }
      }
    );

    if (result.matchedCount === 0) {
      console.log("No matching invoice found for:", body.customer_name);
    } else {
      console.log(`✅ Invoice marked as Paid. Updated: ${result.modifiedCount}`);
    }

    return Response.json({ success: true });

  } catch (error) {
    console.error("Webhook Error:", error);
    return Response.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}