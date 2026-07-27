import { ObjectId } from "mongodb";
import { connectDB } from "../../../../../../lib/mongodb";
import { findAccessibleInvoice } from "../../../../../../lib/publicInvoiceAccess";
import { buildInvoicePdf } from "../../../../../../lib/invoicePdf";

export async function GET(req, context) {
  try {
    const { token } = await context.params;
    const db = await connectDB();
    const invoice = await findAccessibleInvoice(db, { token });

    if (!invoice) {
      return new Response(JSON.stringify({ error: "Invoice not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const ownerId = invoice.ownerId;
    let owner = {};

    if (ownerId && ObjectId.isValid(String(ownerId))) {
      owner = await db.collection("users").findOne({ _id: new ObjectId(String(ownerId)) });
    }

    const pdfBuffer = buildInvoicePdf({ invoice, owner, origin: req.headers.get("origin") || "" });
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice-${String(invoice.invoiceNumber || invoice._id || "invoice").replace(/[^a-zA-Z0-9._-]/g, "-")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("INVOICE PDF ERROR:", error);
    return new Response(JSON.stringify({ error: error.message || "Unable to generate invoice PDF" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
