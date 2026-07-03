import { connectDB } from "../../../lib/mongodb";
import { requireAuth, touchLastActive } from "../../../lib/auth";

// ✅ GET ALL CUSTOMERS — only the ones belonging to the logged-in user
export async function GET(req) {
  try {
    const userId = requireAuth(req);

    const db = await connectDB();
    touchLastActive(db, userId);

    const customers = await db
      .collection("customers")
      .find({ ownerId: userId })
      .toArray();

    return Response.json(customers);

  } catch (error) {
    console.error("GET CUSTOMERS ERROR:", error);

    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Server error" },
      { status }
    );
  }
}

// ✅ CREATE CUSTOMER — tagged with the logged-in user's ID
export async function POST(req) {
  try {
    const userId = requireAuth(req);

    const db = await connectDB();
    const body = await req.json();
    const name = String(body.name || "").trim().toUpperCase();

    const result = await db.collection("customers").insertOne({
      ...body,
      name,
      ownerId: userId,
      createdAt: new Date(),
    });

    return Response.json({
      success: true,
      insertedId: result.insertedId,
    });

  } catch (error) {
    console.error("CREATE CUSTOMER ERROR:", error);

    const status = error.status || 500;
    return Response.json(
      { error: error.message || "Server error" },
      { status }
    );
  }
}
