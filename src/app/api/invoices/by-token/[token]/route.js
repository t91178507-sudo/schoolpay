import { connectDB } from "../../../../../lib/mongodb";
import { isBusinessVerified } from "../../../../../lib/businessVerification";
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

    const business = await db.collection("businesses").findOne({ ownerId: String(invoice.ownerId || ""), active: { $ne: false } });
    return Response.json({ ...serializePublicInvoice(invoice), businessVerified: isBusinessVerified(business || {}), businessVerificationStatus: business?.verificationStatus || "" });
  } catch (error) {
    console.error("FETCH INVOICE ERROR:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
