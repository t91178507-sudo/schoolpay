import { connectDB } from "../../../../lib/mongodb";
``

// ✅ GET ALL FEES
export async function GET() {
  try {
    const db = await connectDB();

    const fees = await db
      .collection("fees")
      .find({})
      .toArray();

    return Response.json(fees);

  } catch (error) {
    console.error("GET FEES ERROR:", error);

    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}


// ✅ CREATE OR UPDATE FEES
export async function POST(request) {
  try {
    const db = await connectDB();
    const data = await request.json();

    // Expected:
    // { className: "Primary 1", amount: 50000 }

    if (!data.className || !data.amount) {
      return Response.json(
        { error: "className and amount required" },
        { status: 400 }
      );
    }

    // ✅ Upsert (create if not exists, update if exists)
    const result = await db.collection("fees").updateOne(
      { className: data.className },
      {
        $set: {
          amount: Number(data.amount),
          updatedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return Response.json({
      message: "Fee saved ✅",
    });

  } catch (error) {
    console.error("SAVE FEES ERROR:", error);

    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}