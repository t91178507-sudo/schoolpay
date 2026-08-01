function parseMoney(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function getInvoicePaymentTransactionList(invoice = {}) {
  return [
    ...(Array.isArray(invoice.paymentTransactions)
      ? invoice.paymentTransactions
      : []),
    ...(Array.isArray(invoice.transactions) ? invoice.transactions : []),
    ...(Array.isArray(invoice.payments) ? invoice.payments : []),
    ...(Array.isArray(invoice.paymentHistory) ? invoice.paymentHistory : []),
  ];
}

export function getPaymentTransactionAmount(transaction = {}) {
  return parseMoney(
    transaction.amount ||
      transaction.paidAmount ||
      transaction.amountPaid ||
      transaction.totalPaid ||
      transaction.value ||
      0
  );
}

export function getPaymentTransactionDate(transaction = {}, invoice = {}) {
  return (
    transaction.paidAt ||
    transaction.paymentConfirmedAt ||
    transaction.confirmedAt ||
    transaction.completedAt ||
    transaction.createdAt ||
    transaction.date ||
    invoice.paidAt ||
    invoice.paymentConfirmedAt ||
    invoice.pendingPaymentCreatedAt ||
    invoice.date ||
    invoice.createdAt
  );
}

export function getPaymentTransactionReference(transaction = {}, invoice = {}) {
  return (
    transaction.reference ||
    transaction.paymentReference ||
    transaction.transactionReference ||
    transaction.transactionId ||
    transaction.gatewayReference ||
    transaction.providerReference ||
    invoice.paymentReference ||
    invoice.pendingPaymentReference ||
    invoice.invoiceNumber ||
    "-"
  );
}

export function getPaymentTransactionProvider(
  transaction = {},
  invoice = {},
  source = "invoice"
) {
  return (
    transaction.provider ||
    transaction.paymentProvider ||
    transaction.gateway ||
    transaction.channel ||
    invoice.paymentProvider ||
    invoice.pendingPaymentProvider ||
    (source === "qr" ? "Monnify" : "Manual")
  );
}

export function getPaymentTransactionStatus(transaction = {}, invoice = {}) {
  return transaction.status || transaction.paymentStatus || invoice.status || "Paid";
}

export function getPaymentNotificationStatus(transaction = {}, invoice = {}) {
  const invoiceStatus =
    String(invoice.lastReminderOutcome || "").toLowerCase() === "sent"
      ? "sent"
      : invoice.customerNotificationStatus;

  return (
    transaction.notificationStatus ||
    transaction.customerNotificationStatus ||
    invoiceStatus ||
    "pending"
  );
}

export function buildPaymentTransactionId({
  reference = "",
  invoiceId = "",
  happenedAt = "",
  index = 0,
} = {}) {
  const date = happenedAt ? new Date(happenedAt) : null;
  const datePart =
    date && !Number.isNaN(date.getTime())
      ? date.toISOString().slice(0, 10).replaceAll("-", "")
      : "00000000";
  const seed = String(reference || invoiceId || "AUTO")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-8)
    .toUpperCase();

  return `TXN-${datePart}-${String(index + 1).padStart(2, "0")}${
    seed || "AUTO"
  }`;
}

export function flattenInvoicePaymentTransactions(invoice = {}, indexOffset = 0) {
  const status = String(invoice.status || invoice.paymentStatus || "").toLowerCase();
  const isPaidInvoice = ["paid", "partially paid", "partial"].includes(status);

  if (!isPaidInvoice) {
    return [];
  }

  const source = invoice.quickPayProfileId ? "qr" : "invoice";
  const transactionList = getInvoicePaymentTransactionList(invoice);
  const validTransactions = transactionList.filter(
    (transaction) => getPaymentTransactionAmount(transaction) > 0
  );

  if (validTransactions.length > 0) {
    return validTransactions.map((transaction, index) => {
      const amount = getPaymentTransactionAmount(transaction);
      const happenedAt = getPaymentTransactionDate(transaction, invoice);
      const reference = getPaymentTransactionReference(transaction, invoice);

      return {
        rawTransaction: transaction,
        invoice,
        invoiceId: invoice._id,
        id: `payment-${invoice._id}-${reference}-${indexOffset + index}`,
        transactionId:
          transaction.transactionId ||
          buildPaymentTransactionId({
            reference,
            invoiceId: invoice._id,
            happenedAt,
            index: indexOffset + index,
          }),
        amount,
        paidAmount: amount,
        happenedAt,
        reference,
        paymentReference: reference,
        provider: getPaymentTransactionProvider(transaction, invoice, source),
        paymentProvider: getPaymentTransactionProvider(transaction, invoice, source),
        status: getPaymentTransactionStatus(transaction, invoice),
        notificationStatus: getPaymentNotificationStatus(transaction, invoice),
        source,
      };
    });
  }

  const amount = parseMoney(invoice.paidAmount || invoice.amountPaid || 0);

  if (amount <= 0) {
    return [];
  }

  const happenedAt =
    invoice.paidAt ||
    invoice.paymentConfirmedAt ||
    invoice.pendingPaymentCreatedAt ||
    invoice.date ||
    invoice.createdAt;
  const reference =
    invoice.paymentReference ||
    invoice.pendingPaymentReference ||
    invoice.invoiceNumber ||
    "-";

  return [
    {
      rawTransaction: null,
      invoice,
      invoiceId: invoice._id,
      id: `invoice-${invoice._id}`,
      transactionId: buildPaymentTransactionId({
        reference,
        invoiceId: invoice._id,
        happenedAt,
        index: indexOffset,
      }),
      amount,
      paidAmount: amount,
      happenedAt,
      reference,
      paymentReference: reference,
      provider: getPaymentTransactionProvider({}, invoice, source),
      paymentProvider: getPaymentTransactionProvider({}, invoice, source),
      status: invoice.status || "Paid",
      notificationStatus: getPaymentNotificationStatus({}, invoice),
      source,
    },
  ];
}

export function flattenPaymentsForInvoices(invoices = []) {
  return invoices.flatMap((invoice, index) =>
    flattenInvoicePaymentTransactions(invoice, index)
  );
}
