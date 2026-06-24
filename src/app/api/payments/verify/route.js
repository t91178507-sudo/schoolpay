import { connectDB } from "../../../../lib/mongodb";
import Invoice from "../../../../models/Invoice";

export async function POST(req) {
  await connectDB();                    // ← Fixed

  try {
    const { token } = await req.json();

    const updated = await Invoice.findOneAndUpdate(
      { token },
      { status: "Paid" },
      { new: true }
    );

    return Response.json(updated);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}