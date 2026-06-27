import { ObjectId } from "mongodb";
import { connectDB } from "../../../../lib/mongodb";
import { parseAmount } from "../../../../lib/monnify";
import {
  findUserById,
  resolveMonnifyConfig,
} from "../../../../lib/paymentGatewaySettings";

export async function POST(req) {
  try {
    const db = await connectDB();
    const body = await req.json();
    const token = body.token;
    const invoiceId = body.invoiceId;
    const requestedAmount = parseAmount(body.amount);

    if (!token || !invoiceId) {
      return Response.json(
        { error: "Token and invoiceId are required" },
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

    if (invoice.status === "Paid") {
      return Response.json(
        { error: "This invoice has already been paid" },
        { status: 409 }
      );
    }

    const invoiceAmount = parseAmount(invoice.amount);

    if (requestedAmount <= 0) {
      return Response.json(
        { error: "Enter a valid payment amount" },
        { status: 400 }
      );
    }

    if (requestedAmount > invoiceAmount) {
      return Response.json(
        {
          error: `Amount cannot be more than the invoice amount. Requested: ${requestedAmount}. Invoice: ${invoiceAmount}.`,
        },
        { status: 400 }
      );
    }

    const owner = invoice.ownerId
      ? await findUserById(db, invoice.ownerId)
      : null;
    const monnifyConfig = resolveMonnifyConfig(owner || {});

    if (!monnifyConfig.apiKey || !monnifyConfig.contractCode) {
      return Response.json(
        { error: "Monnify is not configured for this business" },
        { status: 500 }
      );
    }

    const paymentReference = `mnfy_${invoice.token}_${Date.now()}`;

    await db.collection("invoices").updateOne(
      { _id: invoice._id },
      {
        $set: {
          pendingPaymentReference: paymentReference,
          pendingPaymentAmount: requestedAmount,
          pendingPaymentProvider: "Monnify",
          pendingPaymentCreatedAt: new Date(),
        },
      }
    );

    return Response.json({
      checkoutConfig: {
        amount: requestedAmount,
        currency: "NGN",
        reference: paymentReference,
        customerFullName:
          invoice.customer || invoice.customerName || invoice.student || "Customer",
        customerEmail: invoice.email || "billing@invoicehub.app",
        apiKey: monnifyConfig.apiKey,
        contractCode: monnifyConfig.contractCode,
        paymentDescription:
          invoice.category || invoice.class || "Invoice payment",
      },
      invoiceId: String(invoice._id),
      paymentReference,
    });
  } catch (error) {
    console.error("MONNIFY CHECKOUT CONFIG ERROR:", error);
    return Response.json(
      { error: error.message || "Unable to prepare Monnify checkout" },
      { status: 500 }
    );
  }
}
