import { connectDB } from "../../../../../../lib/mongodb";
import { findUserById } from "../../../../../../lib/paymentGatewaySettings";

function buildCustomerPayload(record = {}, owner = null) {
  return {
    name: record.customer || record.customerName || record.student || record.name,
    phone: record.phone || "",
    email: record.email || "",
    businessName: record.businessName || "",
    defaultPaymentGateway: owner?.defaultPaymentGateway || "monnify",
    token: record.customerToken || record.token || "",
  };
}

export async function GET(req, context) {
  try {
    const { token } = await context.params;
    const db = await connectDB();

    const baseInvoice = await db.collection("invoices").findOne({ token });

    if (baseInvoice) {
      const owner = baseInvoice.ownerId ? await findUserById(db, baseInvoice.ownerId) : null;
      const matchQuery = baseInvoice.customerToken
        ? { customerToken: baseInvoice.customerToken }
        : { token: baseInvoice.token };

      const allInvoices = await db
        .collection("invoices")
        .find(matchQuery)
        .sort({ date: -1 })
        .toArray();

      return Response.json({
        customer: buildCustomerPayload(baseInvoice, owner),
        invoices: allInvoices,
      });
    }

    const customer = await db.collection("customers").findOne({ token });

    if (!customer) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    const owner = customer.ownerId ? await findUserById(db, customer.ownerId) : null;
    const allInvoices = await db
      .collection("invoices")
      .find({ customerToken: customer.token })
      .sort({ date: -1 })
      .toArray();

    return Response.json({
      customer: buildCustomerPayload(customer, owner),
      invoices: allInvoices,
    });
  } catch (error) {
    console.error("FETCH CUSTOMER INVOICES ERROR:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
