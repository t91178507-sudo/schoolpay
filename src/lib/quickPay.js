import { ObjectId } from "mongodb";
import {
  generateInvoiceNumber,
  generateInvoiceToken,
} from "./invoiceUtils";

export function generateQuickPayToken() {
  return `qpay_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function buildQuickPayCustomerEmail(phone = "") {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) {
    return "quickpay@invoicehub.app";
  }

  return `quickpay${digits}@invoicehub.app`;
}

export function resolveGatewayCustomerName(verification = {}, fallback = "") {
  const candidates = [
    verification.customerName,
    verification.paidBy,
    verification.accountName,
    verification.payerName,
    verification.customer?.name,
    verification.customer?.fullName,
    verification.metaData?.customerName,
    verification.metadata?.customerName,
    fallback,
  ];

  const matched = candidates.find(
    (value) => typeof value === "string" && value.trim()
  );

  return matched ? matched.trim() : "";
}

export function normalizeQuickPayInput(body = {}, user = {}) {
  const amount = Number(body.amount || 0);
  const phone = String(body.customerPhone || "").trim();
  const customerName = String(body.customerName || phone || "").trim();

  return {
    token: body.token || generateQuickPayToken(),
    ownerId: body.ownerId || "",
    customerId: body.customerId || "",
    customerToken: body.customerToken || "",
    customerName,
    customerPhone: phone,
    customerEmail: body.customerEmail || buildQuickPayCustomerEmail(phone),
    businessName: body.businessName || user.businessName || "",
    businessLogo: body.businessLogo || user.businessLogo || "",
    description: (body.description || "").trim(),
    amount,
    gateway: body.gateway || "monnify",
    active: body.active !== false,
  };
}

export async function ensureQuickPayPaidInvoice(
  db,
  transaction,
  { paymentReference, paidAmount, paidAt }
) {
  if (transaction.invoiceId) {
    const existing = await db.collection("invoices").findOne({
      _id: new ObjectId(transaction.invoiceId),
    });

    if (existing) {
      return existing;
    }
  }

  const normalizedAmount = Number(paidAmount || transaction.amount || 0);
  const invoiceToken = generateInvoiceToken("inv");
  const customerDisplayName =
    transaction.customerName || transaction.customerPhone || "Customer";
  const invoice = {
    invoiceNumber: generateInvoiceNumber(),
    customer: customerDisplayName,
    customerName: customerDisplayName,
    category: "QR Payment",
    description: transaction.description || "QR payment",
    items: [
      {
        id: "item-1",
        description: transaction.description || "QR payment",
        quantity: 1,
        unitPrice: normalizedAmount,
        lineTotal: normalizedAmount,
      },
    ],
    subtotal: normalizedAmount,
    email: transaction.customerEmail || "",
    amount: normalizedAmount,
    status: "Paid",
    token: invoiceToken,
    customerToken: transaction.customerToken || transaction.profileToken || invoiceToken,
    phone: transaction.customerPhone || "",
    businessName: transaction.businessName || "",
    businessLogo: transaction.businessLogo || "",
    ownerId: transaction.ownerId || "",
    date: paidAt || new Date(),
    paidAt: paidAt || new Date(),
    paidAmount: normalizedAmount,
    paymentReference,
    paymentProvider: transaction.paymentProvider || transaction.gateway || "Monnify",
    paymentVerificationMethod: "quick-pay",
    paymentStatus: "paid",
    paymentConfirmedAt: paidAt || new Date(),
    customerNotificationStatus: transaction.customerPhone ? "prepared" : "unavailable",
    customerNotificationQueuedAt: transaction.customerPhone ? paidAt || new Date() : null,
    createdAt: new Date(),
    quickPayProfileId: transaction.profileId || null,
    balanceDue: 0,
  };

  const result = await db.collection("invoices").insertOne(invoice);

  await db.collection("quickPayTransactions").updateOne(
    { _id: transaction._id },
    {
      $set: {
        customerName: customerDisplayName,
        invoiceId: String(result.insertedId),
        invoiceToken,
        status: "Paid",
        paidAt: paidAt || new Date(),
        paidAmount: normalizedAmount,
        paymentReference,
      },
    }
  );

  return {
    ...invoice,
    _id: result.insertedId,
  };
}
