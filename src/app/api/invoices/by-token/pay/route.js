import { connectDB } from "../../../../../../lib/mongodb";

export async function POST(req, { params }) {
  try {
    const db = await connectDB();

    await db.collection("invoices").updateOne(
      { token: params.token },
      { $set: { status: "Paid" } }
    );

    return Response.json({ message: "Marked as paid ✅" });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}