import { connectDB } from "../../../../../lib/mongodb";
import {
  findAccessibleInvoice,
  serializePublicInvoice,
} from "../../../../../lib/publicInvoiceAccess";

export async function GET(req, context) {
  try {
    const { token } = await context.params;
    const db = await connectDB();
    const invoice = await findAccessibleInvoice(db, { token });

    if (!invoice) {
      return Response.json({ error: "Invoice not found" }, { status: 404 });
    }

    return Response.json(serializePublicInvoice(invoice));
  } catch (error) {
    console.error("FETCH INVOICE ERROR:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
