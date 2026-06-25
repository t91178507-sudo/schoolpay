import { connectDB } from "../../../../../../lib/mongodb";

// ✅ Given one invoice's token, find ALL invoices belonging to the
// same customer (matched by phone number, since that's the most
// reliable shared field between invoices for the same person).
export async function GET(req, context) {
  try {
    const { token } = await context.params;

    const db = await connectDB();

    const baseInvoice = await db.collection("invoices").findOne({ token });

    if (!baseInvoice) {
      return Response.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Match by phone number — the most reliable shared identifier
    // between invoices for the same customer in this data model.
    const matchQuery = baseInvoice.phone
      ? { phone: baseInvoice.phone }
      : { student: baseInvoice.student };

    const allInvoices = await db
      .collection("invoices")
      .find(matchQuery)
      .sort({ date: -1 })
      .toArray();

    return Response.json({
      customer: {
        name: baseInvoice.student || baseInvoice.customer,
        phone: baseInvoice.phone,
        businessName: baseInvoice.businessName,
      },
      invoices: allInvoices,
    });

  } catch (error) {
    console.error("FETCH CUSTOMER INVOICES ERROR:", error);

    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}