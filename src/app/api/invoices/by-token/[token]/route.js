import { connectDB } from "../../../../../lib/mongodb";

// ✅ GET INVOICE BY TOKEN
export async function GET(req, context) {
  try {
    // ✅ unwrap params properly
    const { token } = await context.params;

    const db = await connectDB();

    const invoice = await db.collection("invoices").findOne({
      token: token,
    });

    if (!invoice) {
      return Response.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    return Response.json(invoice);

  } catch (error) {
    console.error("FETCH INVOICE ERROR:", error);

    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
``