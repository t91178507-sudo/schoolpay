import { parseAmount } from "./monnify";

function generatePaymentTransactionId(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const time = String(date.getTime()).slice(-6);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `TXN-${year}${month}${day}-${time}${random}`;
}

export async function markInvoicePaid(
  db,
  invoice,
  {
    paymentReference,
    paidAmount,
    paidAt,
    paymentProvider = "Monnify",
    verificationMethod = "system",
    notificationStatus,
  } = {}
) {
  if (!invoice?._id) {
    throw new Error("Invoice is required");
  }

  const normalizedPaidAt = paidAt ? new Date(paidAt) : new Date();
  const normalizedPaidAmount = parseAmount(paidAmount ?? invoice.amount ?? 0);

  if (!normalizedPaidAmount || normalizedPaidAmount <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const existingTransactions = Array.isArray(invoice.paymentTransactions)
    ? invoice.paymentTransactions
    : [];

  const duplicateTransaction = paymentReference
    ? existingTransactions.some(
        (transaction) =>
          String(transaction.reference || transaction.paymentReference || "") ===
          String(paymentReference)
      )
    : false;

  if (duplicateTransaction) {
    return invoice;
  }

  const previousPaidAmount = parseAmount(
    invoice.paidAmount || invoice.amountPaid || 0
  );

  const invoiceTotal = parseAmount(
    invoice.amount || invoice.total || invoice.subtotal || 0
  );

  const totalPaidAmount = Math.min(
    previousPaidAmount + normalizedPaidAmount,
    invoiceTotal
  );

  const balanceDue = Math.max(invoiceTotal - totalPaidAmount, 0);
  const isFullyPaid = balanceDue <= 0;

  const resolvedNotificationStatus =
    notificationStatus ||
    (isFullyPaid ? (invoice.phone ? "prepared" : "unavailable") : "draft");

  const resolvedPaymentReference =
    paymentReference ||
    invoice.paymentReference ||
    invoice.pendingPaymentReference ||
    null;

  const resolvedPaymentProvider =
    paymentProvider || invoice.paymentProvider || "Monnify";

  const resolvedVerificationMethod =
    verificationMethod || invoice.paymentVerificationMethod || "system";

  const nextState = {
    status: isFullyPaid ? "Paid" : "Partially Paid",
    paidAt: normalizedPaidAt,
    paidAmount: totalPaidAmount,
    amountPaid: totalPaidAmount,
    paymentReference: resolvedPaymentReference,
    paymentProvider: resolvedPaymentProvider,
    paymentVerificationMethod: resolvedVerificationMethod,
    paymentStatus: isFullyPaid ? "paid" : "partial",
    paymentConfirmedAt: isFullyPaid
      ? normalizedPaidAt
      : invoice.paymentConfirmedAt || null,
    customerNotificationStatus: resolvedNotificationStatus,
    balanceDue,
    updatedAt: new Date(),
  };

  if (resolvedNotificationStatus === "prepared") {
    nextState.customerNotificationQueuedAt = normalizedPaidAt;
  }

  const paymentTransaction = {
    transactionId: generatePaymentTransactionId(normalizedPaidAt),
    amount: normalizedPaidAmount,
    reference: resolvedPaymentReference || "",
    paymentReference: resolvedPaymentReference || "",
    provider: resolvedPaymentProvider,
    paymentProvider: resolvedPaymentProvider,
    verificationMethod: resolvedVerificationMethod,
    status: "Paid",
    paymentStatus: "paid",
    notificationStatus: resolvedNotificationStatus || "pending",
    paidAt: normalizedPaidAt,
    paymentConfirmedAt: normalizedPaidAt,
    createdAt: new Date(),
  };

  await db.collection("invoices").updateOne(
    { _id: invoice._id },
    {
      $set: nextState,
      $push: {
        paymentTransactions: paymentTransaction,
      },
    }
  );

  return {
    ...invoice,
    ...nextState,
    paymentTransactions: [...existingTransactions, paymentTransaction],
  };
}

export async function markInvoiceNotificationPrepared(
  db,
  invoiceId,
  notificationStatus = "prepared"
) {
  await db.collection("invoices").updateOne(
    { _id: invoiceId },
    {
      $set: {
        customerNotificationStatus: notificationStatus,
        customerNotificationPreparedAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );
}
