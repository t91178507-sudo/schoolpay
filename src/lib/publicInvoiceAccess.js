import { ObjectId } from "mongodb";

function normalizeId(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.toString === "function") return value.toString();
  return "";
}

export async function tokenCanAccessInvoice(db, invoice, token) {
  if (!invoice || !token) {
    return false;
  }

  if (invoice.token === token || invoice.customerToken === token) {
    return true;
  }

  const baseInvoice = await db.collection("invoices").findOne({ token });

  if (
    baseInvoice &&
    normalizeId(baseInvoice.ownerId) === normalizeId(invoice.ownerId) &&
    baseInvoice.customerToken &&
    baseInvoice.customerToken === invoice.customerToken
  ) {
    return true;
  }

  const customer = await db.collection("customers").findOne({ token });

  return Boolean(
    customer &&
      normalizeId(customer.ownerId) === normalizeId(invoice.ownerId) &&
      customer.token &&
      customer.token === invoice.customerToken
  );
}

export async function findAccessibleInvoice(db, { token, invoiceId }) {
  if (invoiceId && ObjectId.isValid(invoiceId)) {
    const invoice = await db.collection("invoices").findOne({
      _id: new ObjectId(invoiceId),
    });

    if (invoice && (await tokenCanAccessInvoice(db, invoice, token))) {
      return invoice;
    }

    return null;
  }

  return db.collection("invoices").findOne({ token });
}

export async function findAccessibleInvoiceGroup(db, token) {
  const baseInvoice = await db.collection("invoices").findOne({ token });

  if (baseInvoice) {
    const matchQuery = baseInvoice.customerToken
      ? {
          ownerId: baseInvoice.ownerId,
          customerToken: baseInvoice.customerToken,
        }
      : { _id: baseInvoice._id };

    const invoices = await db
      .collection("invoices")
      .find(matchQuery)
      .sort({ date: -1, createdAt: -1 })
      .toArray();

    return {
      baseInvoice,
      invoices,
      customerToken: baseInvoice.customerToken || "",
    };
  }

  const customer = await db.collection("customers").findOne({ token });

  if (!customer) {
    return null;
  }

  const invoices = await db
    .collection("invoices")
    .find({
      ownerId: customer.ownerId,
      customerToken: customer.token,
    })
    .sort({ date: -1, createdAt: -1 })
    .toArray();

  return {
    baseInvoice: invoices[0] || null,
    invoices,
    customer,
    customerToken: customer.token || "",
  };
}

export function serializePublicInvoice(invoice = {}) {
  const totalAmount = Number(invoice.amount || invoice.total || invoice.subtotal || 0);
  const paidAmount = Number(invoice.paidAmount || invoice.amountPaid || 0);
  const rawBalance = Number(invoice.balanceDue ?? totalAmount - paidAmount);
  const balanceDue = Number.isFinite(rawBalance) ? Math.max(rawBalance, 0) : 0;

  return {
    _id: normalizeId(invoice._id),
    invoiceNumber: invoice.invoiceNumber || "",
    amount: totalAmount,
    paidAmount,
    balanceDue,
    status: invoice.status || "Unpaid",
    paymentStatus: invoice.paymentStatus || "",
    customer: invoice.customer || invoice.customerName || invoice.student || "",
    customerName: invoice.customerName || invoice.customer || invoice.student || "",
    student: invoice.student || "",
    phone: invoice.phone || "",
    email: invoice.email || "",
    category: invoice.category || "",
    class: invoice.class || "",
    description: invoice.description || "",
    date: invoice.date || invoice.createdAt || null,
    dueDate: invoice.dueDate || null,
    businessName: invoice.businessName || "",
    businessLogo: invoice.businessLogo || "",
  };
}
