import { connectDB } from "../../../lib/mongodb";

// ✅ GET ALL CUSTOMERS
export async function GET() {
  try {
    const db = await connectDB();

    const customers = await db
      .collection("customers")
      .find({})
      .toArray();

    return Response.json(customers);

  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);

    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(req, context) {
  try {
    const { id } = await context.params;

    const db = await connectDB();

    const result = await db.collection("customers").deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return Response.json({ error: "Customer not found" }, { status: 404 });
    }

    return Response.json({ message: "Deleted ✅" });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}


// ✅ CREATE CUSTOMER
export async function POST(request) {
  try {
    const db = await connectDB();
    const data = await request.json();

    const result = await db.collection("customers").insertOne({
      ...data,
      createdAt: new Date(),
    });

    return Response.json({
      message: "Customer created ✅",
      id: result.insertedId,
    });

  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error);

    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}