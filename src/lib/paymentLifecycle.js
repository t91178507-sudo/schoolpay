import { parseAmount } from "./monnify";

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

  if (
    paymentReference &&
    invoice.paymentReference === paymentReference &&
    parseAmount(invoice.paidAmount || 0) > 0
  ) {
    return invoice;
  }

  const normalizedPaidAt = paidAt ? new Date(paidAt) : new Date();
  const normalizedPaidAmount = parseAmount(paidAmount ?? invoice.amount ?? 0);
  const previousPaidAmount = parseAmount(invoice.paidAmount || 0);
  const invoiceTotal = parseAmount(invoice.amount || 0);
  const totalPaidAmount = Math.min(previousPaidAmount + normalizedPaidAmount, invoiceTotal);
  const balanceDue = Math.max(invoiceTotal - totalPaidAmount, 0);
  const isFullyPaid = balanceDue <= 0;
  const resolvedNotificationStatus =
    notificationStatus ||
    (isFullyPaid ? (invoice.phone ? "prepared" : "unavailable") : "draft");

  const nextState = {
    status: isFullyPaid ? "Paid" : "Partially Paid",
    paidAt: normalizedPaidAt,
    paidAmount: totalPaidAmount,
    paymentReference:
      paymentReference || invoice.paymentReference || invoice.pendingPaymentReference || null,
    paymentProvider: paymentProvider || invoice.paymentProvider || "Monnify",
    paymentVerificationMethod:
      verificationMethod || invoice.paymentVerificationMethod || "system",
    paymentStatus: isFullyPaid ? "paid" : "partial",
    paymentConfirmedAt: isFullyPaid ? normalizedPaidAt : invoice.paymentConfirmedAt || null,
    customerNotificationStatus: resolvedNotificationStatus,
    balanceDue,
  };

  if (resolvedNotificationStatus === "prepared") {
    nextState.customerNotificationQueuedAt = normalizedPaidAt;
  }

  await db.collection("invoices").updateOne(
    { _id: invoice._id },
    {
      $set: nextState,
      $unset: {
        pendingPaymentReference: "",
        pendingPaymentAmount: "",
        pendingPaymentProvider: "",
        pendingPaymentCreatedAt: "",
      },
    }
  );

  return {
    ...invoice,
    ...nextState,
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
      },
    }
  );
}
