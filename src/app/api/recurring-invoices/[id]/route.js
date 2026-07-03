import { ObjectId } from "mongodb";
import { requireAuth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/mongodb";

export async function DELETE(req, context) {
  try {
    const userId = requireAuth(req);
    const { id } = await context.params;
    const db = await connectDB();

    await db.collection("recurringInvoices").deleteOne({
      _id: new ObjectId(id),
      ownerId: userId,
    });

    return Response.json({ success: true });
  } catch (error) {
    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Unable to delete recurring invoice" },
      { status }
    );
  }
}
