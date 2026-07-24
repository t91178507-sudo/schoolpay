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
import { markInvoiceNotificationPrepared } from "../../../../lib/paymentLifecycle";
import {
  ensureQuickPayPaidInvoice,
  resolveGatewayCustomerName,
} from "../../../../lib/quickPay";
import { deliverPaymentConfirmation } from "../../../../lib/whatsappNotifications";

export async function POST(req) {
  try {
    const db = await connectDB();
    const body = await req.json();
    const profileToken = body.profileToken;
    const paymentReference = body.paymentReference;

    if (!profileToken || !paymentReference) {
      return Response.json(
        { error: "profileToken and paymentReference are required" },
        { status: 400 }
      );
    }

    const transaction = await db.collection("quickPayTransactions").findOne({
      profileToken,
      paymentReference,
    });

    if (!transaction) {
      return Response.json({ error: "Quick payment transaction not found" }, { status: 404 });
    }

    const owner = transaction.ownerId ? await findUserById(db, transaction.ownerId) : null;
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
      environment: monnifyConfig.environment,
    });

    const amountPaid = parseAmount(verification.amountPaid);
    const expectedAmount = parseAmount(transaction.amount);

    if (verification.paymentStatus !== "PAID") {
      return Response.json(
        { error: `Payment is not complete yet. Status: ${verification.paymentStatus}` },
        { status: 409 }
      );
    }

    if (amountPaid !== expectedAmount) {
      return Response.json(
        { error: `Amount mismatch. Paid: ${amountPaid}. Expected: ${expectedAmount}.` },
        { status: 409 }
      );
    }

    const resolvedCustomerName = resolveGatewayCustomerName(
      verification,
      transaction.customerName || transaction.customerPhone || "Customer"
    );

    const enrichedTransaction =
      resolvedCustomerName && resolvedCustomerName !== transaction.customerName
        ? {
            ...transaction,
            customerName: resolvedCustomerName,
          }
        : transaction;

    if (resolvedCustomerName && resolvedCustomerName !== transaction.customerName) {
      await db.collection("quickPayTransactions").updateOne(
        { _id: transaction._id },
        {
          $set: {
            customerName: resolvedCustomerName,
          },
        }
      );
    }

    const invoice = await ensureQuickPayPaidInvoice(db, enrichedTransaction, {
      paymentReference,
      paidAmount: amountPaid,
      paidAt: verification.paidOn ? new Date(verification.paidOn) : new Date(),
    });
    const customerPhone = transaction.customerPhone
      ? toWhatsAppNumber(transaction.customerPhone)
      : "";

    if (customerPhone) {
      await markInvoiceNotificationPrepared(db, invoice._id, "prepared");
      try {
        await deliverPaymentConfirmation({
          db,
          invoice,
          owner,
          amount: amountPaid,
        });
      } catch (notificationError) {
        console.error("MONNIFY QR PAYMENT CONFIRMATION SEND ERROR:", notificationError);
      }
    }

    return Response.json({
      success: true,
      paymentReference,
      invoice: {
        customerName: resolvedCustomerName || "Customer",
        customerPhone,
        businessName: transaction.businessName || owner?.businessName || "",
        invoiceNumber: invoice.invoiceNumber || "",
        invoiceId: String(invoice._id),
        description: invoice.description || "QR payment",
        amount: amountPaid,
      },
      paymentConfirmationMessage: buildPaymentConfirmationMessage({
        businessName: transaction.businessName || owner?.businessName || "",
        invoiceNumber: invoice.invoiceNumber || "",
        customerName: resolvedCustomerName || "Customer",
        amount: amountPaid,
        description: invoice.description || "QR payment",
      }),
    });
  } catch (error) {
    console.error("MONNIFY QR VERIFY ERROR:", error);
    return Response.json(
      { error: error.message || "Unable to verify quick payment" },
      { status: 500 }
    );
  }
}

