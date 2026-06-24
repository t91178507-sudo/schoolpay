import { connectDB } from "../../../../lib/mongodb";
import { ObjectId } from "mongodb";

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return Response.json({ error: "Customer ID is required" }, { status: 400 });
    }

    if (!ObjectId.isValid(id)) {
      return Response.json({ error: "Invalid Customer ID" }, { status: 400 });
    }

    const db = await connectDB();

    const result = await db.collection("customers").deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return Response.json({ error: "Customer not found" }, { status: 404 });
    }

    return Response.json({ 
      success: true, 
      message: "Customer deleted successfully" 
    });

  } catch (error) {
    console.error("DELETE Customer ERROR:", error);
    return Response.json({ 
      error: "Failed to delete customer" 
    }, { status: 500 });
  }
}