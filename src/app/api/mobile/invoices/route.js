import { ObjectId } from "mongodb";
import {
  calculateInvoiceTotal,
  generateInvoiceNumber,
  generateInvoiceToken,
  sanitizeInvoiceItems,
} from "../../../../lib/invoiceUtils";
import {
  buildScopedQuery,
  getPreferredBusinessId,
  requireAccessContext,
} from "../../../../lib/accessControl";
import { logUserActivity } from "../../../../lib/activityLogs";
import { connectDB } from "../../../../lib/mongodb";

function formatCustomerName(customer = {}) {
  return (
    customer.name ||
    customer.customerName ||
    customer.student ||
    customer.fullName ||
    ""
  );
}

export async function GET(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db, {
      permission: "invoices.view",
    });
    const invoices = await db
      .collection("invoices")
      .find(buildScopedQuery(context))
      .sort({ createdAt: -1 })
      .limit(250)
      .toArray();

    return Response.json(
      invoices.map((invoice) => ({
        ...invoice,
        _id: String(invoice._id),
      }))
    );
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to load invoices" },
      { status: error.status || 500 }
    );
  }
}

export async function POST(req) {
  try {
    const db = await connectDB();
    const context = await requireAccessContext(req, db, {
      permission: "invoices.create",
    });
    const body = await req.json();
    const items = sanitizeInvoiceItems(body.items || []);
    const amount =
      items.length > 0
        ? calculateInvoiceTotal(items)
        : Number(body.amount || 0);

    if (!amount || amount <= 0) {
      return Response.json(
        { error: "Invoice amount must be greater than zero." },
        { status: 400 }
      );
    }

    const businessId = getPreferredBusinessId(context, body.businessId || "");
    const customerId = String(body.customerId || "");
    let customer = null;

    if (customerId) {
      customer = await db.collection("customers").findOne({
        _id: new ObjectId(customerId),
        ownerId: context.ownerId,
        businessId,
      });
    }

    const invoiceToken = generateInvoiceToken("inv");
    const invoice = {
      ownerId: context.ownerId,
      businessId,
      customerId: customerId || "",
      customerToken: customer?.token || invoiceToken,
      customer: formatCustomerName(customer) || String(body.customerName || "").trim(),
      customerName: formatCustomerName(customer) || String(body.customerName || "").trim(),
      phone: customer?.phone || String(body.phone || "").trim(),
      email: customer?.email || String(body.email || "").trim(),
      invoiceNumber: body.invoiceNumber || generateInvoiceNumber(),
      description: String(body.description || "Invoice payment").trim() || "Invoice payment",
      amount,
      items: items.length ? items : sanitizeInvoiceItems([
        {
          description: String(body.description || "Invoice payment"),
          quantity: Number(body.quantity || 1),
          unitPrice: amount,
        },
      ]),
      paidAmount: 0,
      balanceDue: amount,
      status: "Unpaid",
      paymentStatus: "unpaid",
      category: customer?.category || String(body.category || "").trim(),
      token: invoiceToken,
      customerNotificationStatus: body.phone || customer?.phone ? "draft" : "unavailable",
      date: body.date || new Date().toISOString(),
      dueDate: body.dueDate || "",
      createdAt: new Date(),
      createdByUserId: context.user._id,
      createdByName: context.user.fullName || context.user.email,
    };

    const insert = await db.collection("invoices").insertOne(invoice);

    await logUserActivity(db, {
      ownerId: context.ownerId,
      actorUserId: context.user._id,
      actorName: context.user.fullName || context.user.email,
      actorAccountType: context.user.accountType,
      businessId,
      businessName:
        context.businesses.find((business) => business._id === businessId)?.name ||
        context.primaryBusiness?.name ||
        "",
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
      device: req.headers.get("user-agent") || "",
      action: "Invoice Created",
      description: `${context.user.fullName || "Staff"} created invoice ${invoice.invoiceNumber}.`,
    });

    return Response.json({
      success: true,
      invoice: {
        ...invoice,
        _id: String(insert.insertedId),
      },
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to create invoice" },
      { status: error.status || 500 }
    );
  }
}
