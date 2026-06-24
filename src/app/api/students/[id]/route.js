import { connectDB } from "../../../../lib/mongodb";
``
import { ObjectId } from "mongodb";

// ✅ DELETE STUDENT
export async function DELETE(req, context) {
  try {
    const { id } = await context.params;

    const db = await connectDB();

    const result = await db.collection("students").deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return Response.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    return Response.json({
      message: "Student deleted ✅",
    });

  } catch (error) {
    console.error("DELETE STUDENT ERROR:", error);

    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}