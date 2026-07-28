import { ObjectId } from "mongodb";
import { connectDB } from "../../../../../../lib/mongodb";
import { findAccessibleInvoice } from "../../../../../../lib/publicInvoiceAccess";
import { buildPaymentReceiptPdf } from "../../../../../../lib/paymentReceiptPdf";

function findPayment(invoice = {}, reference = "") {
  const transactions = Array.isArray(invoice.paymentTransactions)
    ? invoice.paymentTransactions
    : [];
  const normalizedReference = String(reference || "").trim();

  if (normalizedReference) {
    return transactions.find(
      (transaction) =>
        String(transaction.reference || transaction.paymentReference || "") ===
        normalizedReference
    );
  }

  return transactions[transactions.length - 1] || null;
}

export async function GET(req, context) {
  try {
    const { token } = await context.params;
    const db = await connectDB();
    const invoice = await findAccessibleInvoice(db, { token });

    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    const reference = new URL(req.url).searchParams.get("reference") || "";
    const payment = findPayment(invoice, reference);
    const invoiceReference = String(invoice.paymentReference || "");
    const referenceMatchesInvoice = reference && reference === invoiceReference;
    const hasRecordedPayment =
      payment ||
      referenceMatchesInvoice ||
      Number(invoice.paidAmount || invoice.amountPaid || 0) > 0;

    if (!hasRecordedPayment) {
      return Response.json({ error: "No confirmed payment was found" }, { status: 404 });
    }

    let owner = {};
    if (invoice.ownerId && ObjectId.isValid(String(invoice.ownerId))) {
      owner = await db.collection("users").findOne({
        _id: new ObjectId(String(invoice.ownerId)),
      });
    }

    const paymentReference =
      payment?.reference ||
      payment?.paymentReference ||
      reference ||
      invoice.paymentReference ||
      "";
    const pdfBuffer = buildPaymentReceiptPdf({
      invoice: {
        ...invoice,
        paidAt: payment?.paidAt || payment?.paymentConfirmedAt || invoice.paidAt,
        paymentProvider:
          payment?.provider || payment?.paymentProvider || invoice.paymentProvider,
      },
      owner,
      amount: payment?.amount || invoice.paidAmount || invoice.amountPaid || invoice.amount,
      paymentReference,
    });
    const safeInvoiceNumber = String(invoice.invoiceNumber || invoice._id || "receipt")
      .replace(/[^a-zA-Z0-9._-]/g, "-");

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="payment-receipt-${safeInvoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("PAYMENT RECEIPT PDF ERROR:", error);
    return Response.json(
      { error: error.message || "Unable to generate payment receipt" },
      { status: error.status || 500 }
    );
  }
}