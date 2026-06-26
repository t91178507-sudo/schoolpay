import { connectDB } from "../../../../../../lib/mongodb";

function buildCustomerPayload(record = {}) {
  return {
    name: record.customer || record.customerName || record.student || record.name,
    phone: record.phone || "",
    email: record.email || "",
    businessName: record.businessName || "",
    token: record.customerToken || record.token || "",
  };
}

export async function GET(req, context) {
  try {
    const { token } = await context.params;
    const db = await connectDB();

    const baseInvoice = await db.collection("invoices").findOne({ token });

    if (baseInvoice) {
      const matchQuery = baseInvoice.customerToken
        ? { customerToken: baseInvoice.customerToken }
        : { token: baseInvoice.token };

      const allInvoices = await db
        .collection("invoices")
        .find(matchQuery)
        .sort({ date: -1 })
        .toArray();

      return Response.json({
        customer: buildCustomerPayload(baseInvoice),
        invoices: allInvoices,
      });
    }

    const customer = await db.collection("customers").findOne({ token });

    if (!customer) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    const allInvoices = await db
      .collection("invoices")
      .find({ customerToken: customer.token })
      .sort({ date: -1 })
      .toArray();

    return Response.json({
      customer: buildCustomerPayload(customer),
      invoices: allInvoices,
    });
  } catch (error) {
    console.error("FETCH CUSTOMER INVOICES ERROR:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
