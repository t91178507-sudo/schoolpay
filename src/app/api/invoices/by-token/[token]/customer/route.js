import { connectDB } from "../../../../../../lib/mongodb";

// ✅ Given one invoice's token, find ALL invoices belonging to the
// same customer. Matched by customerToken — a stable reference to
// the customer's own token, saved on every invoice at creation time.
// This avoids unreliable matching by phone number or name.
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

    // Match by customerToken if present (reliable, stable link).
    // Fall back to matching just this single invoice by its own
    // token if customerToken is missing (e.g. older invoices
    // created before this field existed).
    const matchQuery = baseInvoice.customerToken
      ? { customerToken: baseInvoice.customerToken }
      : { token: baseInvoice.token };

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