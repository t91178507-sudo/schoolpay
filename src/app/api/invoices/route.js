import { connectDB } from "../../../lib/mongodb";
import { requireAuth } from "../../../lib/auth";
import {
  calculateInvoiceTotal,
  generateInvoiceNumber,
  generateInvoiceToken,
  sanitizeInvoiceItems,
} from "../../../lib/invoiceUtils";
import { findUserById } from "../../../lib/paymentGatewaySettings";

function isSchoolBusiness(user = {}) {
  return String(user.businessType || "").trim().toLowerCase() === "school";
}

function normalizeInvoiceForBusiness(body = {}, user = {}) {
  if (isSchoolBusiness(user)) {
    return body;
  }

  const firstItem = Array.isArray(body.items) ? body.items[0] || {} : {};
  const amount = Number(body.amount || body.subtotal || firstItem.unitPrice || 0);
  const description =
    String(body.description || firstItem.description || "Invoice payment").trim() ||
    "Invoice payment";
  const items = sanitizeInvoiceItems([
    {
      ...firstItem,
      description,
      quantity: 1,
      unitPrice: amount,
    },
  ]);
  const total = calculateInvoiceTotal(items);

  return {
    ...body,
    description,
    items,
    subtotal: total,
    amount: total,
  };
}

export async function GET(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();

    const invoices = await db
      .collection("invoices")
      .find({ ownerId: userId })
      .sort({ createdAt: -1, date: -1 })
      .toArray();

    return Response.json(invoices);
  } catch (error) {
    console.error("GET INVOICES ERROR:", error);

    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Server error" },
      { status }
    );
  }
}

export async function POST(req) {
  try {
    const userId = requireAuth(req);
    const db = await connectDB();
    const body = await req.json();
    const owner = await findUserById(db, userId);
    const normalizedBody = normalizeInvoiceForBusiness(body, owner || {});
    const invoiceToken = body.token || generateInvoiceToken("inv");
    const invoiceNumber = normalizedBody.invoiceNumber || generateInvoiceNumber();

    const result = await db.collection("invoices").insertOne({
      ...normalizedBody,
      invoiceNumber,
      token: invoiceToken,
      customerToken: normalizedBody.customerToken || invoiceToken,
      ownerId: userId,
      paidAmount: Number(normalizedBody.paidAmount || 0),
      balanceDue: Math.max(
        Number(normalizedBody.amount || 0) - Number(normalizedBody.paidAmount || 0),
        0
      ),
      paymentStatus: normalizedBody.paymentStatus || "unpaid",
      customerNotificationStatus:
        normalizedBody.customerNotificationStatus ||
        (normalizedBody.phone ? "draft" : "unavailable"),
      createdAt: new Date(),
    });

    return Response.json({
      success: true,
      insertedId: result.insertedId,
      invoiceNumber,
      token: invoiceToken,
    });
  } catch (error) {
    console.error("CREATE INVOICE ERROR:", error);

    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Server error" },
      { status }
    );
  }
}
