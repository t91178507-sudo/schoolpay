import { connectDB } from "../../../../lib/mongodb";
import { parseAmount, verifyMonnifyTransaction } from "../../../../lib/monnify";
import {
  buildPaymentConfirmationMessage,
  toWhatsAppNumber,
} from "../../../../lib/invoiceUtils";
import {
  findUserById,
  resolveMonnifyConfig,
} from "../../../../lib/paymentGatewaySettings";
import { findAccessibleInvoice } from "../../../../lib/publicInvoiceAccess";
import {
  markInvoiceNotificationPrepared,
  markInvoicePaid,
} from "../../../../lib/paymentLifecycle";
import { deliverPaymentConfirmation } from "../../../../lib/whatsappNotifications";

export async function POST(req) {
  try {
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

    const invoice = await findAccessibleInvoice(db, { token, invoiceId });

    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    const owner = invoice.ownerId
      ? await findUserById(db, invoice.ownerId)
      : null;
    const monnifyConfig = resolveMonnifyConfig(owner || {});

    if (!monnifyConfig.apiKey || !monnifyConfig.secretKey) {
      return Response.json(
        { error: "Monnify verification is not configured for this business" },
        { status: 500 }
      );
    }

    const verification = await verifyMonnifyTransaction({
      apiKey: monnifyConfig.apiKey,
      secretKey: monnifyConfig.secretKey,
      paymentReference,
    });

    const amountPaid = parseAmount(verification.amountPaid);
    const expectedAmount = parseAmount(
      invoice.pendingPaymentAmount ?? invoice.amount
    );

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

    const paidInvoice = await markInvoicePaid(db, invoice, {
      paidAt: verification.paidOn ? new Date(verification.paidOn) : new Date(),
      paidAmount: amountPaid,
      paymentReference,
      paymentProvider: "Monnify",
      verificationMethod: "verify-api",
    });

    const customerName =
      paidInvoice.customer || paidInvoice.customerName || paidInvoice.student || "Customer";
    const customerPhone = paidInvoice.phone ? toWhatsAppNumber(paidInvoice.phone) : "";

    if (customerPhone) {
      await markInvoiceNotificationPrepared(db, invoice._id, "prepared");
      try {
        await deliverPaymentConfirmation({
          db,
          invoice: paidInvoice,
          owner,
          amount: amountPaid,
        });
      } catch (notificationError) {
        console.error("MONNIFY PAYMENT CONFIRMATION SEND ERROR:", notificationError);
      }
    }

    return Response.json({
      success: true,
      paymentStatus: verification.paymentStatus,
      paymentReference,
      invoice: {
        invoiceId: String(invoice._id),
        customerName,
        customerPhone,
        businessName: paidInvoice.businessName || owner?.businessName || "",
        invoiceNumber: paidInvoice.invoiceNumber || "",
        description:
          paidInvoice.description || paidInvoice.category || paidInvoice.class || "Invoice payment",
        amount: amountPaid,
      },
      paymentConfirmationMessage: buildPaymentConfirmationMessage({
        businessName: paidInvoice.businessName || owner?.businessName || "",
        invoiceNumber: paidInvoice.invoiceNumber || "",
        customerName,
        amount: amountPaid,
        description:
          paidInvoice.description ||
          paidInvoice.category ||
          paidInvoice.class ||
          "Invoice payment",
      }),
    });
  } catch (error) {
    console.error("MONNIFY VERIFY ERROR:", error);
    return Response.json(
      { error: error.message || "Unable to verify payment" },
      { status: 500 }
    );
  }
}
