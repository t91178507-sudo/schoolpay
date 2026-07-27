import { ObjectId } from "mongodb";
import { requireAdmin } from "../../../../../../lib/adminAuth";
import { decryptVerificationDocument } from "../../../../../../lib/businessVerification";
import { connectDB } from "../../../../../../lib/mongodb";

export async function GET(req, context) {
  try {
    requireAdmin(req);
    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }

    const db = await connectDB();
    const document = await db
      .collection("businessVerificationDocuments")
      .findOne({ _id: new ObjectId(id) });
    if (!document) {
      return Response.json({ error: "Document not found." }, { status: 404 });
    }

    const buffer = decryptVerificationDocument(document);
    return new Response(buffer, {
      headers: {
        "Content-Type": document.contentType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${String(document.fileName || "document").replace(/"/g, "")}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Unable to open document" },
      { status: error.status || 500 }
    );
  }
}
