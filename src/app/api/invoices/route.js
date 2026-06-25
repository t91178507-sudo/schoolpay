import { connectDB } from "../../../lib/mongodb";

// ✅ GET ALL INVOICES
export async function GET() {
  try {
    const db = await connectDB();
    const invoices = await db
      .collection("invoices")
      .find({})
      .sort({ date: -1 })
      .toArray();

    return Response.json(invoices);
  } catch (error) {
    console.error("GET Invoices Error:", error);
    return Response.json([], { status: 200 });
  }
}

// ✅ CREATE INVOICE
export async function POST(request) {
  try {
    const db = await connectDB();
    const data = await request.json();

    const invoice = await db.collection("invoices").insertOne({
      ...data,
      createdAt: new Date(),
    });

    return Response.json(
      {
        ...data,
        _id: invoice.insertedId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST Invoice Error:", error);
    return Response.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}